import { z } from 'zod'

const envSchema = z.object({
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.url().default('postgres://golist:golist@localhost:5432/golist'),
  NEON_DATABASE_URL: z.url().optional(),
})

export type Env = Omit<z.infer<typeof envSchema>, 'NEON_DATABASE_URL'>

export function resolveEnv(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  if (source.DATABASE_URL || !source.NEON_DATABASE_URL) {
    return source
  }

  return {
    ...source,
    DATABASE_URL: source.NEON_DATABASE_URL,
  }
}

const parsed = envSchema.parse(resolveEnv(process.env))

export const env: Env = {
  HOST: parsed.HOST,
  PORT: parsed.PORT,
  NODE_ENV: parsed.NODE_ENV,
  DATABASE_URL: parsed.DATABASE_URL,
}
