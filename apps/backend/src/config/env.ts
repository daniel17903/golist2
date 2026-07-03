import { z } from 'zod'

const sslModeSchema = z.enum(['disable', 'prefer', 'require', 'verify-ca', 'verify-full'])

const envSchema = z.object({
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1).optional(),
  // No .default() here on purpose: falling back silently to
  // localhost/golist/golist/golist is only safe in local development. See
  // the production guard below, which fails fast instead of letting a
  // misconfigured production deploy connect to the wrong database.
  PGHOST: z.string().min(1).optional(),
  PGUSER: z.string().min(1).optional(),
  PGDATABASE: z.string().min(1).optional(),
  PGPASSWORD: z.string().min(1).optional(),
  PGSSLMODE: sslModeSchema.default('require'),
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

const DEV_ONLY_PG_DEFAULTS = {
  PGHOST: 'localhost',
  PGUSER: 'golist',
  PGDATABASE: 'golist',
  PGPASSWORD: 'golist',
} as const

const REQUIRED_PROD_PG_KEYS: Array<keyof typeof DEV_ONLY_PG_DEFAULTS> = [
  'PGHOST',
  'PGUSER',
  'PGDATABASE',
  'PGPASSWORD',
]

// The discrete PG* vars are only used when no connection-string style config
// is supplied (DATABASE_URL, or NEON_* which resolveEnv() already folds into
// PG* above) — see db/client.ts's `hasDatabaseUrl` precedence. In production,
// a missing var in that situation must fail loudly at boot instead of
// silently connecting to localhost.
const isProduction = parsed.NODE_ENV === 'production'
const hasConnectionString = Boolean(parsed.DATABASE_URL)

if (isProduction && !hasConnectionString) {
  const missing = REQUIRED_PROD_PG_KEYS.filter((key) => !parsed[key])

  if (missing.length > 0) {
    throw new Error(
      `Missing required production database configuration: ${missing.join(', ')}. ` +
        'Set DATABASE_URL (or NEON_PG* vars) for connection-string style config, or ' +
        'provide all of PGHOST/PGUSER/PGDATABASE/PGPASSWORD explicitly — insecure ' +
        'localhost defaults are only applied outside production.',
    )
  }
}

export const env: Env = {
  HOST: parsed.HOST,
  PORT: parsed.PORT,
  NODE_ENV: parsed.NODE_ENV,
  DATABASE_URL: parsed.DATABASE_URL,
  PGHOST: parsed.PGHOST ?? DEV_ONLY_PG_DEFAULTS.PGHOST,
  PGUSER: parsed.PGUSER ?? DEV_ONLY_PG_DEFAULTS.PGUSER,
  PGDATABASE: parsed.PGDATABASE ?? DEV_ONLY_PG_DEFAULTS.PGDATABASE,
  PGPASSWORD: parsed.PGPASSWORD ?? DEV_ONLY_PG_DEFAULTS.PGPASSWORD,
  PGSSLMODE: parsed.PGSSLMODE,
}
