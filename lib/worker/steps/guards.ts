import { logInfo } from '@/lib/logger'
import { enterUserConcurrency, enterModelConcurrency, enterGuards } from '@/lib/worker/common'
import { guardBlocked } from '@/lib/worker/pipeline'

export async function guardUser(
  userId: string,
  kind: 'stream' | 'batch',
  ttlSec: number,
  channel: string,
  requestId: string,
  traceId: string
) {
  const gate = await enterUserConcurrency(userId, kind, ttlSec)
  if (!gate.ok) {
    const retryAfter = getRetryAfter(gate.response)
    logInfo({
      reqId: requestId,
      route: `worker/${kind}`,
      userKey: userId,
      phase: 'guard_user_blocked',
      retryAfter,
    })
    await guardBlocked(
      channel,
      userId,
      'user_concurrency',
      'guards',
      requestId,
      traceId,
      retryAfter
    )
    return { ok: false, reason: 'user_concurrency' as const, retryAfter }
  }
  return { ok: true as const }
}

export async function guardModel(
  modelId: any,
  queueId: string,
  ttlSec: number,
  channel: string,
  requestId: string,
  traceId: string
) {
  const gate = await enterModelConcurrency(modelId, queueId, ttlSec)
  if (!gate.ok) {
    const retryAfter = getRetryAfter(gate.response)
    logInfo({
      reqId: requestId,
      route: 'worker/model',
      userKey: userIdFromChannel(channel),
      phase: 'guard_model_blocked',
      queueId,
      modelId,
      retryAfter,
    })
    await guardBlocked(
      channel,
      userIdFromChannel(channel),
      'model_concurrency',
      'guards',
      requestId,
      traceId,
      retryAfter
    )
    return { ok: false, reason: 'model_concurrency' as const, retryAfter }
  }
  return { ok: true as const }
}

export async function guardQueue(
  userId: string,
  kind: 'stream' | 'batch',
  counterKey: string,
  ttlSec: number,
  maxSize: number,
  channel: string,
  requestId: string,
  traceId: string,
  doQueueBump: boolean = true
) {
  const gate = await enterGuards(
    userId,
    kind,
    counterKey,
    ttlSec,
    maxSize,
    doQueueBump,
  )
  if (!gate.ok) {
    const msg = await safeText(gate.response)
    const retryAfter = getRetryAfter(gate.response)
    const code = normalizeGuardCode(msg)
    logInfo({
      reqId: requestId,
      route: `worker/${kind}`,
      userKey: userId,
      phase: 'guard_queue_blocked',
      reason: code,
      counterKey,
      maxSize,
      ...(gate.pending !== undefined ? { pending: gate.pending } : {}),
      retryAfter,
    })
    await guardBlocked(
      channel,
      userId,
      code as 'concurrency_locked' | 'backpressure' | 'guards_failed',
      'guards',
      requestId,
      traceId,
      retryAfter
    )
    return {
      ok: false as const,
      reason: code as 'concurrency_locked' | 'backpressure' | 'guards_failed',
      retryAfter,
      ...(gate.pending !== undefined ? { pending: gate.pending } : {}),
      ...(gate.maxSize !== undefined ? { maxSize: gate.maxSize } : {}),
    }
  }
  return { ok: true as const }
}

function userIdFromChannel(ch: string): string {
  const parts = ch.split(':')
  return parts?.[2] || ''
}

async function safeText(res: Response): Promise<string> {
  try { return await res.text() } catch { return 'guards_failed' }
}

function getRetryAfter(res: Response): number | undefined {
  const value = res.headers.get('Retry-After')
  if (!value) return undefined
  const num = Number(value)
  return Number.isFinite(num) ? num : undefined
}

function normalizeGuardCode(msg: string) {
  if (msg === 'concurrency_locked') return 'concurrency_locked'
  if (msg === 'backpressure') return 'backpressure'
  return 'guards_failed'
}
