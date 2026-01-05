import { ENV } from '@/lib/env'
import { publishEvent } from '@/lib/worker/common'
import { getProvider } from '@/lib/llm/utils'
import type { ModelId } from '@/lib/llm/providers'

export async function publishStart(
  channel: string,
  taskId: string,
  _modelId: string, // Not exposed to frontend for security
  queueId: string,
  stage: string,
  requestId: string,
  traceId: string,
  kind: 'stream' | 'batch'
) {
  await publishEvent(channel, {
    type: 'start',
    taskId,
    // NOTE: modelId and provider are intentionally omitted for security
    queueId,
    stage,
    timeoutSec: Math.ceil(ENV.WORKER_TIMEOUT_MS / 1000),
    requestId,
    traceId,
    kind,
  })
}

export async function guardBlocked(
  channel: string,
  taskId: string,
  reason: 'user_concurrency' | 'model_concurrency' | 'guards_failed' | 'concurrency_locked' | 'backpressure',
  stage: 'guards',
  requestId: string,
  traceId: string,
  retryAfter?: number
) {
  await publishEvent(channel, {
    type: 'error',
    taskId,
    code: reason,
    error: reason,
    stage,
    ...(typeof retryAfter === 'number' ? { retryAfter } : {}),
    requestId,
    traceId,
  })
}

export async function emitStreamIdle(
  channel: string,
  taskId: string,
  _modelId: string, // Not exposed to frontend for security
  requestId: string,
  traceId: string
) {
  await publishEvent(channel, {
    type: 'info',
    taskId,
    code: 'stream_idle',
    stage: 'stream',
    // NOTE: modelId and provider are intentionally omitted for security
    requestId,
    traceId,
  })
}
