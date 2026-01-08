import { getQStash } from '@/lib/queue/qstash'
import { recordRefund } from '@/lib/dal/coinLedger'
import { addQuota } from '@/lib/dal/quotas'
import { ENV } from '@/lib/env'
import type { Locale } from '@/i18n-config'
import type { TaskTemplateId, VariablesFor } from '@/lib/prompts/types'
import { checkRateLimit, checkDailyRateLimit } from '@/lib/rateLimiter'
import { checkQuotaForService } from '@/lib/quota/atomic-operations'
import {
  checkIdempotency,
  getDefaultTTL,
  type IdempotencyStep,
} from '@/lib/idempotency'
import { logAudit, logEvent } from '@/lib/observability/logger'
import { markTimeline } from '@/lib/observability/timeline'
import {
  getTaskRouting,
  getJobVisionTaskRouting,
  isServiceScoped,
} from '@/lib/llm/task-router'
import { getConcurrencyConfig } from '@/lib/env'
import { bumpPending } from '@/lib/redis/counter'
import { logError } from '@/lib/logger'

export interface PushTaskParams<T extends TaskTemplateId> {
  kind: 'stream' | 'batch'
  serviceId: string
  taskId: string
  userId: string
  locale: Locale
  templateId: T
  variables: VariablesFor<T>
}

/**
 * Push task with producer-side safeguards: rate limit + idempotency.
 * Returns messageId when published; on replay or rate limit, returns metadata without publishing.
 */
