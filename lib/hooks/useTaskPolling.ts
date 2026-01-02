import { useEffect, useRef, useState } from 'react'

type AsyncStatus = 'IDLE' | 'PENDING' | 'COMPLETED' | 'FAILED'

export function useTaskPolling({
  taskId,
  taskType,
  enabled,
  onSuccess,
  onError,
  maxAttempts = 30,
}: {
  taskId: string | null
  taskType: string
  enabled: boolean
  onSuccess: () => void
  onError: () => void
  maxAttempts?: number
}) {
  const [status, setStatus] = useState<AsyncStatus>('IDLE')
  const [attempts, setAttempts] = useState(0)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const timerRef = useRef<number | null>(null)
  const schedule = useRef<number[]>([0, 2000, 3000, 5000, 10000, 10000, 10000])

  useEffect(() => {
    if (!enabled || !taskId) return
    let cancelled = false

    const run = async (step: number) => {
      if (cancelled) return
      if (attempts >= maxAttempts) {
        setStatus('FAILED')
        onError()
        return
      }
      try {
        const etag = lastUpdated ? `${status}|${lastUpdated}` : undefined
        const init: RequestInit = {}
        if (etag) init.headers = { 'If-None-Match': etag }
        const res = await fetch(`/api/task-status?taskId=${taskId}&taskType=${taskType}`, init)
        if (res.status === 304) {
          // unchanged
        } else if (res.ok) {
          const data = await res.json()
          const newStatus = (data.status as AsyncStatus) || 'PENDING'
          setStatus(newStatus)
          if (data.lastUpdatedAt) setLastUpdated(String(data.lastUpdatedAt))
          try {
            if (newStatus === 'PENDING') {
              fetch('/api/timeline', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ serviceId: String(taskId), phase: 'poll_pending', meta: { taskType } }),
                keepalive: true,
              })
            }
          } catch {
            // non-fatal: timeline logging should not block polling
          }

          if (newStatus === 'COMPLETED') {
            try {
              fetch('/api/timeline', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ serviceId: String(taskId), phase: 'poll_completed', meta: { taskType } }),
                keepalive: true,
              })
            } catch {
              // non-fatal: timeline logging should not block success callback
            }
            onSuccess()
            return
          }
          if (newStatus === 'FAILED') {
            try {
              fetch('/api/timeline', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ serviceId: String(taskId), phase: 'poll_failed', meta: { taskType } }),
                keepalive: true,
              })
            } catch {
              // non-fatal: timeline logging should not block error callback
            }
            onError()
            return
          }
        }
      } catch {
        // non-fatal: polling fetch errors should trigger retry, not crash
      }
      setAttempts((p) => p + 1)
      const delay = schedule.current[Math.min(step, schedule.current.length - 1)]
      timerRef.current = window.setTimeout(() => run(step + 1), delay)
    }

    run(0)
    return () => {
      cancelled = true
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, taskId, taskType])

  return { status, attempts, lastUpdated }
}
