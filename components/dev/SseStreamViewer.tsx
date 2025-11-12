"use client"
import { useEffect, useRef, useState } from 'react'

interface Props {
  userId: string
  serviceId: string
  taskId: string
}

export function SseStreamViewer({ userId, serviceId, taskId }: Props) {
  const [events, setEvents] = useState<string[]>([])
  const esRef = useRef<EventSource | null>(null)
  const [closed, setClosed] = useState(false)

  useEffect(() => {
    const url = `/api/sse-stream?userId=${encodeURIComponent(userId)}&serviceId=${encodeURIComponent(serviceId)}&taskId=${encodeURIComponent(taskId)}&fromLatest=1`
    const es = new EventSource(url)
    esRef.current = es
    es.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data)
        const text = typeof data === 'string' ? data : JSON.stringify(data)
        setEvents((prev) => [...prev, text])

        // 接收终止事件后主动关闭连接，减少 Redis 读取
        const isTerminal = (data?.type === 'done') || (data?.type === 'error' && ['invoke_or_stream', 'invoke', 'guards'].includes(String(data?.stage)))
        if (isTerminal) {
          esRef.current?.close()
          setClosed(true)
        }
      } catch {
        setEvents((prev) => [...prev, evt.data])
      }
    }
    es.onerror = () => {
      es.close()
      setClosed(true)
    }
    return () => es.close()
  }, [userId, serviceId, taskId])

  function stageLabel(stage?: string) {
    switch (stage) {
      case 'guards':
        return '守卫检查'
      case 'invoke_or_stream':
        return '模型调用/流式'
      case 'stream':
        return '流式传输'
      case 'finalize':
        return '结果整理'
      case 'sse_read':
        return 'SSE读取'
      default:
        return stage || '未知阶段'
    }
  }

  function codeLabel(code?: string) {
    switch (code) {
      case 'concurrency_locked':
        return '并发锁占用（同一用户同一服务已有任务运行）'
      case 'backpressure':
        return '队列拥堵（系统背压限流）'
      case 'guards_failed':
        return '系统守卫未通过'
      case 'llm_error':
        return '模型调用失败'
      case 'provider_not_configured':
        return '模型提供商 API Key 未配置'
      case 'sse_stream_read_error':
        return 'SSE 读取错误'
      default:
        return code || '未知错误'
    }
  }

  function friendlyLine(jsonStr: string): { text: string; kind: 'info' | 'warn' | 'error' } | null {
    try {
      const ev = JSON.parse(jsonStr)
      const reqTrace = [ev.requestId ? `req:${ev.requestId}` : null, ev.traceId ? `trace:${ev.traceId}` : null]
        .filter(Boolean)
        .join(' ')

      if (ev.type === 'error') {
        const base = `错误 · ${codeLabel(ev.code)} · 阶段：${stageLabel(ev.stage)}`
        const retryTip = (ev.code === 'guards_failed' || ev.code === 'backpressure' || ev.code === 'concurrency_locked')
          ? (typeof ev.retryAfter === 'number' && ev.retryAfter > 0
            ? `；建议稍后重试：约 ${Math.round(ev.retryAfter)} 秒后`
            : '；建议稍后重试：约 30-60 秒后')
          : ''
        const ids = reqTrace ? ` （${reqTrace}）` : ''
        return { text: `${base}${retryTip}${ids}`, kind: 'error' }
      }

      if (ev.type === 'start') {
        const timeoutText = typeof ev.timeoutSec === 'number' ? `（超时：${ev.timeoutSec}s）` : ''
        const ids = reqTrace ? ` （${reqTrace}）` : ''
        return { text: `开始 · 阶段：${stageLabel(ev.stage)}${timeoutText}${ids}`, kind: 'info' }
      }

      if (ev.type === 'done') {
        const latency = typeof ev.latencyMs === 'number' ? `，耗时：${ev.latencyMs}ms` : ''
        const usage = ev.usage ? `，Tokens：in ${ev.usage.inputTokens ?? 0} / out ${ev.usage.outputTokens ?? 0}` : ''
        const ids = reqTrace ? ` （${reqTrace}）` : ''
        return { text: `完成 · 阶段：${stageLabel(ev.stage)}${latency}${usage}${ids}`, kind: 'info' }
      }

      if (ev.type === 'token') {
        const len = typeof ev.text === 'string' ? ev.text.length : 0
        const ids = reqTrace ? ` （${reqTrace}）` : ''
        return { text: `流 · +${len} chars · 阶段：${stageLabel(ev.stage)}${ids}`, kind: 'warn' }
      }

      if (ev.type === 'token_batch') {
        const len = typeof ev.text === 'string' ? ev.text.length : 0
        const cnt = typeof ev.count === 'number' ? ev.count : undefined
        const ids = reqTrace ? ` （${reqTrace}）` : ''
        const countLabel = cnt !== undefined ? ` · ${cnt} tokens` : ''
        return { text: `流 · +${len} chars${countLabel} · 阶段：${stageLabel(ev.stage)}${ids}`, kind: 'warn' }
      }

      if (ev.type) {
        const ids = reqTrace ? ` （${reqTrace}）` : ''
        return { text: `事件 · ${ev.type} · 阶段：${stageLabel(ev.stage)}${ids}`, kind: 'info' }
      }

      return null
    } catch {
      return null
    }
  }

  return (
    <div className="space-y-2">
      <div className="text-sm text-muted-foreground">SSE connected: {userId}/{serviceId}/{taskId}</div>
      <div className="border rounded p-2 h-64 overflow-auto text-sm font-mono whitespace-pre-wrap">
        {events.map((e, i) => (
          <div key={i} className="space-y-1">
            <div>{e}</div>
            {(() => {
              const friendly = friendlyLine(e)
              if (!friendly) return null
              const cls = friendly.kind === 'error' ? 'text-red-600' : friendly.kind === 'warn' ? 'text-yellow-600' : 'text-muted-foreground'
              return <div className={cls}>{friendly.text}</div>
            })()}
          </div>
        ))}
      </div>
      {closed && (
        <div className="text-xs text-muted-foreground">连接已关闭（终止事件后停止轮询以降低 Redis 读取）。</div>
      )}
    </div>
  )
}