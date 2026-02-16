// AI IDE: Overwrite this file aligned with M6 routing spec
import type { TaskTemplateId } from '@/lib/prompts/types'
import { ModelId as MODEL } from '@/lib/llm/providers'
import type { ModelId as ModelIdType } from '@/lib/llm/providers'

// 规范: M10 队列优化 - 基于 "时长/复杂度" (Heavy/Light) + "付费等级" 的分流策略
// 目的: 最大化 QStash Free Tier (10 slots) 利用率，同时保护 Fast 任务不被 Slow 任务阻塞
export enum QueueId {
  // --- Paid Tier (6 slots / 60% Capacity) ---
  // Heavy: DeepSeek Reasoner, RAG, Long Gen. (Slow, High Value)
  // 分配 2 个队列 (4 slots) 以应对长耗时导致的堆积
  PAID_HEAVY_1 = 'q_paid_heavy_1',
  PAID_HEAVY_2 = 'q_paid_heavy_2',

  // Light: DeepSeek Chat, OCR, Simple Summary. (Fast, High Throughput)
  // 分配 1 个队列 (2 slots) 足够，因为周转快
  PAID_LIGHT = 'q_paid_light',

  // --- Free Tier (4 slots / 40% Capacity) ---
  // Heavy: Job Match, Customize (Complex workflow)
  // 分配 1 个队列 (2 slots)
  FREE_HEAVY = 'q_free_heavy',

  // Light: Summary, Interview (Fast)
  // 分配 1 个队列 (2 slots)
  FREE_LIGHT = 'q_free_light',
}

// Helper: Paid Heavy 负载均衡
const getPaidHeavyQueue = (): QueueId => {
  return Math.random() > 0.5 ? QueueId.PAID_HEAVY_1 : QueueId.PAID_HEAVY_2
}

interface TaskRouting {
  modelId: ModelIdType
  queueId: QueueId
  isStream: boolean // 标记此任务是否应流式
  promptId?: TaskTemplateId // Optional: use different prompt for this route
}

const ROUTING_TABLE: Partial<
  Record<TaskTemplateId, { paid: TaskRouting; free: TaskRouting }>
