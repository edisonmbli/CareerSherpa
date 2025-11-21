'use server'

import { withServerActionAuthWrite } from '@/lib/auth/wrapper'
import { getOrCreateQuota } from '@/lib/dal/quotas'
import { recordDebit } from '@/lib/dal/coinLedger'
import { upsertResume, upsertDetailedResume } from '@/lib/dal/resume'
import { pushTask } from '@/lib/queue/producer'
import { trackEvent } from '@/lib/analytics/index'
import type { Locale } from '@/i18n-config'
import type { TaskTemplateId } from '@/lib/prompts/types'
import { getTaskLimits } from '@/lib/llm/config'

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
    const limit = getTaskLimits('resume_summary').maxTokens
    if (len > limit) {
      return { ok: false, error: 'text_too_long' }
    }
    await getOrCreateQuota(userId)
    const cost = 1
    const rec = await upsertResume(userId, params.originalText)
    const debit = await recordDebit({
      userId,
      amount: cost,
      templateId: 'resume_summary',
    })
    const hasQuota = debit.ok
    {
      const enq = await ensureEnqueued({
        kind: 'batch',
        serviceId: rec.id,
        taskId: rec.id,
        userId,
        locale: params.locale,
        templateId: 'resume_summary',
        variables: {
          resumeId: rec.id,
          wasPaid: hasQuota,
          cost,
          ...(hasQuota ? { debitId: debit.id } : {}),
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
    trackEvent('ASSET_UPLOADED', {
      userId,
      payload: { type: 'resume', isFree: !hasQuota },
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
    const limit = getTaskLimits('detailed_resume_summary').maxTokens
    if (len > limit) {
      return { ok: false, error: 'text_too_long' }
    }
    await getOrCreateQuota(userId)
    const cost = 1
    const rec = await upsertDetailedResume(userId, params.originalText)
    const debit = await recordDebit({
      userId,
      amount: cost,
      templateId: 'detailed_resume_summary',
    })
    const hasQuota = debit.ok
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
          wasPaid: hasQuota,
          cost,
          ...(hasQuota ? { debitId: debit.id } : {}),
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
    trackEvent('ASSET_UPLOADED', {
      userId,
      payload: { type: 'detailed', isFree: !hasQuota },
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
    const prisma = (await import('@/lib/prisma')).prisma
    const userId = ctx.userId
    const rec = await prisma.resume.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: { resumeSummaryJson: true },
    })
    return { ok: true, data: rec?.resumeSummaryJson || null }
  }
)

export const getLatestDetailedSummaryAction = withServerActionAuthWrite(
  'getLatestDetailedSummaryAction',
  async (_: undefined, ctx) => {
    const prisma = (await import('@/lib/prisma')).prisma
    const userId = ctx.userId
    const rec = await prisma.detailedResume.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: { detailedSummaryJson: true },
    })
    return { ok: true, data: rec?.detailedSummaryJson || null }
  }
)
import { ensureEnqueued } from '@/lib/actions/enqueue'
