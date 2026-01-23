import { ENV, isProdRedisReady } from '@/lib/env'
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

function isPersistentKey(key: string): boolean {
  return key.startsWith('bp:queue:') || key.startsWith('active:model:')
}

function getPersistentTtlSec(): number {
  return Math.max(1, Number(ENV.CONCURRENCY_PERSISTENT_TTL_SECONDS || 0))
}

function memoryBump(
  key: string,
  ttlSec: number,
  maxPending: number,
): BackpressureResult {
  const rec = memCounters.get(key)
  const now = nowMs()
  const persistent = isPersistentKey(key)
  const persistentTtlSec = persistent ? getPersistentTtlSec() : ttlSec
  if (!rec || rec.expiresAt <= now) {
    memCounters.set(key, { count: 0, expiresAt: now + persistentTtlSec * 1000 })
  }
  if (persistent) {
    const curRec = memCounters.get(key)
    if (curRec) curRec.expiresAt = now + persistentTtlSec * 1000
  }
  const cur = memCounters.get(key)!
  const next = cur.count + 1
  if (next > maxPending) {
    const retryAfter = persistent
      ? Math.max(1, Math.ceil(ttlSec))
      : Math.max(1, Math.ceil((cur.expiresAt - now) / 1000))
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
  const persistent = isPersistentKey(key)
  const keepZeroSec = persistent
    ? getPersistentTtlSec()
    : Math.max(0, Number(ENV.CONCURRENCY_KEEP_ZERO_TTL_SECONDS || 0))
  const next = Math.max(0, rec.count - 1)
  rec.count = next
  if (persistent) {
    rec.expiresAt = now + keepZeroSec * 1000
  }
  if (next === 0 && keepZeroSec > 0) {
    rec.expiresAt = now + keepZeroSec * 1000
    return 0
  }
  if (next === 0) {
    memCounters.delete(key)
    return 0
  }
  return next
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
  maxPending: number,
): Promise<BackpressureResult> {
  if (!isProdRedisReady()) {
    return memoryBump(key, ttlSec, maxPending)
  }

  try {
    const redis = getRedis()
    const ttlSeconds = Math.max(1, Math.floor(ttlSec))
    const persistent = isPersistentKey(key)
    const persistentTtlSec = persistent ? getPersistentTtlSec() : ttlSeconds
    const cRaw = await redis.incr(key)
    const c = Number(cRaw)
    if (Number.isNaN(c)) return { ok: false, retryAfter: ttlSeconds }
    if (c <= 0) {
      try {
        await redis.set(key, '1', { ex: persistentTtlSec })
      } catch {}
      return { ok: true, pending: 1, remaining: Math.max(0, maxPending - 1) }
    }
    if (persistent) {
      try {
        await redis.expire(key, persistentTtlSec)
      } catch {}
    } else if (c === 1) {
      try {
        await redis.expire(key, ttlSeconds)
      } catch {}
    }
    if (c > maxPending) {
      // roll back to previous value
      try {
        await redis.decr(key)
      } catch {
        // ignore rollback failure; consumer will still see backpressure
      }
      const pending = Math.max(0, c - 1)
      let retryAfter = ttlSeconds
      if (!persistent) {
        try {
          const tRaw = await redis.ttl(key)
          const t = Number(tRaw)
          if (!Number.isNaN(t) && t > 0) retryAfter = t
        } catch {}
      }
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
    const persistent = isPersistentKey(key)
    const keepZeroSec = persistent
      ? getPersistentTtlSec()
      : Math.max(0, Number(ENV.CONCURRENCY_KEEP_ZERO_TTL_SECONDS || 0))
    const script = `
local v = redis.call("GET", KEYS[1])
if not v then return 0 end
local n = tonumber(v)
if not n then redis.call("DEL", KEYS[1]); return 0 end
n = n - 1
if n <= 0 then
  local keep = tonumber(ARGV[1]) or 0
  if keep > 0 then
    redis.call("SET", KEYS[1], 0, "EX", keep)
  else
    redis.call("DEL", KEYS[1])
  end
  return 0
end
local persistent = tonumber(ARGV[2]) or 0
if persistent == 1 then
  local keep = tonumber(ARGV[1]) or 0
  if keep > 0 then
    redis.call("SET", KEYS[1], n, "EX", keep)
  else
    redis.call("SET", KEYS[1], n, "KEEPTTL")
  end
else
  redis.call("SET", KEYS[1], n, "KEEPTTL")
end
return n
`
    const res = await redis.eval(
      script,
      [key],
      [keepZeroSec, persistent ? 1 : 0],
    )
    const next = Number(res)
    return Number.isFinite(next) ? next : 0
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
    const raw = await redis.get(key)
    if (raw === null || raw === undefined) return 0
    const val = Number(raw)
    if (Number.isNaN(val)) {
      try {
        await redis.del(key)
      } catch {}
      return 0
    }
    const ttl = Number(await redis.ttl(key))
    const persistent = isPersistentKey(key)
    if (ttl <= 0) {
      if (persistent) {
        const keepAlive = getPersistentTtlSec()
        try {
          await redis.expire(key, keepAlive)
        } catch {}
      } else {
        try {
          await redis.del(key)
        } catch {}
        return 0
      }
    }
    if (val < 0) {
      try {
        await redis.del(key)
      } catch {}
      return 0
    }
    if (val === 0) {
      if (!persistent) {
        const keepZeroSec = Math.max(
          0,
          Number(ENV.CONCURRENCY_KEEP_ZERO_TTL_SECONDS || 0),
        )
        if (keepZeroSec === 0) {
          try {
            await redis.del(key)
          } catch {}
        }
      }
      return 0
    }
    return val
  } catch {
    return memoryGet(key)
  }
}
