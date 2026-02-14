'use server'

import { withServerActionAuthWrite } from '@/lib/auth/wrapper'
import {
  getResumeShareContextForUser,
  upsertResumeShareByCustomizedId,
} from '@/lib/dal/resumeShare'
import { createAnalyticsEvent } from '@/lib/dal/analyticsEvent'

export type ShareLinkResult =
  | { ok: true; data: any }
  | { ok: false; error: string }

export async function trackShareEventAction(params: {
  eventName: string
  payload: any
}) {
  // Public action, no auth required
  await createAnalyticsEvent({
    eventName: params.eventName,
    payload: params.payload,
  })
}

export const generateShareLinkAction = withServerActionAuthWrite<
  { serviceId: string; durationDays: number | null },
  ShareLinkResult
>(
  'generateShareLinkAction',
  async (params: { serviceId: string; durationDays: number | null }, ctx) => {
    const { serviceId, durationDays } = params
    const userId = ctx.userId

    const shareCtx = await getResumeShareContextForUser(serviceId, userId)
    if (!shareCtx) {
      return { ok: false, error: 'Service not found or access denied' }
    }

    let expireAt: Date | null = null
    if (durationDays) {
      expireAt = new Date()
      expireAt.setDate(expireAt.getDate() + durationDays)
    }

    const share = await upsertResumeShareByCustomizedId(
      shareCtx.customizedResumeId,
      {
        isEnabled: true,
        expireAt,
      },
    )
    return { ok: true, data: share }
  },
)

export const disableShareLinkAction = withServerActionAuthWrite<
  { serviceId: string },
  ShareLinkResult
>('disableShareLinkAction', async (params: { serviceId: string }, ctx) => {
  const { serviceId } = params
  const userId = ctx.userId

  const shareCtx = await getResumeShareContextForUser(serviceId, userId)
  if (!shareCtx) {
    return { ok: false, error: 'Access denied' }
  }

  await upsertResumeShareByCustomizedId(shareCtx.customizedResumeId, {
    isEnabled: false,
  })
  return { ok: true, data: null }
})

export const getResumeShareAction = withServerActionAuthWrite<
  { serviceId: string },
  ShareLinkResult
>('getResumeShareAction', async (params: { serviceId: string }, ctx) => {
  const { serviceId } = params
  const userId = ctx.userId
  const shareCtx = await getResumeShareContextForUser(serviceId, userId)
  if (!shareCtx) {
    return { ok: false, error: 'Access denied' }
  }
  return { ok: true, data: shareCtx.share }
})
