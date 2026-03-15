import { hasImage } from '@/lib/worker/common'
import {
  getTaskRouting,
  getJobVisionTaskRouting,
  type QueueId,
  getRoutingInputLength,
} from '@/lib/llm/task-router'
import type { TaskTemplateId } from '@/lib/prompts/types'

export function computeDecision(
  templateId: TaskTemplateId,
  variables: Record<string, any>,
  userHasQuota: boolean
) {
  return hasImage(variables)
    ? getJobVisionTaskRouting(userHasQuota)
    : getTaskRouting(
        templateId,
        userHasQuota,
        getRoutingInputLength(templateId, variables),
      )
}

export function withEnqueuedQueueId<T extends { queueId: QueueId }>(
  decision: T,
  queueId?: string,
): T {
  if (!queueId) return decision
  return {
    ...decision,
    queueId: queueId as QueueId,
  }
}
