'use server'

import { withServerActionAuthWrite } from '@/lib/auth/wrapper'
import { getOrCreateQuota } from '@/lib/dal/quotas'
import { recordDebit, markDebitSuccess } from '@/lib/dal/coinLedger'
import { getLatestResume, getLatestDetailedResume } from '@/lib/dal/resume'
import { createService, createJobForService, ensureMatchRecord, ensureCustomizedResumeRecord, ensureInterviewRecord } from '@/lib/dal/services'
import { pushTask } from '@/lib/queue/producer'
import { ensureEnqueued } from '@/lib/actions/enqueue'
import { trackEvent } from '@/lib/analytics/index'
import type { Locale } from '@/i18n-config'
import type { TaskTemplateId } from '@/lib/prompts/types'

export type CustomizeResumeActionResult =
  | { ok: true; taskId: string; taskType: 'customize'; isFree: boolean }
  | { ok: false; error: string }

export type GenerateInterviewTipsActionResult =
  | { ok: true; taskId: string; taskType: 'interview'; isFree: boolean; stream: true }
  | { ok: false; error: string }

export type SaveCustomizedResumeActionResult = { ok: true }

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

    const svc = await createService(userId, resume.id, detailed?.id)
    const job = await createJobForService(svc.id, params.jobText, params.jobImage)
    await ensureMatchRecord(svc.id)

    const isImage = !!params.jobImage

    const debit = await recordDebit({ userId, amount: cost, serviceId: svc.id, templateId: 'job_summary' })
    const hasQuota = debit.ok
    if (isImage) {
      const e1 = await ensureEnqueued({ kind: 'batch', serviceId: svc.id, taskId: `job_${svc.id}`, userId, locale: params.locale, templateId: 'job_summary', variables: { jobId: job.id, image: params.jobImage!, wasPaid: hasQuota, cost, ...(hasQuota ? { debitId: debit.id } : {}) } })
      if (!e1.ok) return { ok: false, error: e1.error }
      const e2 = await ensureEnqueued({ kind: 'stream', serviceId: svc.id, taskId: `match_${svc.id}`, userId, locale: params.locale, templateId: 'job_match', variables: { wasPaid: hasQuota, cost, ...(hasQuota ? { debitId: debit.id } : {}) } })
      if (!e2.ok) return { ok: false, error: e2.error }
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

    const e = await ensureEnqueued({ kind: 'stream', serviceId: svc.id, taskId: `match_${svc.id}`, userId, locale: params.locale, templateId: 'job_match', variables: { jobId: job.id, text: params.jobText!, wasPaid: hasQuota, cost, ...(hasQuota ? { debitId: debit.id } : {}) } })
    if (!e.ok) return { ok: false, error: e.error }
    trackEvent('TASK_ENQUEUED', { userId, payload: { task: 'match', isFree: !hasQuota } })
    return { ok: true, serviceId: svc.id, isFree: !hasQuota, stream: true }
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
    const cost = 2

    const prisma = (await import('@/lib/prisma')).prisma
    const service = await prisma.service.findUnique({
      where: { id: params.serviceId },
      include: { resume: true, detailedResume: true, job: true },
    })
    if (!service?.resume || !service?.job) {
      return { ok: false, error: 'service_context_missing' }
    }
    const debit2 = await recordDebit({ userId, amount: cost, serviceId: service.id, templateId: 'resume_customize' })
    const hasQuota = debit2.ok

    const resumeSummary = service.resume.resumeSummaryJson as any
    const jobSummary = service.job.jobSummaryJson as any
    const originalText = service.resume.originalText || ''
    const { generateOps } = await import('@/lib/customize/ops')
    const { toMarkdown } = await import('@/lib/customize/markdown')
    const ops = generateOps({ resume: resumeSummary, jobSummary })
    const md = toMarkdown({ raw: originalText, ops })

    const rec = await ensureCustomizedResumeRecord(params.serviceId)
    await prisma.customizedResume.update({
      where: { serviceId: params.serviceId },
      data: {
        markdownText: md.markdown,
        opsJson: ops as any,
        status: 'COMPLETED' as any,
      },
    })
    if (debit2.ok) { await markDebitSuccess(debit2.id) }

    trackEvent('TASK_COMPLETED', { userId, payload: { task: 'customize', opsCount: ops.length, markdownLength: md.markdown.length } })
    return { ok: true, taskId: rec.id, taskType: 'customize', isFree: !hasQuota }
  }
)

export const trackCustomizeExportAction = withServerActionAuthWrite(
  'trackCustomizeExportAction',
  async (params: { serviceId: string; markdownLength: number }, ctx) => {
    trackEvent('TASK_COMPLETED', { userId: ctx.userId, payload: { task: 'customize_export', markdownLength: params.markdownLength, serviceId: params.serviceId } })
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
    const cost = 2

    const rec = await ensureInterviewRecord(params.serviceId)
    const debit3 = await recordDebit({ userId, amount: cost, serviceId: params.serviceId, templateId: 'interview_prep' })
    const hasQuota = debit3.ok
    {
      const enq = await ensureEnqueued({ kind: 'stream', serviceId: params.serviceId, taskId: `interview_${params.serviceId}`, userId, locale: params.locale, templateId: 'interview_prep', variables: { interviewId: rec.id, wasPaid: hasQuota, cost, ...(hasQuota ? { debitId: debit3.id } : {}) } })
      if (!enq.ok) return { ok: false, error: enq.error }
    }
    trackEvent('TASK_ENQUEUED', { userId, payload: { task: 'interview', isFree: !hasQuota } })
    return { ok: true, taskId: rec.id, taskType: 'interview', isFree: !hasQuota, stream: true }
  }
)

export const saveCustomizedResumeAction = withServerActionAuthWrite<
  { serviceId: string; markdown: string },
  SaveCustomizedResumeActionResult
>(
  'saveCustomizedResumeAction',
  async (params: { serviceId: string; markdown: string }, ctx) => {
    const userId = ctx.userId
    await (await import('@/lib/prisma')).prisma.customizedResume.update({
      where: { serviceId: params.serviceId },
      data: { markdownText: params.markdown },
    })
    trackEvent('TASK_COMPLETED', { userId, payload: { task: 'customize_save', serviceId: params.serviceId } })
    return { ok: true }
  }
)
