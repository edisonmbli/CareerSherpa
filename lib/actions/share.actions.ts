'use server'

import { withServerActionAuthWrite } from '@/lib/auth/wrapper'
import {
  getResumeShareContextForUser,
  upsertResumeShareByCustomizedId,
} from '@/lib/dal/resumeShare'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
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
    const startAt = Date.now()
    console.info('share_action_start', {
      action: 'generate',
      serviceId,
      userId,
      durationDays,
    })

    // 1. Verify ownership
    const ctxAt = Date.now()
    const shareCtx = await getResumeShareContextForUser(serviceId, userId)
    console.info('share_action_ctx', {
      action: 'generate',
      serviceId,
      userId,
      durationDays,
      ms: Date.now() - ctxAt,
      hasShare: Boolean(shareCtx?.share),
      isEnabled: shareCtx?.share?.isEnabled ?? null,
    })
    if (!shareCtx) {
      console.info('share_action_end', {
        action: 'generate',
        serviceId,
        userId,
        durationDays,
        ok: false,
        ms: Date.now() - startAt,
      })
      return { ok: false, error: 'Service not found or access denied' }
    }

    // 2. Calculate expiry
    let expireAt: Date | null = null
    if (durationDays) {
      expireAt = new Date()
      expireAt.setDate(expireAt.getDate() + durationDays)
    }

    // 3. Upsert
    const actionType = shareCtx.share?.shareKey ? 'renew' : 'enable'
    const upsertAt = Date.now()
    const share = await upsertResumeShareByCustomizedId(
      shareCtx.customizedResumeId,
      {
        isEnabled: true,
        expireAt,
      },
    )
    console.info('share_action_upsert', {
      action: actionType,
      serviceId,
      userId,
      durationDays,
      ms: Date.now() - upsertAt,
      shareKey: share.shareKey,
      isEnabled: share.isEnabled,
      expireAt: share.expireAt?.toISOString() || null,
    })
    after(() => {
      revalidatePath(`/workbench/${serviceId}`)
    })
    console.info('share_action_end', {
      action: actionType,
      serviceId,
      userId,
      durationDays,
      ok: true,
      ms: Date.now() - startAt,
    })
    return { ok: true, data: share }
  },
)

export const disableShareLinkAction = withServerActionAuthWrite<
  { serviceId: string },
  ShareLinkResult
>('disableShareLinkAction', async (params: { serviceId: string }, ctx) => {
  const { serviceId } = params
  const userId = ctx.userId
  const startAt = Date.now()
  console.info('share_action_start', {
    action: 'disable',
    serviceId,
    userId,
  })

  const ctxAt = Date.now()
  const shareCtx = await getResumeShareContextForUser(serviceId, userId)
  console.info('share_action_ctx', {
    action: 'disable',
    serviceId,
    userId,
    ms: Date.now() - ctxAt,
    hasShare: Boolean(shareCtx?.share),
    isEnabled: shareCtx?.share?.isEnabled ?? null,
  })
  if (!shareCtx) {
    console.info('share_action_end', {
      action: 'disable',
      serviceId,
      userId,
      ok: false,
      ms: Date.now() - startAt,
    })
    return { ok: false, error: 'Access denied' }
  }

  const upsertAt = Date.now()
  await upsertResumeShareByCustomizedId(shareCtx.customizedResumeId, {
    isEnabled: false,
  })
  console.info('share_action_upsert', {
    action: 'disable',
    serviceId,
    userId,
    ms: Date.now() - upsertAt,
  })

  after(() => {
    revalidatePath(`/workbench/${serviceId}`)
  })
  console.info('share_action_end', {
    action: 'disable',
    serviceId,
    userId,
    ok: true,
    ms: Date.now() - startAt,
  })
  return { ok: true, data: null }
})

export const getResumeShareAction = withServerActionAuthWrite<
  { serviceId: string },
  ShareLinkResult
>('getResumeShareAction', async (params: { serviceId: string }, ctx) => {
  const { serviceId } = params
  const userId = ctx.userId

  const startAt = Date.now()
  console.info('share_action_start', {
    action: 'load',
    serviceId,
    userId,
  })

  const ctxAt = Date.now()
  const shareCtx = await getResumeShareContextForUser(serviceId, userId)
  console.info('share_action_ctx', {
    action: 'load',
    serviceId,
    userId,
    ms: Date.now() - ctxAt,
    hasShare: Boolean(shareCtx?.share),
    isEnabled: shareCtx?.share?.isEnabled ?? null,
  })
  if (!shareCtx) {
    console.info('share_action_end', {
      action: 'load',
      serviceId,
      userId,
      ok: false,
      ms: Date.now() - startAt,
    })
    return { ok: false, error: 'Access denied' }
  }
  console.info('share_action_end', {
    action: 'load',
    serviceId,
    userId,
    ok: true,
    ms: Date.now() - startAt,
  })
  return { ok: true, data: shareCtx.share }
})
