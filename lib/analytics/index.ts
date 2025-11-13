import { createAnalyticsEvent } from '@/lib/dal/analyticsEvent'

// 统一事件枚举（仅保留关键低频事件，避免噪音与成本）
export type AnalyticsEventName =
  | 'TASK_ENQUEUED'
  | 'TASK_RATE_LIMITED'
  | 'TASK_BACKPRESSURED'
  | 'TASK_REPLAYED'
  | 'TASK_ROUTED'
  | 'TASK_COMPLETED'
  | 'TASK_FAILED'
  | 'WORKER_GUARDS_BLOCKED'
  | 'WORKER_PROVIDER_NOT_CONFIGURED'
  | 'RAG_QUERY_COMPLETED'
  | 'ASSET_UPLOADED'

export interface TrackContext {
  userId?: string
  serviceId?: string
  taskId?: string
  payload?: Record<string, any>
}

function normalizePayload(ctx: TrackContext): Record<string, any> {
  const base: Record<string, any> = {}
  if (ctx.serviceId) base['serviceId'] = ctx.serviceId
  if (ctx.taskId) base['taskId'] = ctx.taskId
  if (ctx.payload && typeof ctx.payload === 'object') {
    for (const [k, v] of Object.entries(ctx.payload)) {
      base[k] = v
    }
  }
  return base
}

/**
 * 统一入口：业务埋点（轻量、异步、集中）
 * - Fire-and-forget：不影响主流程
 * - 严禁携带敏感信息，仅记录非敏感业务字段
 */
export function trackEvent(
  eventName: AnalyticsEventName,
  ctx: TrackContext
): void {
  try {
    const payload = normalizePayload(ctx)
    // 异步触发（不 await）；避免 exactOptionalPropertyTypes 下的 undefined 赋值
    const args: {
      eventName: AnalyticsEventName
      payload?: Record<string, any>
      userId?: string
    } = {
      eventName,
      payload,
    }
    if (ctx.userId) args.userId = ctx.userId
    void createAnalyticsEvent(args)
  } catch (error) {
    // 绝不抛到业务层
    console.warn('[Analytics] trackEvent failed:', error)
  }
}
