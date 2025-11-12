import { Redis } from '@upstash/redis'
import { ENV, isProdRedisReady } from '@/lib/env'
import { proxyRedisClient } from '@/lib/dev/redisSampler'

let _redis: Redis | null = null

export function getRedis(): Redis {
  if (_redis) return _redis
  if (!isProdRedisReady()) {
    throw new Error('upstash_redis_not_configured')
  }
  const client = new Redis({ url: ENV.UPSTASH_REDIS_REST_URL, token: ENV.UPSTASH_REDIS_REST_TOKEN })
  // 仅在开发环境包装代理，生产环境直出原始客户端
  _redis = proxyRedisClient(client)
  return _redis
}

export function redisReady(): boolean {
  return isProdRedisReady()
}