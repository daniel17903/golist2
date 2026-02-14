import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { withTransaction } from './client.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const migrationsDir = path.join(__dirname, 'migrations')

export async function runMigrations(): Promise<number> {
  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort((left, right) => left.localeCompare(right))

  let appliedCount = 0

  for (const file of files) {
    const sql = await readFile(path.join(migrationsDir, file), 'utf8')

    const applied = await withTransaction(async (client) => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS migration_history (
          id BIGSERIAL PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `)

      const existing = await client.query<{ name: string }>(
        'SELECT name FROM migration_history WHERE name = $1 LIMIT 1',
        [file],
      )

      if (existing.rowCount && existing.rowCount > 0) {
        return false
      }

      await client.query(sql)
      await client.query('INSERT INTO migration_history(name) VALUES ($1)', [file])
      return true
    })

    if (applied) {
      appliedCount += 1
    }
  }

  return appliedCount
}
