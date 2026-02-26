import crypto from 'node:crypto'

import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { buildServer } from './server.js'
import { InMemoryListRepository } from './test/in-memory-list-repository.js'

describe('sharing API contract basics', () => {
  it('allows a client to create a new list using a self-generated list id via PUT', async () => {
    const app = buildServer({ listRepository: new InMemoryListRepository() })
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
    const app = buildServer({ listRepository: new InMemoryListRepository() })

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
    const app = buildServer({ listRepository: new InMemoryListRepository() })

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
    const app = buildServer({ listRepository: new InMemoryListRepository() })

    const response = await app.inject({ method: 'GET', url: '/v1/lists/11111111-1111-4111-8111-111111111111' })

    expect(response.statusCode).toBe(400)

    await app.close()
  })

  it('forbids devices without list access on protected routes', async () => {
    const repository = new InMemoryListRepository()
    const app = buildServer({ listRepository: repository })

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
    const app = buildServer({ listRepository: repository })

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
    const app = buildServer({ listRepository: repository })

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
    const app = buildServer({ listRepository: repository })

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
    const app = buildServer({ listRepository: repository })

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

  it('allows redeem route before token redemption and records redemption', async () => {
    const repository = new InMemoryListRepository()
    const app = buildServer({ listRepository: repository })

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
    const app = buildServer({ listRepository: repository })

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
    const app = buildServer({ listRepository: repository })

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
    const app = buildServer({ listRepository: repository })

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
})
