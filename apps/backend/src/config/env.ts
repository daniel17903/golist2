import { z } from 'zod'

const envSchema = z.object({
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.url().default('postgres://golist:golist@localhost:5432/golist'),
})

export type Env = z.infer<typeof envSchema>

export const env = envSchema.parse(process.env)
