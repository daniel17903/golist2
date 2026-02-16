import crypto from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'

import { runMigrations } from './db/migrate.js'
import { buildServer } from './server.js'

const testDeviceId = '11111111-1111-4111-8111-111111111111'

let baseUrl = ''
let app: ReturnType<typeof buildServer>

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
    const createResponse = await fetch(`${baseUrl}/v1/lists`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-device-id': testDeviceId },
      body: JSON.stringify({ listId, name: 'Integration Test List' }),
    })

    expect(createResponse.status).toBe(201)

    const createPayload = z
      .object({ listId: z.string().uuid(), shareToken: z.string().uuid() })
      .parse(await createResponse.json())

    expect(createPayload.listId).toBe(listId)

    const authHeaders = { authorization: `Bearer ${createPayload.shareToken}`, 'x-device-id': testDeviceId }

    const redeemResponse = await fetch(
      `${baseUrl}/v1/share-tokens/${createPayload.shareToken}/redeem`,
      {
        method: 'POST',
        headers: authHeaders,
      },
    )

    expect(redeemResponse.status).toBe(204)

    const listResponse = await fetch(`${baseUrl}/v1/lists/${createPayload.shareToken}`, {
      headers: authHeaders,
    })

    expect(listResponse.status).toBe(200)
    expect(await listResponse.json()).toEqual(
      expect.objectContaining({
        listId,
        name: 'Integration Test List',
        items: [],
      }),
    )
  })

  it('creates items via PUT and enforces deterministic LWW tie-break conflicts', async () => {
    const listId = crypto.randomUUID()
    const createResponse = await fetch(`${baseUrl}/v1/lists`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-device-id': testDeviceId },
      body: JSON.stringify({ listId, name: 'Conflict List' }),
    })

    expect(createResponse.status).toBe(201)

    const createPayload = z
      .object({ listId: z.string().uuid(), shareToken: z.string().uuid() })
      .parse(await createResponse.json())

    const authHeaders = { authorization: `Bearer ${createPayload.shareToken}`, 'x-device-id': testDeviceId }

    const redeemResponse = await fetch(
      `${baseUrl}/v1/share-tokens/${createPayload.shareToken}/redeem`,
      {
        method: 'POST',
        headers: authHeaders,
      },
    )

    expect(redeemResponse.status).toBe(204)

    const itemId = crypto.randomUUID()
    const createItemTimestamp = new Date().toISOString()

    const createItemResponse = await fetch(
      `${baseUrl}/v1/lists/${createPayload.shareToken}/items/${itemId}`,
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
      `${baseUrl}/v1/lists/${createPayload.shareToken}/items/${itemId}`,
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
      fetch(`${baseUrl}/v1/lists/${createPayload.shareToken}/items/${itemId}`, {
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
      fetch(`${baseUrl}/v1/lists/${createPayload.shareToken}/items/${itemId}`, {
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

    const itemResponse = await fetch(`${baseUrl}/v1/lists/${createPayload.shareToken}/items/${itemId}`, {
      headers: authHeaders,
    })

    expect(itemResponse.status).toBe(200)
    expect(await itemResponse.json()).toEqual(
      expect.objectContaining({
        id: itemId,
        listId,
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

    const createResponse = await fetch(`${baseUrl}/v1/lists`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-device-id': testDeviceId },
      body: JSON.stringify({ listId, name: 'Owned List' }),
    })

    expect(createResponse.status).toBe(201)

    const intruderDeviceId = '22222222-2222-4222-8222-222222222222'
    const forbiddenUpdateResponse = await fetch(`${baseUrl}/v1/lists`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-device-id': intruderDeviceId,
      },
      body: JSON.stringify({ listId, name: 'Should Fail' }),
    })

    expect(forbiddenUpdateResponse.status).toBe(403)
  })
})
