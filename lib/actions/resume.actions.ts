'use server'

import { authenticateServerAction } from '@/lib/actions/auth'
import { getOrCreateQuota, deductQuota } from '@/lib/dal/quotas'
import { upsertResume, upsertDetailedResume } from '@/lib/dal/resume'
import { pushTask } from '@/lib/queue/producer'
import { trackEvent } from '@/lib/analytics/index'
import type { Locale } from '@/i18n-config'

export async function uploadResumeAction(params: { locale: Locale, originalText: string }) {
  const auth = await authenticateServerAction('uploadResumeAction')
  if (!auth.user) return { ok: false, error: 'auth_required' }
  const userId = auth.user.id
  await getOrCreateQuota(userId)
  const cost = 1
  let hasQuota = true
  try {
    await deductQuota(userId, cost)
  } catch {
    hasQuota = false
  }
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

export async function uploadDetailedResumeAction(params: { locale: Locale, originalText: string }) {
  const auth = await authenticateServerAction('uploadDetailedResumeAction')
  if (!auth.user) return { ok: false, error: 'auth_required' }
  const userId = auth.user.id
  await getOrCreateQuota(userId)
  const cost = 1
  let hasQuota = true
  try {
    await deductQuota(userId, cost)
  } catch {
    hasQuota = false
  }
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
