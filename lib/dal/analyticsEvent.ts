import { withPrismaGuard } from '@/lib/guard/prismaGuard'
import {
  Prisma,
  AnalyticsCategory,
  AnalyticsOutcome,
  AnalyticsQueueKind,
  AnalyticsRuntime,
  AnalyticsSource,
} from '@prisma/client'
import { logError, logInfo } from '@/lib/logger'

export interface CreateAnalyticsEventParams {
  userId?: string
  serviceId?: string
  taskId?: string
  eventName: string
  payload?: Record<string, unknown>
  traceId?: string
  templateId?: string
  queueKind?: AnalyticsQueueKind
  source?: AnalyticsSource
  runtime?: AnalyticsRuntime
  outcome?: AnalyticsOutcome
  errorCode?: string
  idempotencyKey?: string
  occurredAt?: Date
  duration?: number | null
  category?: AnalyticsCategory
}

export interface PendingAnalyticsOutboxItem {
  id: string
  payload: Prisma.JsonValue
  retryCount: number
}

/**
 * Create analytics event via Prisma DAL.
 * - Fire-and-forget friendly: callers may choose not to await.
 * - Payload should only contain non-sensitive business fields.
 */
export async function createAnalyticsEvent(
  params: CreateAnalyticsEventParams
) {
  const {
    userId,
    serviceId,
    taskId,
    eventName,
    payload,
    traceId,
    templateId,
    queueKind,
    source,
    runtime,
    outcome,
    errorCode,
    idempotencyKey,
    occurredAt,
    duration,
    category,
  } = params
  const finalOccurredAt = occurredAt ?? new Date()
  const finalPayload =
    payload && typeof payload === 'object'
      ? (payload as Prisma.InputJsonValue)
      : Prisma.JsonNull

  try {
    const created = await withPrismaGuard(
      async (client) => {
        return await client.$transaction(async (tx) => {
          if (idempotencyKey) {
            const existing = await tx.analyticsEvent.findFirst({
              where: {
                eventName,
                idempotencyKey,
              },
            })
            if (existing) {
              return existing
            }
          }

          let event: { id: string }
          try {
            event = await tx.analyticsEvent.create({
              data: {
                userId: userId ?? null,
                serviceId: serviceId ?? null,
                taskId: taskId ?? null,
                eventName,
                payload: finalPayload,
                traceId: traceId ?? null,
                templateId: templateId ?? null,
                queueKind: queueKind ?? null,
                source: source ?? AnalyticsSource.ACTION,
                runtime: runtime ?? AnalyticsRuntime.NEXTJS,
                outcome: outcome ?? null,
                errorCode: errorCode ?? null,
                idempotencyKey: idempotencyKey ?? null,
                duration: duration ?? null,
                occurredAt: finalOccurredAt,
                category: category ?? AnalyticsCategory.BUSINESS,
              },
            })
          } catch (error) {
            if (
              idempotencyKey &&
              error instanceof Prisma.PrismaClientKnownRequestError &&
              error.code === 'P2002'
            ) {
              const duplicated = await tx.analyticsEvent.findFirst({
                where: {
                  eventName,
                  idempotencyKey,
                },
              })
              if (duplicated) {
                return duplicated
              }
            }
            throw error
          }

          const outboxPayload: Record<string, unknown> = {
            eventId: event.id,
            eventName,
            occurredAt: finalOccurredAt.toISOString(),
            source: source ?? AnalyticsSource.ACTION,
            runtime: runtime ?? AnalyticsRuntime.NEXTJS,
          }
          if (userId) outboxPayload['userId'] = userId
          if (serviceId) outboxPayload['serviceId'] = serviceId
          if (taskId) outboxPayload['taskId'] = taskId
          if (traceId) outboxPayload['traceId'] = traceId
          if (templateId) outboxPayload['templateId'] = templateId
          if (queueKind) outboxPayload['queueKind'] = queueKind
          if (outcome) outboxPayload['outcome'] = outcome
          if (errorCode) outboxPayload['errorCode'] = errorCode
          if (idempotencyKey) outboxPayload['idempotencyKey'] = idempotencyKey
          if (duration !== undefined && duration !== null) {
            outboxPayload['duration'] = duration
          }
          if (category) outboxPayload['category'] = category
          if (payload) outboxPayload['payload'] = payload

          await tx.analyticsOutbox.create({
            data: {
              eventId: event.id,
              payload: outboxPayload as Prisma.InputJsonValue,
            },
          })

          return event
        })
      },
      { attempts: 3, prewarm: false },
    )
    return created
  } catch (error) {
    // 不阻塞主流程，记录失败即可
    logInfo({
      reqId: 'analytics-event',
      route: 'dal/analyticsEvent',
      phase: 'create_failed',
      error: error instanceof Error ? error : String(error),
    })
    return null
  }
}

