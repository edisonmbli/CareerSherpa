import { createAnalyticsEvent, type CreateAnalyticsEventParams } from '@/lib/dal/analyticsEvent'
import { AnalyticsCategory } from '@prisma/client'

// Re-export for convenience
export { AnalyticsCategory }

// 统一事件枚举
export type AnalyticsEventName =
  // --- System & Worker (High Priority) ---
  | 'TASK_ENQUEUED'
  | 'TASK_REPLAYED'
  | 'TASK_BACKPRESSURED'
  | 'TASK_FAILED'
  | 'WORKER_JOB_STARTED'      // New: Worker received task
  | 'WORKER_JOB_COMPLETED'    // New: Worker finished task
  | 'WORKER_GUARDS_BLOCKED'
  | 'WORKER_PROVIDER_NOT_CONFIGURED'

  // --- Business Flow ---
  | 'USER_SIGNUP_COMPLETED'   // New
  | 'SERVICE_CREATED'         // New
  | 'ASSET_UPLOADED'          // Legacy: File uploaded to blob
  | 'RESUME_UPLOAD_COMPLETED' // New: User uploaded resume for service
  | 'RESUME_PARSE_COMPLETED'  // New: Parser finished
  | 'MATCH_GENERATED'         // New
  | 'CUSTOMIZE_COMPLETED'     // New
  | 'INTERVIEW_SESSION_STARTED' // New
  | 'INTERVIEW_MESSAGE_SENT'    // New

  // --- Growth & Revenue ---
  | 'RESUME_SHARE_VIEW'
  | 'RESUME_SHARE_CONVERT'
  | 'TOPUP_CLICK'
  | 'TOPUP_WAITLIST_SUBMIT'
  
  // --- RAG & AI ---
  | 'RAG_QUERY_COMPLETED'

export interface TrackContext {
  userId?: string
  serviceId?: string
  taskId?: string
  traceId?: string      // New: Correlate async events
  duration?: number     // New: Execution time in ms
  category?: AnalyticsCategory // New: SYSTEM | BUSINESS | SECURITY
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
    const args: CreateAnalyticsEventParams = {
      eventName,
      payload,
    }
    if (ctx.userId) args.userId = ctx.userId
    if (ctx.traceId) args.traceId = ctx.traceId
    if (ctx.duration !== undefined) args.duration = ctx.duration
    if (ctx.category) args.category = ctx.category

    void createAnalyticsEvent(args)
  } catch (error) {
    // 绝不抛到业务层
    console.warn('[Analytics] trackEvent failed:', error)
  }
}
