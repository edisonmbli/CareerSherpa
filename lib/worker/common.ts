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
import { logDebugData } from '@/lib/llm/debug'
import { logError, logDebug } from '@/lib/logger'

const SSE_DEBUG = ENV.LOG_DEBUG || process.env['SSE_DEBUG'] === 'true'

async function appendSsePublishDebug(
  channel: string,
  payload: Record<string, unknown>,
) {
  if (!SSE_DEBUG) return
  const parts = channel.split(':')
  const taskId = String(payload['taskId'] || parts?.[4] || 'unknown')
  logDebugData(`sse_publish_${taskId}`, {
    meta: {
      timestamp: new Date().toISOString(),
      ...payload,
    },
  })
}

export type WorkerKind = 'stream' | 'batch'

export type { WorkerBody }

// --- Type-safe event helpers ---
/**
 * StreamEvent represents worker pubsub events with optional fields.
 * Using this interface avoids `as any` for event property access.
 */
interface StreamEvent {
  type?: string
  text?: string
  requestId?: string
  traceId?: string
  status?: string
  code?: string
  taskId?: string
  [key: string]: unknown // Allow other properties
}

/** Type guard to safely access event properties */
function getEventType(event: Record<string, unknown>): string {
  return String((event as StreamEvent).type || '').toLowerCase()
}

function getEventText(event: Record<string, unknown>): string {
  return String((event as StreamEvent).text ?? '')
}

// --- Token batcher global singleton type ---
declare global {
  var __cs_token_batchers__:
    | Map<
        string,
        {
          tokens: string[]
          timer?: ReturnType<typeof setTimeout>
          startedAt: number
        }
      >
    | undefined
  var __cs_redis_debugged_channels__: Set<string> | undefined
}

function getRedisDebugInfo() {
  const redisUrl = ENV.REDIS_URL
  const upstashUrl = ENV.UPSTASH_REDIS_REST_URL
  const hasUpstashToken = Boolean(ENV.UPSTASH_REDIS_REST_TOKEN)
  let mode = 'none'
  let host = ''
  let port = ''
  if (redisUrl) {
    mode = 'redis_url'
    try {
      const u = new URL(redisUrl)
      host = u.hostname
      port = u.port || ''
    } catch {}
  } else if (upstashUrl && hasUpstashToken) {
    mode = 'upstash_rest'
    try {
      const u = new URL(upstashUrl)
      host = u.hostname
      port = u.port || ''
    } catch {}
  } else if (
    upstashUrl &&
    (upstashUrl.startsWith('redis://') || upstashUrl.startsWith('rediss://'))
  ) {
    mode = 'upstash_redis_url'
    try {
      const u = new URL(upstashUrl)
      host = u.hostname
      port = u.port || ''
    } catch {}
  }
  return {
    mode,
    host,
    port,
    hasUpstashToken,
  }
}

async function writeRedisDebugOnce(channel: string) {
  if (!SSE_DEBUG) return
  const set = globalThis.__cs_redis_debugged_channels__ ?? new Set<string>()
  if (!globalThis.__cs_redis_debugged_channels__) {
    globalThis.__cs_redis_debugged_channels__ = set
  }
  if (set.has(channel)) return
  set.add(channel)
  try {
    await appendSsePublishDebug(channel, {
      event: 'redis_client',
      channel,
      ...getRedisDebugInfo(),
    })
  } catch {}
}

function isIoredisClient(redis: any) {
  return Boolean(redis && typeof redis.pipeline === 'function')
}

async function xaddEvent(redis: any, streamKey: string, payload: string) {
  if (isIoredisClient(redis)) {
    return redis.xadd(streamKey, '*', 'event', payload)
  }
  return redis.xadd(streamKey, '*', { event: payload as any })
}

export async function parseWorkerBody(
  req: Request,
): Promise<{ ok: true; body: WorkerBody } | { ok: false; response: Response }> {
  try {
    const json = await req.json()
    const parsed = workerBodySchema.safeParse(json)
    if (!parsed.success) {
      logDebug({
        reqId: 'worker-parse',
        route: 'worker/common',
        phase: 'validation_failed',
        error: parsed.error,
      })
      return {
        ok: false,
        response: new Response('bad_request', { status: 400 }),
      }
    }
    return { ok: true, body: parsed.data }
  } catch (e) {
    logError({
      reqId: 'worker-parse',
      route: 'worker/common',
      phase: 'json_parse_failed',
      error: e instanceof Error ? e : String(e),
    })
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
  return Math.max(1, Math.floor(ENV.CONCURRENCY_COUNTER_TTL_SECONDS))
}

export function buildCounterKey(userId: string, serviceId: string): string {
  return `bp:${userId}:${serviceId}`
}

export function getChannel(
  userId: string,
  serviceId: string,
  taskId: string,
): string {
  return buildEventChannel(userId, serviceId, taskId)
}

export function buildMatchTaskId(serviceId: string, sessionId?: string) {
  return sessionId ? `match_${serviceId}_${sessionId}` : `match_${serviceId}`
}

export function buildCustomizeTaskId(serviceId: string, sessionId: string) {
  return `customize_${serviceId}_${sessionId}`
}

export function buildInterviewTaskId(serviceId: string, sessionId: string) {
  return `interview_${serviceId}_${sessionId}`
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
  delaySec: number,
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
  doQueueBump: boolean = true,
): Promise<
  | { ok: true }
  | { ok: false; response: Response; pending?: number; maxSize?: number }
> {
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
      const retry = Math.min(5, Number(bp.retryAfter || ttlSec))
      return {
        ok: false,
        response: new Response('backpressure', {
          status: 429,
          headers: { 'Retry-After': String(retry) },
        }),
        ...(bp.pending !== undefined ? { pending: bp.pending } : {}),
        maxSize,
      }
    }
  }
  return { ok: true }
}

