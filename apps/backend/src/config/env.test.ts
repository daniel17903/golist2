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

  it('prefers non-prefixed PG env vars when both are set', () => {
    const resolved = resolveEnv({
      PGHOST: 'primary-host',
      PGUSER: 'primary-user',
      PGDATABASE: 'primary-db',
      PGPASSWORD: 'primary-pass',
      NEON_PGHOST: 'neon-host',
      NEON_PGUSER: 'neon-user',
      NEON_PGDATABASE: 'neon-db',
      NEON_PGPASSWORD: 'neon-pass',
    })

    expect(resolved.PGHOST).toBe('primary-host')
    expect(resolved.PGUSER).toBe('primary-user')
    expect(resolved.PGDATABASE).toBe('primary-db')
    expect(resolved.PGPASSWORD).toBe('primary-pass')
  })
})
