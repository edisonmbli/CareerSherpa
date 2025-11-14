import { trackEvent, type AnalyticsEventName } from '@/lib/analytics/index'
import { auditUserAction } from '@/lib/audit/async-audit'

type BaseContext = { userId?: string; serviceId?: string; taskId?: string }

export function logAudit(
  userId: string,
  action: string,
  entity: 'task' | 'quota' | 'system',
  entityId: string,
  payload?: Record<string, any>
) {
  try { auditUserAction(userId, action, entity, entityId, payload || {}) } catch {}
}

export function logEvent(
  name: AnalyticsEventName,
  ctx: BaseContext,
  payload?: Record<string, any>
) {
  try {
    trackEvent(name, {
      ...(ctx.userId ? { userId: ctx.userId } : {}),
      ...(ctx.serviceId ? { serviceId: ctx.serviceId } : {}),
      ...(ctx.taskId ? { taskId: ctx.taskId } : {}),
      payload: payload || {},
    })
  } catch {}
}
