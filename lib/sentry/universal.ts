import { ENV } from '@/lib/env'

type SentryUser = {
  id?: string
  email?: string
  username?: string
}

type SentryExtraContext = Record<string, unknown>

type SentryClient = {
  captureException: (error: unknown, context?: { extra?: SentryExtraContext }) => string
  captureMessage: (message: string, level?: string) => string
  setUser: (user: SentryUser | null) => void
  setTag: (key: string, value: string) => void
  setContext: (name: string, context: Record<string, unknown> | null) => void
  withScope?: (callback: (scope: any) => void) => void
}

type SentryModule =
  | typeof import('@sentry/nextjs')
  | typeof import('@sentry/node')
  | { default?: unknown }

let sentryPromise: Promise<SentryClient | null> | null = null

function normalizeSentry(mod: SentryModule | null): SentryClient | null {
  if (!mod) return null
  const candidate =
    typeof (mod as any).captureException === 'function'
      ? mod
      : (mod as any).default
  if (!candidate) return null
  if (typeof (candidate as any).captureException !== 'function') return null
  if (typeof (candidate as any).captureMessage !== 'function') return null
  if (typeof (candidate as any).setUser !== 'function') return null
  if (typeof (candidate as any).setTag !== 'function') return null
  if (typeof (candidate as any).setContext !== 'function') return null
  return candidate as SentryClient
}

export async function getRuntimeSentryClient() {
  if (sentryPromise) return sentryPromise
  const isNextRuntime = typeof process.env['NEXT_RUNTIME'] === 'string'
  const isWorker = process.env['WORKER_RUNTIME'] === 'true' || !isNextRuntime
  const canUseSentry =
    Boolean(ENV.NEXT_PUBLIC_SENTRY_DSN) || Boolean(ENV.SENTRY_DSN)

  if (!canUseSentry) {
    sentryPromise = Promise.resolve(null)
    return sentryPromise
  }

  sentryPromise = (isWorker ? import('@sentry/node') : import('@sentry/nextjs'))
    .then((mod) => normalizeSentry(mod as SentryModule))
    .catch(() => null)

  return sentryPromise
}

async function withClient<T>(
  callback: (client: SentryClient) => T,
): Promise<T | undefined> {
  const client = await getRuntimeSentryClient()
  if (!client) return undefined
  return callback(client)
}

export async function captureException(
  error: unknown,
  extra?: SentryExtraContext,
) {
  return await withClient((client) => {
    if (extra && typeof client.withScope === 'function') {
      let eventId: string | undefined
      client.withScope?.((scope) => {
        if (typeof scope?.setExtras === 'function') {
          scope.setExtras(extra)
        }
        eventId = client.captureException(error)
      })
      return eventId
    }
    return client.captureException(error, extra ? { extra } : undefined)
  })
}

export async function captureMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug' = 'info',
) {
  return await withClient((client) => client.captureMessage(message, level))
}

export async function setUser(user: SentryUser | null) {
  return await withClient((client) => client.setUser(user))
}

export async function setTag(key: string, value: string) {
  return await withClient((client) => client.setTag(key, value))
}

export async function setContext(
  name: string,
  context: Record<string, unknown> | null,
) {
  return await withClient((client) => client.setContext(name, context))
}

export async function captureHandledError(
  error: unknown,
  context: {
    tag?: [string, string]
    extra?: SentryExtraContext
    section?: [string, Record<string, unknown>]
  } = {},
) {
  return await withClient((client) => {
    if (typeof client.withScope !== 'function') {
      return client.captureException(error, context.extra ? { extra: context.extra } : undefined)
    }

    let eventId: string | undefined
    client.withScope((scope) => {
      if (context.tag && typeof scope?.setTag === 'function') {
        scope.setTag(context.tag[0], context.tag[1])
      }
      if (context.section && typeof scope?.setContext === 'function') {
        scope.setContext(context.section[0], context.section[1])
      }
      if (context.extra && typeof scope?.setExtras === 'function') {
        scope.setExtras(context.extra)
      }
      eventId = client.captureException(error)
    })
    return eventId
  })
}
