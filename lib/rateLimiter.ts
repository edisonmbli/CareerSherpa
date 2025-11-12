import { isProdRedisReady } from './env'
import { getRedis } from '@/lib/redis/client'

type RateResult = { ok: boolean; remaining?: number; retryAfter?: number }

const windowSec = 300
const trialLimit = 3
const boundLimit = 15

const mem = new Map<string, { count: number; resetAt: number }>()

// 统一 Upstash 访问方式：改用 getRedis 客户端
async function upstashRate(key: string, limit: number): Promise<RateResult> {
  const redis = getRedis()
  const cRaw = await redis.incr(key)
  const c = Number(cRaw)
  if (Number.isNaN(c)) {
    return { ok: false, retryAfter: windowSec }
  }

  // 仅首次设置过期，避免每次都写 EXPIRE
  if (c === 1) {
    try {
      await redis.expire(key, windowSec)
    } catch {
      // 忽略过期设置失败，限流按窗口秒回退
    }
  }

  // 仅超限时读取 TTL，以估算精确的 retryAfter
  if (c > limit) {
    let retryAfter = windowSec
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

function memoryRate(key: string, limit: number): RateResult {
  const now = Date.now()
  const rec = mem.get(key)
  if (!rec || now > rec.resetAt) {
    mem.set(key, { count: 1, resetAt: now + windowSec * 1000 })
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

export async function checkRateLimit(
  route: string,
  identity: string,
  isTrial: boolean
): Promise<RateResult> {
  const limit = isTrial ? trialLimit : boundLimit
  const key = `rate:${identity}:${route}`
  if (isProdRedisReady()) {
    try {
      return await upstashRate(key, limit)
    } catch {
      return memoryRate(key, limit)
    }
  }
  return memoryRate(key, limit)
}