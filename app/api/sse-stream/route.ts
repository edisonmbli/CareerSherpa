import { NextRequest } from 'next/server'
import { promises as fsp } from 'fs'
import path from 'path'
import { ENV } from '@/lib/env'
import { getRedis, redisReady } from '@/lib/redis/client'
import { withRequestSampling } from '@/lib/dev/redisSampler'
import { buildEventChannel } from '@/lib/pubsub/channels'

export const dynamic = 'force-dynamic'

function toSseEvent(data: any, id?: string): string {
  let s = `data: ${JSON.stringify(data)}\n`
  if (id) s += `id: ${id}\n`
  return s + '\n'
}

type StreamEntry = { id: string; fields: Record<string, string> }

async function readStreamRange(
  streamKey: string,
  lastId: string | null,
): Promise<StreamEntry[]> {
  if (!redisReady()) return []
  const redis = getRedis()
  // 使用排他起始，避免每次都重复读到同一条记录
  const start = lastId ? `(${lastId}` : '-'
  // Upstash SDK 返回形如 { id: { field: value } } 的对象映射
  const raw = (await redis.xrange(streamKey, start, '+')) as Record<
    string,
    Record<string, unknown>
  > | null
  const obj = raw ?? {}
  return Object.entries(obj).map(([id, fields]) => ({
    id,
    fields: fields as Record<string, string>,
  }))
}

