import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg'

import { env } from '../config/env.js'

function resolveSsl(sslMode: string): false | { rejectUnauthorized: boolean } {
  if (sslMode === 'disable') {
    return false
  }

  return {
    rejectUnauthorized: sslMode === 'verify-ca' || sslMode === 'verify-full',
  }
}

const ssl = resolveSsl(env.PGSSLMODE)
const hasDatabaseUrl = Boolean(env.DATABASE_URL)

console.info(
  '[db] Creating PostgreSQL pool',
  hasDatabaseUrl
    ? {
        connection: 'DATABASE_URL',
      }
    : {
        host: env.PGHOST,
        user: env.PGUSER,
        database: env.PGDATABASE,
        sslMode: env.PGSSLMODE,
      },
)

export const pool = new Pool(
  hasDatabaseUrl
    ? {
        connectionString: env.DATABASE_URL,
      }
    : {
        host: env.PGHOST,
        user: env.PGUSER,
        database: env.PGDATABASE,
        password: env.PGPASSWORD,
        ssl,
      },
)

pool.on('error', (error) => {
  console.error('[db] Unexpected PostgreSQL pool error', {
    message: error.message,
    stack: error.stack,
    connection: hasDatabaseUrl ? 'DATABASE_URL' : undefined,
    host: hasDatabaseUrl ? undefined : env.PGHOST,
    user: hasDatabaseUrl ? undefined : env.PGUSER,
    database: hasDatabaseUrl ? undefined : env.PGDATABASE,
    sslMode: hasDatabaseUrl ? undefined : env.PGSSLMODE,
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
        connection: hasDatabaseUrl ? 'DATABASE_URL' : undefined,
        host: hasDatabaseUrl ? undefined : env.PGHOST,
        user: hasDatabaseUrl ? undefined : env.PGUSER,
        database: hasDatabaseUrl ? undefined : env.PGDATABASE,
        sslMode: hasDatabaseUrl ? undefined : env.PGSSLMODE,
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
