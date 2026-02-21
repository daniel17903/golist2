import { describe, expect, it } from 'vitest'

import { buildServer } from './server.js'
import { InMemoryListRepository } from './test/in-memory-list-repository.js'

describe('health endpoint', () => {
  it('returns status ok when database is reachable', async () => {
    const repository = new InMemoryListRepository()
    const app = buildServer({ listRepository: repository })

    const response = await app.inject({ method: 'GET', url: '/health' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ok' })

    await app.close()
  })

  it('returns service unavailable when database is unreachable', async () => {
    const repository = new InMemoryListRepository()
    repository.setPingError(new Error('db unavailable'))
    const app = buildServer({ listRepository: repository })

    const response = await app.inject({ method: 'GET', url: '/health' })

    expect(response.statusCode).toBe(503)
    expect(response.json()).toEqual({ status: 'error' })

    await app.close()
  })
})
