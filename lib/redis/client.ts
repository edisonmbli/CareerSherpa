import { Redis as UpstashRedis } from '@upstash/redis'
import Redis from 'ioredis'
import { ENV, isProdRedisReady } from '@/lib/env'
import { proxyRedisClient } from '@/lib/dev/redisSampler'

export type RedisClient = {
  get: (...args: any[]) => Promise<any>
  set: (...args: any[]) => Promise<any>
  setex: (...args: any[]) => Promise<any>
  del: (...args: any[]) => Promise<any>
  publish: (...args: any[]) => Promise<any>
  xadd: (...args: any[]) => Promise<any>
  xtrim: (...args: any[]) => Promise<any>
  expire: (...args: any[]) => Promise<any>
  incr: (...args: any[]) => Promise<any>
  decr: (...args: any[]) => Promise<any>
  eval: (...args: any[]) => Promise<any>
  exists: (...args: any[]) => Promise<any>
  ttl: (...args: any[]) => Promise<any>
  xrange: (...args: any[]) => Promise<any>
  xrevrange: (...args: any[]) => Promise<any>
  xlen: (...args: any[]) => Promise<any>
  hlen: (...args: any[]) => Promise<any>
  hset: (...args: any[]) => Promise<any>
  smembers: (...args: any[]) => Promise<any>
  sadd: (...args: any[]) => Promise<any>
  zrange: (...args: any[]) => Promise<any>
  zrevrange: (...args: any[]) => Promise<any>
  zadd: (...args: any[]) => Promise<any>
  [key: string]: any
}

let _redis: RedisClient | null = null

function createRedisClient(): RedisClient {
  if (ENV.REDIS_URL) {
    return new Redis(ENV.REDIS_URL) as unknown as RedisClient
  }
  if (ENV.UPSTASH_REDIS_REST_URL && ENV.UPSTASH_REDIS_REST_TOKEN) {
    return new UpstashRedis({
      url: ENV.UPSTASH_REDIS_REST_URL,
      token: ENV.UPSTASH_REDIS_REST_TOKEN,
    }) as unknown as RedisClient
  }
  if (ENV.UPSTASH_REDIS_REST_URL) {
    const url = ENV.UPSTASH_REDIS_REST_URL
    if (url.startsWith('redis://') || url.startsWith('rediss://')) {
      return new Redis(url) as unknown as RedisClient
    }
  }
  throw new Error('upstash_redis_not_configured')
}

export function getRedis(): RedisClient {
  if (_redis) return _redis
  if (!isProdRedisReady()) {
    throw new Error('upstash_redis_not_configured')
  }
  const client = createRedisClient()
  _redis = proxyRedisClient(client)
  return _redis
}

export function redisReady(): boolean {
  return isProdRedisReady()
}
