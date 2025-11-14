import { hasImage } from '@/lib/worker/common'
import { getTaskRouting, getJobVisionTaskRouting } from '@/lib/llm/task-router'
import type { TaskTemplateId } from '@/lib/prompts/types'

export function computeDecision(
  templateId: TaskTemplateId,
  variables: Record<string, any>,
  userHasQuota: boolean
) {
  return hasImage(variables)
    ? getJobVisionTaskRouting(userHasQuota)
    : getTaskRouting(templateId, userHasQuota)
}

