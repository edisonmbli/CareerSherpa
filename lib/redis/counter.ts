import { isProdRedisReady } from '@/lib/env'
import { getRedis } from '@/lib/redis/client'

type BackpressureResult = {
  ok: boolean
  pending?: number
  remaining?: number
  retryAfter?: number // seconds
}

// In-memory fallback for local/dev when Upstash is not configured
const memCounters = new Map<string, { count: number; expiresAt: number }>()

// 统一 Upstash 访问方式：改用 getRedis 客户端

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
    const redis = getRedis()
    const cRaw = await redis.incr(key)
    const c = Number(cRaw)
    if (Number.isNaN(c)) return { ok: false, retryAfter: ttlSec }
    // 仅首次设置过期，减少 EXPIRE 写
    if (c === 1) {
      try { await redis.expire(key, ttlSec) } catch {}
    }
    if (c > maxPending) {
      // roll back to previous value
      try {
        await redis.decr(key)
      } catch {
        // ignore rollback failure; consumer will still see backpressure
      }
      const pending = Math.max(0, c - 1)
      // 仅在超限时读取 TTL 以提供更准确的重试时间
      let retryAfter = ttlSec
      try {
        const tRaw = await redis.ttl(key)
        const t = Number(tRaw)
        if (!Number.isNaN(t) && t > 0) retryAfter = t
      } catch {}
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
    const redis = getRedis()
    await redis.decr(key)
    // 这里无需读取当前值；调用方未使用返回值，直接返回 0 以减少额外 GET 读
    return 0
  } catch {
    return memoryDec(key)
  }
}

export async function getPending(key: string): Promise<number> {
  if (!isProdRedisReady()) {
    return memoryGet(key)
  }
  try {
    const redis = getRedis()
    const val = Number(await redis.get(key))
    const ttl = Number(await redis.ttl(key))
    if (Number.isNaN(val) || ttl <= 0) return 0
    return val
  } catch {
    return memoryGet(key)
  }
}