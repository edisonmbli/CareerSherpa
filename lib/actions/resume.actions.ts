'use server'

import { withServerActionAuthWrite } from '@/lib/auth/wrapper'
import { getOrCreateQuota } from '@/lib/dal/quotas'
import { checkQuotaForService } from '@/lib/quota/atomic-operations'
import { recordDebit } from '@/lib/dal/coinLedger'
import {
  upsertResume,
  upsertDetailedResume,
  getLatestResumeSummaryJson,
  getLatestDetailedSummaryJson,
} from '@/lib/dal/resume'
import { pushTask } from '@/lib/queue/producer'
import {
  trackEvent,
  AnalyticsCategory,
  AnalyticsOutcome,
  AnalyticsRuntime,
  AnalyticsSource,
} from '@/lib/analytics/index'
import { checkOperationRateLimit } from '@/lib/rateLimiter'
import type { Locale } from '@/i18n-config'
import type { TaskTemplateId } from '@/lib/prompts/types'
import { getTaskLimits } from '@/lib/llm/config'
import { ensureEnqueued } from '@/lib/actions/enqueue'
import {
  updateCustomizedResumeEditedData,
  resetCustomizedResumeEditedData,
} from '@/lib/dal/services'
import {
  resumeDataSchema,
  sectionConfigSchema,
} from '@/lib/types/resume-schema'
import { revalidatePath } from 'next/cache'
import { logError, logWarn } from '@/lib/logger'
import { markTimeline } from '@/lib/observability/timeline'
import { getTaskInputCharLimit } from '@/lib/llm/config'
import { getDetailedResumeRoutingPlan } from '@/lib/llm/task-router'

export type UploadResumeActionResult =
  | { ok: true; taskId: string; isFree: boolean; taskType: 'resume' }
  | { ok: false; error: string; taskId?: string; isFree?: boolean }

export type UploadDetailedResumeActionResult =
  | { ok: true; taskId: string; isFree: boolean; taskType: 'detailed_resume' }
  | { ok: false; error: string; taskId?: string; isFree?: boolean }

export const uploadResumeAction = withServerActionAuthWrite<
  { locale: Locale; originalText: string },
  UploadResumeActionResult
