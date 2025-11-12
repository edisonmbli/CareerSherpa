import { getQStash } from '@/lib/queue/qstash'
import { ENV } from '@/lib/env'
import type { Locale } from '@/i18n-config'
import type { TaskTemplateId } from '@/lib/prompts/types'
import { checkRateLimit } from '@/lib/rateLimiter'
import { checkQuotaForService } from '@/lib/quota/atomic-operations'
import { checkIdempotency, getDefaultTTL, type IdempotencyStep } from '@/lib/idempotency'
import { auditUserAction } from '@/lib/audit/async-audit'

export interface PushTaskParams {
  kind: 'stream' | 'batch'
  serviceId: string
  taskId: string
  userId: string
  locale: Locale
  templateId: TaskTemplateId
  variables: Record<string, any>
}

/**
 * Push task with producer-side safeguards: rate limit + idempotency.
 * Returns messageId when published; on replay or rate limit, returns metadata without publishing.
 */
export async function pushTask(params: PushTaskParams): Promise<{
  messageId?: string
  url: string
  replay?: boolean
  rateLimited?: boolean
  retryAfter?: number
  idemKey?: string
}> {
  const client = getQStash()
  const base = ENV.NEXT_PUBLIC_APP_BASE_URL || 'http://localhost:3000'
  const url = `${base}/api/worker/${params.kind}/${encodeURIComponent(params.serviceId)}`

  // Check quota to decide trial/bound rate limits
  const { shouldUseFreeQueue } = await checkQuotaForService(params.userId)
  const rate = await checkRateLimit('pushTask', params.userId, shouldUseFreeQueue)
  if (!rate.ok) {
    // Audit and early return on rate limiting
    auditUserAction(params.userId, 'rate_limited', 'task', params.taskId, {
      serviceId: params.serviceId,
      templateId: params.templateId,
      kind: params.kind,
      retryAfter: rate.retryAfter,
    })
    return { url, rateLimited: true, ...(typeof rate.retryAfter === 'number' ? { retryAfter: rate.retryAfter } : {}) }
  }

  // Map template to idempotency step when applicable
  const TEMPLATE_TO_STEP: Partial<Record<TaskTemplateId, IdempotencyStep>> = {
    job_match: 'match',
    resume_customize: 'customize',
    interview_prep: 'interview',
  }
  const step = TEMPLATE_TO_STEP[params.templateId]
  let idemKey: string | undefined
  if (step) {
    const ttlMs = getDefaultTTL(step)
    const idem = await checkIdempotency({
      step,
      ttlMs,
      userKey: params.userId,
      requestBody: { templateId: params.templateId, variables: params.variables },
    })
    idemKey = idem.key
    if (!idem.shouldProcess) {
      // Audit and early return on idempotent replay
      auditUserAction(params.userId, 'idempotent_replay', 'task', params.taskId, {
        serviceId: params.serviceId,
        templateId: params.templateId,
        kind: params.kind,
        idemKey,
      })
      return { url, replay: true, idemKey }
    }
  }

  const res = await client.publishJSON({
    url,
    body: {
      taskId: params.taskId,
      userId: params.userId,
      serviceId: params.serviceId,
      locale: params.locale,
      templateId: params.templateId,
      variables: params.variables,
    },
    retries: 3,
  })

  // Audit successful enqueue
  auditUserAction(params.userId, 'enqueue', 'task', params.taskId, {
    serviceId: params.serviceId,
    templateId: params.templateId,
    kind: params.kind,
    url,
    messageId: res.messageId,
    idemKey,
  })

  return { messageId: res.messageId, url, ...(idemKey ? { idemKey } : {}) }
}