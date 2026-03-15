import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import dotenv from 'dotenv'
import { z } from 'zod'

const currentFile = fileURLToPath(import.meta.url)
const workerSrcDir = path.dirname(currentFile)
const workerDir = path.resolve(workerSrcDir, '..')

// Worker runtime should follow production semantics:
// load worker-scoped env first and fail fast when critical keys are missing.
const envCandidates = [
  path.join(workerDir, '.env.local'),
  path.join(workerDir, '.env'),
]

for (const envPath of envCandidates) {
  if (!fs.existsSync(envPath)) continue
  dotenv.config({ path: envPath, override: false })
}

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.string().default('8081'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
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
  SENTRY_ORG: z.string().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  SENTRY_WORKER_PROJECT: z.string().optional(),
  SENTRY_BASE_URL: z.string().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),
  SENTRY_RELEASE: z.string().optional(),
  SENTRY_ENABLED: z.enum(['true', 'false']).optional(),
  SENTRY_DEBUG: z.enum(['true', 'false']).optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.string().optional(),
  SENTRY_PROFILES_SAMPLE_RATE: z.string().optional(),
})

const parsedEnv = envSchema.superRefine((env, ctx) => {
  const skipVerify =
    env.NODE_ENV === 'development' && env.QSTASH_SKIP_VERIFY === 'true'

  if (!skipVerify && !env.QSTASH_CURRENT_SIGNING_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['QSTASH_CURRENT_SIGNING_KEY'],
      message:
        'QSTASH_CURRENT_SIGNING_KEY is required unless QSTASH_SKIP_VERIFY=true in development',
    })
  }

  if (!skipVerify && !env.QSTASH_NEXT_SIGNING_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['QSTASH_NEXT_SIGNING_KEY'],
      message:
        'QSTASH_NEXT_SIGNING_KEY is required unless QSTASH_SKIP_VERIFY=true in development',
    })
  }
}).safeParse(process.env)

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
