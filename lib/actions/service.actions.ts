'use server'

import { withServerActionAuthWrite } from '@/lib/auth/wrapper'
import { getOrCreateQuota } from '@/lib/dal/quotas'
import { checkQuotaForService } from '@/lib/quota/atomic-operations'
import {
  recordDebit,
  markDebitSuccess,
  markDebitFailed,
  recordRefund,
} from '@/lib/dal/coinLedger'
import { getLatestResume, getLatestDetailedResume } from '@/lib/dal/resume'
import { getTaskCost, JOB_IMAGE_MAX_BYTES } from '@/lib/constants'
import {
  createService,
  createJobForService,
  ensureMatchRecord,
  ensureCustomizedResumeRecord,
  ensureInterviewRecord,
  setCustomizedResumeResult,
  getServiceWithContext,
  updateMatchStatus,
  updateCustomizedResumeEditedData,
  updateCustomizedResumeStatus,
  updateServiceExecutionStatus,
} from '@/lib/dal/services'
import { pushTask } from '@/lib/queue/producer'
import { ensureEnqueued } from '@/lib/actions/enqueue'
import { acquireLock } from '@/lib/redis/lock'
import { ENV } from '@/lib/env'
import { trackEvent, AnalyticsCategory } from '@/lib/analytics/index'
import { checkOperationRateLimit } from '@/lib/rateLimiter'
import type { Locale } from '@/i18n-config'
import type { TaskTemplateId } from '@/lib/prompts/types'
import { AsyncTaskStatus, ExecutionStatus } from '@prisma/client'
import { markTimeline } from '@/lib/observability/timeline'
import { nanoid } from 'nanoid'
import { after } from 'next/server'
import { buildTaskId } from '@/lib/types/task-context'

export type CustomizeResumeActionResult =
  | {
      ok: true
      taskId: string
      taskType: 'customize'
      isFree: boolean
      executionSessionId: string
    }
  | { ok: false; error: string }

export type GenerateInterviewTipsActionResult =
  | {
      ok: true
      taskId: string
      taskType: 'interview'
      isFree: boolean
      stream: true
      executionSessionId: string
    }
  | { ok: false; error: string }

export type SaveCustomizedResumeActionResult = { ok: true }

const getBase64ByteSize = (dataUrl: string) => {
  const commaIndex = dataUrl.indexOf(',')
  const base64 = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl
  return Math.floor((base64.length * 3) / 4)
}

/**
 * 创建服务（Service）并初始化相关任务（Job, Match等）
 * @param params - 包含 locale, jobText, jobImage 的参数对象
 * @param ctx - 包含 userId 的上下文对象
 * @returns 包含 ok, taskId, taskType, isFree 的结果对象
 */
