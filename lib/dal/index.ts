import { ENV, isProdRedisReady } from '@/lib/env'

export type IdempotencyStep = 'match' | 'customize' | 'interview'

export interface StoredIdempotencyKey {
  key: string
  userKey: string
  step: IdempotencyStep
  ttlMs: number
  createdAt: Date
}

// In-memory fallback for local/dev when Upstash is not configured
const memIdem = new Map<string, StoredIdempotencyKey>()

/**
 * Fetch idempotency key state.
 */
export async function getIdempotencyKey(
  key: string
): Promise<StoredIdempotencyKey | null> {
  if (isProdRedisReady()) {
    try {
      const res = await fetch(`${ENV.UPSTASH_REDIS_REST_URL}/get/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${ENV.UPSTASH_REDIS_REST_TOKEN}` },
      })
      if (!res.ok) return null
      const data = await res.json()
      if (!data?.result) return null
      try {
        const parsed = JSON.parse(data.result)
        // revive createdAt
        if (parsed && parsed.createdAt) parsed.createdAt = new Date(parsed.createdAt)
        return parsed as StoredIdempotencyKey
      } catch {
        return null
      }
    } catch {
      return null
    }
  }

  // Memory fallback
  return memIdem.get(key) ?? null
}

/**
 * Create idempotency key with TTL; if it already exists, Upstash will overwrite because setex always sets value.
 */
export async function createIdempotencyKey(
  key: string,
  userKey: string,
  step: IdempotencyStep,
  ttlMs: number
): Promise<StoredIdempotencyKey> {
  const record: StoredIdempotencyKey = {
    key,
    userKey,
    step,
    ttlMs,
    createdAt: new Date(),
  }

  if (isProdRedisReady()) {
    try {
      const ttlSec = Math.max(1, Math.floor(ttlMs / 1000))
      const payload = encodeURIComponent(JSON.stringify(record))
      const res = await fetch(`${ENV.UPSTASH_REDIS_REST_URL}/setex/${encodeURIComponent(key)}/${ttlSec}/${payload}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ENV.UPSTASH_REDIS_REST_TOKEN}` },
      })
      if (!res.ok) {
        // fall back to memory on failure
        memIdem.set(key, record)
      }
    } catch {
      memIdem.set(key, record)
    }
  } else {
    memIdem.set(key, record)
  }

  return record
}