'use server'

import { withServerActionAuthWrite } from '@/lib/auth/wrapper'
import { getOrCreateQuota } from '@/lib/dal/quotas'
import {
  recordDebit,
  markDebitSuccess,
  markDebitFailed,
  recordRefund,
} from '@/lib/dal/coinLedger'
import { getLatestResume, getLatestDetailedResume } from '@/lib/dal/resume'
import { getTaskCost } from '@/lib/constants'
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
  updateServiceExecutionStatus,
} from '@/lib/dal/services'
import { pushTask } from '@/lib/queue/producer'
import { ensureEnqueued } from '@/lib/actions/enqueue'
import { acquireLock } from '@/lib/redis/lock'
import { ENV } from '@/lib/env'
import { trackEvent } from '@/lib/analytics/index'
import type { Locale } from '@/i18n-config'
import type { TaskTemplateId } from '@/lib/prompts/types'
import { AsyncTaskStatus, ExecutionStatus } from '@prisma/client'
import { markTimeline } from '@/lib/observability/timeline'
import { nanoid } from 'nanoid'

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

import { uploadFile } from '@/lib/storage/upload'
import { uploadJobImage } from './helpers/uploadJobImage'

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
    ctx
  ) => {
    const userId = ctx.userId
    const MAX_IMAGE_BYTES = 3 * 1024 * 1024
    const MAX_TEXT_CHARS = 8000
    if (params.jobText && params.jobText.length > MAX_TEXT_CHARS) {
      return { ok: false, error: 'job_text_too_long' }
    }

    let imageUrl: string | undefined
    // If jobImage provided (base64), upload it
    if (params.jobImage) {
      const uploadResult = await uploadJobImage(params.jobImage)
      if (!uploadResult.ok) {
        return { ok: false, error: uploadResult.error }
      }
      imageUrl = uploadResult.imageUrl
    }

    // 1. 获取最新简历
    const resume = await getLatestResume(userId)
    // 1.1 检查简历是否存在且已完成
    if (!resume || String(resume.status).toUpperCase() !== 'COMPLETED') {
      return { ok: false, error: 'resume_required' } // 如果没有完成的简历，则返回错误
    }
    // 2. 获取最新详细简历
    const detailed = await getLatestDetailedResume(userId)
    // 3. 获取或创建用户配额
    await getOrCreateQuota(userId)
    // 4. 定义服务成本
    const cost = 2

    // 5. 创建服务记录
    const svc = await createService(userId, resume.id, detailed?.id)
    await markTimeline(svc.id, 'create_service_start', { userId })

    const executionSessionId =
      typeof crypto?.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    // 6. 为服务创建工作（Job）记录，包含岗位文本或图片URL
    // Pass imageUrl instead of originalImage (base64)
    const job = await createJobForService(
      svc.id,
      params.jobText,
      undefined, // originalImage deprecated
      imageUrl
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

    // 10. 根据输入类型（图片或文本）执行不同的任务入队逻辑
    if (isImage) {
      const tEnq = Date.now()
      const e1 = await ensureEnqueued({
        kind: 'batch',
        serviceId: svc.id,
        taskId: `job_${svc.id}_${executionSessionId}`,
        userId,
        locale: params.locale,
        templateId: 'ocr_extract' as any,
        variables: {
          jobId: job.id,
          wasPaid: hasQuota,
          cost,
          ...(hasQuota ? { debitId: debit.id } : {}),
          executionSessionId,
        } as any,
      })
      await markTimeline(svc.id, 'create_service_ocr_enqueued', {
        latencyMs: Date.now() - tEnq,
      })
      if (!e1.ok) {
        if (hasQuota) {
          // We do NOT need to recordRefund manually here, because ensureEnqueued (via pushTask)
          // already handles the refund logic when enqueue fails.
          // However, we SHOULD mark the original debit as FAILED so the ledger shows it correctly.
          await markDebitFailed(debit.id)
        }
        await updateServiceExecutionStatus(
          svc.id,
          ExecutionStatus.MATCH_FAILED,
          { failureCode: 'ENQUEUE_FAILED' }
        )
        return { ok: false, error: e1.error, serviceId: svc.id }
      }

      // 将执行会话写入并设置为 OCR_PENDING，便于前端在 OCR 阶段就订阅通道
      await updateServiceExecutionStatus(svc.id, ExecutionStatus.OCR_PENDING, {
        executionSessionId,
      })

      trackEvent('TASK_ENQUEUED', {
        userId,
        payload: { task: 'ocr_extract', isFree: !hasQuota },
      })
      return {
        ok: true,
        serviceId: svc.id,
        isFree: !hasQuota,
        stream: false,
        status: 'PENDING_OCR',
        executionSessionId,
        hint: {
          dependency: 'ocr_extract',
          next: ['SUMMARY_COMPLETED', 'MATCH_STREAMING'],
        },
      }
    }

    // 10.3 如果是文本 JD，先入队文本提炼（job_summary），由后台在提炼成功后串行触发匹配
    const tEnq = Date.now()
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
        // We do NOT need to recordRefund manually here, because ensureEnqueued (via pushTask)
        // already handles the refund logic when enqueue fails.
        // However, we SHOULD mark the original debit as FAILED so the ledger shows it correctly.
        await markDebitFailed(debit.id)
      }
      await updateServiceExecutionStatus(svc.id, ExecutionStatus.MATCH_FAILED, {
        failureCode: 'ENQUEUE_FAILED',
      })
      return { ok: false, error: eText.error, serviceId: svc.id }
    }
    await updateServiceExecutionStatus(
      svc.id,
      ExecutionStatus.SUMMARY_PENDING,
      {
        executionSessionId,
      }
    )

    trackEvent('TASK_ENQUEUED', {
      userId,
      payload: { task: 'job_summary', isFree: !hasQuota },
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
  }
)

