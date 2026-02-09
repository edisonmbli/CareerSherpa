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
    process.env.NODE_ENV !== 'production' ||
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

function log(level: LogLevel, category: string, action: string, data?: unknown) {
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
    // Connection lifecycle
    connection: (action: string, data?: unknown) => log('info', 'CONN', action, data),

    // SSE events received
    event: (type: string, data?: unknown) => log('debug', 'EVENT', type, data),

    // State machine transitions
    stateChange: (from: string, to: string, trigger?: string) =>
        log('info', 'STATE', `${from} → ${to}`, trigger ? { trigger } : undefined),

    // Progress updates
    progress: (value: number, stage: string) =>
        log('debug', 'PROGRESS', `${value}% (${stage})`),

    // Content updates
    content: (
        type: 'vision' | 'match' | 'ocr' | 'summary' | 'preMatch' | 'interview',
        length: number,
    ) =>
        log('debug', 'CONTENT', `${type} buffer: ${length} chars`),

    // Errors
    error: (message: string, data?: unknown) => log('error', 'ERROR', message, data),

    // Warnings
    warn: (message: string, data?: unknown) => log('warn', 'WARN', message, data),

    // Export buffered logs for debugging
    exportLogs: () => [...logBuffer],

    // Clear log buffer
    clearLogs: () => {
        logBuffer.length = 0
    },
}

// Expose for console debugging
if (IS_DEBUG && typeof window !== 'undefined') {
    ; (window as any).__sseDebugLogs = () => sseLog.exportLogs()
        ; (window as any).__sseClearLogs = () => sseLog.clearLogs()
}
