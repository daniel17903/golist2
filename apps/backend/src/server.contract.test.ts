import { beforeEach, describe, expect, it, vi } from 'vitest'

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
    withTransactionMock.mockImplementation(async (work: (client: { query: typeof queryMock }) => Promise<void>) => {
      await work({ query: queryMock })
    })
    queryMock.mockResolvedValue({ rowCount: 1, rows: [] })
  })

  it('creates a list and returns listId and shareToken', async () => {
    const { buildServer } = await import('./server.js')
    const app = buildServer()

    const response = await app.inject({
      method: 'POST',
      url: '/v1/lists',
      payload: { listId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Groceries' },
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toEqual(
      expect.objectContaining({
        listId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        shareToken: expect.any(String),
      }),
    )

    await app.close()
  })

  it('requires bearer token for protected routes', async () => {
    const { buildServer } = await import('./server.js')
    const app = buildServer()

    const response = await app.inject({ method: 'GET', url: '/v1/lists/sample-token' })

    expect(response.statusCode).toBe(401)

    await app.close()
  })

  it('requires deviceId query for protected routes', async () => {
    const { buildServer } = await import('./server.js')
    const app = buildServer()

    const response = await app.inject({
      method: 'GET',
      url: '/v1/lists/11111111-1111-4111-8111-111111111111',
      headers: { authorization: 'Bearer 11111111-1111-4111-8111-111111111111' },
    })

    expect(response.statusCode).toBe(400)

    await app.close()
  })

  it('forbids non-redeemed devices on authenticated list routes', async () => {
    const { buildServer } = await import('./server.js')
    const app = buildServer()

    queryMock
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ token_id: '11111111-1111-4111-8111-111111111111', list_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }],
      })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })

    const response = await app.inject({
      method: 'GET',
      url: '/v1/lists/11111111-1111-4111-8111-111111111111?deviceId=22222222-2222-4222-8222-222222222222',
      headers: { authorization: 'Bearer 11111111-1111-4111-8111-111111111111' },
    })

    expect(response.statusCode).toBe(403)

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
      url: '/v1/share-tokens/11111111-1111-4111-8111-111111111111/redeem?deviceId=22222222-2222-4222-8222-222222222222',
      headers: { authorization: 'Bearer 11111111-1111-4111-8111-111111111111' },
    })

    expect(response.statusCode).toBe(204)

    await app.close()
  })
})
