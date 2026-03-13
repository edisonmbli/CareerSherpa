import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config({ path: '../.env.local' })
dotenv.config({ path: '.env.local' })
dotenv.config()

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.string().default('8081'),
  QSTASH_CURRENT_SIGNING_KEY: z.string().optional(),
  QSTASH_NEXT_SIGNING_KEY: z.string().optional(),
  QSTASH_SKIP_VERIFY: z.enum(['true', 'false']).optional(),
  CORS_ORIGIN: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  LOG_INFO: z.enum(['true', 'false']).optional(),
  LOG_DEBUG: z.enum(['true', 'false']).optional(),
  SSE_DEBUG: z.enum(['true', 'false']).optional(),
  SENTRY_DSN: z.string().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),
  SENTRY_RELEASE: z.string().optional(),
  SENTRY_ENABLED: z.enum(['true', 'false']).optional(),
  SENTRY_DEBUG: z.enum(['true', 'false']).optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.string().optional(),
  SENTRY_PROFILES_SAMPLE_RATE: z.string().optional(),
})

const parsedEnv = envSchema.safeParse(process.env)

if (!parsedEnv.success) {
  const formatted = parsedEnv.error.format()
  void (async () => {
    const { logError } = await import('@/lib/logger')
    logError({
      reqId: 'worker-config',
      route: 'worker/config',
      phase: 'invalid_env',
      error: formatted,
    })
    process.exit(1)
  })()
  throw new Error('invalid_worker_env')
}

export const config = parsedEnv.data
