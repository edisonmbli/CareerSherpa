import { useEffect, useRef } from 'react'
import { useWorkbenchStore } from '@/lib/stores/workbench.store'
import { getTaskTypeFromId, type TaskType } from '@/lib/types/task-context'

/**
 * SSE Stream Hook for Workbench
 *
 * Connects to SSE stream and ingests events into workbench store.
 * Supports Match, Customize, and Interview task types.
 *
 * Key behavior:
 * - First connection for a taskId reads all events (fromLatest=0)
 * - Reconnections skip historical events (fromLatest=1)
 * - Auto-switches stream on SUMMARY_COMPLETED for match tasks
 */
export function useSseStream(
  userId: string,
  serviceId: string,
  taskId: string,
  skip?: boolean
) {
  const { ingestEvent } = useWorkbenchStore()
  const esRef = useRef<EventSource | null>(null)
  const taskRef = useRef<string>('')
  // Track which taskIds we've connected to before (to determine fromLatest)
  const connectedTasksRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (skip || !userId || !serviceId || !taskId) return

    const previousTaskId = taskRef.current
    taskRef.current = taskId

    // Determine if this is a new task or reconnection
    // New task: read all events from session start (fromLatest=0)
    // Reconnection: skip historical events (fromLatest=1)
    const isNewTask = !connectedTasksRef.current.has(taskId)
    const fromLatest = isNewTask ? '0' : '1'

    // Mark this taskId as connected
    connectedTasksRef.current.add(taskId)

    // Get task type for logging
    const taskType = getTaskTypeFromId(taskId)

    if (process.env.NODE_ENV !== 'production') {
      console.log('[SSE] Connecting to stream:', {
        userId,
        serviceId,
        taskId,
        taskType,
        isNewTask,
        fromLatest,
        previousTaskId: previousTaskId || '(none)',
      })
    }

    try {
      fetch('/api/timeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId,
          phase: 'sse_connected',
          meta: { taskId, taskType, fromLatest, isNewTask },
        }),
        keepalive: true,
      })
    } catch {
      // non-fatal: timeline logging should not block SSE connection
    }

    const url = `/api/sse-stream?userId=${encodeURIComponent(
      userId
    )}&serviceId=${encodeURIComponent(serviceId)}&taskId=${encodeURIComponent(
      taskId
    )}&fromLatest=${fromLatest}`
    const es = new EventSource(url)
    esRef.current = es

    es.onmessage = (ev) => {
      if (!ev?.data) return
      try {
        const msg = JSON.parse(ev.data)
        if (process.env.NODE_ENV !== 'production') {
          console.log('[SSE] Received message:', msg)
        }
        try {
          if (process.env.NODE_ENV !== 'production') {
            const len =
              typeof (msg as any)?.text === 'string'
                ? (msg as any).text.length
                : typeof (msg as any)?.data === 'string'
                  ? (msg as any).data.length
                  : 0
            console.info('sse_event', {
              type: String((msg as any)?.type || ''),
              status: (msg as any)?.status,
              code: (msg as any)?.code,
              taskId: (msg as any)?.taskId,
              len,
            })
          }
        } catch {
          // non-fatal: debug logging may fail
        }
        ingestEvent(msg)
        const status = String(msg?.status || '')
        const code = String(msg?.code || '')
        const nextTid = String(msg?.taskId || '')

        // Auto-switch for Match tasks: when summary completes, switch to match stream
        const summaryDone =
          status === 'SUMMARY_COMPLETED' ||
          status === 'summary_completed' ||
          code === 'summary_completed'
        if (summaryDone && nextTid && nextTid !== taskRef.current) {
          try {
            esRef.current?.close()
          } catch {
            // non-fatal: close may fail if already closed
          }
          try {
            if (process.env.NODE_ENV !== 'production') {
              console.info('sse_switch', { from: taskRef.current, to: nextTid })
            }
          } catch {
            // non-fatal: debug logging may fail
          }
          try {
            fetch('/api/timeline', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                serviceId,
                phase: 'sse_switch',
                meta: { from: taskRef.current, to: nextTid },
              }),
              keepalive: true,
            })
          } catch {
            // non-fatal: timeline logging should not block task switch
          }
          taskRef.current = nextTid
          // Mark the new taskId as connected
          connectedTasksRef.current.add(nextTid)

          // Switch uses fromLatest=0 to get all events from the new stream
          const nextUrl = `/api/sse-stream?userId=${encodeURIComponent(
            userId
          )}&serviceId=${encodeURIComponent(
            serviceId
          )}&taskId=${encodeURIComponent(nextTid)}&fromLatest=0`
          const nextEs = new EventSource(nextUrl)
          esRef.current = nextEs
          nextEs.onmessage = es.onmessage
          nextEs.onerror = es.onerror as any
        }
      } catch {
        // non-fatal: message parse errors should not crash the stream
      }
    }
    es.onerror = () => {
      ingestEvent({ type: 'error', message: 'stream_connection_error' })
      es.close()
    }
    return () => {
      esRef.current?.close()
    }
  }, [userId, serviceId, taskId, ingestEvent, skip])
}
