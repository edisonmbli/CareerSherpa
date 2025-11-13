import { withPrismaGuard } from '@/lib/guard/prismaGuard'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export interface CreateAnalyticsEventParams {
  userId?: string
  eventName: string
  payload?: Record<string, any>
}

/**
 * Create analytics event via Prisma DAL.
 * - Fire-and-forget friendly: callers may choose not to await.
 * - Payload should only contain non-sensitive business fields.
 */
export async function createAnalyticsEvent(
  params: CreateAnalyticsEventParams
) {
  const { userId, eventName, payload } = params
  try {
    const created = await withPrismaGuard(async (client) => {
      return await client.analyticsEvent.create({
        data: {
          userId: userId ?? null,
          eventName,
          payload: payload ? (payload as Prisma.InputJsonValue) : Prisma.JsonNull,
        },
      })
    }, { attempts: 3, prewarm: false })
    return created
  } catch (error) {
    // 不阻塞主流程，记录失败即可
    console.warn('[DAL] Failed to create AnalyticsEvent:', error)
    return null
  }
}