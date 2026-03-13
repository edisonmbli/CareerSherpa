import {
  listPendingAnalyticsOutbox,
  markAnalyticsOutboxExported,
  markAnalyticsOutboxRetry,
  type PendingAnalyticsOutboxItem,
} from '@/lib/dal/analyticsEvent'
import { ENV } from '@/lib/env'
import { logError, logInfo, logWarn } from '@/lib/logger'

type JsonRecord = Record<string, unknown>

interface AnalyticsOutboxEnvelope {
  eventId: string
  eventName: string
  occurredAt?: string
  userId?: string
  serviceId?: string
  taskId?: string
  traceId?: string
  templateId?: string
  source?: string
  runtime?: string
  queueKind?: string
  outcome?: string
  errorCode?: string
  idempotencyKey?: string
  category?: string
  duration?: number
  payload?: JsonRecord
}

interface PostHogCaptureEvent {
  event: string
  distinct_id: string
  timestamp?: string
  properties: JsonRecord
}

export interface FlushAnalyticsOutboxResult {
  success: boolean
  attempted: number
  exported: number
  failed: number
  skipped: number
  reason?: string
}

function asRecord(input: unknown): JsonRecord | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  return input as JsonRecord
}

function asString(input: unknown): string | undefined {
  if (typeof input !== 'string') return undefined
  const trimmed = input.trim()
  return trimmed ? trimmed : undefined
}

function asNumber(input: unknown): number | undefined {
  if (typeof input === 'number' && Number.isFinite(input)) return input
  return undefined
}

function parseEnvelope(item: PendingAnalyticsOutboxItem): AnalyticsOutboxEnvelope | null {
  const row = asRecord(item.payload)
  if (!row) return null
  const eventId = asString(row['eventId'])
  const eventName = asString(row['eventName'])
  if (!eventId || !eventName) return null

  const payloadRecord = asRecord(row['payload']) || undefined
  const envelope: AnalyticsOutboxEnvelope = {
    eventId,
    eventName,
  }
  const occurredAt = asString(row['occurredAt'])
  const userId = asString(row['userId'])
  const serviceId = asString(row['serviceId'])
  const taskId = asString(row['taskId'])
  const traceId = asString(row['traceId'])
  const templateId = asString(row['templateId'])
  const source = asString(row['source'])
  const runtime = asString(row['runtime'])
  const queueKind = asString(row['queueKind'])
  const outcome = asString(row['outcome'])
  const errorCode = asString(row['errorCode'])
  const idempotencyKey = asString(row['idempotencyKey'])
  const category = asString(row['category'])
  const duration = asNumber(row['duration'])

  if (occurredAt) envelope.occurredAt = occurredAt
  if (userId) envelope.userId = userId
  if (serviceId) envelope.serviceId = serviceId
  if (taskId) envelope.taskId = taskId
  if (traceId) envelope.traceId = traceId
  if (templateId) envelope.templateId = templateId
  if (source) envelope.source = source
  if (runtime) envelope.runtime = runtime
  if (queueKind) envelope.queueKind = queueKind
  if (outcome) envelope.outcome = outcome
  if (errorCode) envelope.errorCode = errorCode
  if (idempotencyKey) envelope.idempotencyKey = idempotencyKey
  if (category) envelope.category = category
  if (typeof duration === 'number') envelope.duration = duration
  if (payloadRecord) envelope.payload = payloadRecord
  return envelope
}

function toPostHogEvent(envelope: AnalyticsOutboxEnvelope): PostHogCaptureEvent {
  const properties: JsonRecord = {
    ...(envelope.payload || {}),
    event_id: envelope.eventId,
    source: envelope.source || 'ACTION',
    runtime: envelope.runtime || 'NEXTJS',
  }

  if (envelope.serviceId) properties['serviceId'] = envelope.serviceId
  if (envelope.taskId) properties['taskId'] = envelope.taskId
  if (envelope.traceId) properties['traceId'] = envelope.traceId
  if (envelope.templateId) properties['templateId'] = envelope.templateId
  if (envelope.queueKind) properties['queueKind'] = envelope.queueKind
  if (envelope.outcome) properties['outcome'] = envelope.outcome
  if (envelope.errorCode) properties['errorCode'] = envelope.errorCode
  if (envelope.idempotencyKey) properties['idempotencyKey'] = envelope.idempotencyKey
  if (envelope.category) properties['category'] = envelope.category
  if (typeof envelope.duration === 'number') properties['duration'] = envelope.duration

  const payloadShareId = asString(envelope.payload?.['shareId'])
  const payloadSessionId = asString(envelope.payload?.['sessionId'])
  const payloadAnonymousId = asString(envelope.payload?.['anonymousId'])
  const distinctId =
    envelope.userId ||
    (payloadShareId ? `share:${payloadShareId}` : undefined) ||
    (payloadSessionId ? `session:${payloadSessionId}` : undefined) ||
    (payloadAnonymousId ? `anon:${payloadAnonymousId}` : undefined) ||
    (envelope.serviceId ? `service:${envelope.serviceId}` : undefined) ||
    `anon:${envelope.eventId}`

  return {
    event: envelope.eventName,
    distinct_id: distinctId,
    ...(envelope.occurredAt ? { timestamp: envelope.occurredAt } : {}),
    properties,
  }
}