export const createServiceAction = withServerActionAuthWrite(
  'createServiceAction',
  async (
    params: { locale: Locale; jobText?: string; jobImage?: string },
    ctx,
  ) => {
    const userId = ctx.userId
    const MAX_IMAGE_BYTES = JOB_IMAGE_MAX_BYTES
    const MAX_TEXT_CHARS = 8000
    if (params.jobText && params.jobText.length > MAX_TEXT_CHARS) {
      return { ok: false, error: 'job_text_too_long' }
    }

    if (params.jobImage) {
      const sizeBytes = getBase64ByteSize(params.jobImage)
      if (sizeBytes > MAX_IMAGE_BYTES) {
        return { ok: false, error: 'image_too_large' }
      }
    }

    // 1. Check quota first to determine tier
    const quotaInfo = await checkQuotaForService(userId)
    const isPaidTier = !quotaInfo.shouldUseFreeQueue

    // 2. User operation rate limit check (early interception)
    const rateCheck = await checkOperationRateLimit(
      userId,
      isPaidTier ? 'paid' : 'free',
    )
    if (!rateCheck.ok) {
      return { ok: false, error: rateCheck.error! }
    }

    // 3. 获取最新简历
    const resume = await getLatestResume(userId)
    // 3.1 检查简历是否存在且已完成
    if (!resume || String(resume.status).toUpperCase() !== 'COMPLETED') {
      return { ok: false, error: 'resume_required' } // 如果没有完成的简历，则返回错误
    }
    // 2. 获取最新详细简历
    const detailed = await getLatestDetailedResume(userId)
    // 3. 获取或创建用户配额
    await getOrCreateQuota(userId)
    // 4. 定义服务成本
    const cost = getTaskCost('job_match')

    // 5. 创建服务记录
    const svc = await createService(userId, resume.id, detailed?.id)
    await markTimeline(svc.id, 'create_service_start', { userId })

    const executionSessionId =
      typeof crypto?.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    // 6. 为服务创建工作（Job）记录，包含岗位文本或图片
    const job = await createJobForService(
      svc.id,
      params.jobText,
      params.jobImage,
    )
    await markTimeline(svc.id, 'create_service_job_created')
    // 7. 确保匹配记录存在
    await ensureMatchRecord(svc.id)
    await markTimeline(svc.id, 'create_service_match_ensured')

    // 8. 判断输入是否为图片
    const isImage = !!params.jobImage

    // 9. 记录扣费
    const debit = await recordDebit({
      userId,
      amount: cost,
      serviceId: svc.id,
      templateId: 'job_match',
    })
    await markTimeline(svc.id, 'create_service_debit_recorded', { cost })
    const hasQuota = debit.ok // 检查是否成功扣费（即用户是否有配额）

    trackEvent('SERVICE_CREATED', {
      userId,
      serviceId: svc.id,
      category: AnalyticsCategory.BUSINESS,
      payload: {
        isImage,
        isPaid: hasQuota,
        hasDetailedResume: !!detailed,
      },
    })

    // 10. 根据输入类型（图片或文本）和付费状态执行不同的任务入队逻辑
    if (isImage) {
      const tEnq = Date.now()

      // Phase 1.5: Different paths for Paid and Free tiers
      if (hasQuota) {
        // --- PAID TIER: Use Baidu OCR (preview) + enqueue job_summary ---
        // Optimistic update
        await updateServiceExecutionStatus(
          svc.id,
          ExecutionStatus.OCR_PENDING,
          {
            executionSessionId,
          },
        )

        after(async () => {
          const e1 = await ensureEnqueued({
            kind: 'batch', // OCR remains batch
            serviceId: svc.id,
            taskId: `job_${svc.id}_${executionSessionId}`,
            userId,
            locale: params.locale,
            templateId: 'ocr_extract' as any,
            variables: {
              jobId: job.id,
              image: params.jobImage,
              wasPaid: hasQuota,
              cost,
              debitId: debit.id,
              executionSessionId,
            } as any,
          })
          await markTimeline(svc.id, 'create_service_ocr_enqueued', {
            latencyMs: Date.now() - tEnq,
          })
          if (!e1.ok) {
            await markDebitFailed(debit.id)
            await updateServiceExecutionStatus(
              svc.id,
              ExecutionStatus.MATCH_FAILED,
              { failureCode: 'ENQUEUE_FAILED' },
            )
          } else {
            trackEvent('TASK_ENQUEUED', {
              userId,
              serviceId: svc.id,
              traceId: `job_${svc.id}_${executionSessionId}`,
              category: AnalyticsCategory.SYSTEM,
              payload: { task: 'ocr_extract', isFree: false },
            })
          }
        })

        return {
          ok: true,
          serviceId: svc.id,
          isFree: false,
          stream: false,
          status: 'PENDING_OCR',
          executionSessionId,
          hint: {
            dependency: 'ocr_extract',
            next: ['SUMMARY_COMPLETED', 'MATCH_STREAMING'],
          },
        }
      } else {
        // --- FREE TIER: Use merged job_vision_summary (Gemini multimodal) ---
        // Optimistic update
        await updateServiceExecutionStatus(
          svc.id,
          ExecutionStatus.JOB_VISION_PENDING,
          {
            executionSessionId,
          },
        )

        after(async () => {
          const e1 = await ensureEnqueued({
            kind: 'stream',
            serviceId: svc.id,
            taskId: `job_${svc.id}_${executionSessionId}`,
            userId,
            locale: params.locale,
            templateId: 'job_vision_summary' as any,
            variables: {
              jobId: job.id,
              image: params.jobImage,
              wasPaid: false,
              cost: 0,
              executionSessionId,
            } as any,
          })
          await markTimeline(svc.id, 'create_service_vision_summary_enqueued', {
            latencyMs: Date.now() - tEnq,
          })
          if (!e1.ok) {
            await updateServiceExecutionStatus(
              svc.id,
              ExecutionStatus.MATCH_FAILED,
              { failureCode: 'ENQUEUE_FAILED' },
            )
          } else {
            trackEvent('TASK_ENQUEUED', {
              userId,
              serviceId: svc.id,
              traceId: `job_${svc.id}_${executionSessionId}`,
              category: AnalyticsCategory.SYSTEM,
              payload: { task: 'job_vision_summary', isFree: true },
            })
          }
        })

        return {
          ok: true,
          serviceId: svc.id,
          isFree: true,
          stream: true,
          status: 'JOB_VISION_PENDING',
          executionSessionId,
          hint: {
            dependency: 'job_vision_summary',
            next: ['SUMMARY_COMPLETED', 'MATCH_STREAMING'],
          },
        }
      }
    }

    // 10.3 如果是文本 JD
    // Optimistic update
    await updateServiceExecutionStatus(
      svc.id,
      ExecutionStatus.SUMMARY_PENDING,
      {
        executionSessionId,
      },
    )

    const tEnq = Date.now()
    after(async () => {
      const eText = await ensureEnqueued({
        kind: 'batch',
        serviceId: svc.id,
        taskId: `job_${svc.id}_${executionSessionId}`,
        userId,
        locale: params.locale,
        templateId: 'job_summary',
        variables: {
          jobId: job.id,
          wasPaid: hasQuota,
          cost,
          ...(hasQuota ? { debitId: debit.id } : {}),
          executionSessionId,
        },
      })
      await markTimeline(svc.id, 'create_service_summary_enqueued', {
        latencyMs: Date.now() - tEnq,
      })
      if (!eText.ok) {
        if (hasQuota) {
          await markDebitFailed(debit.id)
        }
        await updateServiceExecutionStatus(
          svc.id,
          ExecutionStatus.MATCH_FAILED,
          {
            failureCode: 'ENQUEUE_FAILED',
          },
        )
      } else {
        trackEvent('TASK_ENQUEUED', {
          userId,
          serviceId: svc.id,
          traceId: `job_${svc.id}_${executionSessionId}`,
          category: AnalyticsCategory.SYSTEM,
          payload: { task: 'job_summary', isFree: !hasQuota },
        })
      }
    })

    return {
      ok: true,
      serviceId: svc.id,
      isFree: !hasQuota,
      stream: false,
      status: 'PENDING_SUMMARY',
      executionSessionId,
      hint: {
        dependency: 'job_summary',
        next: ['SUMMARY_COMPLETED', 'MATCH_STREAMING'],
      },
    }
  },
)

