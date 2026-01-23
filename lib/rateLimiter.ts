import { isProdRedisReady, ENV } from './env'
import { RATE_LIMIT_FAIL_CLOSED_RETRY_AFTER_SEC } from '@/lib/constants'
import { getRedis } from '@/lib/redis/client'

type RateResult = { ok: boolean; remaining?: number; retryAfter?: number }

// Configurable rate limits from environment
const windowSec = ENV.RATE_LIMIT_PAID_WINDOW_SEC || 300 // 5 minutes for paid
const trialLimit = 3 // Legacy: for trial users
const boundLimit = ENV.RATE_LIMIT_PAID_MAX || 10 // Paid: 10 calls per window
const dailyFreeLimit = ENV.RATE_LIMIT_FREE_DAILY || 1 // Free: 1 calls per day
const UPSTASH_TIMEOUT_MS = 5000 // 5s timeout for Redis operations to handle network latency

const mem = new Map<string, { count: number; resetAt: number }>()
const memDaily = new Map<string, { count: number; resetAt: number }>()

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Upstash timeout')), ms),
    ),
  ])
}

// 统一 Upstash 访问方式：改用 getRedis 客户端
// Critical: The timeout only applies to INCR (the counting op).
// EXPIRE and TTL are best-effort and should not cause fallback to memory.
async function upstashRate(
  key: string,
  limit: number,
  ttlSec: number,
): Promise<RateResult> {
  const redis = getRedis()

  // Step 1: INCR (the critical counting operation - timeout applies here)
  const incrStart = Date.now()
  const cRaw = await redis.incr(key)
  const incrElapsed = Date.now() - incrStart
  if (process.env.NODE_ENV === 'development' && incrElapsed > 100) {
    console.log('[upstashRate] INCR slow', { key, elapsedMs: incrElapsed })
  }

  const c = Number(cRaw)
  if (Number.isNaN(c)) {
    return { ok: false, retryAfter: ttlSec }
  }

  // Step 2: Set expiry (best-effort, don't fail on timeout)
  // Run in background without awaiting to prevent timeout cascade
  if (c === 1) {
    redis.expire(key, ttlSec).catch(() => {
      // Ignore expire failures on first set
    })
  } else {
    // Ensure TTL exists to prevent infinite keys (best-effort)
    redis
      .ttl(key)
      .then((ttl) => {
        if (ttl === -1) redis.expire(key, ttlSec).catch(() => {})
      })
      .catch(() => {})
  }

  // Step 3: Check limit
  if (c > limit) {
    // Try to get accurate retryAfter, but don't block on it
    let retryAfter = ttlSec
    try {
      const tRaw = await Promise.race([
        redis.ttl(key),
        new Promise<number>((resolve) => setTimeout(() => resolve(-2), 500)), // 500ms mini-timeout
      ])
      const t = Number(tRaw)
      if (!Number.isNaN(t) && t > 0) retryAfter = t
    } catch {
      // Use default ttlSec on any failure
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
  tier: 'free' | 'paid',
): Promise<RateResult> {
  if (tier === 'paid') return { ok: true } // Paid uses window-based limit

  const key = `rate:daily:${userId}:gemini`
  const ttlSec = 86400 // 24 hours

  if (isProdRedisReady()) {
    try {
      const result = await withTimeout(
        upstashRate(key, dailyFreeLimit, ttlSec),
        UPSTASH_TIMEOUT_MS,
      )
      // Debug logging for development
      if (process.env.NODE_ENV === 'development') {
        console.log('[DailyRateLimit]', { userId, key, dailyFreeLimit, result })
      }
      return result
    } catch (e) {
      console.warn(
        `[RateLimit] Daily check failed for ${userId}, using memory fallback`,
      )
      // IMPORTANT: If Redis check already ran and incremented counter,
      // we don't have visibility into the result. Fail-closed in production.
      if (process.env.NODE_ENV === 'production') {
        return { ok: false, retryAfter: RATE_LIMIT_FAIL_CLOSED_RETRY_AFTER_SEC }
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
  isTrial: boolean,
): Promise<RateResult> {
  const limit = isTrial ? trialLimit : boundLimit
  const key = `rate:${identity}:${route}`

  if (isProdRedisReady()) {
    try {
      // Wrap Upstash call with timeout to prevent blocking
      const result = await withTimeout(
        upstashRate(key, limit, windowSec),
        UPSTASH_TIMEOUT_MS,
      )
      // Debug logging for development
      if (process.env.NODE_ENV === 'development') {
        console.log('[RateLimit:checkRateLimit]', {
          route,
          identity,
          isTrial,
          limit,
          key,
          result,
        })
      }
      return result
    } catch (e) {
      console.warn(
        `[RateLimit] Upstash latency high (${key}), failing over to local memory strategy.`,
      )
      if (process.env.NODE_ENV === 'production') {
        return { ok: false, retryAfter: RATE_LIMIT_FAIL_CLOSED_RETRY_AFTER_SEC }
      }
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

// ============================================================================
// User-Centric Rate Limiting (at server action level)
// ============================================================================

export type OperationRateLimitResult = {
  ok: boolean
  error?: 'daily_limit' | 'frequency_limit'
  retryAfter?: number | undefined
  remaining?: number | undefined
}

/**
 * Check user operation rate limit at server action level
 * - Free tier: 5 operations per 24 hours (daily limit)
 * - Paid tier: 10 operations per 15 minutes (frequency limit)
 *
 * This should be called at the entry of each user-initiated action
 * (createService, customize, interview, retry, upload resume, etc.)
 */
export async function checkOperationRateLimit(
  userId: string,
  tier: 'free' | 'paid',
): Promise<OperationRateLimitResult> {
  if (tier === 'free') {
    // Free tier: 5 ops per 24 hours
    const key = `rate:op:daily:${userId}`
    const limit = ENV.RATE_LIMIT_FREE_DAILY || 5
    const ttlSec = 86400 // 24 hours

    if (isProdRedisReady()) {
      try {
        const result = await withTimeout(
          upstashRate(key, limit, ttlSec),
          UPSTASH_TIMEOUT_MS,
        )
        if (process.env.NODE_ENV === 'development') {
          console.log('[OpRateLimit:Free]', { userId, limit, result })
        }
        if (!result.ok) {
          return {
            ok: false,
            error: 'daily_limit',
            retryAfter: result.retryAfter,
          }
        }
        return { ok: true, remaining: result.remaining }
      } catch (e) {
        console.warn(
          `[OpRateLimit] Daily check failed for ${userId}, using memory fallback`,
        )
        if (process.env.NODE_ENV === 'production') {
          return {
            ok: false,
            error: 'daily_limit',
            retryAfter: RATE_LIMIT_FAIL_CLOSED_RETRY_AFTER_SEC,
          }
        }
      }
    }

    // Memory fallback
    const memResult = memoryRate(key, limit, ttlSec)
    if (!memResult.ok) {
      return {
        ok: false,
        error: 'daily_limit',
        retryAfter: memResult.retryAfter,
      }
    }
    return { ok: true, remaining: memResult.remaining }
  } else {
    // Paid tier: 10 ops per 15 minutes
    const key = `rate:op:freq:${userId}`
    const limit = ENV.RATE_LIMIT_PAID_MAX || 10
    const ttlSec = ENV.RATE_LIMIT_PAID_WINDOW_SEC || 900 // 15 minutes

    if (isProdRedisReady()) {
      const startTime = Date.now()
      try {
        const result = await withTimeout(
          upstashRate(key, limit, ttlSec),
          UPSTASH_TIMEOUT_MS,
        )
        const elapsed = Date.now() - startTime
        if (process.env.NODE_ENV === 'development') {
          console.log('[OpRateLimit:Paid]', {
            userId,
            limit,
            ttlSec,
            result,
            elapsedMs: elapsed,
          })
        }
        if (!result.ok) {
          return {
            ok: false,
            error: 'frequency_limit',
            retryAfter: result.retryAfter,
          }
        }
        return { ok: true, remaining: result.remaining }
      } catch (e) {
        const elapsed = Date.now() - startTime
        const errorMsg = e instanceof Error ? e.message : String(e)
        console.warn(
          `[OpRateLimit] Frequency check failed for ${userId}, using memory fallback`,
          {
            elapsedMs: elapsed,
            error: errorMsg,
            timeoutMs: UPSTASH_TIMEOUT_MS,
          },
        )
        if (process.env.NODE_ENV === 'production') {
          return {
            ok: false,
            error: 'frequency_limit',
            retryAfter: RATE_LIMIT_FAIL_CLOSED_RETRY_AFTER_SEC,
          }
        }
        const fallbackResult = memoryRate(key, limit, ttlSec)
        if (!fallbackResult.ok) {
          return {
            ok: false,
            error: 'frequency_limit',
            retryAfter: fallbackResult.retryAfter,
          }
        }
        return { ok: true, remaining: fallbackResult.remaining }
      }
    }

    // Memory fallback
    const memResult = memoryRate(key, limit, ttlSec)
    if (!memResult.ok) {
      return {
        ok: false,
        error: 'frequency_limit',
        retryAfter: memResult.retryAfter,
      }
    }
    return { ok: true, remaining: memResult.remaining }
  }
}
