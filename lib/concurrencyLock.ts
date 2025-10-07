import { ENV, isProdRedisReady } from './env'

const memLocks = new Map<string, number>()

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

export async function acquireLock(
  identity: string,
  taskKind: string,
  ttlSec: number
): Promise<boolean> {
  const key = `lock:${identity}:${taskKind}`
  if (isProdRedisReady()) {
    try {
      const out = await upstashPipeline([
        ['SET', key, '1', 'NX', 'EX', String(ttlSec)],
      ])
      const setRes = out?.[0]?.result
      return setRes === 'OK'
    } catch {
      // fall through to memory
    }
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
      await upstashPipeline([['DEL', key]])
      return
    } catch {
      // fall through to memory
    }
  }
  memLocks.delete(key)
}
