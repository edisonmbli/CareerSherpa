'use server'

import { withServerActionAuthWrite } from '@/lib/auth/wrapper'
import { joinPaymentWaitlist } from '@/lib/dal/paymentWaitlist'
import {
  trackEvent,
  AnalyticsOutcome,
  AnalyticsRuntime,
  AnalyticsSource,
} from '@/lib/analytics/index'
import { extractEmailDomain, hashEmailForAnalytics } from '@/lib/analytics/privacy'

export const trackTopupClickAction = withServerActionAuthWrite(
  'trackTopupClickAction',
  async (_params: unknown, ctx) => {
    const userId = ctx.userId
    trackEvent('TOPUP_CLICK', {
      userId,
      source: AnalyticsSource.ACTION,
      runtime: AnalyticsRuntime.NEXTJS,
      outcome: AnalyticsOutcome.ACCEPTED,
    })
    return { ok: true }
  }
)

export const joinPaymentWaitlistAction = withServerActionAuthWrite(
  'joinPaymentWaitlistAction',
  async (params: { email: string }, ctx) => {
    const userId = ctx.userId
    const email = String(params.email || '').trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, error: 'invalid_email' }
    }
    const rec = await joinPaymentWaitlist(userId, email)
    const emailDomain = extractEmailDomain(email)
    trackEvent('TOPUP_WAITLIST_SUBMIT', {
      userId,
      source: AnalyticsSource.ACTION,
      runtime: AnalyticsRuntime.NEXTJS,
      outcome: AnalyticsOutcome.ACCEPTED,
      payload: {
        emailHash: hashEmailForAnalytics(email),
        ...(emailDomain ? { emailDomain } : {}),
      },
    })
    return { ok: !!rec }
  }
)
