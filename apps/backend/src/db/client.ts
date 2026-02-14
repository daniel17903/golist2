import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg'

import { env } from '../config/env.js'

function redactConnectionString(connectionString: string): string {
  try {
    const parsed = new URL(connectionString)

    if (parsed.password) {
      parsed.password = '***'
    }

    return parsed.toString()
  } catch {
    return '<invalid DATABASE_URL>'
  }
}

const redactedConnectionString = redactConnectionString(env.DATABASE_URL)

console.info('[db] Creating PostgreSQL pool', {
  connectionString: redactedConnectionString,
})

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
})

pool.on('error', (error) => {
  console.error('[db] Unexpected PostgreSQL pool error', {
    message: error.message,
    stack: error.stack,
    connectionString: redactedConnectionString,
  })
})

export async function query<T extends QueryResultRow>(
  text: string,
  values?: unknown[],
): Promise<QueryResult<T>> {
  try {
    return await pool.query<T>(text, values)
  } catch (error) {
    if (error instanceof Error) {
      console.error('[db] Query failed', {
        queryText: text,
        message: error.message,
        stack: error.stack,
      })
    }

    throw error
  }
}

export async function withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  let client: PoolClient

  try {
    client = await pool.connect()
  } catch (error) {
    if (error instanceof Error) {
      console.error('[db] Failed to obtain PostgreSQL client from pool', {
        message: error.message,
        stack: error.stack,
        connectionString: redactedConnectionString,
      })
    }

    throw error
  }

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