export const customizeResumeAction = withServerActionAuthWrite<
  { locale: Locale; serviceId: string },
  CustomizeResumeActionResult
>(
  'customizeResumeAction',
  async (params: { locale: Locale; serviceId: string }, ctx) => {
    const userId = ctx.userId
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

    // Push to QStash (New Async Logic)
    const executionSessionId = nanoid()
    const enq = await ensureEnqueued({
      kind: 'batch',
      serviceId: params.serviceId,
      taskId: `customize_${params.serviceId}_${Date.now()}`,
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

    if (!enq.ok) return { ok: false, error: enq.error }

    trackEvent('TASK_ENQUEUED', {
      userId,
      payload: { task: 'customize', isFree: !hasQuota },
    })

    return {
      ok: true,
      taskId: rec.id,
      taskType: 'customize',
      isFree: !hasQuota,
      executionSessionId,
    }
  }
)

export const trackCustomizeExportAction = withServerActionAuthWrite(
  'trackCustomizeExportAction',
  async (params: { serviceId: string; markdownLength: number }, ctx) => {
    trackEvent('TASK_COMPLETED', {
      userId: ctx.userId,
      payload: {
        task: 'customize_export',
        markdownLength: params.markdownLength,
        serviceId: params.serviceId,
      },
    })
    return { ok: true }
  }
)

export const generateInterviewTipsAction = withServerActionAuthWrite<
  { locale: Locale; serviceId: string },
  GenerateInterviewTipsActionResult
>(
  'generateInterviewTipsAction',
  async (params: { locale: Locale; serviceId: string }, ctx) => {
    const userId = ctx.userId
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
      { executionSessionId }
    )

    {
      const enq = await ensureEnqueued({
        kind: 'stream',
        serviceId: params.serviceId,
        taskId: `interview_${params.serviceId}`,
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
          { executionSessionId }
        )
        return { ok: false, error: enq.error }
      }
    }
    trackEvent('TASK_ENQUEUED', {
      userId,
      payload: { task: 'interview', isFree: !hasQuota },
    })
    return {
      ok: true,
      taskId: rec.id,
      taskType: 'interview',
      isFree: !hasQuota,
      stream: true,
      executionSessionId,
    }
  }
)

export const saveCustomizedResumeAction = withServerActionAuthWrite<
  { serviceId: string; resumeJson: any },
  SaveCustomizedResumeActionResult
>(
  'saveCustomizedResumeAction',
  async (params: { serviceId: string; resumeJson: any }, ctx) => {
    const userId = ctx.userId
    await updateCustomizedResumeEditedData(params.serviceId, params.resumeJson)
    trackEvent('TASK_COMPLETED', {
      userId,
      payload: { task: 'customize_save', serviceId: params.serviceId },
    })
    return { ok: true }
  }
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
  }
>(
  'retryMatchAction',
  async (params: { locale: Locale; serviceId: string }, ctx) => {
    const userId = ctx.userId
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
      // Fix: Check imageUrl as well, since originalImage is deprecated
      const needOcr =
        !svc.job.originalText && (!!svc.job.originalImage || !!svc.job.imageUrl)
      const ttlSec = Math.max(
        1,
        Math.floor(ENV.CONCURRENCY_LOCK_TIMEOUT_MS / 1000)
      )
      const locked = await acquireLock(params.serviceId, 'summary', ttlSec)
      if (!locked) {
        return { ok: false, error: 'enqueue_failed' }
      }
      const enqSummary = await ensureEnqueued({
        kind: 'batch',
        serviceId: params.serviceId,
        taskId: `job_${params.serviceId}_${executionSessionId}`,
        userId,
        locale: params.locale,
        templateId: (needOcr ? 'ocr_extract' : 'job_summary') as any,
        variables: {
          jobId: svc.job.id,
          wasPaid: hasQuota,
          cost,
          ...(hasQuota ? { debitId: debit.id } : {}),
          executionSessionId,
        },
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
          { failureCode: 'ENQUEUE_FAILED' }
        )
        return { ok: false, error: 'enqueue_failed' }
      }
      trackEvent('TASK_ENQUEUED', {
        userId,
        payload: { task: 'job_summary_retry', isFree: !hasQuota },
      })
      await updateMatchStatus(params.serviceId, 'PENDING' as any)
      await updateServiceExecutionStatus(
        params.serviceId,
        'SUMMARY_PENDING' as any,
        { failureCode: null, executionSessionId }
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
        ...(hasQuota ? { debitId: debit.id } : {}),
        executionSessionId,
      },
    })
    if (!enq.ok) {
      if (hasQuota) {
        // We do NOT need to recordRefund manually here, because ensureEnqueued (via pushTask)
        // already handles the refund logic when enqueue fails.
        // However, we SHOULD mark the original debit as FAILED so the ledger shows it correctly.
        await markDebitFailed(debit.id)
      }
      await updateServiceExecutionStatus(
        params.serviceId,
        ExecutionStatus.MATCH_FAILED,
        { failureCode: 'ENQUEUE_FAILED' }
      )
      return { ok: false, error: 'enqueue_failed' }
    }
    trackEvent('TASK_ENQUEUED', {
      userId,
      payload: { task: 'retry_match', isFree: !hasQuota },
    })
    await updateServiceExecutionStatus(
      params.serviceId,
      ExecutionStatus.MATCH_PENDING,
      { failureCode: null, executionSessionId }
    )
    return {
      ok: true,
      isFree: !hasQuota,
      step: 'match',
      stream: true,
      executionSessionId,
    }
  }
)
