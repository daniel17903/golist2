import crypto from 'node:crypto'

import { afterAll, describe, expect, it } from 'vitest'

// Runs only against a real database (the backend CI job provides Postgres and
// applies migrations first); skipped when no PG connection is configured.
const hasDatabase = Boolean(process.env.PGHOST || process.env.DATABASE_URL)

describe.skipIf(!hasDatabase)('postgresListRepository', async () => {
  const { postgresListRepository } = await import('./postgres-list-repository.js')
  const { pool } = await import('../db/client.js')
  const deviceId = crypto.randomUUID()

  afterAll(async () => {
    await pool.end()
  })

  const createList = async (name: string) => {
    const listId = crypto.randomUUID()
    const created = await postgresListRepository.putList(listId, name, deviceId, '2026-01-01T00:00:00.000Z')
    expect(created.outcome).toBe('created')
    return listId
  }

  it('stores the plain name when renaming with an updatedAt', async () => {
    const listId = await createList('Original')

    const result = await postgresListRepository.putList(listId, 'Weekly groceries', deviceId, '2026-01-02T00:00:00.000Z')

    expect(result.outcome).toBe('updated')
    expect((await postgresListRepository.getList(listId))?.name).toBe('Weekly groceries')
  })

  it('keeps non-ASCII and backslash characters intact', async () => {
    const listId = await createList('Original')
    const name = 'Einkäufe \\ Ü 🛒'

    await postgresListRepository.putList(listId, name, deviceId, '2026-01-02T00:00:00.000Z')

    expect((await postgresListRepository.getList(listId))?.name).toBe(name)
  })

  it('ignores stale renames and breaks timestamp ties by the greater name', async () => {
    const listId = await createList('Original')
    const tiedAt = '2026-01-03T00:00:00.000Z'

    expect((await postgresListRepository.putList(listId, 'Stale', deviceId, '2025-12-31T00:00:00.000Z')).outcome).toBe('ignored')
    expect((await postgresListRepository.putList(listId, 'Zebra', deviceId, tiedAt)).outcome).toBe('updated')
    expect((await postgresListRepository.putList(listId, 'Alpha', deviceId, tiedAt)).outcome).toBe('ignored')
    expect((await postgresListRepository.getList(listId))?.name).toBe('Zebra')
  })
})
