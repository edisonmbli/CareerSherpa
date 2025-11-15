'use server'

import { requireAuthForAction, withServerActionAuthWrite } from '@/lib/auth/wrapper'
import { getOrCreateQuota, deductQuota } from '@/lib/dal/quotas'
import { upsertResume, upsertDetailedResume } from '@/lib/dal/resume'
import { pushTask } from '@/lib/queue/producer'
import { trackEvent } from '@/lib/analytics/index'
import type { Locale } from '@/i18n-config'

export const uploadResumeAction = withServerActionAuthWrite(
  'uploadResumeAction',
  async (params: { locale: Locale; originalText: string }, ctx) => {
    const userId = ctx.userId
    await getOrCreateQuota(userId)
    const cost = 1
    const deduction = await deductQuota(userId, cost)
    const hasQuota = deduction.success
    const rec = await upsertResume(userId, params.originalText)
    await pushTask({
      kind: 'batch',
      serviceId: rec.id,
      taskId: rec.id,
      userId,
      locale: params.locale,
      templateId: 'resume_summary' as any,
      variables: { resumeId: rec.id, wasPaid: hasQuota, cost },
    })
    trackEvent('ASSET_UPLOADED', { userId, payload: { type: 'resume', isFree: !hasQuota } })
    return { ok: true, taskId: rec.id, isFree: !hasQuota, taskType: 'resume' }
  }
)

export const uploadDetailedResumeAction = withServerActionAuthWrite(
  'uploadDetailedResumeAction',
  async (params: { locale: Locale; originalText: string }, ctx) => {
    const userId = ctx.userId
    await getOrCreateQuota(userId)
    const cost = 1
    const deduction = await deductQuota(userId, cost)
    const hasQuota = deduction.success
    const rec = await upsertDetailedResume(userId, params.originalText)
    await pushTask({
      kind: 'batch',
      serviceId: rec.id,
      taskId: rec.id,
      userId,
      locale: params.locale,
      templateId: 'detailed_resume_summary' as any,
      variables: { detailedResumeId: rec.id, wasPaid: hasQuota, cost },
    })
    trackEvent('ASSET_UPLOADED', { userId, payload: { type: 'detailed', isFree: !hasQuota } })
    return { ok: true, taskId: rec.id, isFree: !hasQuota, taskType: 'detailed_resume' }
  }
)
