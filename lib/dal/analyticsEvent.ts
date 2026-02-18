import { withPrismaGuard } from '@/lib/guard/prismaGuard'
import { prisma } from '@/lib/prisma'
import { Prisma, AnalyticsCategory } from '@prisma/client'
import { logError, logInfo } from '@/lib/logger'

export interface CreateAnalyticsEventParams {
  userId?: string
  eventName: string
  payload?: Record<string, any>
  traceId?: string
  duration?: number
  category?: AnalyticsCategory
}

/**
 * Create analytics event via Prisma DAL.
 * - Fire-and-forget friendly: callers may choose not to await.
 * - Payload should only contain non-sensitive business fields.
 */
export async function createAnalyticsEvent(
  params: CreateAnalyticsEventParams
) {
  const { userId, eventName, payload, traceId, duration, category } = params
  try {
    const created = await withPrismaGuard(async (client) => {
      return await client.analyticsEvent.create({
        data: {
          userId: userId ?? null,
          eventName,
          payload: payload ? (payload as Prisma.InputJsonValue) : Prisma.JsonNull,
          traceId: traceId ?? null,
          duration: duration ?? 0,
          category: category ?? AnalyticsCategory.BUSINESS,
        },
      })
    }, { attempts: 3, prewarm: false })
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

      return { systemDeleted: sys.count, businessDeleted: biz.count, securityDeleted: sec.count }
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
