import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg'

import { env } from '../config/env.js'

export const pool = new Pool({
  connectionString: env.DATABASE_URL
})

export async function query<T extends QueryResultRow>(
  text: string,
  values?: unknown[]
): Promise<QueryResult<T>> {
  return pool.query<T>(text, values)
}

export async function withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
