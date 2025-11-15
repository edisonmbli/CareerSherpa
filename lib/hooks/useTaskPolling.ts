import { useState, useEffect } from 'react'

type AsyncStatus = 'IDLE' | 'PENDING' | 'COMPLETED' | 'FAILED'

export function useTaskPolling({
  taskId,
  taskType,
  initialStatus,
  onSuccess,
  onError,
  interval = 3000,
  maxAttempts = 20,
}: {
  taskId: string | null
  taskType: string
  initialStatus: AsyncStatus
  onSuccess: () => void
  onError: () => void
  interval?: number
  maxAttempts?: number
}) {
  const [status, setStatus] = useState<AsyncStatus>(initialStatus)
  const [attempts, setAttempts] = useState(0)

  useEffect(() => {
    if (status !== 'PENDING' || !taskId) return

    const poll = async () => {
      if (attempts >= maxAttempts) {
        onError()
        return
      }
      try {
        const res = await fetch(`/api/task-status?taskId=${taskId}&taskType=${taskType}`)
        if (!res.ok) throw new Error('status_fetch_failed')
        const data = await res.json()
        const newStatus = (data.status as AsyncStatus) || 'PENDING'
        setStatus(newStatus)
        setAttempts((p) => p + 1)
        if (newStatus === 'COMPLETED') onSuccess()
        else if (newStatus === 'FAILED') onError()
      } catch {
        setAttempts((p) => p + 1)
      }
    }

    const timer = setInterval(poll, interval)
    return () => clearInterval(timer)
  }, [status, taskId, taskType, interval, maxAttempts, attempts, onSuccess, onError])

  return { status }
}