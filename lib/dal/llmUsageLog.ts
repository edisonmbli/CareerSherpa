import { prisma } from '@/lib/prisma'
import type { TaskTemplateId } from '@/lib/prompts/types'
import type { ModelId } from '@/lib/llm/providers'

export interface LlmUsageLogCreateParams {
  modelName: string
  inputTokens: number
  outputTokens: number
  cost: number
}

export async function createLlmUsageLog(params: LlmUsageLogCreateParams) {
  const { modelName, inputTokens, outputTokens, cost } = params
  try {
    return await prisma.llmUsageLog.create({
      data: {
        modelName,
        inputTokens,
        outputTokens,
        cost,
      },
    })
  } catch (error) {
    // 记录失败不应阻塞主流程
    console.warn('[DAL] Failed to create LlmUsageLog:', error)
    return null
  }
}

// M4: Expanded logging API aligned with new Prisma schema
export interface LlmUsageLogDetailedParams {
  userId?: string
  serviceId?: string
  taskTemplateId: TaskTemplateId
  provider: 'deepseek' | 'zhipu'
  modelId: ModelId // canonical model id, e.g. 'deepseek-chat'
  modelName?: string
  inputTokens: number
  outputTokens: number
  totalTokens?: number
  latencyMs: number
  cost?: number
  isStream: boolean
  isSuccess: boolean
  errorMessage?: string
}

export async function createLlmUsageLogDetailed(
  params: LlmUsageLogDetailedParams
) {
  try {
    const {
      userId,
      serviceId,
      taskTemplateId,
      provider,
      modelId,
      modelName,
      inputTokens,
      outputTokens,
      totalTokens,
      latencyMs,
      cost,
      isStream,
      isSuccess,
      errorMessage,
    } = params

    const data: any = {
      taskTemplateId,
      provider,
      modelId,
      inputTokens,
      outputTokens,
      totalTokens: totalTokens ?? inputTokens + outputTokens,
      latencyMs,
      isStream,
      isSuccess,
    }

    // Only attach optional properties when defined to satisfy Prisma input types
    if (typeof userId === 'string') data.userId = userId
    if (typeof serviceId === 'string') data.serviceId = serviceId
    if (typeof modelName === 'string') data.modelName = modelName
    if (typeof cost === 'number') data.cost = cost
    if (typeof errorMessage === 'string' && errorMessage.length > 0) {
      data.errorMessage = errorMessage.substring(0, 500)
    }

    return await prisma.llmUsageLog.create({
      data,
    })
  } catch (error) {
    console.warn('[DAL] Failed to create detailed LlmUsageLog:', error)
    return null
  }
}