export async function GET(req: NextRequest) {
  return withRequestSampling('/api/sse-stream', 'GET', async () => {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId') || ''
    const serviceId = searchParams.get('serviceId') || ''
    const taskId = searchParams.get('taskId') || ''
    const fromLatest = searchParams.get('fromLatest') === '1'

    const lastEventId =
      req.headers.get('last-event-id') ||
      searchParams.get('lastEventId') ||
      null

    if (!userId || !serviceId || !taskId) {
      return new Response('missing_params', { status: 400 })
    }

    const channel = buildEventChannel(userId, serviceId, taskId)
    const streamKey = `${channel}:stream`

    let cancelStream: (() => void) | null = null
    const stream = new ReadableStream({
      async start(controller) {
        // 初始握手/心跳
        controller.enqueue(
          new TextEncoder().encode(toSseEvent({ type: 'connected', channel })),
        )
        try {
          // if (process.env.NODE_ENV !== 'production') {
          //   console.info('sse_start', { channel, streamKey })
          // }
        } catch {}

        let lastId: string | null = lastEventId
        let closed = false
        let consecutiveIdle = 0
        let timer: ReturnType<typeof setTimeout> | null = null
        let keepAlive: ReturnType<typeof setInterval> | null = null

        const closeStream = (reason: string, extra?: Record<string, unknown>) => {
          if (closed) return
          closed = true
          if (timer) clearTimeout(timer)
          if (keepAlive) clearInterval(keepAlive)
          try {
            console.info('sse_close', {
              reason,
              streamKey,
              lastId,
              ...(extra || {}),
            })
            controller.close()
          } catch (e) {
            console.warn('sse_close_error', (e as any)?.message || e)
          }
        }

        cancelStream = () => {
          closeStream('cancel')
        }

        // 可选：在首次连接时快进到最新一条，避免重放历史
        // 仅当没有 Last-Event-ID 时才应用 fromLatest 逻辑
        if (
          !lastId &&
          fromLatest &&
          ENV.UPSTASH_REDIS_REST_URL &&
          ENV.UPSTASH_REDIS_REST_TOKEN
        ) {
          try {
            const resp = await fetch(`${ENV.UPSTASH_REDIS_REST_URL}/pipeline`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${ENV.UPSTASH_REDIS_REST_TOKEN}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify([
                ['XREVRANGE', streamKey, '+', '-', 'COUNT', 1],
              ]),
            })
            const json = (await resp.json()) as any[]
            const last =
              Array.isArray(json) && json[0] && Array.isArray(json[0].result)
                ? json[0].result[0]
                : null
            if (last && Array.isArray(last)) {
              lastId = String(last[0])
            }
          } catch {
            // 静默失败，保持从头读取
          }
        }

        async function tick() {
          if (closed) return
          try {
            const entries = await readStreamRange(streamKey, lastId)
            try {
              // if (process.env.NODE_ENV !== 'production') {
              //   console.info('sse_tick', {
              //     streamKey,
              //     lastId,
              //     entries: entries.length,
              //   })
              // }
            } catch {}
            if (entries.length === 0) {
              consecutiveIdle = Math.min(consecutiveIdle + 1, 5)
            } else {
              consecutiveIdle = 0
            }
            for (const entry of entries) {
              lastId = entry.id
              const payload = (entry.fields as any)?.['event']
              if (payload !== undefined) {
                let data: any
                if (typeof payload === 'string') {
                  try {
                    data = JSON.parse(payload)
                  } catch {
                    data = {
                      type: 'error',
                      message: 'invalid_json',
                      raw: payload,
                    }
                  }
                } else {
                  data = payload
                }
                // 附带流条目ID用于前端去重
                const enriched = { ...(data as any), _sid: entry.id }
                try {
                  controller.enqueue(
                    new TextEncoder().encode(toSseEvent(enriched, entry.id)),
                  )
                } catch (e) {
                  console.warn('sse_enqueue_error', (e as any)?.message || e)
                  closeStream('enqueue_error', { entryId: entry.id })
                  return
                }
                try {
                  if (process.env.NODE_ENV !== 'production') {
                    const len =
                      typeof (data as any)?.text === 'string'
                        ? (data as any).text.length
                        : typeof (data as any)?.data === 'string'
                          ? (data as any).data.length
                          : 0
                    console.info('sse_event', {
                      type: String((data as any)?.type || ''),
                      status: (data as any)?.status,
                      code: (data as any)?.code,
                      taskId: (data as any)?.taskId,
                      id: entry.id,
                      len,
                    })
                    try {
                      const debugDir = path.join(
                        process.cwd(),
                        'tmp',
                        'llm-debug',
                      )
                      await fsp.mkdir(debugDir, { recursive: true })
                      const file = path.join(
                        debugDir,
                        `sse_event_${taskId || 'unknown'}.log`,
                      )
                      await fsp.appendFile(
                        file,
                        JSON.stringify({
                          timestamp: new Date().toISOString(),
                          streamKey, // Log the source stream key
                          id: entry.id,
                          type: String((data as any)?.type || ''),
                          status: (data as any)?.status,
                          code: (data as any)?.code,
                          len,
                          // Log preview of text content to check for empty tokens
                          preview:
                            (data as any)?.text?.substring(0, 50) ||
                            (data as any)?.data?.substring(0, 50) ||
                            '',
                        }) + '\n',
                      )
                    } catch {}
                  }
                } catch {}

                // 若收到终止事件或终止状态，主动关闭连接，减少后续读取
                const isTerminal =
                  (data?.type === 'status' &&
                    [
                      'MATCH_COMPLETED',
                      'MATCH_FAILED',
                      'SUMMARY_FAILED',
                      'CUSTOMIZE_COMPLETED',
                      'CUSTOMIZE_FAILED',
                      'INTERVIEW_COMPLETED',
                      'INTERVIEW_FAILED',
                    ].includes(String(data?.status))) ||
                  (data?.type === 'error' &&
                    ['invoke_or_stream', 'invoke', 'guards'].includes(
                      String(data?.stage),
                    ))
                if (isTerminal) {
                  closeStream('terminal_event', {
                    entryId: entry.id,
                    type: String((data as any)?.type || ''),
                    status: (data as any)?.status,
                    code: (data as any)?.code,
                    taskId: (data as any)?.taskId,
                  })
                  return
                }
              }
            }
          } catch (err) {
            controller.enqueue(
              new TextEncoder().encode(
                toSseEvent({
                  type: 'error',
                  code: 'sse_stream_read_error',
                  stage: 'sse_read',
                  message: (err as Error).message,
                  streamKey,
                  lastId,
                }),
              ),
            )
          } finally {
            if (!closed) {
              const base = Math.max(ENV.STREAM_FLUSH_INTERVAL_MS, 400)
              const delay =
                consecutiveIdle === 0
                  ? base
                  : Math.min(8000, base * 2 ** consecutiveIdle)
              timer = setTimeout(tick, delay)
            }
          }
        }

        // 启动自适应轮询
        timer = setTimeout(tick, 0)

        keepAlive = setInterval(() => {
          if (closed) return
          if (controller.desiredSize === null) {
            closeStream('keepalive_closed')
            return
          }
          try {
            controller.enqueue(new TextEncoder().encode(':keepalive\n\n'))
          } catch (e) {
            console.warn('sse_keepalive_error', (e as any)?.message || e)
            closeStream('keepalive_error')
          }
        }, 25000)

        // 当连接关闭时清理资源
        req.signal?.addEventListener?.('abort', () => {
          closeStream('abort')
        })
      },
      cancel() {
        if (cancelStream) cancelStream()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    })
  })
}
