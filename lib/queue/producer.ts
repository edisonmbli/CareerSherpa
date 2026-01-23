import { getQStash } from '@/lib/queue/qstash'
import { recordRefund } from '@/lib/dal/coinLedger'
import { addQuota } from '@/lib/dal/quotas'
import { ENV } from '@/lib/env'
import type { Locale } from '@/i18n-config'
import type { TaskTemplateId, VariablesFor } from '@/lib/prompts/types'
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
import { buildQueueCounterKey, queueMaxSizeFor } from '@/lib/config/concurrency'
import { bumpPending } from '@/lib/redis/counter'
import { logError } from '@/lib/logger'
import { getChannel, publishEvent } from '@/lib/worker/common'

export interface PushTaskParams<T extends TaskTemplateId> {
  kind: 'stream' | 'batch'
  serviceId: string
  taskId: string
  userId: string
  locale: Locale
  templateId: T
  variables: VariablesFor<T>
  /** Optional delay before task dispatch (in seconds). Useful to avoid lock contention. */
  delaySec?: number
}

/**
 * Push task with producer-side safeguards: rate limit + idempotency.
 * Returns messageId when published; on replay or rate limit, returns metadata without publishing.
 */
export async function pushTask<T extends TaskTemplateId>(
  params: PushTaskParams<T>,
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
  // Phase 4: Respect the kind parameter from action layer
  // Previously had a hardcoded override forcing vision→batch, now removed to enable streaming
  const kindSegment = params.kind
  const url = `${base}/api/worker/${kindSegment}/${encodeURIComponent(
    params.serviceId,
  )}`

  // Publish Queued Event to SSE
  try {
    const channel = getChannel(params.userId, params.serviceId, params.taskId)
    let code = 'queued'
    if (params.templateId === 'job_vision_summary') code = 'job_vision_queued'
    else if (params.templateId === 'job_summary') code = 'job_summary_queued'
    else if (params.templateId === 'pre_match_audit') code = 'prematch_queued'
    else if (params.templateId === 'job_match') code = 'match_queued'

    const pendingStatusMap: Partial<Record<TaskTemplateId, string>> = {
      job_vision_summary: 'JOB_VISION_PENDING',
      job_summary: 'SUMMARY_PENDING',
      pre_match_audit: 'PREMATCH_PENDING',
      job_match: 'MATCH_PENDING',
    }
    const pendingStatus = pendingStatusMap[params.templateId] || 'PENDING'

    // We don't await this to avoid blocking the main flow, or we catch error
    publishEvent(channel, {
      type: 'status',
      taskId: params.taskId,
      status: pendingStatus,
      code,
      stage: 'enqueue',
      requestId: params.taskId,
      traceId: params.taskId,
      lastUpdatedAt: new Date().toISOString(),
    }).catch((e) => console.error('Failed to publish queued event', e))
  } catch (e) {
    // Ignore error
  }

  // Check quota to decide trial/bound rate limits (for queue routing only)
  // Note: Rate limiting is now done at the server action level (user-centric)
  const { shouldUseFreeQueue } = quotaInfo

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
        { templateId: params.templateId, kind: params.kind, idemKey },
      )
      return { url, replay: true, idemKey }
    }
  }

  // 生产者侧队列背压：按 QueueId 维度限制入队
  const ttlSec = Math.max(1, Math.floor(ENV.CONCURRENCY_LOCK_TIMEOUT_MS / 1000))
  const queueCounterKey = buildQueueCounterKey(String(decision.queueId))
  const maxSize = queueMaxSizeFor(String(decision.queueId))
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
        maxSize,
        ...(bp.pending !== undefined ? { pending: bp.pending } : {}),
        retryAfter: bp.retryAfter,
      },
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
        // Delay dispatch to allow previous worker to release lock
        ...(params.delaySec && params.delaySec > 0
          ? { delay: params.delaySec }
          : {}),
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
      },
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
    },
  )

  // Phase 4: Emit "Queued" status immediately for UI feedback
  try {
    const STATUS_MAP: Record<string, string> = {
      job_match: 'MATCH_PENDING',
      job_summary: 'SUMMARY_PENDING',
      job_vision_summary: 'SUMMARY_PENDING',
      pre_match_audit: 'MATCH_PENDING', // Audit is part of match phase
      resume_customize: 'CUSTOMIZE_PENDING',
      interview_prep: 'INTERVIEW_PENDING',
    }
    const pendingStatus = STATUS_MAP[params.templateId] || 'PROCESSING'
    const channel = getChannel(params.userId, params.serviceId, params.taskId)

    // Fire and forget - don't block return
    publishEvent(channel, {
      type: 'status',
      taskId: params.taskId,
      status: pendingStatus,
      code: 'queued',
      stage: 'enqueue',
      requestId: params.taskId,
      traceId: params.taskId,
      lastUpdatedAt: new Date().toISOString(),
    }).catch((err) => {
      // Silent catch for queue notification errors
      if (process.env.NODE_ENV !== 'production') {
        console.error('[Producer] Failed to emit queued event:', err)
      }
    })
  } catch (e) {
    // Ignore
  }

  await markTimeline(params.serviceId, 'producer_enqueued', {
    taskId: params.taskId,
    queueId: String(decision.queueId || ''),
    messageId: res.messageId,
  })
  return { messageId: res.messageId, url, ...(idemKey ? { idemKey } : {}) }
}
