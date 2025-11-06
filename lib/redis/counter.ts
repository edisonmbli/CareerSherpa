import { ENV, isProdRedisReady } from '@/lib/env'

type BackpressureResult = {
  ok: boolean
  pending?: number
  remaining?: number
  retryAfter?: number // seconds
}

// In-memory fallback for local/dev when Upstash is not configured
const memCounters = new Map<string, { count: number; expiresAt: number }>()

async function upstashPipeline(cmds: string[][]) {
  const res = await fetch(`${ENV.UPSTASH_REDIS_REST_URL}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ENV.UPSTASH_REDIS_REST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(cmds),
  })
  if (!res.ok) {
    throw new Error('upstash_request_failed')
  }
  return res.json()
}

function nowMs() {
  return Date.now()
}

function memoryBump(key: string, ttlSec: number, maxPending: number): BackpressureResult {
  const rec = memCounters.get(key)
  const now = nowMs()
  if (!rec || rec.expiresAt <= now) {
    memCounters.set(key, { count: 0, expiresAt: now + ttlSec * 1000 })
  }
  const cur = memCounters.get(key)!
  const next = cur.count + 1
  if (next > maxPending) {
    const retryAfter = Math.max(1, Math.ceil((cur.expiresAt - now) / 1000))
    return { ok: false, pending: cur.count, remaining: 0, retryAfter }
  }
  cur.count = next
  return { ok: true, pending: next, remaining: Math.max(0, maxPending - next) }
}

function memoryDec(key: string): number {
  const rec = memCounters.get(key)
  const now = nowMs()
  if (!rec || rec.expiresAt <= now) {
    memCounters.delete(key)
    return 0
  }
  rec.count = Math.max(0, rec.count - 1)
  if (rec.count === 0) {
    memCounters.delete(key)
    return 0
  }
  return rec.count
}

function memoryGet(key: string): number {
  const rec = memCounters.get(key)
  const now = nowMs()
  if (!rec || rec.expiresAt <= now) return 0
  return rec.count
}

/**
 * Atomically bump pending counter with TTL and enforce a max.
 * If the bump would exceed maxPending, it returns ok=false without changing the counter
 * in memory fallback. In Redis mode, we INCR then roll back with DECR to approximate atomicity.
 */
export async function bumpPending(
  key: string,
  ttlSec: number,
  maxPending: number
): Promise<BackpressureResult> {
  if (!isProdRedisReady()) {
    return memoryBump(key, ttlSec, maxPending)
  }

  try {
    const out = await upstashPipeline([
      ['INCR', key],
      ['EXPIRE', key, String(ttlSec)],
      ['TTL', key],
    ])
    const c = Number(out?.[0]?.result)
    const t = Number(out?.[2]?.result)
    const retryAfter = t > 0 ? t : ttlSec
    if (Number.isNaN(c)) return { ok: false, retryAfter }
    if (c > maxPending) {
      // roll back to previous value
      try {
        await upstashPipeline([['DECR', key]])
      } catch {
        // ignore rollback failure; consumer will still see backpressure
      }
      const pending = Math.max(0, c - 1)
      return { ok: false, pending, remaining: 0, retryAfter }
    }
    return { ok: true, pending: c, remaining: Math.max(0, maxPending - c) }
  } catch {
    // network error: fall back to memory
    return memoryBump(key, ttlSec, maxPending)
  }
}

/**
 * Decrement pending counter; if it reaches zero, the key is deleted in memory fallback.
 * In Redis mode, we simply DECR and leave TTL as-is.
 */
export async function decPending(key: string): Promise<number> {
  if (!isProdRedisReady()) {
    return memoryDec(key)
  }
  try {
    const out = await upstashPipeline([
      ['DECR', key],
      ['GET', key],
    ])
    const val = Number(out?.[1]?.result)
    if (Number.isNaN(val) || val < 0) return 0
    return val
  } catch {
    return memoryDec(key)
  }
}

export async function getPending(key: string): Promise<number> {
  if (!isProdRedisReady()) {
    return memoryGet(key)
  }
  try {
    const out = await upstashPipeline([
      ['GET', key],
      ['TTL', key],
    ])
    const val = Number(out?.[0]?.result)
    const ttl = Number(out?.[1]?.result)
    if (Number.isNaN(val) || ttl <= 0) return 0
    return val
  } catch {
    return memoryGet(key)
  }
}