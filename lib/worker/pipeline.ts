import { ENV } from '@/lib/env'
import { publishEvent } from '@/lib/worker/common'
import { getProvider } from '@/lib/llm/utils'
import type { ModelId } from '@/lib/llm/providers'

export async function publishStart(
  channel: string,
  taskId: string,
  modelId: ModelId,
  queueId: string,
  stage: string,
  requestId: string,
  traceId: string,
  kind: 'stream' | 'batch'
) {
  await publishEvent(channel, {
    type: 'start',
    taskId,
    provider: getProvider(modelId),
    modelId,
    queueId,
    stage,
    timeoutSec: Math.ceil(ENV.WORKER_TIMEOUT_MS / 1000),
    requestId,
    traceId,
    kind,
  } as any)
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
  modelId: ModelId,
  requestId: string,
  traceId: string
) {
  await publishEvent(channel, {
    type: 'info',
    taskId,
    code: 'stream_idle',
    stage: 'stream',
    provider: getProvider(modelId),
    modelId,
    requestId,
    traceId,
  })
}
