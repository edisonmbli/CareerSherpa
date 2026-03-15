import { ENV } from '@/lib/env'
import { appendTaskDebugEvent, summarizeDebugPayload } from './task-debug'

export async function markTimeline(
  serviceId: string,
  phase: string,
  meta?: Record<string, any>
) {
  if (!ENV.LOG_DEBUG) return
  try {
    const event: Parameters<typeof appendTaskDebugEvent>[0] = {
      scope: 'timeline',
      serviceId,
      phase,
      stage: 'timeline',
    }
    if (meta?.['taskId']) event.taskId = String(meta['taskId'])
    if (meta?.['templateId']) event.templateId = String(meta['templateId'])
    if (meta) {
      event.meta = summarizeDebugPayload(meta) as Record<string, unknown>
    }
    await appendTaskDebugEvent({
      ...event,
    })
  } catch {}
}