export const customizeResumeAction = withServerActionAuthWrite<
  { locale: Locale; serviceId: string },
  CustomizeResumeActionResult
>(
  'customizeResumeAction',
  async (params: { locale: Locale; serviceId: string }, ctx) => {
    const userId = ctx.userId

    // 1. Check quota to determine tier
    const quotaInfo = await checkQuotaForService(userId)
    const isPaidTier = !quotaInfo.shouldUseFreeQueue

    // 2. User operation rate limit check (early interception)
    const rateCheck = await checkOperationRateLimit(
      userId,
      isPaidTier ? 'paid' : 'free',
    )
    if (!rateCheck.ok) {
      return { ok: false, error: rateCheck.error! }
    }

    await getOrCreateQuota(userId)
    const cost = getTaskCost('resume_customize')

    const service = await getServiceWithContext(params.serviceId)
    if (!service?.resume || !service?.job) {
      return { ok: false, error: 'service_context_missing' }
    }

    // Ensure customized resume record exists
    const rec = await ensureCustomizedResumeRecord(params.serviceId)

    const debit2 = await recordDebit({
      userId,
      amount: cost,
      serviceId: service.id,
      templateId: 'resume_customize',
    })
    const hasQuota = debit2.ok

    // Set PENDING before enqueue (matches generateInterviewTipsAction pattern)
    const executionSessionId = nanoid()
    await updateServiceExecutionStatus(
      params.serviceId,
      ExecutionStatus.CUSTOMIZE_PENDING,
      { executionSessionId },
    )

    // Push to QStash (New Async Logic)
    const enq = await ensureEnqueued({
      kind: 'batch',
      serviceId: params.serviceId,
      // Use consistent taskId format: customize_{serviceId}_{sessionId}
      taskId: `customize_${params.serviceId}_${executionSessionId}`,
      userId,
      locale: params.locale,
      templateId: 'resume_customize',
      variables: {
        serviceId: params.serviceId,
        wasPaid: hasQuota,
        cost,
        executionSessionId,
        ...(hasQuota ? { debitId: debit2.id } : {}),
      } as any,
    })

    if (!enq.ok) {
      // Set FAILED status on customize_resumes record
      await updateCustomizedResumeStatus(
        params.serviceId,
        AsyncTaskStatus.FAILED,
      )
      // Set FAILED status on service execution
      await updateServiceExecutionStatus(
        params.serviceId,
        ExecutionStatus.CUSTOMIZE_FAILED,
        { executionSessionId },
      )
      // Mark debit as FAILED to ensure ledger consistency
      if (hasQuota) {
        await markDebitFailed(debit2.id)
      }
      return { ok: false, error: enq.error }
    }

    trackEvent('TASK_ENQUEUED', {
      userId,
      serviceId: params.serviceId,
      traceId: `customize_${params.serviceId}_${executionSessionId}`,
      category: AnalyticsCategory.SYSTEM,
      payload: { task: 'customize', isFree: !hasQuota },
    })

    return {
      ok: true,
      taskId: rec.id,
      taskType: 'customize',
      isFree: !hasQuota,
      executionSessionId,
    }
  },
)

