'use server'

import { withServerActionAuthWrite } from '@/lib/auth/wrapper'
import { getOrCreateQuota } from '@/lib/dal/quotas'
import { recordDebit } from '@/lib/dal/coinLedger'
import {
  upsertResume,
  upsertDetailedResume,
  getLatestResumeSummaryJson,
  getLatestDetailedSummaryJson,
} from '@/lib/dal/resume'
import { pushTask } from '@/lib/queue/producer'
import { trackEvent } from '@/lib/analytics/index'
import type { Locale } from '@/i18n-config'
import type { TaskTemplateId } from '@/lib/prompts/types'
import { getTaskLimits } from '@/lib/llm/config'
import { ensureEnqueued } from '@/lib/actions/enqueue'
import { updateCustomizedResumeEditedData } from '@/lib/dal/services'
import {
  resumeDataSchema,
  sectionConfigSchema,
} from '@/lib/types/resume-schema'
import { revalidatePath } from 'next/cache'

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
  resumeData: any
  sectionConfig?: any
}) {
  const { serviceId, resumeData, sectionConfig } = params

  try {
    // Validate data before saving
    const validatedData = resumeDataSchema.parse(resumeData)
    const validatedConfig = sectionConfig
      ? sectionConfigSchema.parse(sectionConfig)
      : undefined

    await updateCustomizedResumeEditedData(
      serviceId,
      validatedData,
      validatedConfig
    )

    revalidatePath(`/workbench/${serviceId}`)
    return { ok: true }
  } catch (error) {
    console.error('Failed to update resume data:', error)
    return { ok: false, error: 'Failed to save changes' }
  }
}
