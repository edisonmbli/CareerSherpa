import { isProdRedisReady } from '@/lib/env'
import { getRedis } from '@/lib/redis/client'

const memLocks = new Map<string, number>()

export async function acquireLock(
  identity: string,
  taskKind: string,
  ttlSec: number
): Promise<boolean> {
  const key = `lock:${identity}:${taskKind}`
  if (isProdRedisReady()) {
    try {
      const redis = getRedis()
      const setRes = await redis.set(key, '1', { nx: true, ex: ttlSec })
      return setRes === 'OK'
    } catch {}
  }
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
    } catch {}
  }
  memLocks.delete(key)
}

