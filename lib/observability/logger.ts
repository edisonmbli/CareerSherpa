import { trackEvent, type AnalyticsEventName } from '@/lib/analytics/index'
import { auditUserAction } from '@/lib/audit/async-audit'
import {
  AnalyticsCategory,
  AnalyticsRuntime,
  AnalyticsSource,
  AnalyticsQueueKind,
  AnalyticsOutcome,
} from '@prisma/client'

type BaseContext = { userId?: string; serviceId?: string; taskId?: string }
type EventOptions = {
  category?: AnalyticsCategory
  traceId?: string
  source?: AnalyticsSource
  runtime?: AnalyticsRuntime
  queueKind?: AnalyticsQueueKind
  outcome?: AnalyticsOutcome
  errorCode?: string
  idempotencyKey?: string
}

export function logAudit(
  userId: string,
  action: string,
  entity: 'task' | 'quota' | 'system',
  entityId: string,
  payload?: Record<string, any>
) {
  try {
    auditUserAction(userId, action, entity, entityId, payload || {})
  } catch {
    // non-fatal: audit logging should not block main flow
  }
}

export function logEvent(
  name: AnalyticsEventName,
  ctx: BaseContext,
  payload?: Record<string, unknown>,
  opts?: EventOptions,
) {
  try {
    trackEvent(name, {
      ...(ctx.userId ? { userId: ctx.userId } : {}),
      ...(ctx.serviceId ? { serviceId: ctx.serviceId } : {}),
      ...(ctx.taskId ? { taskId: ctx.taskId } : {}),
      ...(opts?.traceId ? { traceId: opts.traceId } : {}),
      ...(opts?.category ? { category: opts.category } : {}),
      ...(opts?.source ? { source: opts.source } : {}),
      ...(opts?.runtime ? { runtime: opts.runtime } : {}),
      ...(opts?.queueKind ? { queueKind: opts.queueKind } : {}),
      ...(opts?.outcome ? { outcome: opts.outcome } : {}),
      ...(opts?.errorCode ? { errorCode: opts.errorCode } : {}),
      ...(opts?.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : {}),
      payload: payload || {},
    })
  } catch {
    // non-fatal: analytics tracking should not block main flow
  }
}
