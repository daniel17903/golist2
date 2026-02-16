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
    const createResponse = await fetch(`${baseUrl}/v1/lists?deviceId=${testDeviceId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ listId, name: 'Integration Test List' }),
    })

    expect(createResponse.status).toBe(201)

    const createPayload = z
      .object({ listId: z.string().uuid(), shareToken: z.string().uuid() })
      .parse(await createResponse.json())

    expect(createPayload.listId).toBe(listId)

    const authHeaders = { authorization: `Bearer ${createPayload.shareToken}` }

    const redeemResponse = await fetch(
      `${baseUrl}/v1/share-tokens/${createPayload.shareToken}/redeem?deviceId=${testDeviceId}`,
      {
        method: 'POST',
        headers: authHeaders,
      },
    )

    expect(redeemResponse.status).toBe(204)

    const listResponse = await fetch(`${baseUrl}/v1/lists/${createPayload.shareToken}?deviceId=${testDeviceId}`, {
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
    const createResponse = await fetch(`${baseUrl}/v1/lists?deviceId=${testDeviceId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ listId, name: 'Conflict List' }),
    })

    expect(createResponse.status).toBe(201)

    const createPayload = z
      .object({ listId: z.string().uuid(), shareToken: z.string().uuid() })
      .parse(await createResponse.json())

    const authHeaders = { authorization: `Bearer ${createPayload.shareToken}` }

    const redeemResponse = await fetch(
      `${baseUrl}/v1/share-tokens/${createPayload.shareToken}/redeem?deviceId=${testDeviceId}`,
      {
        method: 'POST',
        headers: authHeaders,
      },
    )

    expect(redeemResponse.status).toBe(204)

    const itemId = crypto.randomUUID()
    const createItemTimestamp = new Date().toISOString()

    const createItemResponse = await fetch(
      `${baseUrl}/v1/lists/${createPayload.shareToken}/items/${itemId}?deviceId=${testDeviceId}`,
      {
        method: 'PUT',
        headers: {
          ...authHeaders,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Milk',
          category: 'dairy',
          deleted: false,
          updatedAt: createItemTimestamp,
        }),
      },
    )

    expect(createItemResponse.status).toBe(201)

    const baselineItemResponse = await fetch(
      `${baseUrl}/v1/lists/${createPayload.shareToken}/items/${itemId}?deviceId=${testDeviceId}`,
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
      fetch(`${baseUrl}/v1/lists/${createPayload.shareToken}/items/${itemId}?deviceId=${testDeviceId}`, {
        method: 'PUT',
        headers: {
          ...authHeaders,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ name: 'Yogurt', category: 'dairy', deleted: false, updatedAt: sameTimestamp }),
      }),
      fetch(`${baseUrl}/v1/lists/${createPayload.shareToken}/items/${itemId}?deviceId=${testDeviceId}`, {
        method: 'PUT',
        headers: {
          ...authHeaders,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ name: 'Apple', category: 'produce', deleted: false, updatedAt: sameTimestamp }),
      }),
    ])

    expect(largerTieBreakUpdateResponse.status).toBe(204)
    expect(smallerTieBreakUpdateResponse.status).toBe(204)

    const itemResponse = await fetch(`${baseUrl}/v1/lists/${createPayload.shareToken}/items/${itemId}?deviceId=${testDeviceId}`, {
      headers: authHeaders,
    })

    expect(itemResponse.status).toBe(200)
    expect(await itemResponse.json()).toEqual(
      expect.objectContaining({
        id: itemId,
        name: 'Yogurt',
        category: 'dairy',
        deleted: false,
        updatedAt: sameTimestamp,
      }),
    )
  })
})
