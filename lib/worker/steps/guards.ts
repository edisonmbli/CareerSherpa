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
    const retryAfter = gate.response.headers.get('Retry-After')
    await guardBlocked(channel, userId, 'user_concurrency' as any, 'guards', requestId, traceId, retryAfter ? Number(retryAfter) : undefined)
    return { ok: false, reason: 'user_concurrency' as const, retryAfter: retryAfter ? Number(retryAfter) : undefined }
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
    const retryAfter = gate.response.headers.get('Retry-After')
    await guardBlocked(channel, userIdFromChannel(channel), 'model_concurrency' as any, 'guards', requestId, traceId, retryAfter ? Number(retryAfter) : undefined)
    return { ok: false, reason: 'model_concurrency' as const, retryAfter: retryAfter ? Number(retryAfter) : undefined }
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
  traceId: string
) {
  const gate = await enterGuards(userId, kind, counterKey, ttlSec, maxSize, true)
  if (!gate.ok) {
    const msg = await safeText(gate.response)
    const retryAfter = gate.response.headers.get('Retry-After')
    const code = msg === 'concurrency_locked' ? 'concurrency_locked' : msg === 'backpressure' ? 'backpressure' : 'guards_failed'
    await guardBlocked(channel, userId, code as any, 'guards', requestId, traceId, retryAfter ? Number(retryAfter) : undefined)
    return { ok: false as const, reason: code as 'concurrency_locked' | 'backpressure' | 'guards_failed', retryAfter: retryAfter ? Number(retryAfter) : undefined }
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
