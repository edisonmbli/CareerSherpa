import { ENV, getConcurrencyConfig, getPerformanceConfig } from '@/lib/env'
import { queueMaxSizeFor, buildUserActiveKey } from '@/lib/config/concurrency'
import { acquireLock, releaseLock } from '@/lib/redis/lock'
import { bumpPending, decPending } from '@/lib/redis/counter'
import { buildEventChannel, buildEventStreamKey } from '@/lib/pubsub/channels'
import { getRedis } from '@/lib/redis/client'
import { auditUserAction } from '@/lib/audit/async-audit'
import { i18n, type Locale } from '@/i18n-config'
import { checkQuotaForService } from '@/lib/quota/atomic-operations'
import { getProvider } from '@/lib/llm/utils'
import {
  buildModelActiveKey,
  getMaxWorkersForModel,
} from '@/lib/config/concurrency'
import type { ModelId as ModelIdType } from '@/lib/llm/providers'
import { getQStash } from '@/lib/queue/qstash'
import { workerBodySchema, type WorkerBody } from '@/lib/worker/types'
import { promises as fsp } from 'fs'
import path from 'path'

export type WorkerKind = 'stream' | 'batch'

export type { WorkerBody }

export async function parseWorkerBody(
  req: Request
): Promise<{ ok: true; body: WorkerBody } | { ok: false; response: Response }> {
  try {
    const json = await req.json()
    const parsed = workerBodySchema.safeParse(json)
    if (!parsed.success) {
      return {
        ok: false,
        response: new Response('bad_request', { status: 400 }),
      }
    }
    return { ok: true, body: parsed.data }
  } catch {
    return { ok: false, response: new Response('bad_request', { status: 400 }) }
  }
}

export async function getUserHasQuota(userId: string): Promise<boolean> {
  const { shouldUseFreeQueue } = await checkQuotaForService(userId)
  return !shouldUseFreeQueue
}

export function hasImage(variables?: Record<string, any>): boolean {
  return Boolean(variables?.['image'] || variables?.['jobImage'])
}

export function getTtlSec(): number {
  return Math.max(1, Math.floor(ENV.CONCURRENCY_LOCK_TIMEOUT_MS / 1000))
}

export function buildCounterKey(userId: string, serviceId: string): string {
  return `bp:${userId}:${serviceId}`
}

export function getChannel(
  userId: string,
  serviceId: string,
  taskId: string
): string {
  return buildEventChannel(userId, serviceId, taskId)
}

export function getMaxTotalWaitMs(kind: WorkerKind): number {
  const perf = getPerformanceConfig()
  return kind === 'stream'
    ? perf.maxTotalWaitMs.stream
    : perf.maxTotalWaitMs.batch
}

export async function requeueWithDelay(
  kind: WorkerKind,
  service: string,
  body: WorkerBody,
  delaySec: number
) {
  const client = getQStash()
  const base = ENV.NEXT_PUBLIC_APP_BASE_URL || 'http://localhost:3000'
  const url = `${base}/api/worker/${kind}/${encodeURIComponent(service)}`
  const nextRetry = Math.max(0, Number(body.retryCount || 0) + 1)
  const payload = { ...body, retryCount: nextRetry }
  const notBefore =
    Math.floor(Date.now() / 1000) + Math.max(1, Math.floor(delaySec))
  await client.publishJSON({
    url,
    body: payload,
    retries: 0,
    notBefore,
    delay: Math.max(1, Math.floor(delaySec)),
  })
}

// 队列级背压键（按 QueueId 维度）
export function getQueueMaxSize(queueId: string): number {
  return queueMaxSizeFor(queueId)
}

// 模型维度并发键（按模型+付费等级维度）
export function getTierFromQueueId(queueId: string): 'paid' | 'free' {
  return queueId.toLowerCase().includes('paid') ? 'paid' : 'free'
}

export async function enterGuards(
  userId: string,
  kind: WorkerKind,
  counterKey: string,
  ttlSec: number,
  maxSize: number,
  doQueueBump: boolean = true
): Promise<{ ok: true } | { ok: false; response: Response }> {
  const locked = await acquireLock(userId, kind, ttlSec)
  if (!locked) {
    return {
      ok: false,
      response: new Response('concurrency_locked', { status: 429 }),
    }
  }

  if (doQueueBump) {
    const bp = await bumpPending(counterKey, ttlSec, maxSize)
    if (!bp.ok) {
      await releaseLock(userId, kind)
      return {
        ok: false,
        response: new Response('backpressure', {
          status: 429,
          headers: { 'Retry-After': String(bp.retryAfter || ttlSec) },
        }),
      }
    }
  }
  return { ok: true }
}

