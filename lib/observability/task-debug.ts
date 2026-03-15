import { promises as fsp } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { ENV, shouldWriteLocalTaskDebugFiles } from '@/lib/env'

const MAX_PREVIEW_CHARS = 600
const MAX_OBJECT_KEYS = 24
const MAX_ARRAY_ITEMS = 12
const currentFile = fileURLToPath(import.meta.url)
const repoRoot = path.resolve(path.dirname(currentFile), '..', '..')

export type TaskDebugRuntime = 'nextjs' | 'worker'

function getTaskDebugRuntime(): TaskDebugRuntime {
  return process.env['WORKER_RUNTIME'] === 'true' ? 'worker' : 'nextjs'
}

function getTaskDebugDir(runtime: TaskDebugRuntime) {
  if (runtime === 'worker') {
    return path.join(repoRoot, 'worker', 'tmp', 'task-debug')
  }
  return path.join(repoRoot, 'tmp', 'task-debug', 'nextjs')
}

function truncateString(value: string) {
  if (value.length <= MAX_PREVIEW_CHARS) return value
  return `${value.slice(0, MAX_PREVIEW_CHARS)}... [truncated ${value.length - MAX_PREVIEW_CHARS} chars]`
}

function summarizeValue(value: unknown, depth: number = 0): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === 'string') return truncateString(value)
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (value instanceof Error) {
    return {
      name: value.name,
      message: truncateString(value.message),
      stack: value.stack ? truncateString(value.stack) : undefined,
    }
  }
  if (depth >= 2) {
    if (Array.isArray(value)) return `[array(${value.length})]`
    return '[object]'
  }
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map((item) => summarizeValue(item, depth + 1))
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).slice(
      0,
      MAX_OBJECT_KEYS,
    )
    return Object.fromEntries(
      entries.map(([key, val]) => [key, summarizeValue(val, depth + 1)]),
    )
  }
  return String(value)
}

function sanitizeId(value?: string) {
  const raw = String(value || 'system').trim()
  return raw.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'system'
}

function buildDebugFilePath(serviceId?: string, taskId?: string) {
  const runtime = getTaskDebugRuntime()
  const key = taskId || serviceId || 'system'
  const prefix = serviceId ? `${sanitizeId(serviceId)}__` : ''
  return path.join(
    getTaskDebugDir(runtime),
    `${prefix}${sanitizeId(key)}.jsonl`,
  )
}

export type TaskDebugScope = 'timeline' | 'llm' | 'sse'

export async function appendTaskDebugEvent(entry: {
  scope: TaskDebugScope
  phase: string
  serviceId?: string
  taskId?: string
  templateId?: string
  requestId?: string
  traceId?: string
  stage?: string
  elapsedMs?: number
  meta?: Record<string, unknown>
}) {
  if (!ENV.LOG_DEBUG || !shouldWriteLocalTaskDebugFiles()) return

  const payload = {
    ts: new Date().toISOString(),
    runtime: getTaskDebugRuntime(),
    scope: entry.scope,
    stage: entry.stage || entry.scope,
    phase: entry.phase,
    ...(entry.serviceId ? { serviceId: entry.serviceId } : {}),
    ...(entry.taskId ? { taskId: entry.taskId } : {}),
    ...(entry.templateId ? { templateId: entry.templateId } : {}),
    ...(entry.requestId ? { requestId: entry.requestId } : {}),
    ...(entry.traceId ? { traceId: entry.traceId } : {}),
    ...(typeof entry.elapsedMs === 'number' ? { elapsedMs: entry.elapsedMs } : {}),
    ...(entry.meta ? { meta: summarizeValue(entry.meta) } : {}),
  }

  const filePath = buildDebugFilePath(entry.serviceId, entry.taskId)
  await fsp.mkdir(path.dirname(filePath), { recursive: true })
  await fsp.appendFile(filePath, JSON.stringify(payload) + '\n', 'utf8')
}

export function summarizeDebugPayload(value: unknown) {
  return summarizeValue(value)
}

export function summarizeDebugText(value?: string) {
  if (!value) return ''
  return truncateString(value)
}
