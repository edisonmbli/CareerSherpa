import { ENV } from '@/lib/env'

type LogBase = {
  reqId?: string
  route?: string
  userKey?: string
  isTrial?: boolean
  lang?: string
  durationMs?: number
  // 支持单值或对象化的 tokens 统计
  tokens?: number | Record<string, number>
  error?: string | Error | unknown
  // 允许附加的结构化信息，例如 phase、inputs_len 等
  [key: string]: unknown
}

type SentryClient = {
  captureException: (
    error: unknown,
    context?: { extra?: Record<string, unknown> },
  ) => void
  captureMessage: (message: string, level?: string) => void
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
  return candidate as SentryClient
}

function getSentryClient() {
  if (sentryPromise) return sentryPromise
  const isNextRuntime = typeof process.env['NEXT_RUNTIME'] === 'string'
  const isWorker = process.env['WORKER_RUNTIME'] === 'true' || !isNextRuntime
  sentryPromise = (isWorker ? import('@sentry/node') : import('@sentry/nextjs'))
    .then((mod) => normalizeSentry(mod as SentryModule))
    .catch(() => null)
  return sentryPromise
}

const isProd = process.env.NODE_ENV === 'production'
const isInfoEnabled = ENV.LOG_INFO || ENV.LOG_DEBUG
const isDebugEnabled = ENV.LOG_DEBUG

function safeStringify(obj: unknown): string {
  try {
    return JSON.stringify(obj, (key, value) => {
      // Handle Error objects explicitly to preserve stack traces in logs
      if (value instanceof Error) {
        return {
          name: value.name,
          message: value.message,
          stack: value.stack,
          cause: value.cause,
        }
      }
      // 处理可能的循环引用和不可序列化的值
      if (typeof value === 'object' && value !== null) {
        if (
          value.constructor &&
          value.constructor.name !== 'Object' &&
          value.constructor.name !== 'Array'
        ) {
          return `[${value.constructor.name}]`
        }
      }
      if (typeof value === 'function') {
        return '[Function]'
      }
      if (typeof value === 'undefined') {
        return '[undefined]'
      }
      return value
    })
  } catch (error) {
    return JSON.stringify({
      error: 'Failed to serialize log entry',
      originalError: String(error),
    })
  }
}

export function logInfo(payload: LogBase) {
  if (!isInfoEnabled) return
  const entry = { level: 'info', ts: new Date().toISOString(), ...payload }
  if (!isProd) {
    console.log(safeStringify(entry))
    return
  }
  void getSentryClient().then((Sentry) => {
    if (!Sentry) return
    Sentry.captureMessage(safeStringify(entry), 'info')
  })
}

export function logDebug(payload: LogBase) {
  if (!isDebugEnabled) return
  const entry = { level: 'debug', ts: new Date().toISOString(), ...payload }
  if (!isProd) {
    console.log(safeStringify(entry))
    return
  }
  void getSentryClient().then((Sentry) => {
    if (!Sentry) return
    Sentry.captureMessage(safeStringify(entry), 'debug')
  })
}

export function logError(payload: LogBase) {
  const entry = { level: 'error', ts: new Date().toISOString(), ...payload }
  if (!isProd) {
    console.error(safeStringify(entry))
    return
  }

  const errorObj =
    payload.error instanceof Error
      ? payload.error
      : new Error(
          typeof payload.error === 'string'
            ? payload.error
            : JSON.stringify(payload.error || 'Unknown Error'),
        )
  void getSentryClient().then((Sentry) => {
    if (!Sentry) return
    Sentry.captureException(errorObj, {
      extra: {
        ...payload,
      },
    })
  })
}
