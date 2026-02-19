import { describe, expect, it } from 'vitest'

import { resolveEnv } from './env.js'

describe('resolveEnv', () => {
  it('uses NEON_ prefixed PG env vars when primary values are missing', () => {
    const resolved = resolveEnv({
      NEON_PGHOST: 'neon-host',
      NEON_PGUSER: 'neon-user',
      NEON_PGDATABASE: 'neon-db',
      NEON_PGPASSWORD: 'neon-pass',
    })

    expect(resolved.PGHOST).toBe('neon-host')
    expect(resolved.PGUSER).toBe('neon-user')
    expect(resolved.PGDATABASE).toBe('neon-db')
    expect(resolved.PGPASSWORD).toBe('neon-pass')
  })

  it('defaults PGSSLMODE to require when using NEON_ db config', () => {
    const resolved = resolveEnv({
      NEON_PGHOST: 'neon-host',
    })

    expect(resolved.PGSSLMODE).toBe('require')
  })

  it('keeps DATABASE_URL when provided', () => {
    const resolved = resolveEnv({
      DATABASE_URL: 'postgres://user:pass@example.com:5432/app',
      PGHOST: 'primary-host',
      PGUSER: 'primary-user',
      PGDATABASE: 'primary-db',
      PGPASSWORD: 'primary-pass',
    })

    expect(resolved.DATABASE_URL).toBe('postgres://user:pass@example.com:5432/app')
  })

  it('prefers non-prefixed PG env vars when both are set', () => {
    const resolved = resolveEnv({
      PGHOST: 'primary-host',
      PGUSER: 'primary-user',
      PGDATABASE: 'primary-db',
      PGPASSWORD: 'primary-pass',
      PGSSLMODE: 'disable',
      NEON_PGHOST: 'neon-host',
      NEON_PGUSER: 'neon-user',
      NEON_PGDATABASE: 'neon-db',
      NEON_PGPASSWORD: 'neon-pass',
      NEON_PGSSLMODE: 'require',
    })

    expect(resolved.PGHOST).toBe('primary-host')
    expect(resolved.PGUSER).toBe('primary-user')
    expect(resolved.PGDATABASE).toBe('primary-db')
    expect(resolved.PGPASSWORD).toBe('primary-pass')
    expect(resolved.PGSSLMODE).toBe('disable')
  })
})