>(
  'uploadResumeAction',
  async (params: { locale: Locale; originalText: string }, ctx) => {
    const userId = ctx.userId
    const len = (params.originalText || '').length
    const limit = getTaskInputCharLimit('resume_summary')
    if (len > limit) {
      logWarn({
        reqId: userId,
        route: 'actions/resume',
        phase: 'resume_text_too_long',
        templateId: 'resume_summary',
        meta: { length: len, limit },
      })
      return { ok: false, error: 'text_too_long' }
    }

    const actionStartedAt = Date.now()

    // 1. Check quota to determine tier
    const quotaInfo = await checkQuotaForService(userId)
    const isPaidTier = !quotaInfo.shouldUseFreeQueue
    await markTimeline(userId, 'resume_action_quota_checked', {
      kind: 'batch',
      templateId: 'resume_summary',
      meta: {
        elapsedMs: Date.now() - actionStartedAt,
        isPaidTier,
        remainingCredits: quotaInfo.remainingCredits,
      },
    })

    // 2. User operation rate limit check (early interception)
    const rateCheck = await checkOperationRateLimit(userId, isPaidTier ? 'paid' : 'free')
    if (!rateCheck.ok) {
      return { ok: false, error: rateCheck.error! }
    }
    await markTimeline(userId, 'resume_action_rate_limit_checked', {
      kind: 'batch',
      templateId: 'resume_summary',
      meta: {
        elapsedMs: Date.now() - actionStartedAt,
      },
    })

    await getOrCreateQuota(userId)
    await markTimeline(userId, 'resume_action_quota_ready', {
      kind: 'batch',
      templateId: 'resume_summary',
      meta: {
        elapsedMs: Date.now() - actionStartedAt,
      },
    })
    const cost = 1
    const rec = await upsertResume(userId, params.originalText)
    await markTimeline(rec.id, 'resume_action_upsert_done', {
      taskId: rec.id,
      templateId: 'resume_summary',
      kind: 'batch',
      meta: {
        elapsedMs: Date.now() - actionStartedAt,
        inputLength: len,
      },
    })
    await markTimeline(rec.id, 'action_start', {
      taskId: rec.id,
      templateId: 'resume_summary',
      kind: 'batch',
    })
    const debit = await recordDebit({
      userId,
      amount: cost,
      taskId: rec.id,
      templateId: 'resume_summary',
    })
    const hasQuota = debit.ok
    await markTimeline(rec.id, 'resume_action_debit_done', {
      taskId: rec.id,
      templateId: 'resume_summary',
      kind: 'batch',
      meta: {
        elapsedMs: Date.now() - actionStartedAt,
        hasQuota,
      },
    })
    {
      await markTimeline(rec.id, 'resume_action_enqueue_requested', {
        taskId: rec.id,
        templateId: 'resume_summary',
        kind: 'batch',
        meta: {
          elapsedMs: Date.now() - actionStartedAt,
        },
      })
      const enq = await ensureEnqueued({
        kind: 'batch',
        serviceId: rec.id,
        taskId: rec.id,
        userId,
        locale: params.locale,
        templateId: 'resume_summary',
        variables: {
          resumeId: rec.id,
          resume_text: params.originalText,
          wasPaid: hasQuota,
          cost,
          ...(hasQuota ? { debitId: debit.id } : {}),
        },
        routingSource: 'explicit',
        hasQuota,
      })
      await markTimeline(rec.id, enq.ok ? 'resume_action_enqueue_accepted' : 'resume_action_enqueue_rejected', {
        taskId: rec.id,
        templateId: 'resume_summary',
        kind: 'batch',
        meta: {
          elapsedMs: Date.now() - actionStartedAt,
          ...(enq.ok ? {} : { error: enq.error }),
        },
      })
      if (!enq.ok)
        return {
          ok: false,
          taskId: rec.id,
          isFree: !hasQuota,
          error: enq.error,
        }
    }
    trackEvent('RESUME_UPLOAD_ACCEPTED', {
      userId,
      serviceId: rec.id,
      taskId: rec.id,
      traceId: rec.id,
      category: AnalyticsCategory.BUSINESS,
      source: AnalyticsSource.ACTION,
      runtime: AnalyticsRuntime.NEXTJS,
      outcome: AnalyticsOutcome.ACCEPTED,
      payload: { type: 'resume', isFree: !hasQuota, length: len },
    })
    return { ok: true, taskId: rec.id, isFree: !hasQuota, taskType: 'resume' }
  }
)

export const uploadDetailedResumeAction = withServerActionAuthWrite<
  { locale: Locale; originalText: string },
  UploadDetailedResumeActionResult
