import { pushTask } from '@/lib/queue/producer'
import type { Locale } from '@/i18n-config'
import type { TaskTemplateId, VariablesFor } from '@/lib/prompts/types'

export type EnsureEnqueuedResult =
  | { ok: true; replay?: false }
  | { ok: true; replay: true; idemKey?: string }
  | {
      ok: false
      error: string
      rateLimited?: boolean
      backpressured?: boolean
      retryAfter?: number
    }

export async function ensureEnqueued<T extends TaskTemplateId>(args: {
  kind: 'stream' | 'batch'
  serviceId: string
  taskId: string
  traceId?: string
  userId: string
  locale: Locale
  templateId: T
  variables: VariablesFor<T>
}): Promise<EnsureEnqueuedResult> {
  const res = await pushTask(args)
  if (res.replay) {
    return { ok: true, replay: true, ...(res.idemKey ? { idemKey: res.idemKey } : {}) }
  }
  if (res.rateLimited || res.backpressured || res.error) {
    return {
      ok: false,
      error: res.error || 'enqueue_failed',
      ...(res.rateLimited ? { rateLimited: true } : {}),
      ...(res.backpressured ? { backpressured: true } : {}),
      ...(res.retryAfter ? { retryAfter: res.retryAfter } : {}),
    }
  }
  return { ok: true }
}
