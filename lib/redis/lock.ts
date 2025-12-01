import { isProdRedisReady } from '@/lib/env'
import { getRedis } from '@/lib/redis/client'
import { logError } from '@/lib/logger'

const memLocks = new Map<string, number>()

/**
 * Tries to acquire a distributed lock.
 * Falls back to in-memory lock if Redis is unavailable or not configured.
 */
export async function acquireLock(
  identity: string,
  taskKind: string,
  ttlSec: number
): Promise<boolean> {
  const key = `lock:${identity}:${taskKind}`
  if (isProdRedisReady()) {
    try {
      const redis = getRedis()
      // NX: Set if Not eXists, EX: Expire time in seconds
      const setRes = await redis.set(key, '1', { nx: true, ex: ttlSec })
      return setRes === 'OK'
    } catch (error) {
      logError({
        reqId: 'system',
        route: 'redis/lock',
        error: String(error),
        phase: 'acquire_lock',
        meta: { key },
      })
      // Fallback to memory lock on Redis error?
      // For safety, maybe better to fail closed or open depending on requirement.
      // Here we fall back to memory lock to keep system running in dev/single-instance.
    }
  }

  // In-memory fallback
  const now = Date.now()
  const expiresAt = memLocks.get(key) ?? 0
  if (now < expiresAt) return false
  memLocks.set(key, now + ttlSec * 1000)
  return true
}

export async function releaseLock(identity: string, taskKind: string) {
  const key = `lock:${identity}:${taskKind}`
  if (isProdRedisReady()) {
    try {
      const redis = getRedis()
      await redis.del(key)
      return
    } catch (error) {
      logError({
        reqId: 'system',
        route: 'redis/lock',
        error: String(error),
        phase: 'release_lock',
        meta: { key },
      })
    }
  }
  memLocks.delete(key)
}
