'use server'

import { withServerActionAuthWrite } from '@/lib/auth/wrapper'
import { joinPaymentWaitlist } from '@/lib/dal/paymentWaitlist'
import { trackEvent } from '@/lib/analytics/index'

export const trackTopupClickAction = withServerActionAuthWrite(
  'trackTopupClickAction',
  async (_params: unknown, ctx) => {
    const userId = ctx.userId
    trackEvent('TOPUP_CLICK', { userId })
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
    trackEvent('TOPUP_WAITLIST_SUBMIT', { userId, payload: { email } })
    return { ok: !!rec }
  }
)