function nextRetryAfterSec(maxRetryCount: number): number {
  const backoff = Math.pow(2, Math.max(0, Math.min(10, maxRetryCount + 1)))
  return Math.max(30, Math.min(3600, backoff))
}

function getPostHogBatchEndpoint(): string {
  const host = (ENV.POSTHOG_HOST || 'https://us.i.posthog.com').replace(/\/+$/, '')
  return `${host}/batch/`
}

function getBatchSize(limit?: number): number {
  const raw = typeof limit === 'number' ? limit : ENV.ANALYTICS_OUTBOX_BATCH_SIZE
  if (!Number.isFinite(raw)) return 200
  return Math.max(1, Math.min(500, Math.floor(raw)))
}

async function sendBatchToPostHog(batch: PostHogCaptureEvent[]): Promise<void> {
  const response = await fetch(getPostHogBatchEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: ENV.POSTHOG_API_KEY,
      batch,
    }),
    cache: 'no-store',
  })

  if (!response.ok) {
    let detail = ''
    try {
      detail = await response.text()
    } catch {
      detail = ''
    }
    throw new Error(`posthog_http_${response.status}:${detail.slice(0, 300)}`)
  }
}

export async function flushAnalyticsOutboxToPostHog(
  limit?: number,
): Promise<FlushAnalyticsOutboxResult> {
  const take = getBatchSize(limit)
  const pending = await listPendingAnalyticsOutbox(take)

  if (pending.length === 0) {
    return { success: true, attempted: 0, exported: 0, failed: 0, skipped: 0 }
  }

  if (!ENV.POSTHOG_API_KEY) {
    return {
      success: true,
      attempted: pending.length,
      exported: 0,
      failed: 0,
      skipped: pending.length,
      reason: 'posthog_not_configured',
    }
  }

  const validRows: PendingAnalyticsOutboxItem[] = []
  const invalidIds: string[] = []
  const posthogBatch: PostHogCaptureEvent[] = []

  for (const row of pending) {
    const envelope = parseEnvelope(row)
    if (!envelope) {
      invalidIds.push(row.id)
      continue
    }
    validRows.push(row)
    posthogBatch.push(toPostHogEvent(envelope))
  }

  if (invalidIds.length > 0) {
    await markAnalyticsOutboxRetry(invalidIds, 'invalid_outbox_payload', 1800)
  }

  if (validRows.length === 0) {
    return {
      success: false,
      attempted: pending.length,
      exported: 0,
      failed: invalidIds.length,
      skipped: 0,
      reason: 'invalid_payload_only',
    }
  }

  const validIds = validRows.map((row) => row.id)
  const maxRetryCount = validRows.reduce(
    (max, row) => (row.retryCount > max ? row.retryCount : max),
    0,
  )
  const retryAfterSec = nextRetryAfterSec(maxRetryCount)

  try {
    await sendBatchToPostHog(posthogBatch)
    await markAnalyticsOutboxExported(validIds)
    logInfo({
      reqId: 'analytics-outbox',
      route: 'analytics/outbox',
      phase: 'flush_success',
      attempted: pending.length,
      exported: validIds.length,
      failed: invalidIds.length,
      skipped: 0,
    })
    return {
      success: true,
      attempted: pending.length,
      exported: validIds.length,
      failed: invalidIds.length,
      skipped: 0,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    await markAnalyticsOutboxRetry(validIds, errorMessage, retryAfterSec)
    logWarn({
      reqId: 'analytics-outbox',
      route: 'analytics/outbox',
      phase: 'flush_failed',
      attempted: pending.length,
      exported: 0,
      failed: validIds.length + invalidIds.length,
      errorCode: 'analytics_outbox_flush_failed',
      message: errorMessage,
    })
    return {
      success: false,
      attempted: pending.length,
      exported: 0,
      failed: validIds.length + invalidIds.length,
      skipped: 0,
      reason: errorMessage,
    }
  }
}
