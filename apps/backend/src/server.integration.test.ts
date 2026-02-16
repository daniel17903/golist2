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

    const createResponse = await fetch(`${baseUrl}/v1/lists?deviceId=${testDeviceId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Integration Test List' }),
    })

    expect(createResponse.status).toBe(201)

    const createPayload = z
      .object({ listId: z.string().uuid(), shareToken: z.string().uuid() })
      .parse(await createResponse.json())

    expect(createPayload.listId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
    expect(createPayload.shareToken).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )

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
        listId: createPayload.listId,
        name: 'Integration Test List',
        items: [],
      }),
    )
  })
})