export const trackCustomizeExportAction = withServerActionAuthWrite(
  'trackCustomizeExportAction',
  async (params: { serviceId: string; markdownLength: number }, ctx) => {
    trackEvent('CUSTOMIZE_COMPLETED', {
      userId: ctx.userId,
      category: AnalyticsCategory.BUSINESS,
      payload: {
        task: 'customize_export',
        markdownLength: params.markdownLength,
        serviceId: params.serviceId,
      },
    })
    return { ok: true }
  },
)

export const generateInterviewTipsAction = withServerActionAuthWrite<
  { locale: Locale; serviceId: string },
  GenerateInterviewTipsActionResult
>(
  'generateInterviewTipsAction',
  async (params: { locale: Locale; serviceId: string }, ctx) => {
    const userId = ctx.userId

    // 1. Check quota to determine tier
    const quotaInfo = await checkQuotaForService(userId)
    const isPaidTier = !quotaInfo.shouldUseFreeQueue

    // 2. User operation rate limit check (early interception)
    const rateCheck = await checkOperationRateLimit(
      userId,
      isPaidTier ? 'paid' : 'free',
    )
    if (!rateCheck.ok) {
      return { ok: false, error: rateCheck.error! }
    }

    await getOrCreateQuota(userId)
    const cost = getTaskCost('interview_prep')

    const rec = await ensureInterviewRecord(params.serviceId)
    const debit3 = await recordDebit({
      userId,
      amount: cost,
      serviceId: params.serviceId,
      templateId: 'interview_prep',
    })
    const hasQuota = debit3.ok

    const executionSessionId = nanoid()
    await updateServiceExecutionStatus(
      params.serviceId,
      ExecutionStatus.INTERVIEW_PENDING,
      { executionSessionId },
    )

    const interviewTaskId = buildTaskId(
      'interview',
      params.serviceId,
      executionSessionId,
    )

    {
      const enq = await ensureEnqueued({
        kind: 'stream',
        serviceId: params.serviceId,
        taskId: interviewTaskId,
        userId,
        locale: params.locale,
        templateId: 'interview_prep',
        variables: {
          interviewId: rec.id,
          wasPaid: hasQuota,
          cost,
          executionSessionId,
          ...(hasQuota ? { debitId: debit3.id } : {}),
        } as any,
      })
      if (!enq.ok) {
        await updateServiceExecutionStatus(
          params.serviceId,
          ExecutionStatus.INTERVIEW_FAILED,
          { executionSessionId },
        )
        return { ok: false, error: enq.error }
      }
    }
    trackEvent('TASK_ENQUEUED', {
      userId,
      serviceId: params.serviceId,
      traceId: interviewTaskId,
      category: AnalyticsCategory.SYSTEM,
      payload: { task: 'interview', isFree: !hasQuota },
    })

    trackEvent('INTERVIEW_SESSION_STARTED', {
      userId,
      serviceId: params.serviceId,
      category: AnalyticsCategory.BUSINESS,
      payload: { interviewId: rec.id },
    })
    return {
      ok: true,
      taskId: rec.id,
      taskType: 'interview',
      isFree: !hasQuota,
      stream: true,
      executionSessionId,
    }
  },
)

export const saveCustomizedResumeAction = withServerActionAuthWrite<
  { serviceId: string; resumeJson: any },
  SaveCustomizedResumeActionResult
