import { Prisma, FeedbackInboxStatus } from '@prisma/client'
import { withPrismaGuard } from '@/lib/guard/prismaGuard'
import type {
  FeedbackDispatchPayload,
  FeedbackSubmission,
  FeedbackType,
} from '@/lib/feedback/schema'
import { logError } from '@/lib/logger'

export interface CreateFeedbackInboxParams {
  feedbackId: string
  userId: string
  accountEmail?: string
  type: FeedbackType
  message: string
  context: FeedbackSubmission['context']
}

export interface FeedbackInboxRecord {
  id: string
  feedbackId: string
  userId: string
  accountEmail: string | null
  type: FeedbackType
  message: string
  serviceId: string | null
  taskId: string | null
  taskTemplateId: string | null
  context: Prisma.JsonValue
  status: FeedbackInboxStatus
  deliveryAttempts: number
  lastDeliveryError: string | null
  lastDeliveredAt: Date | null
  nextRetryAt: Date | null
  createdAt: Date
  updatedAt: Date
}

function toRecord<T extends FeedbackInboxRecord>(row: T): T {
  return row
}

export async function createFeedbackInbox(
  params: CreateFeedbackInboxParams,
): Promise<FeedbackInboxRecord> {
  const context =
    params.context && typeof params.context === 'object'
      ? (params.context as Prisma.InputJsonValue)
      : Prisma.JsonNull

  return await withPrismaGuard(
    async (client) => {
      const created = await client.feedbackInbox.create({
        data: {
          feedbackId: params.feedbackId,
          userId: params.userId,
          accountEmail: params.accountEmail ?? null,
          type: params.type,
          message: params.message,
          serviceId: params.context.serviceId ?? null,
          taskId: params.context.taskId ?? null,
          taskTemplateId: params.context.taskTemplateId ?? null,
          context,
        },
      })
      return toRecord(created as FeedbackInboxRecord)
    },
    { attempts: 3, prewarm: false },
  )
}

export async function getFeedbackInboxByFeedbackId(
  feedbackId: string,
): Promise<FeedbackInboxRecord | null> {
  return await withPrismaGuard(
    async (client) => {
      const row = await client.feedbackInbox.findUnique({
        where: { feedbackId },
      })
      return row ? toRecord(row as FeedbackInboxRecord) : null
    },
    { attempts: 2, prewarm: false },
  )
}

export async function markFeedbackProcessing(feedbackId: string) {
  return await withPrismaGuard(
    async (client) =>
      await client.feedbackInbox.updateMany({
        where: {
          feedbackId,
          status: {
            in: [FeedbackInboxStatus.PENDING, FeedbackInboxStatus.FAILED],
          },
        },
        data: {
          status: FeedbackInboxStatus.PROCESSING,
          deliveryAttempts: { increment: 1 },
          lastDeliveryError: null,
        },
      }),
    { attempts: 2, prewarm: false },
  )
}

export async function markFeedbackDelivered(feedbackId: string) {
  const now = new Date()
  return await withPrismaGuard(
    async (client) =>
      await client.feedbackInbox.updateMany({
        where: { feedbackId },
        data: {
          status: FeedbackInboxStatus.DELIVERED,
          lastDeliveredAt: now,
          nextRetryAt: null,
          lastDeliveryError: null,
        },
      }),
    { attempts: 2, prewarm: false },
  )
}

export async function markFeedbackRetry(
  feedbackId: string,
  errorMessage: string,
  retryAfterSec: number = 60,
) {
  const nextRetryAt = new Date(Date.now() + Math.max(1, retryAfterSec) * 1000)
  return await withPrismaGuard(
    async (client) =>
      await client.feedbackInbox.updateMany({
        where: { feedbackId },
        data: {
          status: FeedbackInboxStatus.FAILED,
          lastDeliveryError: errorMessage.slice(0, 1000),
          nextRetryAt,
        },
      }),
    { attempts: 2, prewarm: false },
  )
}

export async function markFeedbackFailedNoRetry(
  feedbackId: string,
  errorMessage: string,
) {
  return await withPrismaGuard(
    async (client) =>
      await client.feedbackInbox.updateMany({
        where: { feedbackId },
        data: {
          status: FeedbackInboxStatus.FAILED,
          lastDeliveryError: errorMessage.slice(0, 1000),
          nextRetryAt: null,
        },
      }),
    { attempts: 2, prewarm: false },
  )
}

export function feedbackInboxRecordToPayload(
  record: FeedbackInboxRecord,
): FeedbackDispatchPayload {
  const context = record.context as FeedbackSubmission['context']
  return {
    feedbackId: record.feedbackId,
    submittedAt: record.createdAt.toISOString(),
    type: record.type,
    message: record.message,
    includeAccountEmail: Boolean(record.accountEmail),
    authUser: {
      id: record.userId,
      ...(record.accountEmail ? { email: record.accountEmail } : {}),
    },
    context,
  }
}

export function logFeedbackInboxPersistenceFailure(
  feedbackId: string,
  userId: string,
  error: unknown,
) {
  logError({
    reqId: feedbackId,
    route: 'dal/feedbackInbox',
    userKey: userId,
    phase: 'write_failed',
    error: error instanceof Error ? error.message : String(error),
  })
}