export async function exitGuards(
  userId: string,
  kind: WorkerKind,
  counterKey: string,
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
  ttlSec: number,
): Promise<{ ok: true } | { ok: false; response: Response }> {
  const tier = getTierFromQueueId(queueId)
  const key = buildModelActiveKey(modelId, tier)
  const maxWorkers = getMaxWorkersForModel(modelId, tier)
  const bp = await bumpPending(key, ttlSec, maxWorkers)
  if (!bp.ok) {
    const retry = Math.min(5, Number(bp.retryAfter || ttlSec))
    return {
      ok: false,
      response: new Response('model_concurrency_exceeded', {
        status: 429,
        headers: { 'Retry-After': String(retry) },
      }),
    }
  }
  return { ok: true }
}

export async function exitModelConcurrency(
  modelId: ModelIdType,
  queueId: string,
) {
  const tier = getTierFromQueueId(queueId)
  const key = buildModelActiveKey(modelId, tier)
  await decPending(key)
}

export async function enterUserConcurrency(
  userId: string,
  kind: WorkerKind,
  ttlSec: number,
): Promise<{ ok: true } | { ok: false; response: Response }> {
  const cfg = getConcurrencyConfig()
  const maxActive =
    kind === 'stream' ? cfg.userMaxActive.stream : cfg.userMaxActive.batch
  const key = buildUserActiveKey(userId, kind)
  const bp = await bumpPending(key, ttlSec, maxActive)
  if (!bp.ok) {
    const retry = Math.min(5, Number(bp.retryAfter || ttlSec))
    return {
      ok: false,
      response: new Response('user_concurrency_exceeded', {
        status: 429,
        headers: { 'Retry-After': String(retry) },
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
  event: Record<string, any>,
) {
  const redis = getRedis()
  await writeRedisDebugOnce(channel)

  // 在生产环境抑制调试事件采样：不发布、不入流
  const isDebugEvent = getEventType(event) === 'debug'
  if (process.env.NODE_ENV === 'production' && isDebugEvent) {
    return
  }

  // --- 合并窗口 + 长度阈值：仅针对 token 事件进行合并 ---
  type Batcher = {
    tokens: string[]
    timer?: ReturnType<typeof setTimeout>
    startedAt: number
    requestId?: string
    traceId?: string
    taskId?: string
    stage?: string
  }
  const batchers = globalThis.__cs_token_batchers__
  const tokenBatchers: Map<string, Batcher> =
    batchers ?? new Map<string, Batcher>()
  if (!globalThis.__cs_token_batchers__) {
    globalThis.__cs_token_batchers__ = tokenBatchers
  }

  const flush = async (ch: string) => {
    const buf = tokenBatchers.get(ch)
    if (!buf || buf.tokens.length === 0) return
    const mergedText = buf.tokens.join('')
    const parts = ch.split(':')
    const taskId = buf.taskId || parts[parts.length - 1] || ''
    const payloadObj = {
      type: 'token_batch',
      stage: buf.stage || 'stream',
      text: mergedText,
      count: buf.tokens.length,
      startedAt: buf.startedAt,
      endedAt: Date.now(),
      taskId,
      ...(buf.requestId ? { requestId: buf.requestId } : {}),
      ...(buf.traceId ? { traceId: buf.traceId } : {}),
    }
    const payloadStr = JSON.stringify(payloadObj)
    try {
      await appendSsePublishDebug(ch, {
        event: 'token_batch',
        channel: ch,
        streamKey: `${ch}:stream`,
        taskId,
        count: buf.tokens.length,
        len: mergedText.length,
      })
    } catch {}
    try {
      await redis.publish(ch, payloadStr)
    } catch (err) {
      try {
        await appendSsePublishDebug(ch, {
          event: 'token_batch_publish_error',
          channel: ch,
          streamKey: `${ch}:stream`,
          taskId,
          error: String(err),
        })
      } catch {}
    }
    try {
      const streamKey = `${ch}:stream`
      await xaddEvent(redis, streamKey, payloadStr)
      try {
        await appendSsePublishDebug(ch, {
          event: 'token_batch_stream',
          channel: ch,
          streamKey,
          taskId,
          count: buf.tokens.length,
          len: mergedText.length,
        })
      } catch {}
    } catch (err) {
      try {
        await appendSsePublishDebug(ch, {
          event: 'token_batch_stream_error',
          channel: ch,
          streamKey: `${ch}:stream`,
          taskId,
          error: String(err),
        })
      } catch {}
    }
    if (buf.timer) clearTimeout(buf.timer)
    tokenBatchers.delete(ch)
  }

  const isTokenEvent = getEventType(event) === 'token'
  if (isTokenEvent) {
    const text = getEventText(event)
    let buf = tokenBatchers.get(channel)
    if (!buf) {
      buf = {
        tokens: [],
        startedAt: Date.now(),
      }
      if (event?.['requestId']) buf.requestId = event['requestId']
      if (event?.['traceId']) buf.traceId = event['traceId']
      if (event?.['taskId']) buf.taskId = event['taskId']
      if (event?.['stage']) buf.stage = event['stage']
      tokenBatchers.set(channel, buf)
      // 定时器：时间窗口先到即 flush（互补策略）
      buf.timer = setTimeout(
        () => flush(channel),
        Math.max(ENV.STREAM_FLUSH_INTERVAL_MS || 20, 20),
      )
    } else {
      if (!buf.requestId && event?.['requestId'])
        buf.requestId = event['requestId']
      if (!buf.traceId && event?.['traceId']) buf.traceId = event['traceId']
      if (!buf.taskId && event?.['taskId']) buf.taskId = event['taskId']
      if (!buf.stage && event?.['stage']) buf.stage = event['stage']
    }
    buf.tokens.push(text)
    // 长度阈值先到即立即 flush（互补策略）
    if (buf.tokens.length >= Math.max(1, ENV.STREAM_FLUSH_SIZE || 5)) {
      await flush(channel)
    }
    // token 事件在合并后统一写入，因此此处直接返回
    return
  }

  // 对非 token 事件：写入前先冲洗 token 合并缓存，保证顺序
  await flush(channel)

  const payload = JSON.stringify(event)
  try {
    await appendSsePublishDebug(channel, {
      event: 'publish',
      channel,
      streamKey: `${channel}:stream`,
      type: getEventType(event),
      taskId: (event as any)?.taskId || '',
      status: (event as any)?.status,
      code: (event as any)?.code,
      len: payload.length,
    })
  } catch {}
  try {
    await redis.publish(channel, payload)
  } catch (err) {
    try {
      await appendSsePublishDebug(channel, {
        event: 'publish_error',
        channel,
        streamKey: `${channel}:stream`,
        type: getEventType(event),
        taskId: (event as any)?.taskId || '',
        status: (event as any)?.status,
        code: (event as any)?.code,
        error: String(err),
      })
    } catch {}
    throw err
  }

  // Audit event dispatch for observability（降低频次：仅记录关键事件，跳过 token/token_batch/debug）
  try {
    const parts = channel.split(':')
    const t = getEventType(event)
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
          ...(event['requestId'] && { reqId: event['requestId'] as string }),
          ...(event['traceId'] && { traceId: event['traceId'] as string }),
        })
      }
    }
  } catch {
    // swallow audit errors
  }

  // 同步写入 Redis Streams 作为 SSE 的后备缓冲；终止事件时追加 TTL/修剪
  try {
    const streamKey = `${channel}:stream`
    const t = getEventType(event)
    const isTerminal = t === 'done' || t === 'error'
    await xaddEvent(redis, streamKey, payload)
    try {
      await appendSsePublishDebug(channel, {
        event: 'stream_append',
        channel,
        streamKey,
        type: t,
        taskId: (event as any)?.taskId || '',
        status: (event as any)?.status,
        code: (event as any)?.code,
        len: payload.length,
      })
    } catch {}
    const ttl = Math.max(0, Number(ENV.STREAM_TTL_SECONDS || 0))
    if (ttl > 0) {
      try {
        await redis.expire(streamKey, ttl)
      } catch {
        // non-fatal: TTL set error
      }
    }
    if (isTerminal) {
      const maxlen = Math.max(0, Number(ENV.STREAM_TRIM_MAXLEN || 0))
      if (maxlen > 0) {
        try {
          // Note: Upstash Redis xtrim options type mismatch, 'as any' is required
          await redis.xtrim(streamKey, {
            strategy: 'maxlen',
            threshold: maxlen,
            approximate: true,
          } as any)
        } catch {
          // non-fatal: stream trim error
        }
      }
    }
  } catch (err) {
    try {
      await appendSsePublishDebug(channel, {
        event: 'stream_error',
        channel,
        streamKey: `${channel}:stream`,
        type: getEventType(event),
        taskId: (event as any)?.taskId || '',
        status: (event as any)?.status,
        code: (event as any)?.code,
        error: String(err),
      })
    } catch {}
  }
}
