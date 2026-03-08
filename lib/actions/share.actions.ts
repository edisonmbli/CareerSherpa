'use server'

import { withServerActionAuthWrite } from '@/lib/auth/wrapper'
import {
  getResumeShareContextForUser,
  incrementResumeShareViewCountByShareKey,
  upsertResumeShareByCustomizedId,
} from '@/lib/dal/resumeShare'
import {
  trackEvent,
  AnalyticsCategory,
  AnalyticsOutcome,
  AnalyticsRuntime,
  AnalyticsSource,
} from '@/lib/analytics/index'
import { checkRateLimit } from '@/lib/rateLimiter'
import { extractReferrerDomain } from '@/lib/analytics/privacy'
import { resolveAvatarForShare } from '@/lib/storage/avatar-server'
import { logError } from '@/lib/logger'
import { z } from 'zod'

export type ShareLinkResult =
  | { ok: true; data: any }
  | { ok: false; error: string }

const shareViewPayloadSchema = z.object({
  shareId: z.string().min(1).max(120),
  templateId: z.string().min(1).max(60),
  source: z.string().max(24).optional(),
  sessionId: z.string().max(80).optional(),
  referrer: z.string().max(2000).optional(),
  utm_source: z.string().max(80).nullable().optional(),
  utm_medium: z.string().max(80).nullable().optional(),
  utm_campaign: z.string().max(80).nullable().optional(),
  utm_content: z.string().max(120).nullable().optional(),
  utm_term: z.string().max(120).nullable().optional(),
})

const shareCtaPayloadSchema = z.object({
  shareId: z.string().min(1).max(120),
  templateId: z.string().min(1).max(60),
  target: z.string().max(64).optional(),
  source: z.string().max(24).optional(),
  sessionId: z.string().max(80).optional(),
  utm_source: z.string().max(80).nullable().optional(),
  utm_medium: z.string().max(80).nullable().optional(),
  utm_campaign: z.string().max(80).nullable().optional(),
  utm_content: z.string().max(120).nullable().optional(),
  utm_term: z.string().max(120).nullable().optional(),
})

type ShareEventName = 'RESUME_SHARE_VIEW' | 'RESUME_SHARE_CTA_CLICK'

export async function trackShareEventAction(params: {
  eventName: ShareEventName
  payload: unknown
}) {
  if (params.eventName === 'RESUME_SHARE_VIEW') {
    const parsed = shareViewPayloadSchema.safeParse(params.payload)
    if (!parsed.success) {
      return { ok: false, error: 'invalid_payload' as const }
    }
    const payload = parsed.data
    const sessionIdentity = payload.sessionId || 'anonymous'
    const rate = await checkRateLimit(
      `share_event:${params.eventName}`,
      `share:${payload.shareId}:session:${sessionIdentity}`,
      false,
    )
    if (!rate.ok) {
      return { ok: false, error: 'rate_limited' as const }
    }
    await incrementResumeShareViewCountByShareKey(payload.shareId)
    const referrerDomain = extractReferrerDomain(payload.referrer)
    trackEvent('RESUME_SHARE_VIEW', {
      category: AnalyticsCategory.BUSINESS,
      source: AnalyticsSource.PUBLIC_SHARE,
      runtime: AnalyticsRuntime.NEXTJS,
      outcome: AnalyticsOutcome.ACCEPTED,
      payload: {
        shareId: payload.shareId,
        templateId: payload.templateId,
        ...(payload.source ? { source: payload.source } : {}),
        ...(referrerDomain ? { referrerDomain } : {}),
        ...(payload.utm_source !== undefined
          ? { utm_source: payload.utm_source }
          : {}),
        ...(payload.utm_medium !== undefined
          ? { utm_medium: payload.utm_medium }
          : {}),
        ...(payload.utm_campaign !== undefined
          ? { utm_campaign: payload.utm_campaign }
          : {}),
        ...(payload.utm_content !== undefined
          ? { utm_content: payload.utm_content }
          : {}),
        ...(payload.utm_term !== undefined
          ? { utm_term: payload.utm_term }
          : {}),
      },
    })
    return { ok: true as const }
  }

  const parsed = shareCtaPayloadSchema.safeParse(params.payload)
  if (!parsed.success) {
    return { ok: false, error: 'invalid_payload' as const }
  }
  const payload = parsed.data
  const sessionIdentity = payload.sessionId || 'anonymous'
  const rate = await checkRateLimit(
    `share_event:${params.eventName}`,
    `share:${payload.shareId}:session:${sessionIdentity}`,
    false,
  )
  if (!rate.ok) {
    return { ok: false, error: 'rate_limited' as const }
  }
  trackEvent('RESUME_SHARE_CTA_CLICK', {
    category: AnalyticsCategory.BUSINESS,
    source: AnalyticsSource.PUBLIC_SHARE,
    runtime: AnalyticsRuntime.NEXTJS,
    outcome: AnalyticsOutcome.ACCEPTED,
    payload: {
      shareId: payload.shareId,
      templateId: payload.templateId,
      ...(payload.target ? { target: payload.target } : {}),
      ...(payload.source ? { source: payload.source } : {}),
      ...(payload.utm_source !== undefined
        ? { utm_source: payload.utm_source }
        : {}),
      ...(payload.utm_medium !== undefined
        ? { utm_medium: payload.utm_medium }
        : {}),
      ...(payload.utm_campaign !== undefined
        ? { utm_campaign: payload.utm_campaign }
        : {}),
      ...(payload.utm_content !== undefined
        ? { utm_content: payload.utm_content }
        : {}),
      ...(payload.utm_term !== undefined ? { utm_term: payload.utm_term } : {}),
    },
  })
  return { ok: true as const }
}