export async function listPendingAnalyticsOutbox(
  limit: number = 100,
): Promise<PendingAnalyticsOutboxItem[]> {
  const take = Number.isFinite(limit) ? Math.max(1, Math.min(500, limit)) : 100
  const now = new Date()
  try {
    const rows = await withPrismaGuard(
      async (client) => {
        return await client.analyticsOutbox.findMany({
          where: {
            exportedAt: null,
            OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
          },
          orderBy: { createdAt: 'asc' },
          take,
          select: { id: true, payload: true, retryCount: true },
        })
      },
      { attempts: 3 },
    )
    return rows
  } catch (error) {
    logError({
      reqId: 'analytics-outbox',
      route: 'dal/analyticsEvent',
      phase: 'list_pending_failed',
      error: error instanceof Error ? error : String(error),
    })
    return []
  }
}

export async function markAnalyticsOutboxExported(outboxIds: string[]) {
  if (!outboxIds.length) return { count: 0 }
  const now = new Date()
  return await withPrismaGuard(
    async (client) => {
      return await client.analyticsOutbox.updateMany({
        where: { id: { in: outboxIds } },
        data: {
          exportedAt: now,
          lastError: null,
          nextRetryAt: null,
        },
      })
    },
    { attempts: 3 },
  )
}

export async function markAnalyticsOutboxRetry(
  outboxIds: string[],
  errorMessage: string,
  retryAfterSec: number = 60,
) {
  if (!outboxIds.length) return { count: 0 }
  const nextRetryAt = new Date(Date.now() + Math.max(1, retryAfterSec) * 1000)
  return await withPrismaGuard(
    async (client) => {
      return await client.analyticsOutbox.updateMany({
        where: { id: { in: outboxIds } },
        data: {
          retryCount: { increment: 1 },
          lastError: errorMessage.slice(0, 1000),
          nextRetryAt,
        },
      })
    },
    { attempts: 3 },
  )
}

/**
 * Cleanup old analytics events based on retention policy.
 * - BUSINESS: Keep 90 days
 * - SYSTEM: Keep 30 days
 * - SECURITY: Keep 90 days (audit logs)
 */
export async function cleanupOldAnalyticsEvents() {
  const now = new Date()
  const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const day90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

  try {
    const result = await withPrismaGuard(async (client) => {
      // 1. Delete SYSTEM events older than 30 days
      const sys = await client.analyticsEvent.deleteMany({
        where: {
          category: AnalyticsCategory.SYSTEM,
          createdAt: { lt: day30 },
        },
      })

      // 2. Delete BUSINESS events older than 90 days
      const biz = await client.analyticsEvent.deleteMany({
        where: {
          category: AnalyticsCategory.BUSINESS,
          createdAt: { lt: day90 },
        },
      })

      // 3. Delete SECURITY events older than 90 days
      const sec = await client.analyticsEvent.deleteMany({
        where: {
          category: AnalyticsCategory.SECURITY,
          createdAt: { lt: day90 },
        },
      })

      return {
        systemDeleted: sys.count,
        businessDeleted: biz.count,
        securityDeleted: sec.count,
      }
    }, { attempts: 3 })

    return result
  } catch (error) {
    logError({
      reqId: 'analytics-event',
      route: 'dal/analyticsEvent',
      phase: 'cleanup_failed',
      error: error instanceof Error ? error : String(error),
    })
    throw error
  }
}

/**
 * Cleanup exported analytics outbox records after a short retention window.
 * Keep recent exported rows for diagnostics, then delete to control storage.
 */
export async function cleanupExportedAnalyticsOutbox(retentionDays: number = 7) {
  const safeRetentionDays = Math.max(1, Math.min(90, Math.floor(retentionDays)))
  const cutoff = new Date(Date.now() - safeRetentionDays * 24 * 60 * 60 * 1000)

  try {
    const result = await withPrismaGuard(
      async (client) => {
        const deleted = await client.analyticsOutbox.deleteMany({
          where: {
            exportedAt: { lt: cutoff },
          },
        })
        return {
          outboxDeleted: deleted.count,
          retentionDays: safeRetentionDays,
        }
      },
      { attempts: 3 },
    )
    return result
  } catch (error) {
    logError({
      reqId: 'analytics-outbox',
      route: 'dal/analyticsEvent',
      phase: 'cleanup_exported_failed',
      error: error instanceof Error ? error : String(error),
    })
    throw error
  }
}
