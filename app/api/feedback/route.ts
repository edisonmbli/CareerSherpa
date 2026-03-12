import { NextResponse } from 'next/server'
import { stackServerApp } from '@/stack/server'
import { feedbackSubmissionSchema } from '@/lib/feedback/schema'
import { submitFounderFeedback } from '@/lib/feedback/inbox-service'
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

  try {
    const result = await submitFounderFeedback(parsed.data, {
      id: user.id,
      email: user.primaryEmail ?? undefined,
    })
    return NextResponse.json({
      ok: true,
      queued: result.queued,
      feedbackId: result.feedbackId,
      ...(result.messageId ? { messageId: result.messageId } : {}),
      destinations: result.destinations,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'feedback_delivery_failed'
    logError({
      reqId: 'feedback-submit',
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
      reqId: 'feedback-submit',
      route: 'api/feedback',
      userKey: user.id,
      phase: 'handled',
      surface: parsed.data.context.surface,
    })
  }
}
