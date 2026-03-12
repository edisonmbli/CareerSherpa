import { NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { stackServerApp } from '@/stack/server'
import { feedbackSubmissionSchema, type FeedbackDispatchPayload } from '@/lib/feedback/schema'
import { deliverFounderFeedback, getConfiguredFeedbackDestinations, queueFounderFeedback } from '@/lib/feedback/delivery'
import { isQstashReady } from '@/lib/env'
import { logError, logInfo } from '@/lib/logger'

export async function POST(req: Request) {
  const user = await stackServerApp.getUser()
  if (!user?.id) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const rawBody = await req.json().catch(() => null)
  const parsed = feedbackSubmissionSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: 'invalid_feedback_payload',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
      { status: 400 },
    )
  }

  const payload: FeedbackDispatchPayload = {
    ...parsed.data,
    feedbackId: nanoid(12),
    submittedAt: new Date().toISOString(),
    authUser: {
      id: user.id,
      ...(parsed.data.includeAccountEmail && user.primaryEmail
        ? { email: user.primaryEmail }
        : {}),
    },
  }

  const configured = getConfiguredFeedbackDestinations()
  if (!configured.length) {
    logError({
      reqId: payload.feedbackId,
      route: 'api/feedback',
      userKey: user.id,
      phase: 'not_configured',
      error: 'feedback_delivery_not_configured',
    })
    return NextResponse.json(
      { ok: false, error: 'feedback_delivery_not_configured' },
      { status: 503 },
    )
  }

  try {
    if (isQstashReady()) {
      const queued = await queueFounderFeedback(payload)
      return NextResponse.json({
        ok: true,
        queued: true,
        feedbackId: payload.feedbackId,
        messageId: queued.messageId,
        destinations: configured,
      })
    }

    const delivered = await deliverFounderFeedback(payload, {
      deliveryMode: 'direct',
    })
    return NextResponse.json({
      ok: true,
      queued: false,
      feedbackId: payload.feedbackId,
      destinations: delivered.delivered,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'feedback_delivery_failed'
    logError({
      reqId: payload.feedbackId,
      route: 'api/feedback',
      userKey: user.id,
      phase: 'submit_failed',
      error: message,
    })
    return NextResponse.json(
      { ok: false, error: 'feedback_delivery_failed', detail: message },
      { status: 500 },
    )
  } finally {
    logInfo({
      reqId: payload.feedbackId,
      route: 'api/feedback',
      userKey: user.id,
      phase: 'handled',
      surface: payload.context.surface,
    })
  }
}
