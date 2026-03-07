'use server'

import { z } from 'zod'
import { checkRateLimit } from '@/lib/rateLimiter'
import {
  trackEvent,
  AnalyticsCategory,
  AnalyticsOutcome,
  AnalyticsRuntime,
  AnalyticsSource,
} from '@/lib/analytics/index'
import {
  sanitizeAttributionSnapshot,
  type AttributionTouch,
} from '@/lib/analytics/attribution'

const landingAttributionSchema = z.object({
  touch: z.enum(['first', 'last']),
  landingPath: z.string().max(256).optional(),
  referrerDomain: z.string().max(128).optional(),
  utm_source: z.string().max(80).nullable().optional(),
  utm_medium: z.string().max(80).nullable().optional(),
  utm_campaign: z.string().max(80).nullable().optional(),
  utm_content: z.string().max(120).nullable().optional(),
  utm_term: z.string().max(120).nullable().optional(),
  src: z.string().max(24).nullable().optional(),
  shareId: z.string().max(120).nullable().optional(),
  anonymousId: z.string().max(80).optional(),
  sessionId: z.string().max(80).optional(),
})

export async function trackLandingAttributionAction(params: unknown): Promise<{
  ok: true
} | {
  ok: false
  error: string
}> {
  const parsed = landingAttributionSchema.safeParse(params)
  if (!parsed.success) return { ok: false, error: 'invalid_payload' }
  const payload = sanitizeAttributionSnapshot(parsed.data)

  const identity = payload.sessionId || payload.anonymousId || payload.shareId || 'anonymous'
  const rate = await checkRateLimit(
    `landing_attr:${payload.touch as AttributionTouch}`,
    identity,
    false,
  )
  if (!rate.ok) {
    return { ok: false, error: 'rate_limited' }
  }

  trackEvent('LANDING_ATTRIBUTED', {
    category: AnalyticsCategory.BUSINESS,
    source: AnalyticsSource.ACTION,
    runtime: AnalyticsRuntime.NEXTJS,
    outcome: AnalyticsOutcome.ACCEPTED,
    payload: {
      touch: payload.touch,
      channel: payload.channel,
      ...(payload.landingPath ? { landingPath: payload.landingPath } : {}),
      ...(payload.referrerDomain
        ? { referrerDomain: payload.referrerDomain }
        : {}),
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
      ...(payload.src !== undefined ? { src: payload.src } : {}),
      ...(payload.shareId !== undefined ? { shareId: payload.shareId } : {}),
      ...(payload.anonymousId ? { anonymousId: payload.anonymousId } : {}),
      ...(payload.sessionId ? { sessionId: payload.sessionId } : {}),
    },
  })

  return { ok: true }
}
