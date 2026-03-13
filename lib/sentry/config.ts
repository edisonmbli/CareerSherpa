type SharedSentryOptions = {
  dsn?: string
  enabled: boolean
  environment: string
  release?: string
  tracesSampleRate: number
  profilesSampleRate?: number
  debug: boolean
}

function asOptionalString(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function parseBoolean(value: string | undefined) {
  return (value ?? '').toLowerCase() === 'true'
}

function parseSampleRate(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  if (parsed < 0) return 0
  if (parsed > 1) return 1
  return parsed
}

function getNodeEnv() {
  return process.env['NODE_ENV'] || 'development'
}

function getSharedEnvironment() {
  return (
    asOptionalString(process.env['SENTRY_ENVIRONMENT']) ||
    asOptionalString(process.env['VERCEL_ENV']) ||
    getNodeEnv()
  )
}

function getSharedRelease() {
  return (
    asOptionalString(process.env['SENTRY_RELEASE']) ||
    asOptionalString(process.env['VERCEL_GIT_COMMIT_SHA']) ||
    asOptionalString(process.env['NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA'])
  )
}

function buildSharedOptions(
  dsn: string | undefined,
  explicitEnabled: boolean,
): SharedSentryOptions {
  const nodeEnv = getNodeEnv()
  const enabled = Boolean(dsn) && (explicitEnabled || nodeEnv === 'production')
  const release = getSharedRelease()
  return {
    ...(dsn ? { dsn } : {}),
    enabled,
    environment: getSharedEnvironment(),
    ...(release ? { release } : {}),
    tracesSampleRate: parseSampleRate(
      process.env['SENTRY_TRACES_SAMPLE_RATE'],
      nodeEnv === 'production' ? 0.15 : 1,
    ),
    profilesSampleRate: parseSampleRate(
      process.env['SENTRY_PROFILES_SAMPLE_RATE'],
      0,
    ),
    debug: parseBoolean(process.env['SENTRY_DEBUG']),
  }
}

export function getWebSentryOptions() {
  return buildSharedOptions(
    asOptionalString(process.env['NEXT_PUBLIC_SENTRY_DSN']),
    parseBoolean(process.env['NEXT_PUBLIC_SENTRY_ENABLED']) ||
      parseBoolean(process.env['SENTRY_ENABLED']),
  )
}

export function getWorkerSentryOptions() {
  return buildSharedOptions(
    asOptionalString(process.env['SENTRY_DSN']),
    parseBoolean(process.env['SENTRY_ENABLED']),
  )
}
