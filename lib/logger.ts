import { ENV } from '@/lib/env'
import { captureException } from '@/lib/sentry/universal'

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
  console.log(safeStringify(entry))
}

export function logDebug(payload: LogBase) {
  if (!isDebugEnabled) return
  const entry = { level: 'debug', ts: new Date().toISOString(), ...payload }
  console.log(safeStringify(entry))
}

export function logWarn(payload: LogBase) {
  if (!isInfoEnabled) return
  const entry = { level: 'warn', ts: new Date().toISOString(), ...payload }
  console.warn(safeStringify(entry))
}

export function logError(payload: LogBase) {
  const entry = { level: 'error', ts: new Date().toISOString(), ...payload }
  console.error(safeStringify(entry))

  const errorObj =
    payload.error instanceof Error
      ? payload.error
      : new Error(
          typeof payload.error === 'string'
            ? payload.error
            : JSON.stringify(payload.error || 'Unknown Error'),
        )
  void captureException(errorObj, {
    ...payload,
  })
}
