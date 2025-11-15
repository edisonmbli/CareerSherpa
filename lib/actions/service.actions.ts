'use server'

import { withServerActionAuthWrite } from '@/lib/auth/wrapper'
import { getOrCreateQuota, deductQuota } from '@/lib/dal/quotas'
import { getLatestResume, getLatestDetailedResume } from '@/lib/dal/resume'
import { createService, createJobForService, ensureMatchRecord, ensureCustomizedResumeRecord, ensureInterviewRecord } from '@/lib/dal/services'
import { pushTask } from '@/lib/queue/producer'
import { trackEvent } from '@/lib/analytics/index'
import type { Locale } from '@/i18n-config'

export const createServiceAction = withServerActionAuthWrite(
  'createServiceAction',
  async (params: { locale: Locale; jobText?: string; jobImage?: string }, ctx) => {
    const userId = ctx.userId
    const resume = await getLatestResume(userId)
    if (!resume || String(resume.status).toUpperCase() !== 'COMPLETED') {
      return { ok: false, error: 'resume_required' }
    }
    const detailed = await getLatestDetailedResume(userId)
    await getOrCreateQuota(userId)
    const cost = 2
    let hasQuota = true
    try { await deductQuota(userId, cost) } catch { hasQuota = false }

    const svc = await createService(userId, resume.id, detailed?.id)
    const job = await createJobForService(svc.id, params.jobText, params.jobImage)
    await ensureMatchRecord(svc.id)

    const isImage = !!params.jobImage
    if (isImage) {
      await pushTask({ kind: 'batch', serviceId: svc.id, taskId: `job_${svc.id}`, userId, locale: params.locale, templateId: 'job_summary' as any, variables: { serviceId: svc.id, jobId: job.id, image: params.jobImage, wasPaid: hasQuota, cost } })
      await pushTask({ kind: 'stream', serviceId: svc.id, taskId: `match_${svc.id}`, userId, locale: params.locale, templateId: 'job_match' as any, variables: { serviceId: svc.id, wasPaid: hasQuota, cost } })
      trackEvent('TASK_ENQUEUED', { userId, payload: { task: 'match', isFree: !hasQuota } })
      return {
        ok: true,
        serviceId: svc.id,
        isFree: !hasQuota,
        stream: false,
        status: 'PENDING_OCR',
        hint: { dependency: 'job_summary', next: ['STREAMING', 'COMPLETED'] },
      }
    }

    await pushTask({ kind: 'stream', serviceId: svc.id, taskId: `match_${svc.id}`, userId, locale: params.locale, templateId: 'job_match' as any, variables: { serviceId: svc.id, jobId: job.id, text: params.jobText, wasPaid: hasQuota, cost } })
    trackEvent('TASK_ENQUEUED', { userId, payload: { task: 'match', isFree: !hasQuota } })
    return { ok: true, serviceId: svc.id, isFree: !hasQuota, stream: true }
  }
)

export const customizeResumeAction = withServerActionAuthWrite(
  'customizeResumeAction',
  async (params: { locale: Locale; serviceId: string }, ctx) => {
    const userId = ctx.userId
    await getOrCreateQuota(userId)
    const cost = 2
    let hasQuota = true
    try { await deductQuota(userId, cost) } catch { hasQuota = false }

    const rec = await ensureCustomizedResumeRecord(params.serviceId)
    await pushTask({ kind: 'batch', serviceId: params.serviceId, taskId: `custom_${params.serviceId}`, userId, locale: params.locale, templateId: 'resume_customize' as any, variables: { serviceId: params.serviceId, customizedResumeId: rec.id, wasPaid: hasQuota, cost } })
    trackEvent('TASK_ENQUEUED', { userId, payload: { task: 'customize', isFree: !hasQuota } })
    return { ok: true, taskId: rec.id, taskType: 'customize', isFree: !hasQuota }
  }
)

export const generateInterviewTipsAction = withServerActionAuthWrite(
  'generateInterviewTipsAction',
  async (params: { locale: Locale; serviceId: string }, ctx) => {
    const userId = ctx.userId
    await getOrCreateQuota(userId)
    const cost = 2
    let hasQuota = true
    try { await deductQuota(userId, cost) } catch { hasQuota = false }

    const rec = await ensureInterviewRecord(params.serviceId)
    await pushTask({ kind: 'stream', serviceId: params.serviceId, taskId: `interview_${params.serviceId}`, userId, locale: params.locale, templateId: 'interview_prep' as any, variables: { serviceId: params.serviceId, interviewId: rec.id, wasPaid: hasQuota, cost } })
    trackEvent('TASK_ENQUEUED', { userId, payload: { task: 'interview', isFree: !hasQuota } })
    return { ok: true, taskId: rec.id, taskType: 'interview', isFree: !hasQuota, stream: true }
  }
)
