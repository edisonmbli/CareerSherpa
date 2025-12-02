import type { Redis } from '@upstash/redis'
import { AsyncLocalStorage } from 'node:async_hooks'

// 开发环境开关：生产环境完全禁用采样逻辑
const enabled = process.env.NODE_ENV !== 'production'

type Ctx = { route: string; method: string; startAt: number }
const ctxStore = new AsyncLocalStorage<Ctx>()

type RouteStats = {
  total: number
  reads: number
  writes: number
  byCmd: Record<string, number>
  lastUpdated: number
}

const stats = new Map<string, RouteStats>()
const knownReads = new Set([
  'get', 'ttl', 'exists', 'xrange', 'xrevrange', 'xlen', 'hlen', 'smembers', 'zrange', 'zrevrange'
])
const knownWrites = new Set([
  'set', 'incr', 'decr', 'expire', 'del', 'publish', 'xadd', 'hset', 'sadd', 'zadd'
])

function classify(cmd: string): 'read' | 'write' {
  const c = cmd.toLowerCase()
  if (knownReads.has(c)) return 'read'
  if (knownWrites.has(c)) return 'write'
  // 默认按写处理（更保守），避免低估写操作
  return 'write'
}

function getRouteKey(): string {
  const c = ctxStore.getStore()
  if (!c) return 'unknown'
  return `${c.method} ${c.route}`
}

function bump(routeKey: string, cmd: string) {
  let rec = stats.get(routeKey)
  if (!rec) {
    rec = { total: 0, reads: 0, writes: 0, byCmd: {}, lastUpdated: Date.now() }
    stats.set(routeKey, rec)
  }
  rec.total += 1
  const kind = classify(cmd)
  if (kind === 'read') rec.reads += 1
  else rec.writes += 1
  rec.byCmd[cmd] = (rec.byCmd[cmd] || 0) + 1
  rec.lastUpdated = Date.now()
}

export function withRequestSampling<T>(route: string, method: string, fn: () => Promise<T> | T): Promise<T> | T {
  if (!enabled) return fn()
  const ctx: Ctx = { route, method, startAt: Date.now() }
  return ctxStore.run(ctx, fn)
}

export function captureRedisCommand(cmd: string) {
  if (!enabled) return
  const routeKey = getRouteKey()
  bump(routeKey, cmd)
}

export function getSamplingSummary() {
  const out: Record<string, RouteStats> = {}
  for (const [k, v] of stats.entries()) {
    out[k] = { ...v }
  }
  return out
}

let periodicTimer: ReturnType<typeof setInterval> | null = null
// let lastSignature: string | null = null

export function enablePeriodicConsoleLogging(intervalMs = 30000, minTotal = 20) {
  if (!enabled) return
  if (periodicTimer) return
  periodicTimer = setInterval(() => {
    const summary = getSamplingSummary()
    const rows = Object.entries(summary)
      .map(([route, s]) => ({ route, total: s.total, reads: s.reads, writes: s.writes }))
      .filter(r => r.total >= minTotal)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
    // 仅在计数变化时输出，避免“连接关闭后仍持续打印”的误解
    // const signature = rows.length > 0 ? JSON.stringify(rows) : ''
    // if (rows.length > 0 && signature !== lastSignature) {
    //   lastSignature = signature
    //   console.info('[dev:redis-sampling] Top routes by total commands:', rows)
    // }
  }, intervalMs)
}

// 将 Upstash Redis 客户端包装为带采样的代理（仅 dev）
export function proxyRedisClient(redis: Redis): Redis {
  if (!enabled) return redis
  const handler: ProxyHandler<any> = {
    get(target, prop, receiver) {
      const orig = Reflect.get(target, prop, receiver)
      if (typeof orig === 'function') {
        const cmd = String(prop)
        return function (...args: any[]) {
          try {
            captureRedisCommand(cmd)
          } catch {}
          return orig.apply(target, args)
        }
      }
      return orig
    },
  }
  // 启用周期性输出但避免噪音
  try { enablePeriodicConsoleLogging() } catch {}
  return new Proxy(redis as any, handler) as Redis
}