/**
 * SSE Debug Logger
 *
 * Detailed logging for SSE events during development.
 * All logs are disabled in production builds.
 *
 * Usage:
 *   import { sseLog } from '@/lib/ui/sse-debug-logger'
 *   sseLog.connection('connected', { serviceId, taskId })
 *   sseLog.event('status', payload)
 *   sseLog.stateChange('IDLE', 'JOB_VISION_PENDING')
 */

const IS_DEBUG =
  process.env['NEXT_PUBLIC_LOG_DEBUG'] === 'true' ||
  process.env['NEXT_PUBLIC_SSE_DEBUG'] === 'true'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  timestamp: string
  category: string
  action: string
  data?: unknown
}

const logBuffer: LogEntry[] = []
const MAX_BUFFER_SIZE = 100

function formatTime(): string {
  return new Date().toISOString().slice(11, 23) // HH:mm:ss.SSS
}

function log(
  level: LogLevel,
  category: string,
  action: string,
  data?: unknown,
) {
  if (!IS_DEBUG) return

  const entry: LogEntry = {
    timestamp: formatTime(),
    category,
    action,
    data,
  }

  // Buffer for export
  logBuffer.push(entry)
  if (logBuffer.length > MAX_BUFFER_SIZE) {
    logBuffer.shift()
  }

  // Console output with styling
  const prefix = `[SSE:${category}]`
  const styles = {
    debug: 'color: #888',
    info: 'color: #2196F3',
    warn: 'color: #FF9800',
    error: 'color: #F44336',
  }

  if (data !== undefined) {
    console[level](`%c${prefix} ${action}`, styles[level], data)
  } else {
    console[level](`%c${prefix} ${action}`, styles[level])
  }
}

export const sseLog = {
  connection: (action: string, data?: unknown) =>
    log('info', 'CONN', action, data),
  event: (type: string, data?: unknown) => log('debug', 'EVENT', type, data),
  stateChange: (from: string, to: string, trigger?: string) =>
    log('info', 'STATE', `${from} → ${to}`, trigger ? { trigger } : undefined),
  progress: (value: number, stage: string) =>
    log('debug', 'PROGRESS', `${value}% (${stage})`),
  content: (
    type: 'vision' | 'match' | 'ocr' | 'summary' | 'preMatch' | 'interview',
    length: number,
  ) => log('debug', 'CONTENT', `${type} buffer: ${length} chars`),
  error: (message: string, data?: unknown) =>
    log('error', 'ERROR', message, data),
  warn: (message: string, data?: unknown) => log('warn', 'WARN', message, data),
  exportLogs: () => [...logBuffer],
  clearLogs: () => {
    logBuffer.length = 0
  },
}

export const uiLog = {
  debug: (action: string, data?: unknown) => log('debug', 'UI', action, data),
  info: (action: string, data?: unknown) => log('info', 'UI', action, data),
  warn: (action: string, data?: unknown) => log('warn', 'UI', action, data),
  error: (action: string, data?: unknown) => log('error', 'UI', action, data),
  event: (category: string, action: string, data?: unknown) =>
    log('debug', category, action, data),
  exportLogs: () => [...logBuffer],
  clearLogs: () => {
    logBuffer.length = 0
  },
}

// Expose for console debugging
if (IS_DEBUG && typeof window !== 'undefined') {
  ;(window as any).__sseDebugLogs = () => sseLog.exportLogs()
  ;(window as any).__sseClearLogs = () => sseLog.clearLogs()
}
