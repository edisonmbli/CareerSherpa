import type { TaskTemplateId } from '@/lib/prompts/types'
import type { ModelId } from '@/lib/llm/providers'

export type WorkerType = 'structured' | 'stream'
export type Tier = 'free' | 'paid'

// Queue identifiers (aligning with QStash naming in docs)
export type QueueId =
  | 'q_deepseek_reasoner'
  | 'q_deepseek_chat'
  | 'q_glm_flash'
  | 'q_glm_vision_paid'
  | 'q_glm_vision_free'

// Canonical model IDs imported from providers.ts

export interface RouteDecision {
  tier: Tier
  modelId: ModelId
  queueId: QueueId
  worker: WorkerType
}

export interface RouteOptions {
  hasImage?: boolean
  preferReasoning?: boolean
}

/**
 * Select model, queue and worker type based on template and user quota.
 */
export function routeTask(
  templateId: TaskTemplateId,
  userHasQuota: boolean,
  options: RouteOptions = {}
): RouteDecision {
  const tier: Tier = userHasQuota ? 'paid' : 'free'

  // Vision tasks (job parsing / matching with image)
  if (options.hasImage) {
    if (tier === 'paid') {
      return {
        tier,
        modelId: 'glm-4.1v-thinking-flash',
        queueId: 'q_glm_vision_paid',
        worker: 'structured',
      }
    }
    return {
      tier,
      modelId: 'glm-4.1v-thinking-flash',
      queueId: 'q_glm_vision_free',
      worker: 'structured',
    }
  }

  // Detailed resume prefers reasoning when paid
  if (templateId === 'detailed_resume_summary') {
    // if (tier === 'paid' || options.preferReasoning) {
    if (tier === 'paid') {
      return {
        tier,
        modelId: 'deepseek-reasoner',
        queueId: 'q_deepseek_reasoner',
        worker: 'structured',
      }
    }
    return {
      tier,
      modelId: 'glm-4.5-flash',
      queueId: 'q_glm_flash',
      worker: 'structured',
    }
  }

  // Match and Interview tend to benefit from streaming UX
  if (templateId === 'job_match' || templateId === 'interview_prep') {
    if (tier === 'paid') {
      return {
        tier,
        modelId: 'deepseek-chat',
        queueId: 'q_deepseek_chat',
        worker: 'stream',
      }
    }
    return {
      tier,
      modelId: 'glm-4.5-flash',
      queueId: 'q_glm_flash',
      worker: 'stream',
    }
  }

  // Default routing: structured text
  if (tier === 'paid') {
    return {
      tier,
      modelId: 'deepseek-chat',
      queueId: 'q_deepseek_chat',
      worker: 'structured',
    }
  }
  return {
    tier,
    modelId: 'glm-4.5-flash',
    queueId: 'q_glm_flash',
    worker: 'structured',
  }
}
