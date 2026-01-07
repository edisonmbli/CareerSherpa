import type { TaskTemplateId } from '@/lib/prompts/types'
import type { ModelId } from '@/lib/llm/providers'
import { prisma } from '@/lib/prisma'
import { withPrismaGuard } from '@/lib/guard/prismaGuard'

// export interface LlmUsageLogCreateParams {
//   modelName: string
//   inputTokens: number
//   outputTokens: number
//   cost: number
// }

// export async function createLlmUsageLog(params: LlmUsageLogCreateParams) {
//   const { modelName, inputTokens, outputTokens, cost } = params
//   try {
//     return await prisma.llmUsageLog.create({
//       data: {
//         modelName,
//         inputTokens,
//         outputTokens,
//         cost,
//       },
//     })
//   } catch (error) {
//     // 记录失败不应阻塞主流程
//     console.warn('[DAL] Failed to create LlmUsageLog:', error)
//     return null
//   }
// }

// M4: Expanded logging API aligned with new Prisma schema
export interface LlmUsageLogDetailedParams {
  userId?: string
  serviceId?: string
  taskTemplateId: TaskTemplateId
  provider: 'deepseek' | 'zhipu' | 'gemini'
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
  errorCode?: import('@prisma/client').FailureCode
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

    const created = await withPrismaGuard(async (client) => {
      return await client.llmUsageLog.create({
        data: {
          userId: userId ?? null,
          serviceId: serviceId ?? null,
          taskTemplateId,
          provider,
          modelId,
          modelName: modelName ?? null,
          inputTokens: inputTokens ?? 0,
          outputTokens: outputTokens ?? 0,
          totalTokens:
            typeof totalTokens === 'number'
              ? totalTokens
              : (inputTokens ?? 0) + (outputTokens ?? 0),
          latencyMs,
          cost: typeof cost === 'number' ? cost : null,
          isStream,
          isSuccess,
          errorMessage: errorMessage ?? null,
          errorCode: (params as any)?.errorCode ?? null,
        },
      })
    }, { attempts: 3, prewarm: false })
    return created
  } catch (error) {
    // 记录失败不应阻塞主流程，但不进行原生 SQL 降级
    console.error('[DAL] Failed to create LlmUsageLog via Prisma:', {
      error: error instanceof Error ? error.message : String(error),
      taskTemplateId: params.taskTemplateId,
      isSuccess: params.isSuccess,
      serviceId: params.serviceId,
    })
    return null
  }
}
