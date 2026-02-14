import { beforeEach, describe, expect, it, vi } from 'vitest'

const queryMock = vi.fn()
const withTransactionMock = vi.fn()

vi.mock('./db/client.js', () => ({
  query: queryMock,
  withTransaction: withTransactionMock
}))

describe('sharing API contract basics', () => {
  beforeEach(() => {
    queryMock.mockReset()
    withTransactionMock.mockReset()
    withTransactionMock.mockImplementation(async (work: (client: { query: typeof queryMock }) => Promise<void>) => {
      await work({ query: queryMock })
    })
  })

  it('creates a list and returns listId and shareToken', async () => {
    const { buildServer } = await import('./server.js')
    const app = buildServer()

    const response = await app.inject({
      method: 'POST',
      url: '/v1/lists',
      payload: { name: 'Groceries' }
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toEqual(
      expect.objectContaining({
        listId: expect.any(String),
        shareToken: expect.any(String)
      })
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
})
