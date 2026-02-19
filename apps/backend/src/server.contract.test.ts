import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

const queryMock = vi.fn()
const withTransactionMock = vi.fn()

vi.mock('./db/client.js', () => ({
  query: queryMock,
  withTransaction: withTransactionMock,
}))

describe('sharing API contract basics', () => {
  beforeEach(() => {
    queryMock.mockReset()
    withTransactionMock.mockReset()
    withTransactionMock.mockImplementation(async (work: (client: { query: typeof queryMock }) => Promise<unknown>) => {
      return await work({ query: queryMock })
    })
    queryMock.mockResolvedValue({ rowCount: 1, rows: [] })
  })

  it('creates a list and returns listId', async () => {
    const { buildServer } = await import('./server.js')
    const app = buildServer()

    queryMock.mockResolvedValueOnce({ rowCount: 0, rows: [] })

    const response = await app.inject({
      method: 'PUT',
      url: '/v1/lists/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      headers: { 'x-device-id': '11111111-1111-4111-8111-111111111111' },
      payload: { name: 'Groceries' },
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toEqual(
      expect.objectContaining({
        listId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      }),
    )

    await app.close()
  })



  it('rejects putting an existing list without required X-Device-Id header', async () => {
    const { buildServer } = await import('./server.js')
    const app = buildServer()

    queryMock.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', created_by_device_id: '11111111-1111-4111-8111-111111111111' }],
    })

    queryMock.mockResolvedValueOnce({ rowCount: 0, rows: [] })

    const response = await app.inject({
      method: 'PUT',
      url: '/v1/lists/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      payload: { name: 'Groceries' },
    })

    expect(response.statusCode).toBe(400)

    await app.close()
  })

  it('requires X-Device-Id header for protected routes', async () => {
    const { buildServer } = await import('./server.js')
    const app = buildServer()

    const response = await app.inject({ method: 'GET', url: '/v1/lists/11111111-1111-4111-8111-111111111111' })

    expect(response.statusCode).toBe(400)

    await app.close()
  })

  it('forbids devices without list access on protected routes', async () => {
    const { buildServer } = await import('./server.js')
    const app = buildServer()

    queryMock.mockResolvedValueOnce({ rowCount: 1, rows: [{ has_access: false }] })

    const response = await app.inject({
      method: 'GET',
      url: '/v1/lists/11111111-1111-4111-8111-111111111111',
      headers: { 'x-device-id': '22222222-2222-4222-8222-222222222222' },
    })

    expect(response.statusCode).toBe(403)

    await app.close()
  })

  it('forbids non-redeemed devices on authenticated list routes', async () => {
    const { buildServer } = await import('./server.js')
    const app = buildServer()

    queryMock
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ has_access: false }],
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
    const { buildServer } = await import('./server.js')
    const app = buildServer()

    queryMock
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ has_access: true }],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })

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


  it('allows redeem route before token redemption and records redemption', async () => {
    const { buildServer } = await import('./server.js')
    const app = buildServer()

    queryMock
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ token_id: '11111111-1111-4111-8111-111111111111', list_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })

    const response = await app.inject({
      method: 'POST',
      url: '/v1/share-tokens/11111111-1111-4111-8111-111111111111/redeem',
      headers: { 'x-device-id': '22222222-2222-4222-8222-222222222222' },
    })

    expect(response.statusCode).toBe(200)

    await app.close()
  })
  it('creates a secondary share token only for redeemed devices', async () => {
    const { buildServer } = await import('./server.js')
    const app = buildServer()

    queryMock
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ has_access: true }],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ created_at: '2026-01-01T00:00:00.000Z' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })

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

    const tokenPayload = z
      .object({ tokenId: z.string().uuid(), shareToken: z.string().uuid() })
      .parse(response.json())
    expect(tokenPayload.shareToken).toBe(tokenPayload.tokenId)

    await app.close()
  })

  it('forbids creating a secondary share token for non-redeemed devices', async () => {
    const { buildServer } = await import('./server.js')
    const app = buildServer()

    queryMock
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ has_access: false }],
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
    const { buildServer } = await import('./server.js')
    const app = buildServer()

    queryMock
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ token_id: '11111111-1111-4111-8111-111111111111', list_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ token_id: '11111111-1111-4111-8111-111111111111', list_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })

    const headers = { 'x-device-id': '22222222-2222-4222-8222-222222222222' }

    const firstResponse = await app.inject({
      method: 'POST',
      url: '/v1/share-tokens/11111111-1111-4111-8111-111111111111/redeem',
      headers,
    })

    const secondResponse = await app.inject({
      method: 'POST',
      url: '/v1/share-tokens/11111111-1111-4111-8111-111111111111/redeem',
      headers,
    })

    expect(firstResponse.statusCode).toBe(200)
    expect(secondResponse.statusCode).toBe(200)

    await app.close()
  })

})
