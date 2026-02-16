import { beforeEach, describe, expect, it, vi } from 'vitest'

const queryMock = vi.fn()

vi.mock('./db/client.js', () => ({
  query: queryMock,
}))

describe('health endpoint', () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  it('returns status ok when database is reachable', async () => {
    const { buildServer } = await import('./server.js')
    const app = buildServer()

    queryMock.mockResolvedValue({ rowCount: 1, rows: [{ '?column?': 1 }] })

    const response = await app.inject({ method: 'GET', url: '/health' })

    expect(queryMock).toHaveBeenCalledWith('SELECT 1')
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ok' })

    await app.close()
  })

  it('returns service unavailable when database is unreachable', async () => {
    const { buildServer } = await import('./server.js')
    const app = buildServer()

    queryMock.mockRejectedValue(new Error('db unavailable'))

    const response = await app.inject({ method: 'GET', url: '/health' })

    expect(queryMock).toHaveBeenCalledWith('SELECT 1')
    expect(response.statusCode).toBe(503)
    expect(response.json()).toEqual({ status: 'error' })

    await app.close()
  })
})