>(
  'uploadDetailedResumeAction',
  async (params: { locale: Locale; originalText: string }, ctx) => {
    const userId = ctx.userId
    const len = (params.originalText || '').length
    const limit = getTaskInputCharLimit('detailed_resume_summary')
    if (len > limit) {
      logWarn({
        reqId: userId,
        route: 'actions/resume',
        phase: 'detailed_resume_text_too_long',
        templateId: 'detailed_resume_summary',
        meta: { length: len, limit },
      })
      return { ok: false, error: 'text_too_long' }
    }

    // 1. Check quota to determine tier
    const quotaInfo = await checkQuotaForService(userId)
    const isPaidTier = !quotaInfo.shouldUseFreeQueue

    // 2. User operation rate limit check (early interception)
    const rateCheck = await checkOperationRateLimit(userId, isPaidTier ? 'paid' : 'free')
    if (!rateCheck.ok) {
      return { ok: false, error: rateCheck.error! }
    }

    await getOrCreateQuota(userId)
    const cost = 1
    const rec = await upsertDetailedResume(userId, params.originalText)
    await markTimeline(rec.id, 'action_start', {
      taskId: rec.id,
      templateId: 'detailed_resume_summary',
      kind: 'batch',
    })
    const debit = await recordDebit({
      userId,
      amount: cost,
      taskId: rec.id,
      templateId: 'detailed_resume_summary',
    })
    const hasQuota = debit.ok
    const routingPlan = getDetailedResumeRoutingPlan(hasQuota, len)
    await markTimeline(rec.id, 'detailed_resume_action_profile_selected', {
      taskId: rec.id,
      templateId: 'detailed_resume_summary',
      kind: 'batch',
      modelId: routingPlan.modelId,
      queueId: String(routingPlan.queueId),
      profile: routingPlan.profile,
      inputLength: len,
      isPaid: hasQuota,
    })
    {
      const enq = await ensureEnqueued({
        kind: 'batch',
        serviceId: rec.id,
        taskId: rec.id,
        userId,
        locale: params.locale,
        templateId: 'detailed_resume_summary',
        variables: {
          detailedResumeId: rec.id,
          detailed_resume_text: params.originalText,
          wasPaid: hasQuota,
          cost,
          ...(hasQuota ? { debitId: debit.id } : {}),
        },
        routingSource: 'explicit',
        hasQuota,
      })
      if (!enq.ok)
        return {
          ok: false,
          taskId: rec.id,
          isFree: !hasQuota,
          error: enq.error,
        }
    }
    trackEvent('RESUME_UPLOAD_ACCEPTED', {
      userId,
      serviceId: rec.id,
      taskId: rec.id,
      traceId: rec.id,
      category: AnalyticsCategory.BUSINESS,
      source: AnalyticsSource.ACTION,
      runtime: AnalyticsRuntime.NEXTJS,
      outcome: AnalyticsOutcome.ACCEPTED,
      payload: { type: 'detailed', isFree: !hasQuota, length: len },
    })
    return {
      ok: true,
      taskId: rec.id,
      isFree: !hasQuota,
      taskType: 'detailed_resume',
    }
  }
)

export const getLatestResumeSummaryAction = withServerActionAuthWrite(
  'getLatestResumeSummaryAction',
  async (_: undefined, ctx) => {
    const userId = ctx.userId
    const data = await getLatestResumeSummaryJson(userId)
    return { ok: true, data }
  }
)

export const getLatestDetailedSummaryAction = withServerActionAuthWrite(
  'getLatestDetailedSummaryAction',
  async (_: undefined, ctx) => {
    const userId = ctx.userId
    const data = await getLatestDetailedSummaryJson(userId)
    return { ok: true, data }
  }
)

// --- New Actions for Resume Customization (M10) ---

export async function updateCustomizedResumeAction(params: {
  serviceId: string
  resumeData?: any      // Now optional for incremental updates
  sectionConfig?: any
  opsJson?: any
}) {
  const { serviceId, resumeData, sectionConfig, opsJson } = params

  try {
    // Only validate fields that are being updated
    const validatedData = resumeData
      ? resumeDataSchema.parse(resumeData)
      : undefined
    const validatedConfig = sectionConfig
      ? sectionConfigSchema.parse(sectionConfig)
      : undefined

    await updateCustomizedResumeEditedData(
      serviceId,
      validatedData,
      validatedConfig,
      opsJson
    )

    revalidatePath(`/workbench/${serviceId}`)
    return { ok: true }
  } catch (error) {
    logError({
      reqId: serviceId,
      route: 'actions/resume',
      phase: 'update_customized_resume_failed',
      serviceId,
      error: error instanceof Error ? error : String(error),
    })
    return { ok: false, error: 'Failed to save changes' }
  }
}

export async function resetCustomizedResumeAction(serviceId: string) {
  try {
    await resetCustomizedResumeEditedData(serviceId)
    revalidatePath(`/workbench/${serviceId}`)
    return { ok: true }
  } catch (error) {
    logError({
      reqId: serviceId,
      route: 'actions/resume',
      phase: 'reset_customized_resume_failed',
      serviceId,
      error: error instanceof Error ? error : String(error),
    })
    return { ok: false, error: 'Failed to reset data' }
  }
}
