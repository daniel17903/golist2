import crypto from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'

import { runMigrations } from './db/migrate.js'
import { buildServer } from './server.js'

const testDeviceId = '11111111-1111-4111-8111-111111111111'

let baseUrl = ''
let app: ReturnType<typeof buildServer>

const createShareTokenForList = async (listId: string, deviceId: string) => {
  const response = await fetch(`${baseUrl}/v1/lists/${listId}/share-tokens`, {
    method: 'POST',
    headers: { 'x-device-id': deviceId },
  })

  expect(response.status).toBe(201)

  return z
    .object({ tokenId: z.string().uuid(), listId: z.string().uuid(), shareToken: z.string().uuid() })
    .parse(await response.json())
}

describe('backend runtime integration (real postgres)', () => {
  beforeAll(async () => {
    await runMigrations()

    app = buildServer()
    await app.listen({ host: '127.0.0.1', port: 0 })

    const address = app.server.address()

    if (!address || typeof address === 'string') {
      throw new Error('Failed to resolve server address for integration test')
    }

    baseUrl = `http://127.0.0.1:${address.port}`
  })

  afterAll(async () => {
    await app.close()
  })

  it('serves health and handles list lifecycle endpoints against real DB', async () => {
    const healthResponse = await fetch(`${baseUrl}/health`)

    expect(healthResponse.status).toBe(200)
    expect(await healthResponse.json()).toEqual({ status: 'ok' })

    const listId = crypto.randomUUID()
    const createResponse = await fetch(`${baseUrl}/v1/lists/${listId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-device-id': testDeviceId },
      body: JSON.stringify({ name: 'Integration Test List' }),
    })

    expect(createResponse.status).toBe(201)

    const createPayload = z.object({ listId: z.string().uuid() }).parse(await createResponse.json())

    expect(createPayload.listId).toBe(listId)

    const initialToken = await createShareTokenForList(createPayload.listId, testDeviceId)

    const authHeaders = { authorization: `Bearer ${initialToken.shareToken}`, 'x-device-id': testDeviceId }

    const redeemResponse = await fetch(
      `${baseUrl}/v1/share-tokens/${initialToken.shareToken}/redeem`,
      {
        method: 'POST',
        headers: authHeaders,
      },
    )

    expect(redeemResponse.status).toBe(200)

    const redeemPayload = z.object({ listId: z.string().uuid() }).parse(await redeemResponse.json())

    const listResponse = await fetch(`${baseUrl}/v1/lists/${redeemPayload.listId}`, {
      headers: authHeaders,
    })

    expect(listResponse.status).toBe(200)
    expect(await listResponse.json()).toEqual(
      expect.objectContaining({
        name: 'Integration Test List',
        items: [],
      }),
    )
  })

  it('creates items via PUT and enforces deterministic LWW tie-break conflicts', async () => {
    const listId = crypto.randomUUID()
    const createResponse = await fetch(`${baseUrl}/v1/lists/${listId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-device-id': testDeviceId },
      body: JSON.stringify({ name: 'Conflict List' }),
    })

    expect(createResponse.status).toBe(201)

    const createPayload = z.object({ listId: z.string().uuid() }).parse(await createResponse.json())

    const initialToken = await createShareTokenForList(createPayload.listId, testDeviceId)

    const authHeaders = { authorization: `Bearer ${initialToken.shareToken}`, 'x-device-id': testDeviceId }

    const redeemResponse = await fetch(
      `${baseUrl}/v1/share-tokens/${initialToken.shareToken}/redeem`,
      {
        method: 'POST',
        headers: authHeaders,
      },
    )

    expect(redeemResponse.status).toBe(200)

    const itemId = crypto.randomUUID()
    const createItemTimestamp = new Date().toISOString()

    const createItemResponse = await fetch(
      `${baseUrl}/v1/lists/${createPayload.listId}/items/${itemId}`,
      {
        method: 'PUT',
        headers: {
          ...authHeaders,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Milk',
          quantityOrUnit: '1L',
          category: 'dairy',
          deleted: false,
          updatedAt: createItemTimestamp,
        }),
      },
    )

    expect(createItemResponse.status).toBe(201)

    const baselineItemResponse = await fetch(
      `${baseUrl}/v1/lists/${createPayload.listId}/items/${itemId}`,
      {
        headers: authHeaders,
      },
    )

    expect(baselineItemResponse.status).toBe(200)

    const baselineItem = z
      .object({
        id: z.string().uuid(),
        updatedAt: z.string().datetime(),
      })
      .parse(await baselineItemResponse.json())

    const sameTimestamp = new Date(Date.parse(baselineItem.updatedAt) + 60_000).toISOString()

    const [largerTieBreakUpdateResponse, smallerTieBreakUpdateResponse] = await Promise.all([
      fetch(`${baseUrl}/v1/lists/${createPayload.listId}/items/${itemId}`, {
        method: 'PUT',
        headers: {
          ...authHeaders,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Yogurt',
          quantityOrUnit: '2',
          category: 'dairy',
          deleted: false,
          updatedAt: sameTimestamp,
        }),
      }),
      fetch(`${baseUrl}/v1/lists/${createPayload.listId}/items/${itemId}`, {
        method: 'PUT',
        headers: {
          ...authHeaders,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Apple',
          quantityOrUnit: '5',
          category: 'produce',
          deleted: false,
          updatedAt: sameTimestamp,
        }),
      }),
    ])

    expect(largerTieBreakUpdateResponse.status).toBe(204)
    expect(smallerTieBreakUpdateResponse.status).toBe(204)

    const itemResponse = await fetch(`${baseUrl}/v1/lists/${createPayload.listId}/items/${itemId}`, {
      headers: authHeaders,
    })

    expect(itemResponse.status).toBe(200)
    expect(await itemResponse.json()).toEqual(
      expect.objectContaining({
        id: itemId,
        name: 'Yogurt',
        quantityOrUnit: '2',
        category: 'dairy',
        deleted: false,
        updatedAt: sameTimestamp,
      }),
    )
  })

  it('forbids putting an existing list without a valid access token', async () => {
    const listId = crypto.randomUUID()

    const createResponse = await fetch(`${baseUrl}/v1/lists/${listId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-device-id': testDeviceId },
      body: JSON.stringify({ name: 'Owned List' }),
    })

    expect(createResponse.status).toBe(201)

    const intruderDeviceId = '22222222-2222-4222-8222-222222222222'
    const forbiddenUpdateResponse = await fetch(`${baseUrl}/v1/lists/${listId}`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-device-id': intruderDeviceId,
      },
      body: JSON.stringify({ name: 'Should Fail' }),
    })

    expect(forbiddenUpdateResponse.status).toBe(403)
  })

  it('completes share-token creation and redemption across multiple devices', async () => {
    const ownerDeviceId = '33333333-3333-4333-8333-333333333333'
    const guestDeviceId = '44444444-4444-4444-8444-444444444444'
    const secondGuestDeviceId = '55555555-5555-4555-8555-555555555555'
    const listId = crypto.randomUUID()

    const createResponse = await fetch(`${baseUrl}/v1/lists/${listId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-device-id': ownerDeviceId },
      body: JSON.stringify({ name: 'Token Flow List' }),
    })

    expect(createResponse.status).toBe(201)

    const createdList = z.object({ listId: z.string().uuid() }).parse(await createResponse.json())

    const primaryToken = await createShareTokenForList(createdList.listId, ownerDeviceId)

    const unredeemedGuestHeaders = {
      authorization: `Bearer ${primaryToken.shareToken}`,
      'x-device-id': guestDeviceId,
    }

    const unredeemedGuestListResponse = await fetch(`${baseUrl}/v1/lists/${createdList.listId}`, {
      headers: unredeemedGuestHeaders,
    })

    expect(unredeemedGuestListResponse.status).toBe(403)

    const redeemPrimaryTokenResponse = await fetch(
      `${baseUrl}/v1/share-tokens/${primaryToken.shareToken}/redeem`,
      {
        method: 'POST',
        headers: unredeemedGuestHeaders,
      },
    )

    expect(redeemPrimaryTokenResponse.status).toBe(200)

    const primaryRedeemPayload = z.object({ listId: z.string().uuid() }).parse(await redeemPrimaryTokenResponse.json())

    const redeemedGuestListResponse = await fetch(`${baseUrl}/v1/lists/${primaryRedeemPayload.listId}`, {
      headers: unredeemedGuestHeaders,
    })

    expect(redeemedGuestListResponse.status).toBe(200)

    const secondaryToken = await createShareTokenForList(createdList.listId, guestDeviceId)

    expect(secondaryToken.listId).toBe(listId)
    expect(secondaryToken.shareToken).toBe(secondaryToken.tokenId)

    const secondGuestHeaders = {
      authorization: `Bearer ${secondaryToken.shareToken}`,
      'x-device-id': secondGuestDeviceId,
    }

    const secondUnredeemedListResponse = await fetch(`${baseUrl}/v1/lists/${secondaryToken.listId}`, {
      headers: secondGuestHeaders,
    })

    expect(secondUnredeemedListResponse.status).toBe(403)

    const redeemSecondaryTokenResponse = await fetch(
      `${baseUrl}/v1/share-tokens/${secondaryToken.shareToken}/redeem`,
      {
        method: 'POST',
        headers: secondGuestHeaders,
      },
    )

    expect(redeemSecondaryTokenResponse.status).toBe(200)

    const secondaryRedeemPayload = z.object({ listId: z.string().uuid() }).parse(await redeemSecondaryTokenResponse.json())

    const secondRedeemedListResponse = await fetch(`${baseUrl}/v1/lists/${secondaryRedeemPayload.listId}`, {
      headers: secondGuestHeaders,
    })

    expect(secondRedeemedListResponse.status).toBe(200)
  })
})
