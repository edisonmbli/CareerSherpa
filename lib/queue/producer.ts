import { getQStash } from '@/lib/queue/qstash'
import { ENV } from '@/lib/env'
import type { Locale } from '@/i18n-config'
import type { TaskTemplateId } from '@/lib/prompts/types'
import { checkRateLimit } from '@/lib/rateLimiter'
import { checkQuotaForService } from '@/lib/quota/atomic-operations'
import {
  checkIdempotency,
  getDefaultTTL,
  type IdempotencyStep,
} from '@/lib/idempotency'
import { logAudit, logEvent } from '@/lib/observability/logger'
import { getTaskRouting, getJobVisionTaskRouting } from '@/lib/llm/task-router'
import { getConcurrencyConfig } from '@/lib/env'
import { bumpPending } from '@/lib/redis/counter'

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
  backpressured?: boolean
}> {
  const client = getQStash()
  const base = ENV.NEXT_PUBLIC_APP_BASE_URL || 'http://localhost:3000'
  const quotaInfo = await checkQuotaForService(params.userId)
  const tierOverride = (params.variables as any)?.tierOverride
  const hasQuota = tierOverride === 'paid'
    ? true
    : tierOverride === 'free'
    ? false
    : typeof (params.variables as any)?.wasPaid === 'boolean'
    ? Boolean((params.variables as any)?.wasPaid)
    : !quotaInfo.shouldUseFreeQueue
  const hasImage = Boolean(
    params.variables?.['image'] || params.variables?.['jobImage']
  )
  const decision = hasImage
    ? getJobVisionTaskRouting(hasQuota)
    : getTaskRouting(params.templateId, hasQuota)
  let kindSegment = params.kind
  const qid = String(decision.queueId).toLowerCase()
  if (qid.includes('vision')) {
    kindSegment = 'batch'
  }
  const url = `${base}/api/worker/${kindSegment}/${encodeURIComponent(
    params.serviceId
  )}`

  // Check quota to decide trial/bound rate limits
  const { shouldUseFreeQueue } = quotaInfo
  const rate = await checkRateLimit(
    'pushTask',
    params.userId,
    shouldUseFreeQueue
  )
  if (!rate.ok) {
    // Audit and early return on rate limiting
    logAudit(params.userId, 'rate_limited', 'task', params.taskId, { serviceId: params.serviceId, templateId: params.templateId, kind: params.kind, retryAfter: rate.retryAfter })
    // Analytics: producer-side rate limiting (non-blocking)
    logEvent('TASK_RATE_LIMITED', { userId: params.userId, serviceId: params.serviceId, taskId: params.taskId }, { templateId: params.templateId, kind: params.kind, retryAfter: rate.retryAfter })
    return {
      url,
      rateLimited: true,
      ...(typeof rate.retryAfter === 'number'
        ? { retryAfter: rate.retryAfter }
        : {}),
    }
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
      requestBody: {
        templateId: params.templateId,
        variables: params.variables,
      },
    })
    idemKey = idem.key
    if (!idem.shouldProcess) {
      // Audit and early return on idempotent replay
      logAudit(params.userId, 'idempotent_replay', 'task', params.taskId, { serviceId: params.serviceId, templateId: params.templateId, kind: params.kind, idemKey })
      // Analytics: idempotent replay detected (non-blocking)
      logEvent('TASK_REPLAYED', { userId: params.userId, serviceId: params.serviceId, taskId: params.taskId }, { templateId: params.templateId, kind: params.kind, idemKey })
      return { url, replay: true, idemKey }
    }
  }

  // 生产者侧队列背压：按 QueueId 维度限制入队
  const ttlSec = Math.max(1, Math.floor(ENV.CONCURRENCY_LOCK_TIMEOUT_MS / 1000))
  const queueCounterKey = `bp:queue:${String(decision.queueId)}`
  const cfg = getConcurrencyConfig()
  const qidLower = String(decision.queueId).toLowerCase()
  const maxSize =
    qidLower.includes('paid') && qidLower.includes('stream')
      ? cfg.queueLimits.paidStream
      : qidLower.includes('free') && qidLower.includes('stream')
      ? cfg.queueLimits.freeStream
      : qidLower.includes('paid') && qidLower.includes('batch')
      ? cfg.queueLimits.paidBatch
      : qidLower.includes('free') && qidLower.includes('batch')
      ? cfg.queueLimits.freeBatch
      : qidLower.includes('paid') && qidLower.includes('vision')
      ? cfg.queueLimits.paidVision
      : qidLower.includes('free') && qidLower.includes('vision')
      ? cfg.queueLimits.freeVision
      : cfg.queueMaxSize
  const bp = await bumpPending(queueCounterKey, ttlSec, maxSize)
  if (!bp.ok) {
    // 审计与分析：生产者侧背压拒绝
    logAudit(params.userId, 'backpressure', 'task', params.taskId, { serviceId: params.serviceId, templateId: params.templateId, kind: params.kind, queueId: String(decision.queueId || ''), retryAfter: bp.retryAfter })
    logEvent('TASK_BACKPRESSURED', { userId: params.userId, serviceId: params.serviceId, taskId: params.taskId }, { templateId: params.templateId, kind: params.kind, queueId: String(decision.queueId || ''), retryAfter: bp.retryAfter })
    return {
      url,
      backpressured: true,
      ...(bp.retryAfter ? { retryAfter: bp.retryAfter } : {}),
    }
  }

  const res = await client.queue({ queueName: String(decision.queueId) }).enqueueJSON({
    url,
    body: {
      taskId: params.taskId,
      userId: params.userId,
      serviceId: params.serviceId,
      locale: params.locale,
      templateId: params.templateId,
      variables: params.variables,
      enqueuedAt: Date.now(),
      retryCount: 0,
    },
    retries: 3,
  })

  // Audit successful enqueue
  logAudit(params.userId, 'enqueue', 'task', params.taskId, { serviceId: params.serviceId, templateId: params.templateId, kind: params.kind, url, messageId: res.messageId, idemKey })

  // Analytics: task enqueued successfully
  logEvent('TASK_ENQUEUED', { userId: params.userId, serviceId: params.serviceId, taskId: params.taskId }, { templateId: params.templateId, kind: params.kind, url, messageId: res.messageId, ...(idemKey ? { idemKey } : {}) })

  return { messageId: res.messageId, url, ...(idemKey ? { idemKey } : {}) }
}
