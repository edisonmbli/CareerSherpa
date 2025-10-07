import { ENV, isProdRedisReady } from './env'

type RateResult = { ok: boolean; remaining?: number; retryAfter?: number }

const windowSec = 300
const trialLimit = 3
const boundLimit = 15

const mem = new Map<string, { count: number; resetAt: number }>()

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

async function upstashRate(key: string, limit: number): Promise<RateResult> {
  const out = await upstashPipeline([
    ['INCR', key],
    ['EXPIRE', key, String(windowSec)],
    ['TTL', key],
  ])
  const countRes = out?.[0]?.result
  const ttlRes = out?.[2]?.result
  const c = Number(countRes)
  const t = Number(ttlRes)
  if (Number.isNaN(c) || Number.isNaN(t)) {
    return { ok: false, retryAfter: windowSec }
  }
  if (c > limit) {
    return { ok: false, retryAfter: t > 0 ? t : windowSec }
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