import crypto from 'node:crypto'

import { type InjectOptions } from 'fastify'
import { afterEach, describe, expect, it } from 'vitest'
import { z } from 'zod'

import { buildServer, type BuildServerOptions } from './server.js'
import { InMemoryListRepository } from './test/in-memory-list-repository.js'
import { checkResponsesAgainstSpec } from './test/openapi-spec.js'

// Every response in these tests must also match apps/api-spec/openapi.yaml.
let specViolations: string[][] = []

function buildSpecCheckedServer(options: BuildServerOptions) {
  const app = buildServer(options)
  specViolations.push(checkResponsesAgainstSpec(app).violations)
  return app
}

afterEach(() => {
  const violations = specViolations.flat()
  specViolations = []
  expect(violations).toEqual([])
})

describe('sharing API contract basics', () => {
  it('allows a client to create a new list using a self-generated list id via PUT', async () => {
    const app = buildSpecCheckedServer({ listRepository: new InMemoryListRepository() })
    const listId = crypto.randomUUID()

    const createResponse = await app.inject({
      method: 'PUT',
      url: `/v1/lists/${listId}`,
      headers: { 'x-device-id': '11111111-1111-4111-8111-111111111111' },
      payload: { name: 'Client Generated Id List' },
    })

    expect(createResponse.statusCode).toBe(201)
    expect(createResponse.json()).toEqual({ listId })

    const fetchResponse = await app.inject({
      method: 'GET',
      url: `/v1/lists/${listId}`,
      headers: { 'x-device-id': '11111111-1111-4111-8111-111111111111' },
    })

    expect(fetchResponse.statusCode).toBe(200)
    expect(fetchResponse.json()).toEqual(
      expect.objectContaining({
        listId,
        name: 'Client Generated Id List',
      }),
    )

    await app.close()
  })

  it('creates a list and returns listId', async () => {
    const app = buildSpecCheckedServer({ listRepository: new InMemoryListRepository() })

    const response = await app.inject({
      method: 'PUT',
      url: '/v1/lists/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      headers: { 'x-device-id': '11111111-1111-4111-8111-111111111111' },
      payload: { name: 'Groceries' },
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toEqual(expect.objectContaining({ listId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }))

    await app.close()
  })

  it('rejects putting an existing list without required X-Device-Id header', async () => {
    const app = buildSpecCheckedServer({ listRepository: new InMemoryListRepository() })

    await app.inject({
      method: 'PUT',
      url: '/v1/lists/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      headers: { 'x-device-id': '11111111-1111-4111-8111-111111111111' },
      payload: { name: 'Groceries' },
    })

    const response = await app.inject({
      method: 'PUT',
      url: '/v1/lists/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      payload: { name: 'Groceries' },
    })

    expect(response.statusCode).toBe(400)

    await app.close()
  })

  it('requires X-Device-Id header for protected routes', async () => {
    const app = buildSpecCheckedServer({ listRepository: new InMemoryListRepository() })

    const response = await app.inject({ method: 'GET', url: '/v1/lists/11111111-1111-4111-8111-111111111111' })

    expect(response.statusCode).toBe(400)

    await app.close()
  })

  it('forbids devices without list access on protected routes', async () => {
    const repository = new InMemoryListRepository()
    const app = buildSpecCheckedServer({ listRepository: repository })

    await app.inject({
      method: 'PUT',
      url: '/v1/lists/11111111-1111-4111-8111-111111111111',
      headers: { 'x-device-id': '11111111-1111-4111-8111-111111111111' },
      payload: { name: 'Private List' },
    })

    const response = await app.inject({
      method: 'GET',
      url: '/v1/lists/11111111-1111-4111-8111-111111111111',
      headers: { 'x-device-id': '22222222-2222-4222-8222-222222222222' },
    })

    expect(response.statusCode).toBe(403)

    await app.close()
  })

  it('allows list item updates for the list creator without a redemption record', async () => {
    const repository = new InMemoryListRepository()
    const app = buildSpecCheckedServer({ listRepository: repository })

    await app.inject({
      method: 'PUT',
      url: '/v1/lists/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      headers: { 'x-device-id': '11111111-1111-4111-8111-111111111111' },
      payload: { name: 'Groceries' },
    })

    const response = await app.inject({
      method: 'PUT',
      url: '/v1/lists/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/items/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      headers: {
        'x-device-id': '11111111-1111-4111-8111-111111111111',
      },
      payload: {
        name: 'Milk',
        category: 'dairy',
        deleted: false,
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    })

    expect(response.statusCode).toBe(201)

    await app.close()
  })


  it('accepts item updatedAt values with explicit UTC offsets', async () => {
    const repository = new InMemoryListRepository()
    const app = buildSpecCheckedServer({ listRepository: repository })

    await app.inject({
      method: 'PUT',
      url: '/v1/lists/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      headers: { 'x-device-id': '11111111-1111-4111-8111-111111111111' },
      payload: { name: 'Groceries' },
    })

    const response = await app.inject({
      method: 'PUT',
      url: '/v1/lists/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/items/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
      headers: {
        'x-device-id': '11111111-1111-4111-8111-111111111111',
      },
      payload: {
        name: 'Apples',
        deleted: false,
        updatedAt: '2026-02-26T21:02:36.191600+00:00',
      },
    })

    expect(response.statusCode).toBe(201)

    await app.close()
  })

  it('auto-assigns category from item name when category is omitted and defaults language to en', async () => {
    const repository = new InMemoryListRepository()
    const app = buildSpecCheckedServer({ listRepository: repository })

    await app.inject({
      method: 'PUT',
      url: '/v1/lists/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      headers: { 'x-device-id': '11111111-1111-4111-8111-111111111111' },
      payload: { name: 'Groceries' },
    })

    const response = await app.inject({
      method: 'PUT',
      url: '/v1/lists/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/items/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbc',
      headers: {
        'x-device-id': '11111111-1111-4111-8111-111111111111',
      },
      payload: {
        name: 'Milk',
        deleted: false,
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    })

    expect(response.statusCode).toBe(201)

    const itemResponse = await app.inject({
      method: 'GET',
      url: '/v1/lists/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/items/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbc',
      headers: {
        'x-device-id': '11111111-1111-4111-8111-111111111111',
      },
    })

    expect(itemResponse.statusCode).toBe(200)
    expect(itemResponse.json()).toEqual(expect.objectContaining({ category: 'milkCheese', iconName: 'tetrapack' }))

    await app.close()
  })

  it('auto-assigns category using the provided language when category is omitted', async () => {
    const repository = new InMemoryListRepository()
    const app = buildSpecCheckedServer({ listRepository: repository })

    await app.inject({
      method: 'PUT',
      url: '/v1/lists/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      headers: { 'x-device-id': '11111111-1111-4111-8111-111111111111' },
      payload: { name: 'Groceries' },
    })

    const response = await app.inject({
      method: 'PUT',
      url: '/v1/lists/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/items/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbd',
      headers: {
        'x-device-id': '11111111-1111-4111-8111-111111111111',
      },
      payload: {
        name: 'apfel',
        language: 'de',
        deleted: false,
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    })

    expect(response.statusCode).toBe(201)

    const itemResponse = await app.inject({
      method: 'GET',
      url: '/v1/lists/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/items/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbd',
      headers: {
        'x-device-id': '11111111-1111-4111-8111-111111111111',
      },
    })

    expect(itemResponse.statusCode).toBe(200)
    expect(itemResponse.json()).toEqual(expect.objectContaining({ category: 'fruitsVegetables', iconName: 'apple' }))

    await app.close()
  })

  it('infers the language from existing list items when category and language are omitted', async () => {
    const repository = new InMemoryListRepository()
    const app = buildSpecCheckedServer({ listRepository: repository })

    await app.inject({
      method: 'PUT',
      url: '/v1/lists/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      headers: { 'x-device-id': '11111111-1111-4111-8111-111111111111' },
      payload: { name: 'Einkaufsliste' },
    })

    // A German item already on the list (e.g. category resolved client-side).
    await app.inject({
      method: 'PUT',
      url: '/v1/lists/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/items/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
      headers: { 'x-device-id': '11111111-1111-4111-8111-111111111111' },
      payload: {
        name: 'Apfel',
        category: 'fruitsVegetables',
        iconName: 'apple',
        deleted: false,
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    })

    // A new item without category/iconName/language: should be resolved using
    // the inferred German language rather than defaulting to English.
    const response = await app.inject({
      method: 'PUT',
      url: '/v1/lists/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/items/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
      headers: { 'x-device-id': '11111111-1111-4111-8111-111111111111' },
      payload: {
        name: 'Banane',
        deleted: false,
        updatedAt: '2026-01-01T00:00:01.000Z',
      },
    })

    expect(response.statusCode).toBe(201)

    const itemResponse = await app.inject({
      method: 'GET',
      url: '/v1/lists/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/items/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
      headers: { 'x-device-id': '11111111-1111-4111-8111-111111111111' },
    })

    expect(itemResponse.statusCode).toBe(200)
    expect(itemResponse.json()).toEqual(expect.objectContaining({ category: 'fruitsVegetables', iconName: 'banana' }))

    await app.close()
  })

  it('allows redeem route before token redemption and records redemption', async () => {
    const repository = new InMemoryListRepository()
    const app = buildSpecCheckedServer({ listRepository: repository })

    await app.inject({
      method: 'PUT',
      url: '/v1/lists/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      headers: { 'x-device-id': '11111111-1111-4111-8111-111111111111' },
      payload: { name: 'Groceries' },
    })

    const tokenResponse = await app.inject({
      method: 'POST',
      url: '/v1/lists/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/share-tokens',
      headers: { 'x-device-id': '11111111-1111-4111-8111-111111111111' },
    })

    const token = z.object({ shareToken: z.uuid() }).parse(tokenResponse.json())

    const response = await app.inject({
      method: 'POST',
      url: `/v1/share-tokens/${token.shareToken}/redeem`,
      headers: { 'x-device-id': '22222222-2222-4222-8222-222222222222' },
    })

    expect(response.statusCode).toBe(200)

    await app.close()
  })

  it('creates a secondary share token only for redeemed devices', async () => {
    const repository = new InMemoryListRepository()
    const app = buildSpecCheckedServer({ listRepository: repository })

    await app.inject({
      method: 'PUT',
      url: '/v1/lists/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      headers: { 'x-device-id': '11111111-1111-4111-8111-111111111111' },
      payload: { name: 'Groceries' },
    })

    const ownerTokenResponse = await app.inject({
      method: 'POST',
      url: '/v1/lists/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/share-tokens',
      headers: { 'x-device-id': '11111111-1111-4111-8111-111111111111' },
    })

    const ownerToken = z.object({ shareToken: z.string().uuid() }).parse(ownerTokenResponse.json())

    await app.inject({
      method: 'POST',
      url: `/v1/share-tokens/${ownerToken.shareToken}/redeem`,
      headers: { 'x-device-id': '22222222-2222-4222-8222-222222222222' },
    })

    const response = await app.inject({
      method: 'POST',
      url: '/v1/lists/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/share-tokens',
      headers: { 'x-device-id': '22222222-2222-4222-8222-222222222222' },
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toEqual(
      expect.objectContaining({
        listId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        tokenId: expect.any(String),
        shareToken: expect.any(String),
      }),
    )

    const tokenPayload = z.object({ tokenId: z.string().uuid(), shareToken: z.string().uuid() }).parse(response.json())
    expect(tokenPayload.shareToken).toBe(tokenPayload.tokenId)

    await app.close()
  })

  it('forbids creating a secondary share token for non-redeemed devices', async () => {
    const repository = new InMemoryListRepository()
    const app = buildSpecCheckedServer({ listRepository: repository })

    await app.inject({
      method: 'PUT',
      url: '/v1/lists/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      headers: { 'x-device-id': '11111111-1111-4111-8111-111111111111' },
      payload: { name: 'Groceries' },
    })

    const response = await app.inject({
      method: 'POST',
      url: '/v1/lists/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/share-tokens',
      headers: { 'x-device-id': '22222222-2222-4222-8222-222222222222' },
    })

    expect(response.statusCode).toBe(403)

    await app.close()
  })

  it('accepts repeated redemption calls for the same device and token', async () => {
    const repository = new InMemoryListRepository()
    const app = buildSpecCheckedServer({ listRepository: repository })

    await app.inject({
      method: 'PUT',
      url: '/v1/lists/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      headers: { 'x-device-id': '11111111-1111-4111-8111-111111111111' },
      payload: { name: 'Groceries' },
    })

    const tokenResponse = await app.inject({
      method: 'POST',
      url: '/v1/lists/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/share-tokens',
      headers: { 'x-device-id': '11111111-1111-4111-8111-111111111111' },
    })

    const token = z.object({ shareToken: z.string().uuid() }).parse(tokenResponse.json())

    const headers = { 'x-device-id': '22222222-2222-4222-8222-222222222222' }

    const firstResponse = await app.inject({
      method: 'POST',
      url: `/v1/share-tokens/${token.shareToken}/redeem`,
      headers,
    })

    const secondResponse = await app.inject({
      method: 'POST',
      url: `/v1/share-tokens/${token.shareToken}/redeem`,
      headers,
    })

    expect(firstResponse.statusCode).toBe(200)
    expect(secondResponse.statusCode).toBe(200)

    await app.close()
  })

  it('keeps list metadata version independent from newer item activity', async () => {
    const app = buildSpecCheckedServer({ listRepository: new InMemoryListRepository() })
    const listId = '77777777-7777-4777-8777-777777777777'
    const itemId = '88888888-8888-4888-8888-888888888888'
    const deviceId = '99999999-9999-4999-8999-999999999999'
    const metadataUpdatedAt = '2026-01-01T00:00:00.000Z'

    const createResponse = await app.inject({
      method: 'PUT',
      url: `/v1/lists/${listId}`,
      headers: { 'x-device-id': deviceId },
      payload: {
        name: 'Metadata List',
        updatedAt: metadataUpdatedAt,
      },
    })
    expect(createResponse.statusCode).toBe(201)

    const itemResponse = await app.inject({
      method: 'PUT',
      url: `/v1/lists/${listId}/items/${itemId}`,
      headers: { 'x-device-id': deviceId },
      payload: {
        name: 'Milk',
        iconName: 'default',
        category: 'other',
        deleted: false,
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
    })
    expect(itemResponse.statusCode).toBe(201)

    const listResponse = await app.inject({
      method: 'GET',
      url: `/v1/lists/${listId}`,
      headers: { 'x-device-id': deviceId },
    })
    expect(listResponse.statusCode).toBe(200)
    expect(listResponse.json()).toEqual(
      expect.objectContaining({
        name: 'Metadata List',
        updatedAt: metadataUpdatedAt,
      }),
    )

    await app.close()
  })


  // Every response status documented in openapi.yaml that the tests above do
  // not produce, so a changed status code or body is caught by the spec check.
  it('matches openapi.yaml for the remaining documented responses', async () => {
    const repository = new InMemoryListRepository()
    const app = buildSpecCheckedServer({ listRepository: repository, logger: false })
    const creator = { 'x-device-id': '11111111-1111-4111-8111-111111111111' }
    const otherDevice = { 'x-device-id': '22222222-2222-4222-8222-222222222222' }
    const listId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const otherListId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    const itemId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    const item = { name: 'Milk', deleted: false, updatedAt: '2026-01-01T00:00:00.000Z' }
    const statusOf = async (options: InjectOptions) => (await app.inject(options)).statusCode

    expect(await statusOf({ method: 'GET', url: '/health' })).toBe(200)
    repository.ping = async () => {
      throw new Error('database down')
    }
    expect(await statusOf({ method: 'GET', url: '/health' })).toBe(503)

    expect(await statusOf({ method: 'PUT', url: `/v1/lists/${listId}`, headers: creator, payload: { name: 'A' } })).toBe(201)
    expect(await statusOf({ method: 'PUT', url: `/v1/lists/${listId}`, headers: creator, payload: { name: 'B' } })).toBe(200)
    expect(await statusOf({ method: 'PUT', url: `/v1/lists/${otherListId}`, headers: creator, payload: { name: 'C' } })).toBe(201)
    expect(await statusOf({ method: 'PUT', url: `/v1/lists/${listId}`, headers: otherDevice, payload: { name: 'D' } })).toBe(403)
    expect(await statusOf({ method: 'PUT', url: `/v1/lists/${listId}`, headers: creator, payload: { name: '' } })).toBe(400)

    const itemUrl = `/v1/lists/${listId}/items/${itemId}`
    expect(await statusOf({ method: 'GET', url: itemUrl, headers: creator })).toBe(404)
    expect(await statusOf({ method: 'PUT', url: itemUrl, headers: creator, payload: item })).toBe(201)
    expect(await statusOf({ method: 'PUT', url: itemUrl, headers: creator, payload: { ...item, updatedAt: '2026-01-02T00:00:00.000Z' } })).toBe(204)
    expect(await statusOf({ method: 'PUT', url: itemUrl, headers: creator, payload: { ...item, name: '' } })).toBe(400)
    expect(await statusOf({ method: 'PUT', url: itemUrl, headers: otherDevice, payload: item })).toBe(403)
    expect(
      await statusOf({ method: 'PUT', url: `/v1/lists/${otherListId}/items/${itemId}`, headers: creator, payload: item }),
    ).toBe(409)
    expect(await statusOf({ method: 'GET', url: itemUrl, headers: creator })).toBe(200)
    expect(await statusOf({ method: 'GET', url: itemUrl, headers: otherDevice })).toBe(403)
    expect(await statusOf({ method: 'GET', url: `/v1/lists/${listId}/items/not-a-uuid`, headers: creator })).toBe(400)

    const itemsUrl = `/v1/lists/${listId}/items`
    expect(await statusOf({ method: 'GET', url: `${itemsUrl}?updatedAfter=2025-01-01T00:00:00.000Z`, headers: creator })).toBe(200)
    expect(await statusOf({ method: 'GET', url: `${itemsUrl}?updatedAfter=2025-01-01T00:00:00+01:00`, headers: creator })).toBe(400)
    expect(await statusOf({ method: 'GET', url: `${itemsUrl}?updatedAfter=2025-01-01T00:00:00.000Z`, headers: otherDevice })).toBe(403)

    expect(await statusOf({ method: 'GET', url: `/v1/lists/${listId}`, headers: creator })).toBe(200)
    expect(await statusOf({ method: 'GET', url: `/v1/lists/${listId}` })).toBe(400)
    expect(await statusOf({ method: 'GET', url: `/v1/lists/${listId}`, headers: otherDevice })).toBe(403)

    expect(await statusOf({ method: 'POST', url: `/v1/lists/${listId}/share-tokens`, headers: otherDevice })).toBe(403)
    expect(await statusOf({ method: 'POST', url: `/v1/lists/${listId}/share-tokens` })).toBe(400)
    const redeemUrl = `/v1/share-tokens/${crypto.randomUUID()}/redeem`
    expect(await statusOf({ method: 'POST', url: redeemUrl, headers: otherDevice })).toBe(401)
    expect(await statusOf({ method: 'POST', url: redeemUrl })).toBe(400)

    expect(await statusOf({ method: 'DELETE', url: `/v1/lists/${listId}`, headers: otherDevice })).toBe(403)
    expect(await statusOf({ method: 'DELETE', url: `/v1/lists/${listId}` })).toBe(400)
    expect(await statusOf({ method: 'DELETE', url: `/v1/lists/${listId}`, headers: creator })).toBe(204)

    // Without an Upgrade header the WebSocket route answers 404.
    expect(await statusOf({ method: 'GET', url: '/v1/ws' })).toBe(404)
    // Excluded from the spec check: Fastify's HEAD routes and CORS preflight.
    expect(await statusOf({ method: 'HEAD', url: '/health' })).toBe(503)
    expect(
      await statusOf({
        method: 'OPTIONS',
        url: `/v1/lists/${listId}`,
        headers: { origin: 'https://go-list.app', 'access-control-request-method': 'PUT' },
      }),
    ).toBe(204)

    await app.close()
  })
})

describe('list types and todo fields', () => {
  const deviceId = '11111111-1111-4111-8111-111111111111'
  const headers = { 'x-device-id': deviceId }

  it('stores the list type, keeps it when a write omits it and defaults new lists to shopping', async () => {
    const app = buildSpecCheckedServer({ listRepository: new InMemoryListRepository() })
    const listId = crypto.randomUUID()
    const getType = async () =>
      (await app.inject({ method: 'GET', url: `/v1/lists/${listId}`, headers })).json().listType

    expect((await app.inject({ method: 'PUT', url: `/v1/lists/${listId}`, headers, payload: { name: 'Chores', listType: 'todo' } })).statusCode).toBe(201)
    expect(await getType()).toBe('todo')

    // An older client renaming the list without a type keeps it.
    await app.inject({ method: 'PUT', url: `/v1/lists/${listId}`, headers, payload: { name: 'Flat chores' } })
    expect(await getType()).toBe('todo')

    await app.inject({ method: 'PUT', url: `/v1/lists/${listId}`, headers, payload: { name: 'Flat chores', listType: 'shopping' } })
    expect(await getType()).toBe('shopping')

    const otherListId = crypto.randomUUID()
    await app.inject({ method: 'PUT', url: `/v1/lists/${otherListId}`, headers, payload: { name: 'Groceries' } })
    expect((await app.inject({ method: 'GET', url: `/v1/lists/${otherListId}`, headers })).json().listType).toBe('shopping')

    const invalid = await app.inject({ method: 'PUT', url: `/v1/lists/${listId}`, headers, payload: { name: 'X', listType: 'wishlist' } })
    expect(invalid.statusCode).toBe(400)

    await app.close()
  })

  it('stores todo fields, keeps them when a write omits them and clears them on null', async () => {
    const app = buildSpecCheckedServer({ listRepository: new InMemoryListRepository() })
    const listId = crypto.randomUUID()
    const itemId = crypto.randomUUID()
    await app.inject({ method: 'PUT', url: `/v1/lists/${listId}`, headers, payload: { name: 'Chores', listType: 'todo' } })

    const dueDate = '2026-03-27T00:00:00.000Z'
    const recurrence = JSON.stringify({ every: 1, unit: 'week', anchor: 'from_due_date' })
    const put = (payload: Record<string, unknown>) =>
      app.inject({ method: 'PUT', url: `/v1/lists/${listId}/items/${itemId}`, headers, payload })
    const getItem = async () =>
      (await app.inject({ method: 'GET', url: `/v1/lists/${listId}/items/${itemId}`, headers })).json()

    expect(
      (
        await put({
          name: 'Clean bathroom',
          deleted: false,
          updatedAt: '2026-03-20T10:00:00.000Z',
          description: 'Sink too',
          points: 3,
          dueDate,
          assignedTo: 'Alex',
          recurrence,
        })
      ).statusCode,
    ).toBe(201)
    expect(await getItem()).toEqual(
      expect.objectContaining({ description: 'Sink too', points: 3, dueDate, assignedTo: 'Alex', recurrence }),
    )

    // A caller that predates todo lists (e.g. the openclaw CLI renaming an
    // item) does not wipe the todo fields.
    await put({ name: 'Clean the bathroom', deleted: false, updatedAt: '2026-03-20T11:00:00.000Z' })
    expect(await getItem()).toEqual(
      expect.objectContaining({ name: 'Clean the bathroom', points: 3, dueDate, assignedTo: 'Alex', recurrence }),
    )

    const completedAt = '2026-03-21T08:00:00.000Z'
    await put({ name: 'Clean the bathroom', deleted: false, updatedAt: '2026-03-21T08:00:00.000Z', completedAt, assignedTo: null })
    const completed = await getItem()
    expect(completed.completedAt).toBe(completedAt)
    expect(completed).not.toHaveProperty('assignedTo')

    const invalid = await put({ name: 'x', deleted: false, updatedAt: '2026-03-22T08:00:00.000Z', points: 0 })
    expect(invalid.statusCode).toBe(400)

    await app.close()
  })
})
