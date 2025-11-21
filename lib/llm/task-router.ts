// AI IDE: Overwrite this file aligned with M6 routing spec
import type { TaskTemplateId } from '@/lib/prompts/types'
import { ModelId as MODEL } from '@/lib/llm/providers'
import type { ModelId as ModelIdType } from '@/lib/llm/providers'

// 规范: M6 队列按“体验模式”+“付费等级”划分
export enum QueueId {
  PAID_STREAM = 'q_paid_stream',
  PAID_BATCH = 'q_paid_batch',
  PAID_VISION = 'q_paid_vision',

  FREE_STREAM = 'q_free_stream',
  FREE_BATCH = 'q_free_batch',
  FREE_VISION = 'q_free_vision',
}

interface TaskRouting {
  modelId: ModelIdType
  queueId: QueueId
  isStream: boolean // 标记此任务是否应流式
}

const ROUTING_TABLE: Partial<
  Record<TaskTemplateId, { paid: TaskRouting; free: TaskRouting }>
> = {
  // --- M7 资产流 (Batch) ---
  resume_summary: {
    paid: {
      modelId: MODEL.DEEPSEEK_CHAT,
      queueId: QueueId.PAID_BATCH,
      isStream: false,
    },
    free: {
      modelId: MODEL.GLM_45_FLASH,
      queueId: QueueId.FREE_BATCH,
      isStream: false,
    },
  },
  detailed_resume_summary: {
    paid: {
      modelId: MODEL.DEEPSEEK_REASONER,
      queueId: QueueId.PAID_BATCH,
      isStream: false,
    },
    free: {
      modelId: MODEL.GLM_45_FLASH,
      queueId: QueueId.FREE_BATCH,
      isStream: false,
    },
  },
  job_summary: {
    // JD 文本摘要 (Batch)
    paid: {
      modelId: MODEL.DEEPSEEK_CHAT,
      queueId: QueueId.PAID_BATCH,
      isStream: false,
    },
    free: {
      modelId: MODEL.GLM_45_FLASH,
      queueId: QueueId.FREE_BATCH,
      isStream: false,
    },
  },

  // --- M8/M9 服务流 (Stream) ---
  job_match: {
    paid: {
      modelId: MODEL.DEEPSEEK_REASONER,
      queueId: QueueId.PAID_STREAM,
      isStream: true,
    },
    free: {
      modelId: MODEL.GLM_45_FLASH,
      queueId: QueueId.FREE_STREAM,
      isStream: true,
    },
  },
  interview_prep: {
    paid: {
      modelId: MODEL.DEEPSEEK_CHAT,
      queueId: QueueId.PAID_STREAM,
      isStream: true,
    },
    free: {
      modelId: MODEL.GLM_45_FLASH,
      queueId: QueueId.FREE_STREAM,
      isStream: true,
    },
  },

  // --- M9 服务流 (Batch) ---
  resume_customize: {
    paid: {
      modelId: MODEL.DEEPSEEK_CHAT,
      queueId: QueueId.PAID_BATCH,
      isStream: false,
    },
    free: {
      modelId: MODEL.GLM_45_FLASH,
      queueId: QueueId.FREE_BATCH,
      isStream: false,
    },
  },
}

/**
 * M8/M9 Server Action 调用的核心函数
 */
export const getTaskRouting = (
  templateId: TaskTemplateId,
  hasQuota: boolean
) => {
  const route = ROUTING_TABLE[templateId]
  if (!route) throw new Error(`Routing for task ${templateId} not found.`)
  return hasQuota ? route.paid : route.free
}

// M9 特殊任务：JD 截图
export const getJobVisionTaskRouting = (hasQuota: boolean): TaskRouting => {
  return hasQuota
    ? {
        modelId: MODEL.GLM_VISION_THINKING_FLASH,
        queueId: QueueId.PAID_VISION,
        isStream: false,
      }
    : {
        modelId: MODEL.GLM_VISION_THINKING_FLASH,
        queueId: QueueId.FREE_VISION,
        isStream: false,
      }
}

export const isServiceScoped = (t: TaskTemplateId): boolean => {
  return (
    t === 'job_summary' ||
    t === 'job_match' ||
    t === 'resume_customize' ||
    t === 'interview_prep'
  )
}