>(
  'saveCustomizedResumeAction',
  async (params: { serviceId: string; resumeJson: any }, ctx) => {
    const userId = ctx.userId
    await updateCustomizedResumeEditedData(params.serviceId, params.resumeJson)
    trackEvent('CUSTOMIZE_COMPLETED', {
      userId,
      category: AnalyticsCategory.BUSINESS,
      payload: { task: 'customize_save', serviceId: params.serviceId },
    })
    return { ok: true }
  },
)

export const retryMatchAction = withServerActionAuthWrite<
  { locale: Locale; serviceId: string },
  | {
      ok: true
      isFree: boolean
      step: 'summary' | 'match'
      stream: boolean
      executionSessionId: string
    }
  | {
      ok: false
      error:
        | 'job_summary_missing'
        | 'previous_ocr_failed'
        | 'previous_summary_failed'
        | 'previous_model_limit'
        | 'enqueue_failed'
        | 'daily_limit'
        | 'frequency_limit'
    }
>(
  'retryMatchAction',
  async (params: { locale: Locale; serviceId: string }, ctx) => {
    const userId = ctx.userId

    // 1. Check quota to determine tier
    const quotaInfo = await checkQuotaForService(userId)
    const isPaidTier = !quotaInfo.shouldUseFreeQueue

    // 2. User operation rate limit check (early interception)
    const rateCheck = await checkOperationRateLimit(
      userId,
      isPaidTier ? 'paid' : 'free',
    )
    if (!rateCheck.ok) {
      return { ok: false, error: rateCheck.error! }
    }

    await getOrCreateQuota(userId)
    const cost = getTaskCost('job_match')
    const svc = await getServiceWithContext(params.serviceId)
    if (!svc?.resume || !svc?.job) {
      return { ok: false, error: 'job_summary_missing' }
    }
    const executionSessionId =
      typeof crypto?.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    if (!svc.job.jobSummaryJson) {
      const debit = await recordDebit({
        userId,
        amount: cost,
        serviceId: params.serviceId,
        templateId: 'job_match',
      })
      const hasQuota = debit.ok
      const needOcr = !svc.job.originalText && !!svc.job.originalImage
      const ttlSec = Math.max(
        1,
        Math.floor(ENV.CONCURRENCY_LOCK_TIMEOUT_MS / 1000),
      )
      const locked = await acquireLock(params.serviceId, 'summary', ttlSec)
      if (!locked) {
        return { ok: false, error: 'enqueue_failed' }
      }
      // Phase 1.5: Different templates for Paid vs Free tier
      let templateId: any = 'job_summary'
      if (needOcr) {
        templateId = hasQuota ? 'ocr_extract' : 'job_vision_summary' // Free tier uses merged flow
      }
      const enqSummary = await ensureEnqueued({
        kind: 'batch',
        serviceId: params.serviceId,
        taskId: `job_${params.serviceId}_${executionSessionId}`,
        userId,
        locale: params.locale,
        templateId,
        variables: {
          jobId: svc.job.id,
          ...(needOcr && svc.job.originalImage
            ? { image: svc.job.originalImage }
            : {}),
          wasPaid: hasQuota,
          cost,
          ...(hasQuota ? { debitId: debit.id } : {}),
          executionSessionId,
        } as any,
      })
      if (!enqSummary.ok) {
        if (hasQuota) {
          // We do NOT need to recordRefund manually here, because ensureEnqueued (via pushTask)
          // already handles the refund logic when enqueue fails.
          // However, we SHOULD mark the original debit as FAILED so the ledger shows it correctly.
          await markDebitFailed(debit.id)
        }
        await updateServiceExecutionStatus(
          params.serviceId,
          ExecutionStatus.MATCH_FAILED,
          { failureCode: 'ENQUEUE_FAILED' },
        )
        return { ok: false, error: 'enqueue_failed' }
      }
      trackEvent('TASK_ENQUEUED', {
        userId,
        serviceId: params.serviceId,
        traceId: `job_${params.serviceId}_${executionSessionId}`,
        category: AnalyticsCategory.SYSTEM,
        payload: { task: 'job_summary_retry', isFree: !hasQuota },
      })
      await updateMatchStatus(params.serviceId, 'PENDING' as any)
      await updateServiceExecutionStatus(
        params.serviceId,
        'SUMMARY_PENDING' as any,
        { failureCode: null, executionSessionId },
      )
      return {
        ok: true,
        isFree: !hasQuota,
        step: 'summary',
        stream: false,
        executionSessionId,
      }
    }
    const debit = await recordDebit({
      userId,
      amount: cost,
      serviceId: params.serviceId,
      templateId: 'job_match',
    })
    const hasQuota = debit.ok
    await updateMatchStatus(params.serviceId, AsyncTaskStatus.PENDING)

    // Phase 2 Fix: Paid users must go through Pre-Match Audit logic on retry
    if (hasQuota) {
      const matchTaskId = `match_${params.serviceId}_${executionSessionId}`
      const enq = await ensureEnqueued({
        kind: 'batch',
        serviceId: params.serviceId,
        taskId: `pre_${matchTaskId}`, // Distinct task ID for audit
        userId,
        locale: params.locale,
        templateId: 'pre_match_audit',
        variables: {
          serviceId: params.serviceId,
          resumeId: svc.resumeId,
          ...(svc.detailedResumeId
            ? { detailedResumeId: svc.detailedResumeId }
            : {}),
          jobId: svc.job.id,
          resume_summary_json: '', // Worker will fetch
          job_summary_json: '', // Worker will fetch
          executionSessionId,
          wasPaid: hasQuota,
          cost,
          ...(hasQuota ? { debitId: debit.id } : {}),
          nextTaskId: matchTaskId,
        } as any,
      })

      if (!enq.ok) {
        // Refund logic handled by ensureEnqueued? No, ensuring debit failed mark.
        await markDebitFailed(debit.id)
        await updateServiceExecutionStatus(
          params.serviceId,
          ExecutionStatus.MATCH_FAILED,
          { failureCode: 'ENQUEUE_FAILED' },
        )
        return { ok: false, error: 'enqueue_failed' }
      }

      trackEvent('TASK_ENQUEUED', {
        userId,
        serviceId: params.serviceId,
        traceId: `pre_match_${params.serviceId}_${executionSessionId}`,
        category: AnalyticsCategory.SYSTEM,
        payload: { task: 'retry_pre_match_audit', isFree: !hasQuota },
      })
      await updateServiceExecutionStatus(
        params.serviceId,
        ExecutionStatus.MATCH_PENDING,
        { failureCode: null, executionSessionId },
      )
      return {
        ok: true,
        isFree: !hasQuota,
        step: 'match',
        stream: false, // Audit is batch
        executionSessionId,
      }
    }

    // Free Tier: Direct Match
    const enq = await ensureEnqueued({
      kind: 'stream',
      serviceId: params.serviceId,
      taskId: `match_${params.serviceId}_${executionSessionId}`,
      userId,
      locale: params.locale,
      templateId: 'job_match',
      variables: {
        rag_context: '',
        resumeId: svc.resumeId,
        ...(svc.detailedResumeId
          ? { detailedResumeId: svc.detailedResumeId }
          : {}),
        jobId: svc.job.id,
        resume_summary_json: '',
        job_summary_json: '',
        wasPaid: hasQuota,
        cost,
        // Removed unreachable debitId check
        // ...(hasQuota ? { debitId: debit.id } : {}),
        executionSessionId,
      },
    })
    if (!enq.ok) {
      // Free tier path or failed debit path - no debitId to fail
      //if (hasQuota) {
      // We do NOT need to recordRefund manually here, because ensureEnqueued (via pushTask)
      // already handles the refund logic when enqueue fails.
      // However, we SHOULD mark the original debit as FAILED so the ledger shows it correctly.
      // await markDebitFailed(debit.id)
      //}
      await updateServiceExecutionStatus(
        params.serviceId,
        ExecutionStatus.MATCH_FAILED,
        { failureCode: 'ENQUEUE_FAILED' },
      )
      return { ok: false, error: 'enqueue_failed' }
    }
    trackEvent('TASK_ENQUEUED', {
      userId,
      serviceId: params.serviceId,
      traceId: `match_${params.serviceId}_${executionSessionId}`,
      category: AnalyticsCategory.SYSTEM,
      payload: { task: 'retry_match', isFree: !hasQuota },
    })
    await updateServiceExecutionStatus(
      params.serviceId,
      ExecutionStatus.MATCH_PENDING,
      { failureCode: null, executionSessionId },
    )
    return {
      ok: true,
      isFree: !hasQuota,
      step: 'match',
      stream: true,
      executionSessionId,
    }
  },
)
