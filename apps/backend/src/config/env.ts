import { z } from 'zod'

const sslModeSchema = z.enum(['disable', 'prefer', 'require', 'verify-ca', 'verify-full'])

const envSchema = z.object({
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PGHOST: z.string().min(1).default('localhost'),
  PGUSER: z.string().min(1).default('golist'),
  PGDATABASE: z.string().min(1).default('golist'),
  PGPASSWORD: z.string().min(1).default('golist'),
  PGSSLMODE: sslModeSchema.default('disable'),
  NEON_PGHOST: z.string().min(1).optional(),
  NEON_PGUSER: z.string().min(1).optional(),
  NEON_PGDATABASE: z.string().min(1).optional(),
  NEON_PGPASSWORD: z.string().min(1).optional(),
  NEON_PGSSLMODE: sslModeSchema.optional(),
})

type RawEnv = z.infer<typeof envSchema>

type NeonKeys =
  | 'NEON_PGHOST'
  | 'NEON_PGUSER'
  | 'NEON_PGDATABASE'
  | 'NEON_PGPASSWORD'
  | 'NEON_PGSSLMODE'

export type Env = Omit<RawEnv, NeonKeys>

export function resolveEnv(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const fallbackMap = {
    PGHOST: 'NEON_PGHOST',
    PGUSER: 'NEON_PGUSER',
    PGDATABASE: 'NEON_PGDATABASE',
    PGPASSWORD: 'NEON_PGPASSWORD',
    PGSSLMODE: 'NEON_PGSSLMODE',
  } as const

  const resolved = { ...source }

  for (const [primaryKey, fallbackKey] of Object.entries(fallbackMap)) {
    if (!resolved[primaryKey] && resolved[fallbackKey]) {
      resolved[primaryKey] = resolved[fallbackKey]
    }
  }

  const hasNeonDbConfig =
    Boolean(resolved.NEON_PGHOST) ||
    Boolean(resolved.NEON_PGUSER) ||
    Boolean(resolved.NEON_PGDATABASE) ||
    Boolean(resolved.NEON_PGPASSWORD)

  if (!resolved.PGSSLMODE && hasNeonDbConfig) {
    resolved.PGSSLMODE = 'require'
  }

  return resolved
}

const parsed = envSchema.parse(resolveEnv(process.env))

export const env: Env = {
  HOST: parsed.HOST,
  PORT: parsed.PORT,
  NODE_ENV: parsed.NODE_ENV,
  PGHOST: parsed.PGHOST,
  PGUSER: parsed.PGUSER,
  PGDATABASE: parsed.PGDATABASE,
  PGPASSWORD: parsed.PGPASSWORD,
  PGSSLMODE: parsed.PGSSLMODE,
}
