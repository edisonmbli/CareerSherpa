import { pushTask } from '@/lib/queue/producer'
import type { Locale } from '@/i18n-config'
import type { TaskTemplateId, VariablesFor } from '@/lib/prompts/types'

export async function ensureEnqueued<T extends TaskTemplateId>(args: {
  kind: 'stream' | 'batch'
  serviceId: string
  taskId: string
  userId: string
  locale: Locale
  templateId: T
  variables: VariablesFor<T>
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await pushTask(args)
  if (res.rateLimited || res.backpressured || res.error) {
    return { ok: false, error: res.error || 'enqueue_failed' }
  }
  return { ok: true }
}