import { describe, expect, it } from 'vitest'

import { resolveEnv } from './env.js'

describe('resolveEnv', () => {
  it('uses NEON_DATABASE_URL when DATABASE_URL is missing', () => {
    const resolved = resolveEnv({ NEON_DATABASE_URL: 'postgres://example.com/neon-db' })

    expect(resolved.DATABASE_URL).toBe('postgres://example.com/neon-db')
  })

  it('prefers DATABASE_URL when both are set', () => {
    const resolved = resolveEnv({
      DATABASE_URL: 'postgres://example.com/primary-db',
      NEON_DATABASE_URL: 'postgres://example.com/neon-db',
    })

    expect(resolved.DATABASE_URL).toBe('postgres://example.com/primary-db')
  })
})
