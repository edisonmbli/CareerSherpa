import { verifySignatureAppRouter } from '@upstash/qstash/nextjs'
import { ENV } from '@/lib/env'
import { feedbackDispatchSchema } from '@/lib/feedback/schema'
import { deliverFounderFeedback } from '@/lib/feedback/delivery'
import { logError } from '@/lib/logger'

const handler = verifySignatureAppRouter(
  async (req: Request) => {
    const rawBody = await req.json().catch(() => null)
    const parsed = feedbackDispatchSchema.safeParse(rawBody)
    if (!parsed.success) {
      return Response.json(
        {
          ok: false,
          error: 'invalid_feedback_dispatch_payload',
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 },
      )
    }

    try {
      const result = await deliverFounderFeedback(parsed.data, {
        deliveryMode: 'qstash',
      })
      return Response.json({ ok: true, destinations: result.delivered })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'feedback_dispatch_failed'
      logError({
        reqId: parsed.data.feedbackId,
        route: 'api/feedback/dispatch',
        userKey: parsed.data.authUser.id,
        phase: 'dispatch_failed',
        error: message,
      })
      return Response.json(
        { ok: false, error: 'feedback_dispatch_failed', detail: message },
        { status: 500 },
      )
    }
  },
  {
    currentSigningKey: ENV.QSTASH_CURRENT_SIGNING_KEY,
    nextSigningKey: ENV.QSTASH_NEXT_SIGNING_KEY,
  },
)

export { handler as POST }
