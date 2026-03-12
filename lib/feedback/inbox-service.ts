import { nanoid } from 'nanoid'
import {
  createFeedbackInbox,
  feedbackInboxRecordToPayload,
  getFeedbackInboxByFeedbackId,
  markFeedbackDelivered,
  markFeedbackFailedNoRetry,
  markFeedbackProcessing,
  markFeedbackRetry,
} from '@/lib/dal/feedbackInbox'
import { isQstashReady } from '@/lib/env'
import { deliverFounderFeedback, getConfiguredFeedbackDestinations, queueFounderFeedback } from '@/lib/feedback/delivery'
import {
  feedbackContextSchema,
  feedbackStoredPayloadSchema,
  type FeedbackDispatchRequest,
  type FeedbackSubmission,
} from '@/lib/feedback/schema'
import { logError } from '@/lib/logger'

const FEEDBACK_DELIVERY_RETRY_AFTER_SEC = 60

export async function submitFounderFeedback(
  submission: FeedbackSubmission,
  authUser: { id: string; email?: string },
) {
  const feedbackId = nanoid(12)
  await createFeedbackInbox({
    feedbackId,
    userId: authUser.id,
    type: submission.type,
    message: submission.message,
    context: submission.context,
    ...(submission.includeAccountEmail && authUser.email
      ? { accountEmail: authUser.email }
      : {}),
  })

  const destinations = getConfiguredFeedbackDestinations()
  if (!destinations.length) {
    await markFeedbackFailedNoRetry(feedbackId, 'feedback_delivery_not_configured')
    return {
      feedbackId,
      queued: false,
      messageId: null as string | null,
      destinations,
    }
  }

  if (isQstashReady()) {
    try {
      const queued = await queueFounderFeedback(
        { feedbackId, deliveryMode: 'qstash' },
        { userId: authUser.id },
      )
      return {
        feedbackId,
        queued: true,
        messageId: queued.messageId,
        destinations,
      }
    } catch (error) {
      logError({
        reqId: feedbackId,
        route: 'feedback/submit',
        userKey: authUser.id,
        phase: 'queue_failed_fallback_direct',
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  try {
    await processQueuedFounderFeedback({ feedbackId, deliveryMode: 'direct' })
  } catch (error) {
    logError({
      reqId: feedbackId,
      route: 'feedback/submit',
      userKey: authUser.id,
      phase: 'direct_delivery_failed_after_persist',
      error: error instanceof Error ? error.message : String(error),
    })
  }

  return {
    feedbackId,
    queued: false,
    messageId: null as string | null,
    destinations,
  }
}

export async function processQueuedFounderFeedback(
  request: FeedbackDispatchRequest,
) {
  const record = await getFeedbackInboxByFeedbackId(request.feedbackId)
  if (!record) {
    throw new Error('feedback_inbox_not_found')
  }

  if (record.status === 'DELIVERED') {
    return {
      delivered: [] as string[],
      failures: [] as string[],
      enrichment: null,
      skipped: 'already_delivered' as const,
    }
  }

  const contextParsed = feedbackContextSchema.safeParse(record.context)
  if (!contextParsed.success) {
    await markFeedbackFailedNoRetry(request.feedbackId, 'invalid_feedback_inbox_context')
    throw new Error('invalid_feedback_inbox_context')
  }

  const payloadCandidate = feedbackInboxRecordToPayload({
    ...record,
    context: contextParsed.data,
  })
  const payloadParsed = feedbackStoredPayloadSchema.safeParse(payloadCandidate)
  if (!payloadParsed.success) {
    await markFeedbackFailedNoRetry(request.feedbackId, 'invalid_feedback_inbox_payload')
    throw new Error('invalid_feedback_inbox_payload')
  }

  await markFeedbackProcessing(request.feedbackId)

  try {
    const delivered = await deliverFounderFeedback(payloadParsed.data, {
      deliveryMode: request.deliveryMode,
    })
    await markFeedbackDelivered(request.feedbackId)
    return delivered
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'feedback_delivery_failed'
    await markFeedbackRetry(
      request.feedbackId,
      message,
      FEEDBACK_DELIVERY_RETRY_AFTER_SEC,
    )
    throw error
  }
}