const customizeShareClickSchema = z.object({
  serviceId: z.string().min(1).max(80),
  shareId: z.string().min(1).max(120),
  shareMethod: z
    .enum(['generate_link', 'copy_link', 'preview_open', 'renew_link'])
    .default('copy_link'),
  templateId: z.string().max(60).optional(),
})

export const trackCustomizeShareClickAction = withServerActionAuthWrite<
  {
    serviceId: string
    shareId: string
    shareMethod: 'generate_link' | 'copy_link' | 'preview_open' | 'renew_link'
    templateId?: string
  },
  { ok: true } | { ok: false; error: string }
>('trackCustomizeShareClickAction', async (params, ctx) => {
  const parsed = customizeShareClickSchema.safeParse(params)
  if (!parsed.success) {
    return { ok: false, error: 'invalid_payload' }
  }
  const payload = parsed.data

  const rate = await checkRateLimit(
    'customize_share_click',
    `user:${ctx.userId}:service:${payload.serviceId}`,
    false,
  )
  if (!rate.ok) {
    return { ok: false, error: 'rate_limited' }
  }

  trackEvent('CUSTOMIZE_SHARE_CLICKED', {
    userId: ctx.userId,
    serviceId: payload.serviceId,
    category: AnalyticsCategory.BUSINESS,
    source: AnalyticsSource.ACTION,
    runtime: AnalyticsRuntime.NEXTJS,
    outcome: AnalyticsOutcome.ACCEPTED,
    payload: {
      shareId: payload.shareId,
      source: 'web',
      shareMethod: payload.shareMethod,
      ...(payload.templateId ? { templateId: payload.templateId } : {}),
    },
  })

  return { ok: true }
})

export const generateShareLinkAction = withServerActionAuthWrite<
  {
    serviceId: string
    durationDays: number | null
    avatarBase64?: string | null
  },
  ShareLinkResult
>(
  'generateShareLinkAction',
  async (
    params: {
      serviceId: string
      durationDays: number | null
      avatarBase64?: string | null
    },
    ctx,
  ) => {
    const { serviceId, durationDays, avatarBase64 } = params
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

    const resolvedAvatar = await resolveAvatarForShare(
      avatarBase64,
      serviceId,
    )
    if (!resolvedAvatar.ok) {
      logError({
        reqId: serviceId,
        route: 'actions/share',
        phase: 'upload_avatar_failed',
        error: resolvedAvatar.error,
      })
      return { ok: false, error: resolvedAvatar.error }
    }
    const avatarUrl = resolvedAvatar.avatarUrl

    const share = await upsertResumeShareByCustomizedId(
      shareCtx.customizedResumeId,
      {
        isEnabled: true,
        expireAt,
        ...(avatarUrl ? { avatarUrl } : {}),
      },
    )

    trackEvent('CUSTOMIZE_SHARE_CLICKED', {
      userId,
      serviceId,
      category: AnalyticsCategory.BUSINESS,
      source: AnalyticsSource.ACTION,
      runtime: AnalyticsRuntime.NEXTJS,
      outcome: AnalyticsOutcome.ACCEPTED,
      payload: {
        shareId: share.shareKey,
        source: 'web',
        shareMethod: shareCtx.share?.shareKey ? 'renew_link' : 'generate_link',
      },
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