export async function exitGuards(
  userId: string,
  kind: WorkerKind,
  counterKey: string
) {
  try {
    await decPending(counterKey)
  } finally {
    await releaseLock(userId, kind)
  }
}

// 模型维度并发控制：进入/退出
export async function enterModelConcurrency(
  modelId: ModelIdType,
  queueId: string,
  ttlSec: number
): Promise<{ ok: true } | { ok: false; response: Response }> {
  const tier = getTierFromQueueId(queueId)
  const key = buildModelActiveKey(modelId, tier)
  const maxWorkers = getMaxWorkersForModel(modelId, tier)
  const act = await bumpPending(key, ttlSec, Math.max(1, maxWorkers))
  if (!act.ok) {
    return {
      ok: false,
      response: new Response('model_concurrency', {
        status: 429,
        headers: { 'Retry-After': String(act.retryAfter || ttlSec) },
      }),
    }
  }
  return { ok: true }
}

export async function exitModelConcurrency(
  modelId: ModelIdType,
  queueId: string
) {
  const tier = getTierFromQueueId(queueId)
  const key = buildModelActiveKey(modelId, tier)
  await decPending(key)
}

export async function enterUserConcurrency(
  userId: string,
  kind: WorkerKind,
  ttlSec: number
): Promise<{ ok: true } | { ok: false; response: Response }> {
  const cfg = getConcurrencyConfig()
  const maxActive =
    kind === 'stream' ? cfg.userMaxActive.stream : cfg.userMaxActive.batch
  const key = buildUserActiveKey(userId, kind)
  const act = await bumpPending(key, ttlSec, Math.max(1, maxActive))
  if (!act.ok) {
    return {
      ok: false,
      response: new Response('user_concurrency', {
        status: 429,
        headers: { 'Retry-After': String(act.retryAfter || ttlSec) },
      }),
    }
  }
  return { ok: true }
}

export async function exitUserConcurrency(userId: string, kind: WorkerKind) {
  const key = buildUserActiveKey(userId, kind)
  await decPending(key)
}