> = {
  // --- M7 资产流 (Batch) ---
  // Light: 简单摘要
  resume_summary: {
    paid: {
      modelId: MODEL.DEEPSEEK_CHAT,
      queueId: QueueId.PAID_LIGHT,
      isStream: false,
    },
    free: {
      modelId: MODEL.GEMINI_3_FLASH_PREVIEW,
      queueId: QueueId.FREE_LIGHT,
      isStream: false,
    },
  },
  // Heavy: 深度推理
  detailed_resume_summary: {
    paid: {
      modelId: MODEL.DEEPSEEK_REASONER,
      queueId: QueueId.PAID_HEAVY_1, // Dynamic in getter
      isStream: false,
    },
    free: {
      modelId: MODEL.GEMINI_3_FLASH_PREVIEW,
      queueId: QueueId.FREE_HEAVY,
      isStream: false,
    },
  },
  // Light: 文本摘要
  job_summary: {
    paid: {
      modelId: MODEL.DEEPSEEK_CHAT,
      queueId: QueueId.PAID_LIGHT,
      isStream: false,
    },
    free: {
      modelId: MODEL.GEMINI_3_FLASH_PREVIEW,
      queueId: QueueId.FREE_LIGHT,
      isStream: false,
    },
  },

  // --- M8/M9 服务流 (Stream) ---
  // Heavy: 核心匹配 (RAG + Reasoning)
  job_match: {
    paid: {
      modelId: MODEL.DEEPSEEK_REASONER,
      queueId: QueueId.PAID_HEAVY_1, // Dynamic
      isStream: true,
    },
    free: {
      modelId: MODEL.GEMINI_3_FLASH_PREVIEW,
      queueId: QueueId.FREE_HEAVY,
      isStream: true,
    },
  },
  // Heavy: 对话生成 (Chat -> Reasoner for better quality)
  interview_prep: {
    paid: {
      modelId: MODEL.DEEPSEEK_REASONER, // Switched to Reasoner as requested
      queueId: QueueId.PAID_HEAVY_1, // Moved to Heavy queue
      isStream: true,
    },
    free: {
      modelId: MODEL.GEMINI_3_FLASH_PREVIEW,
      queueId: QueueId.FREE_LIGHT,
      isStream: true,
    },
  },

  // --- M9 服务流 (Batch) ---
  // Heavy: 简历定制 (Reasoning + Long Gen)
  resume_customize: {
    paid: {
      modelId: MODEL.DEEPSEEK_REASONER,
      queueId: QueueId.PAID_HEAVY_1, // Dynamic
      isStream: false,
    },
    free: {
      modelId: MODEL.GEMINI_3_FLASH_PREVIEW,
      queueId: QueueId.FREE_HEAVY,
      isStream: false,
    },
  },
  // Light: OCR 提取
  ocr_extract: {
    paid: {
      modelId: MODEL.GLM_VISION_THINKING_FLASH,
      queueId: QueueId.PAID_LIGHT,
      isStream: false,
    },
    free: {
      modelId: MODEL.GEMINI_3_FLASH_PREVIEW,
      queueId: QueueId.FREE_LIGHT,
      isStream: false,
    },
  },
  // Light: 审计 (Fast Check)
  pre_match_audit: {
    paid: {
      modelId: MODEL.GEMINI_3_FLASH_PREVIEW,
      queueId: QueueId.PAID_LIGHT,
      isStream: false,
    },
    free: {
      modelId: MODEL.GEMINI_3_FLASH_PREVIEW,
      queueId: QueueId.FREE_LIGHT,
      isStream: false,
    },
  },
  // Legacy Vision
  job_vision_summary: {
    paid: {
      modelId: MODEL.DEEPSEEK_CHAT,
      queueId: QueueId.PAID_LIGHT,
      isStream: false,
    },
    free: {
      modelId: MODEL.GEMINI_3_FLASH_PREVIEW,
      queueId: QueueId.FREE_LIGHT,
      isStream: false,
    },
  },
}

/**
 * M8/M9 Server Action 调用的核心函数
 */
export const getTaskRouting = (
  templateId: TaskTemplateId,
  hasQuota: boolean,
) => {
  const route = ROUTING_TABLE[templateId]
  if (!route) throw new Error(`Routing for task ${templateId} not found.`)

  const selected = hasQuota ? route.paid : route.free

  // Paid Heavy Load Balancing: Randomly distribute between HEAVY_1 and HEAVY_2
  if (hasQuota && selected.queueId === QueueId.PAID_HEAVY_1) {
    return { ...selected, queueId: getPaidHeavyQueue() }
  }

  return selected
}

// M9 特殊任务：JD 截图 (Light)
export const getJobVisionTaskRouting = (hasQuota: boolean): TaskRouting => {
  return hasQuota
    ? {
        modelId: MODEL.GLM_VISION_THINKING_FLASH,
        queueId: QueueId.PAID_LIGHT,
        isStream: false,
      }
    : {
        modelId: MODEL.GEMINI_3_FLASH_PREVIEW,
        queueId: QueueId.FREE_LIGHT,
        isStream: false,
      }
}

export const isServiceScoped = (t: TaskTemplateId): boolean => {
  return (
    t === 'job_summary' ||
    t === 'job_match' ||
    t === 'resume_customize' ||
    t === 'interview_prep' ||
    t === 'ocr_extract' ||
    t === 'pre_match_audit'
  )
}

export function routeTask(
  templateId: TaskTemplateId,
  tier: 'paid' | 'free',
  hasImage?: boolean,
): TaskRouting {
  const userHasQuota = tier === 'paid'
  return hasImage && templateId === 'job_summary'
    ? getJobVisionTaskRouting(userHasQuota)
    : getTaskRouting(templateId, userHasQuota)
}