export async function pushTask<T extends TaskTemplateId>(
  params: PushTaskParams<T>
): Promise<{
  messageId?: string
  url: string
  replay?: boolean
  rateLimited?: boolean
  retryAfter?: number
  idemKey?: string
  backpressured?: boolean
  refunded?: boolean
  error?: string
}> {
  const client = getQStash()
  const base = ENV.NEXT_PUBLIC_APP_BASE_URL || 'http://localhost:3000'
  const quotaInfo = await checkQuotaForService(params.userId)
  const tierOverride = params.variables.tierOverride
  const hasQuota =
    tierOverride === 'paid'
      ? true
      : tierOverride === 'free'
        ? false
        : typeof (params.variables as any)?.wasPaid === 'boolean'
          ? Boolean((params.variables as any)?.wasPaid)
          : !quotaInfo.shouldUseFreeQueue
  const decision =
    params.templateId === 'job_summary' &&
      'image' in params.variables &&
      !!params.variables.image
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

  // Phase 1.5: Check daily rate limit for Free tier (Gemini calls)
  // Use `!hasQuota` to respect explicit tierOverride === 'paid'
  // Note: If !hasQuota, this is definitively Free tier, so no refund logic needed
  if (!hasQuota) {
    const dailyRate = await checkDailyRateLimit(params.userId, 'free')
    if (!dailyRate.ok) {
      logAudit(params.userId, 'daily_rate_limited', 'task', params.taskId, {
        serviceId: params.serviceId,
        templateId: params.templateId,
        kind: params.kind,
        retryAfter: dailyRate.retryAfter,
      })
      logEvent(
        'TASK_RATE_LIMITED',
        {
          userId: params.userId,
          serviceId: params.serviceId,
          taskId: params.taskId,
        },
        {
          templateId: params.templateId,
          kind: params.kind,
          retryAfter: dailyRate.retryAfter,
          reason: 'daily_limit_exceeded',
        }
      )
      await markTimeline(params.serviceId, 'producer_daily_limited', {
        taskId: params.taskId,
        retryAfter: dailyRate.retryAfter,
      })
      return {
        url,
        rateLimited: true,
        ...(typeof dailyRate.retryAfter === 'number'
          ? { retryAfter: dailyRate.retryAfter }
          : {}),
        error: 'daily_limit_exceeded',
      }
    }
  }

  const rate = await checkRateLimit(
    'pushTask',
    params.userId,
    shouldUseFreeQueue
  )
  if (!rate.ok) {
    // Audit and early return on rate limiting
    logAudit(params.userId, 'rate_limited', 'task', params.taskId, {
      serviceId: params.serviceId,
      templateId: params.templateId,
      kind: params.kind,
      retryAfter: rate.retryAfter,
    })
    // Analytics: producer-side rate limiting (non-blocking)
    logEvent(
      'TASK_RATE_LIMITED',
      {
        userId: params.userId,
        serviceId: params.serviceId,
        taskId: params.taskId,
      },
      {
        templateId: params.templateId,
        kind: params.kind,
        retryAfter: rate.retryAfter,
      }
    )
    const wasPaid = !!params.variables.wasPaid
    const cost = Number(params.variables.cost || 0)
    const debitId = String((params.variables as any)?.debitId || '')
    if (wasPaid && cost > 0 && debitId) {
      const ledgerServiceId = isServiceScoped(params.templateId)
        ? params.serviceId
        : undefined
      try {
        await recordRefund({
          userId: params.userId,
          amount: cost,
          relatedId: debitId,
          ...(ledgerServiceId ? { serviceId: ledgerServiceId } : {}),
          templateId: params.templateId,
        })
      } catch (err) {
        logError({
          reqId: params.taskId,
          route: 'pushTask',
          error: String(err),
          phase: 'refund_rate_limit',
        })
      }
    }
    await markTimeline(params.serviceId, 'producer_rate_limited', {
      taskId: params.taskId,
      retryAfter: rate.retryAfter,
    })
    return {
      url,
      rateLimited: true,
      refunded: wasPaid && cost > 0,
      ...(typeof rate.retryAfter === 'number'
        ? { retryAfter: rate.retryAfter }
        : {}),
      error: 'rate_limited',
    }
  }

  // Map template to idempotency step when applicable
  const TEMPLATE_TO_STEP: Partial<Record<TaskTemplateId, IdempotencyStep>> = {
    job_match: 'match',
    resume_customize: 'customize',
    interview_prep: 'interview',
    job_summary: 'summary',
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
      logAudit(params.userId, 'idempotent_replay', 'task', params.taskId, {
        serviceId: params.serviceId,
        templateId: params.templateId,
        kind: params.kind,
        idemKey,
      })
      // Analytics: idempotent replay detected (non-blocking)
      logEvent(
        'TASK_REPLAYED',
        {
          userId: params.userId,
          serviceId: params.serviceId,
          taskId: params.taskId,
        },
        { templateId: params.templateId, kind: params.kind, idemKey }
      )
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
    logAudit(params.userId, 'backpressure', 'task', params.taskId, {
      serviceId: params.serviceId,
      templateId: params.templateId,
      kind: params.kind,
      queueId: String(decision.queueId || ''),
      retryAfter: bp.retryAfter,
    })
    logEvent(
      'TASK_BACKPRESSURED',
      {
        userId: params.userId,
        serviceId: params.serviceId,
        taskId: params.taskId,
      },
      {
        templateId: params.templateId,
        kind: params.kind,
        queueId: String(decision.queueId || ''),
        retryAfter: bp.retryAfter,
      }
    )
    const wasPaid = !!params.variables.wasPaid
    const cost = Number(params.variables.cost || 0)
    const debitId = String((params.variables as any)?.debitId || '')
    if (wasPaid && cost > 0) {
      try {
        if (debitId) {
          const ledgerServiceId = isServiceScoped(params.templateId)
            ? params.serviceId
            : undefined
          await recordRefund({
            userId: params.userId,
            amount: cost,
            relatedId: debitId,
            ...(ledgerServiceId ? { serviceId: ledgerServiceId } : {}),
            templateId: params.templateId,
            metadata: { reason: 'backpressure' },
          })
        } else {
          await addQuota(params.userId, cost)
        }
      } catch (err) {
        logError({
          reqId: params.taskId,
          route: 'pushTask',
          error: String(err),
          phase: 'refund_backpressure',
        })
      }
    }
    await markTimeline(params.serviceId, 'producer_backpressured', {
      taskId: params.taskId,
      queueId: String(decision.queueId || ''),
      retryAfter: bp.retryAfter,
    })
    return {
      url,
      backpressured: true,
      refunded: wasPaid && cost > 0,
      ...(bp.retryAfter ? { retryAfter: bp.retryAfter } : {}),
      error: 'backpressured',
    }
  }

  let res: any
  try {
    res = await client
      .queue({ queueName: String(decision.queueId) })
      .enqueueJSON({
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
        retries: 0,
      })
  } catch (error) {
    const wasPaid = !!(params.variables as any)?.wasPaid
    const cost = Number((params.variables as any)?.cost || 0)
    const debitId = String((params.variables as any)?.debitId || '')
    if (wasPaid && cost > 0) {
      try {
        if (debitId) {
          const ledgerServiceId = isServiceScoped(params.templateId)
            ? params.serviceId
            : undefined
          await recordRefund({
            userId: params.userId,
            amount: cost,
            relatedId: debitId,
            ...(ledgerServiceId ? { serviceId: ledgerServiceId } : {}),
            templateId: params.templateId,
            metadata: { reason: 'enqueue_error', error: String(error) },
          })
        } else {
          await addQuota(params.userId, cost)
        }
      } catch (err) {
        logError({
          reqId: params.taskId,
          route: 'pushTask',
          error: String(err),
          phase: 'refund_enqueue_fail',
        })
      }
    }
    logEvent(
      'TASK_FAILED',
      {
        userId: params.userId,
        serviceId: params.serviceId,
        taskId: params.taskId,
      },
      {
        templateId: params.templateId,
        kind: params.kind,
        error: error instanceof Error ? error.message : String(error),
      }
    )
    return { url, refunded: wasPaid && cost > 0, error: 'enqueue_failed' }
  }

  // Audit successful enqueue
  logAudit(params.userId, 'enqueue', 'task', params.taskId, {
    serviceId: params.serviceId,
    templateId: params.templateId,
    kind: params.kind,
    url,
    messageId: res.messageId,
    idemKey,
  })

  // Analytics: task enqueued successfully
  logEvent(
    'TASK_ENQUEUED',
    {
      userId: params.userId,
      serviceId: params.serviceId,
      taskId: params.taskId,
    },
    {
      templateId: params.templateId,
      kind: params.kind,
      url,
      messageId: res.messageId,
      ...(idemKey ? { idemKey } : {}),
    }
  )

  await markTimeline(params.serviceId, 'producer_enqueued', {
    taskId: params.taskId,
    queueId: String(decision.queueId || ''),
    messageId: res.messageId,
  })
  return { messageId: res.messageId, url, ...(idemKey ? { idemKey } : {}) }
}