export async function publishEvent(
  channel: string,
  event: Record<string, any>
) {
  const redis = getRedis()

  // 在生产环境抑制调试事件采样：不发布、不入流
  const isDebugEvent =
    String((event as any)?.type || '').toLowerCase() === 'debug'
  if (process.env.NODE_ENV === 'production' && isDebugEvent) {
    return
  }

  // --- 合并窗口 + 长度阈值：仅针对 token 事件进行合并 ---
  type Batcher = {
    tokens: string[]
    timer?: ReturnType<typeof setTimeout>
    startedAt: number
  }
  const batchers = (globalThis as any).__cs_token_batchers__ as
    | Map<string, Batcher>
    | undefined
  const tokenBatchers: Map<string, Batcher> =
    batchers ?? new Map<string, Batcher>()
  if (!(globalThis as any).__cs_token_batchers__) {
    ;(globalThis as any).__cs_token_batchers__ = tokenBatchers
  }

  const flush = async (ch: string) => {
    const buf = tokenBatchers.get(ch)
    if (!buf || buf.tokens.length === 0) return
    const mergedText = buf.tokens.join('')
    const parts = ch.split(':')
    const taskId = parts[parts.length - 1] || ''
    const payloadObj = {
      type: 'token_batch',
      stage: 'stream',
      text: mergedText,
      count: buf.tokens.length,
      startedAt: buf.startedAt,
      endedAt: Date.now(),
      taskId,
    }
    const payloadStr = JSON.stringify(payloadObj)
    try {
      if (process.env.NODE_ENV !== 'production') {
        try {
          console.info('publish_token_batch', {
            channel: ch,
            count: buf.tokens.length,
          })
          const debugDir = path.join(process.cwd(), 'tmp', 'llm-debug')
          await fsp.mkdir(debugDir, { recursive: true })
          const file = path.join(debugDir, `token_batch_${taskId || 'unknown'}.log`)
          await fsp.appendFile(
            file,
            JSON.stringify({ channel: ch, count: buf.tokens.length, len: mergedText.length }) + '\n'
          )
        } catch {}
      }
      await redis.publish(ch, payloadStr)
    } catch {
      // swallow pubsub errors
    }
    try {
      const streamKey = `${ch}:stream`
      await redis.xadd(streamKey, '*', { event: payloadStr as any })
      if (process.env.NODE_ENV !== 'production') {
        try {
          console.info('publish_stream_xadd', {
            streamKey,
            type: 'token_batch',
          })
          const debugDir = path.join(process.cwd(), 'tmp', 'llm-debug')
          await fsp.mkdir(debugDir, { recursive: true })
          const file = path.join(debugDir, `stream_xadd_${taskId || 'unknown'}.log`)
          await fsp.appendFile(
            file,
            JSON.stringify({ streamKey, type: 'token_batch', id: 'auto' }) + '\n'
          )
        } catch {}
      }
    } catch {
      // 忽略缓冲写入错误
    }
    if (buf.timer) clearTimeout(buf.timer)
    tokenBatchers.delete(ch)
  }

  const isTokenEvent =
    String((event as any)?.type || '').toLowerCase() === 'token'
  if (isTokenEvent) {
    const text = String((event as any)?.text ?? '')
    let buf = tokenBatchers.get(channel)
    if (!buf) {
      buf = { tokens: [], startedAt: Date.now() }
      tokenBatchers.set(channel, buf)
      // 定时器：时间窗口先到即 flush（互补策略）
      buf.timer = setTimeout(
        () => flush(channel),
        Math.max(ENV.STREAM_FLUSH_INTERVAL_MS, 50)
      )
    }
    buf.tokens.push(text)
    // 长度阈值先到即立即 flush（互补策略）
    if (buf.tokens.length >= Math.max(1, ENV.STREAM_FLUSH_SIZE)) {
      await flush(channel)
    }
    // token 事件在合并后统一写入，因此此处直接返回
    return
  }

  // 对非 token 事件：写入前先冲洗 token 合并缓存，保证顺序
  await flush(channel)

  const payload = JSON.stringify(event)
  if (process.env.NODE_ENV !== 'production') {
    try {
      const t = String((event as any)?.type || '')
      console.info('publish_event', {
        channel,
        type: t,
        status: (event as any)?.status,
        taskId: (event as any)?.taskId,
      })
    } catch {}
  }
  await redis.publish(channel, payload)

  // Audit event dispatch for observability（降低频次：仅记录关键事件，跳过 token/token_batch/debug）
  try {
    const parts = channel.split(':')
    const t = String((event as any)?.type || '').toLowerCase()
    const shouldAudit = t === 'start' || t === 'done' || t === 'error'
    if (shouldAudit) {
      // Expected format: cs:events:{userId}:{serviceId}:{taskId}
      const userId = parts?.[2] ?? ''
      const serviceId = parts?.[3] ?? ''
      const taskId = parts?.[4] ?? ''
      if (userId && taskId) {
        auditUserAction(userId, 'event_publish', 'task', taskId, {
          serviceId,
          channel,
          ...(event && event['type'] && { eventType: event['type'] as string }),
          ...(event &&
            (event as any)['requestId'] && {
              reqId: (event as any)['requestId'] as string,
            }),
          ...(event &&
            (event as any)['traceId'] && {
              traceId: (event as any)['traceId'] as string,
            }),
        })
      }
    }
  } catch {
    // swallow audit errors
  }

  // 同步写入 Redis Streams 作为 SSE 的后备缓冲；终止事件时追加 TTL/修剪
  try {
    const streamKey = `${channel}:stream`
    const t = String((event as any)?.type || '').toLowerCase()
    const isTerminal = t === 'done' || t === 'error'
    await redis.xadd(streamKey, '*', { event: payload as any })
    if (process.env.NODE_ENV !== 'production') {
      try {
        console.info('publish_stream_xadd', {
          streamKey,
          type: t,
          terminal: isTerminal,
        })
      } catch {}
    }
    if (isTerminal) {
      const ttl = Math.max(0, Number(ENV.STREAM_TTL_SECONDS || 0))
      const maxlen = Math.max(0, Number(ENV.STREAM_TRIM_MAXLEN || 0))
      if (ttl > 0) {
        try {
          await redis.expire(streamKey, ttl)
        } catch {}
      }
      if (maxlen > 0) {
        try {
          await redis.xtrim(streamKey, {
            strategy: 'maxlen',
            threshold: maxlen,
            approximate: true,
          } as any)
        } catch {}
      }
    }
  } catch (err) {
    // 忽略缓冲写入错误，不影响主发布通道
  }
}
