import { isProdRedisReady, ENV } from './env'
import { getRedis } from '@/lib/redis/client'

type RateResult = { ok: boolean; remaining?: number; retryAfter?: number }

// Configurable rate limits from environment
const windowSec = ENV.RATE_LIMIT_PAID_WINDOW_SEC || 300 // 5 minutes for paid
const trialLimit = 3 // Legacy: for trial users
const boundLimit = ENV.RATE_LIMIT_PAID_MAX || 10 // Paid: 10 calls per window
const dailyFreeLimit = ENV.RATE_LIMIT_FREE_DAILY || 8 // Free: 8 calls per day
const UPSTASH_TIMEOUT_MS = 5000 // 5s timeout for Redis operations to handle network latency

const mem = new Map<string, { count: number; resetAt: number }>()
const memDaily = new Map<string, { count: number; resetAt: number }>()

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Upstash timeout')), ms)
    ),
  ])
}

// 统一 Upstash 访问方式：改用 getRedis 客户端
async function upstashRate(key: string, limit: number, ttlSec: number): Promise<RateResult> {
  const redis = getRedis()
  const cRaw = await redis.incr(key)
  const c = Number(cRaw)
  if (Number.isNaN(c)) {
    return { ok: false, retryAfter: ttlSec }
  }

  // 仅首次设置过期，避免每次都写 EXPIRE
  if (c === 1) {
    try {
      await redis.expire(key, ttlSec)
    } catch {
      // 忽略过期设置失败，限流按窗口秒回退
    }
  } else {
    // Ensure TTL exists to prevent infinite keys
    try {
      const ttl = await redis.ttl(key)
      if (ttl === -1) await redis.expire(key, ttlSec)
    } catch { }
  }

  // 仅超限时读取 TTL，以估算精确的 retryAfter
  if (c > limit) {
    let retryAfter = ttlSec
    try {
      const tRaw = await redis.ttl(key)
      const t = Number(tRaw)
      if (!Number.isNaN(t) && t > 0) retryAfter = t
    } catch {
      // 读取 TTL 失败时，保守回退到窗口秒
    }
    return { ok: false, retryAfter }
  }

  return { ok: true, remaining: Math.max(0, limit - c) }
}

function memoryRate(key: string, limit: number, ttlSec: number): RateResult {
  const now = Date.now()
  const rec = mem.get(key)
  if (!rec || now > rec.resetAt) {
    mem.set(key, { count: 1, resetAt: now + ttlSec * 1000 })
    return { ok: true, remaining: limit - 1 }
  }
  const next = rec.count + 1
  mem.set(key, { count: next, resetAt: rec.resetAt })
  if (next > limit) {
    const retryAfter = Math.ceil((rec.resetAt - now) / 1000)
    return { ok: false, retryAfter }
  }
  return { ok: true, remaining: Math.max(0, limit - next) }
}

/**
 * Check daily rate limit for Free tier Gemini calls
 * Returns ok:true for Paid tier (uses window-based limit instead)
 */
export async function checkDailyRateLimit(
  userId: string,
  tier: 'free' | 'paid'
): Promise<RateResult> {
  if (tier === 'paid') return { ok: true } // Paid uses window-based limit

  const key = `rate:daily:${userId}:gemini`
  const ttlSec = 86400 // 24 hours

  if (isProdRedisReady()) {
    try {
      const result = await withTimeout(
        upstashRate(key, dailyFreeLimit, ttlSec),
        UPSTASH_TIMEOUT_MS
      )
      // Debug logging for development
      if (process.env.NODE_ENV === 'development') {
        console.log('[DailyRateLimit]', { userId, key, dailyFreeLimit, result })
      }
      return result
    } catch (e) {
      console.warn(`[RateLimit] Daily check failed for ${userId}, using memory fallback`)
      // IMPORTANT: If Redis check already ran and incremented counter,
      // we don't have visibility into the result. Fail-closed in production.
      if (process.env.NODE_ENV === 'production') {
        return { ok: false, retryAfter: 60 } // Fail-closed in production
      }
      // In development, allow memory fallback for testing convenience
    }
  }

  // Memory fallback for daily limit (development only or when Redis not configured)
  const now = Date.now()
  const rec = memDaily.get(key)
  if (!rec || now > rec.resetAt) {
    memDaily.set(key, { count: 1, resetAt: now + ttlSec * 1000 })
    return { ok: true, remaining: dailyFreeLimit - 1 }
  }
  const next = rec.count + 1
  memDaily.set(key, { count: next, resetAt: rec.resetAt })
  if (next > dailyFreeLimit) {
    const retryAfter = Math.ceil((rec.resetAt - now) / 1000)
    return { ok: false, retryAfter }
  }
  return { ok: true, remaining: Math.max(0, dailyFreeLimit - next) }
}

export async function checkRateLimit(
  route: string,
  identity: string,
  isTrial: boolean
): Promise<RateResult> {
  const limit = isTrial ? trialLimit : boundLimit
  const key = `rate:${identity}:${route}`

  if (isProdRedisReady()) {
    try {
      // Wrap Upstash call with timeout to prevent blocking
      const result = await withTimeout(
        upstashRate(key, limit, windowSec),
        UPSTASH_TIMEOUT_MS
      )
      // Debug logging for development
      if (process.env.NODE_ENV === 'development') {
        console.log('[RateLimit:checkRateLimit]', { route, identity, isTrial, limit, key, result })
      }
      return result
    } catch (e) {
      console.warn(
        `[RateLimit] Upstash latency high (${key}), failing over to local memory strategy.`
      )
      const fallbackResult = memoryRate(key, limit, windowSec)
      console.log('[RateLimit:memoryFallback]', { key, limit, fallbackResult })
      return fallbackResult
    }
  }

  const result = memoryRate(key, limit, windowSec)
  if (process.env.NODE_ENV === 'development') {
    console.log('[RateLimit:memoryOnly]', { key, limit, result })
  }
  return result
}


