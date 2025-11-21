import { useEffect } from 'react'
import { useWorkbenchStore } from '@/lib/stores/workbench.store'

export function useSseStream(userId: string, serviceId: string, taskId: string) {
  const { appendStreamToken, completeStream, setError } = useWorkbenchStore()
  useEffect(() => {
    if (!userId || !serviceId || !taskId) return
    const url = `/api/sse-stream?userId=${encodeURIComponent(userId)}&serviceId=${encodeURIComponent(serviceId)}&taskId=${encodeURIComponent(taskId)}&fromLatest=1`
    const es = new EventSource(url)
    es.onmessage = (ev) => {
      if (!ev?.data) return
      try {
        const msg = JSON.parse(ev.data)
        if (msg?.type === 'token' || msg?.type === 'token_batch') {
          const t = msg?.text ?? msg?.data ?? ''
          if (t) appendStreamToken(String(t))
        } else if (msg?.type === 'done') {
          completeStream()
          es.close()
        } else if (msg?.type === 'error') {
          setError(String(msg?.message ?? 'stream_error'))
          es.close()
        }
      } catch {}
    }
    es.onerror = () => {
      setError('stream_connection_error')
      es.close()
    }
    return () => {
      es.close()
    }
  }, [userId, serviceId, taskId, appendStreamToken, completeStream, setError])
}