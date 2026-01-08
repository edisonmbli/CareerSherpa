import type { Locale } from '@/i18n-config'
import { getTemplate } from '@/lib/prompts/index'
import type { TaskTemplateId } from '@/lib/prompts/types'
import { getModel, type ModelId } from '@/lib/llm/providers'
import { getTaskRouting, getJobVisionTaskRouting } from '@/lib/llm/task-router'
import {
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from '@langchain/core/prompts'
import { BaseMessage, SystemMessage, HumanMessage, AIMessage } from '@langchain/core/messages'
import { getTaskSchema, type TaskOutput } from '@/lib/llm/zod-schemas'
import { validateJson } from '@/lib/llm/json-validator'
import { createLlmUsageLogDetailed } from '@/lib/dal/llmUsageLog'
import { getProvider, getCost } from '@/lib/llm/utils'
import { glmEmbeddingProvider } from '@/lib/llm/embeddings'
import { ENV } from '@/lib/env'
import { getTaskLimits } from '@/lib/llm/config'
import { executeWithSmartRetry, getTierFromModelId } from '@/lib/llm/retry'
import { shouldUseStructuredOutput } from '@/lib/llm/capability'
import {
  extractTokenUsageFromMessage,
  extractTokenUsageFromModel,
} from '@/lib/llm/usage-extractor'

export interface RunTaskOptions {
  tier?: 'free' | 'paid'
  providerOverride?: 'zhipu' | 'deepseek' | 'openai'
  temperature?: number
  maxTokens?: number
  timeoutMs?: number
  hasImage?: boolean
  preferReasoning?: boolean
}

export interface RunLlmTaskResult<T extends TaskTemplateId> {
  ok: boolean
  data?: TaskOutput<T>
  raw?: string
  usage?: {
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
    cost?: number
    model?: string
    provider?: string
  }
  error?: string
  usageLogId?: string
}

// --- M5 prep: Unified embedding call surface ---
export interface RunEmbeddingResult {
  ok: boolean
  vector?: number[]
  usage?: {
    inputTokens?: number
    totalTokens?: number
    cost?: number
    model?: string
    provider?: string
    dimensions?: number
  }
  error?: string
}

function renderVariables(template: string, variables: Record<string, string>) {
  let rendered = template
  for (const [key, val] of Object.entries(variables)) {
    // Support both {{var}}, {{ var }}, {var}, and { var } syntax
    // Double braces (legacy/LangChain convention)
    const doubleBracePattern = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
    rendered = rendered.replace(doubleBracePattern, val ?? '')
    // Single braces (common in templates)
    const singleBracePattern = new RegExp(`{${key}}`, 'g')
    rendered = rendered.replace(singleBracePattern, val ?? '')
  }
  return rendered
}

export async function runLlmTask<T extends TaskTemplateId>(
  taskId: T,
  locale: Locale,
  variables: Record<string, string>,
  options: RunTaskOptions = {}
): Promise<RunLlmTaskResult<T>> {
  // 统一入口：根据路由决策选择结构化或流式执行
  const userHasQuota = (options.tier ?? 'paid') === 'paid'
  const hasImage =
    options.hasImage ?? Boolean(variables['image'] || variables['jobImage'])
  const decision = hasImage
    ? getJobVisionTaskRouting(userHasQuota)
    : getTaskRouting(taskId, userHasQuota)

  // Use promptId override if specified (e.g., resume_customize_lite for free tier)
  const effectiveTemplateId = decision.promptId ?? taskId

  if (decision.isStream) {
    return runStreamingLlmTask(
      decision.modelId,
      effectiveTemplateId,
      locale,
      variables,
      {}
    ) as Promise<RunLlmTaskResult<T>>
  }
  return runStructuredLlmTask(
    decision.modelId,
    effectiveTemplateId,
    locale,
    variables,
    {},
    options
  )
}

// --- M4 additions: structured & streaming entry points ---
interface TaskContext {
  userId?: string
  serviceId?: string
}

// Token usage extraction helpers moved to @/lib/llm/usage-extractor

/**
 * 生成单条文本的嵌入，统一入口与日志记录
 */
export async function runEmbedding(
  text: string,
  context: TaskContext = {}
): Promise<RunEmbeddingResult> {
  const start = Date.now()
  try {
    const res = await glmEmbeddingProvider.embed(text)
    const inputTokens = Number(res.usage?.totalTokens ?? 0)
    const outputTokens = 0

    await createLlmUsageLogDetailed({
      taskTemplateId: 'rag_embedding',
      provider: 'zhipu',
      modelId: 'glm-embedding-3',
      inputTokens,
      outputTokens,
      latencyMs: Date.now() - start,
      cost: getCost('glm-embedding-3', inputTokens, 0),
      isStream: false,
      isSuccess: true,
      ...(context.userId ? { userId: context.userId } : {}),
      ...(context.serviceId ? { serviceId: context.serviceId } : {}),
    })

    return {
      ok: true,
      vector: res.embedding,
      usage: {
        inputTokens,
        totalTokens: inputTokens,
        cost: getCost('glm-embedding-3', inputTokens, 0),
        model: 'glm-embedding-3',
        provider: 'zhipu',
        dimensions: glmEmbeddingProvider.getDimensions?.() ?? undefined,
      },
    }
  } catch (error) {
    await createLlmUsageLogDetailed({
      taskTemplateId: 'rag_embedding',
      provider: 'zhipu',
      modelId: 'glm-embedding-3',
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: Date.now() - start,
      isStream: false,
      isSuccess: false,
      errorMessage: error instanceof Error ? error.message : String(error),
      ...(context.userId ? { userId: context.userId } : {}),
      ...(context.serviceId ? { serviceId: context.serviceId } : {}),
    })
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'unknown_error',
    }
  }
}

/**
 * 批量生成嵌入，保持统一入口与日志记录（按批汇总）
 */
export async function runEmbeddingBatch(
  texts: string[],
  context: TaskContext = {}
): Promise<{
  ok: boolean
  vectors?: number[][]
  error?: string
  usage?: {
    inputTokens?: number
    totalTokens?: number
    cost?: number
    model?: string
    provider?: string
    dimensions?: number
  }
}> {
  const start = Date.now()
  try {
    const results = await glmEmbeddingProvider.embedBatch(texts)
    const vectors = results.map((r) => r.embedding)
    const inputTokens = results.reduce(
      (sum, r) => sum + Number(r.usage?.totalTokens ?? 0),
      0
    )

    await createLlmUsageLogDetailed({
      taskTemplateId: 'rag_embedding',
      provider: 'zhipu',
      modelId: 'glm-embedding-3',
      inputTokens,
      outputTokens: 0,
      latencyMs: Date.now() - start,
      cost: getCost('glm-embedding-3', inputTokens, 0),
      isStream: false,
      isSuccess: true,
      ...(context.userId ? { userId: context.userId } : {}),
      ...(context.serviceId ? { serviceId: context.serviceId } : {}),
    })

    return {
      ok: true,
      vectors,
      usage: {
        inputTokens,
        totalTokens: inputTokens,
        cost: getCost('glm-embedding-3', inputTokens, 0),
        model: 'glm-embedding-3',
        provider: 'zhipu',
        dimensions: glmEmbeddingProvider.getDimensions?.() ?? undefined,
      },
    }
  } catch (error) {
    await createLlmUsageLogDetailed({
      taskTemplateId: 'rag_embedding',
      provider: 'zhipu',
      modelId: 'glm-embedding-3',
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: Date.now() - start,
      isStream: false,
      isSuccess: false,
      errorMessage: error instanceof Error ? error.message : String(error),
      ...(context.userId ? { userId: context.userId } : {}),
      ...(context.serviceId ? { serviceId: context.serviceId } : {}),
    })
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'unknown_error',
    }
  }
}

import { logDebugData } from '@/lib/llm/debug'

export async function runStructuredLlmTask<T extends TaskTemplateId>(
  modelId: ModelId,
  templateId: T,
  locale: Locale,
  variables: Record<string, any>,
  context: TaskContext = {},
  options: RunTaskOptions = {}
): Promise<RunLlmTaskResult<T>> {
  const start = Date.now()
  try {
    const template = getTemplate(locale, templateId)
    const limits = getTaskLimits(String(templateId))
    const schemaJson = JSON.stringify(
      (template as any).outputSchema ?? {},
      null,
      2
    )

    // Debug Log: Input
    logDebugData(`${String(templateId)}_input`, {
      input: JSON.stringify({
        system: template.systemPrompt,
        user: template.userPrompt,
        variables,
      }),
      meta: { modelId, limits },
    })

    const prompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(template.systemPrompt),
      new SystemMessage(
        `You MUST output a single valid JSON object that conforms to the following JSON Schema. Do NOT include any prose or code fences.\n\nJSON Schema:\n${schemaJson}`
      ),
      HumanMessagePromptTemplate.fromTemplate(template.userPrompt),
    ])
    const model = getModel(modelId, {
      temperature: options.temperature ?? 0.3,
      timeoutMs: options.timeoutMs ?? ENV.WORKER_TIMEOUT_MS,
      maxTokens: options.maxTokens ?? limits.maxTokens,
    })

    const chain = prompt.pipe(model)
    const hasVisionImage =
      (String(templateId) === 'ocr_extract' || String(templateId) === 'job_vision_summary') &&
      typeof variables['image'] === 'string' &&
      variables['image']

    // Determine tier for smart retry strategy
    const tier = getTierFromModelId(modelId)
    const retryContext = {
      templateId: String(templateId),
      modelId,
      serviceId: context.serviceId,
      userId: context.userId,
    }

    // Generic Hybrid Result Strategy
    // Supports both 'withStructuredOutput' (future standard) and 'message' (legacy/other providers)
    // Capability and schema checks are now in @/lib/llm/capability.ts
    const schema = getTaskSchema(templateId)
    const useStructuredOutput = shouldUseStructuredOutput(modelId, schema)

    // Execute with tier-aware smart retry
    const result: any = await executeWithSmartRetry(
      async () => {
        if (useStructuredOutput) {
          // Case A: Modern Structured Output (Provider Agnostic)
          // We use includeRaw to get token usage, compatible with Generic Hybrid Strategy
          const structuredModel = (model as any).withStructuredOutput(schema, {
            includeRaw: true,
          })

          // Build message array dynamically based on vision presence
          const messages: BaseMessage[] = [
            new SystemMessage(template.systemPrompt),
          ]

          if (hasVisionImage) {
            messages.push(new HumanMessage({
              content: [
                {
                  type: 'text',
                  text: renderVariables((template as any).userPrompt, {
                    ...variables,
                    image: '[attached]',
                  }),
                },
                {
                  type: 'image_url',
                  image_url: { url: String(variables['image']) },
                },
              ],
            }))
          } else {
            messages.push(new HumanMessage(renderVariables((template as any).userPrompt, variables)))
          }

          return structuredModel.invoke(messages)
        }

        // Case B: Legacy/Standard Provider Path (e.g. Zhipu GLM)
        if (hasVisionImage) {
          // Standardize message structure: separate system prompt and schema instruction
          // This aligns with how ChatPromptTemplate is constructed for text tasks
          // and relies on the model's ability to handle multiple system messages (common in modern providers)
          const legacyMessages: BaseMessage[] = [
            new SystemMessage(template.systemPrompt),
            new SystemMessage(`You MUST output a single valid JSON object that conforms to the following JSON Schema. Do NOT include any prose or code fences.\n\nJSON Schema:\n${schemaJson}`)
          ]

          legacyMessages.push(new HumanMessage({
            content: [
              {
                type: 'text',
                text: renderVariables((template as any).userPrompt, {
                  ...variables,
                  image: '[attached]',
                }),
              },
              {
                type: 'image_url',
                image_url: { url: String(variables['image']) },
              },
            ],
          }))

          return model.invoke(legacyMessages)
        }

        // Standard Text Task (Legacy)
        return chain.invoke(variables)
      },
      tier,
      retryContext
    )

    // Hybrid Result Processing
    let content: string = ''
    let inputTokens = 0
    let outputTokens = 0
    let parsedData: any = null
    let preValidated = false

    // Case A: Structured Output ({ parsed, raw })
    if (result && typeof result === 'object' && 'parsed' in result && 'raw' in result) {
      parsedData = result.parsed
      preValidated = true
      content = JSON.stringify(result.parsed) // Serialize for log/raw return
      const usage = extractTokenUsageFromMessage(result.raw)
      inputTokens = usage.inputTokens
      outputTokens = usage.outputTokens
    }
    // Case B: Legacy/Standard Message (AIMessage / BaseMessage)
    else {
      const aiMessage = result
      const usage = extractTokenUsageFromMessage(aiMessage)
      inputTokens = usage.inputTokens
      outputTokens = usage.outputTokens
      content = (aiMessage as any)?.content ?? (aiMessage as any)?.text ?? ''
    }

    // Debug Log: Output
    logDebugData(`${String(templateId)}_output`, {
      output: content,
      latencyMs: Date.now() - start,
      meta: { inputTokens, outputTokens, mode: preValidated ? 'structured' : 'legacy' },
    })

    // Validation Flow
    // If preValidated (StructuredOutput), we skip validateJson/safeParse because it's already done
    if (preValidated) {
      // Just need to handle logging
      const log = await createLlmUsageLogDetailed({
        taskTemplateId: templateId,
        provider: getProvider(modelId),
        modelId,
        inputTokens,
        outputTokens,
        latencyMs: Date.now() - start,
        cost: getCost(modelId, inputTokens, outputTokens),
        isStream: false,
        isSuccess: true,
        ...(context.userId ? { userId: context.userId } : {}),
        ...(context.serviceId ? { serviceId: context.serviceId } : {}),
      })

      return {
        ok: true,
        data: parsedData as TaskOutput<T>,
        raw: content,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
          cost: getCost(modelId, inputTokens, outputTokens),
          model: modelId,
          provider: getProvider(modelId),
        },
        usageLogId: (log as any)?.id // M5: Return unified usage log ID
      } as RunLlmTaskResult<T>
    }

    const parsed = validateJson(content)
    if (!parsed.success || !parsed.data) {
      const log = await createLlmUsageLogDetailed({
        taskTemplateId: templateId,
        provider: getProvider(modelId),
        modelId,
        inputTokens,
        outputTokens,
        latencyMs: Date.now() - start,
        cost: getCost(modelId, inputTokens, outputTokens),
        isStream: false,
        isSuccess: false,
        errorMessage: parsed.error ?? 'json_parse_failed',
        ...(context.userId ? { userId: context.userId } : {}),
        ...(context.serviceId ? { serviceId: context.serviceId } : {}),
      })
      return {
        ok: false,
        raw: content,
        error: parsed.error ?? 'json_parse_failed',
        usageLogId: (log as any)?.id,
      }
    }

    // Already have `schema` from above, reuse it
    const safe = schema.safeParse(parsed.data)
    const ok = safe.success

    let usageLogId: any = null
    if (!ok) {
      const issues: any[] = ((safe as any)?.error?.issues as any[]) || []
      const isOcr = String(templateId) === 'ocr_extract'
      const hasEmptyExtract =
        isOcr &&
        issues.some((it: any) => {
          const p = it?.path
          const onField = Array.isArray(p)
            ? p.includes('extracted_text')
            : String(p || '').includes('extracted_text')
          return onField && String(it?.code || '') === 'too_small'
        })
      const errMsg = hasEmptyExtract
        ? 'ocr_extracted_text_empty'
        : (safe as any)?.error?.message ?? 'zod_validation_failed'
      const log = await createLlmUsageLogDetailed({
        taskTemplateId: templateId,
        provider: getProvider(modelId),
        modelId,
        inputTokens,
        outputTokens,
        latencyMs: Date.now() - start,
        cost: getCost(modelId, inputTokens, outputTokens),
        isStream: false,
        isSuccess: false,
        errorMessage: errMsg,
        ...(hasEmptyExtract
          ? { errorCode: 'ZOD_VALIDATION_FAILED' as any }
          : {}),
        ...(context.userId ? { userId: context.userId } : {}),
        ...(context.serviceId ? { serviceId: context.serviceId } : {}),
      })
      usageLogId = (log as any)?.id
      return { ok: false, raw: content, error: errMsg, usageLogId }
    }

    const log = await createLlmUsageLogDetailed({
      taskTemplateId: templateId,
      provider: getProvider(modelId),
      modelId,
      inputTokens,
      outputTokens,
      latencyMs: Date.now() - start,
      cost: getCost(modelId, inputTokens, outputTokens),
      isStream: false,
      isSuccess: ok,
      ...(context.userId ? { userId: context.userId } : {}),
      ...(context.serviceId ? { serviceId: context.serviceId } : {}),
    })

    return {
      ok: true,
      data: safe.data as TaskOutput<T>,
      raw: content,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        cost: getCost(modelId, inputTokens, outputTokens),
        model: modelId,
        provider: getProvider(modelId),
      },
      usageLogId: (log as any)?.id, // M5: Return unified usage log ID
    }
  } catch (error) {
    const log = await createLlmUsageLogDetailed({
      taskTemplateId: templateId,
      provider: getProvider(modelId),
      modelId,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: Date.now() - start,
      isStream: false,
      isSuccess: false,
      errorMessage: mapErrorToMessage(error),
      ...(context.userId ? { userId: context.userId } : {}),
      ...(context.serviceId ? { serviceId: context.serviceId } : {}),
    })
    console.error('Structured model error', {
      templateId,
      modelId,
      error: mapErrorToMessage(error),
    })
    return {
      ok: false,
      error: mapErrorToMessage(error),
      usageLogId: (log as any)?.id,
    }
  }
}

// Helper to parse specific error codes
function mapErrorToMessage(error: any): string {
  return error instanceof Error ? error.message : String(error)
}

export async function runStreamingLlmTask<T extends TaskTemplateId>(
  modelId: ModelId,
  templateId: T,
  locale: Locale,
  variables: Record<string, any>,
  context: TaskContext = {},
  onToken?: (t: string) => void | Promise<void>
) {
  const start = Date.now()
  const template = getTemplate(locale, templateId)

  // Debug Log: Input (Streaming)
  logDebugData(`${String(templateId)}_stream_input`, {
    input: JSON.stringify({
      system: template.systemPrompt,
      user: template.userPrompt,
      variables,
    }),
    meta: { modelId },
  })

  try {
    const prompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(template.systemPrompt),
      HumanMessagePromptTemplate.fromTemplate(template.userPrompt),
    ])
    const limits = getTaskLimits(String(templateId))
    const model = getModel(modelId, {
      temperature: 0.3,
      timeoutMs: ENV.WORKER_TIMEOUT_MS,
      maxTokens: limits.maxTokens,
    })
    const chain = prompt.pipe(model)

    // Stream tokens to consumer; when finished, log usage
    const stream = await chain.stream(variables)
    let fullText = ''
    for await (const chunk of stream) {
      const text = (chunk as any)?.content ?? (chunk as any)?.text ?? ''
      fullText += text
      if (text && onToken) {
        await onToken(text)
      }
    }
    const end = Date.now()

    // Debug Log: Output (Streaming)
    logDebugData(`${String(templateId)}_stream_output`, {
      output: fullText,
      latencyMs: end - start,
      meta: { len: fullText.length },
    })

    // token usage may be available on model after stream; best-effort
    let { inputTokens, outputTokens } = extractTokenUsageFromModel(model)
    if (!inputTokens && !outputTokens) {
      try {
        const estIn = Math.ceil(JSON.stringify(variables).length / 4)
        const estOut = Math.ceil(fullText.length / 4)
        inputTokens = estIn
        outputTokens = estOut
      } catch { }
    }

    const log = await createLlmUsageLogDetailed({
      taskTemplateId: templateId,
      provider: getProvider(modelId),
      modelId,
      inputTokens,
      outputTokens,
      latencyMs: end - start,
      cost: getCost(modelId, inputTokens, outputTokens),
      isStream: true,
      isSuccess: true,
      ...(context.userId ? { userId: context.userId } : {}),
      ...(context.serviceId ? { serviceId: context.serviceId } : {}),
    })

    return {
      ok: true,
      raw: fullText,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        cost: getCost(modelId, inputTokens, outputTokens),
        model: modelId,
        provider: getProvider(modelId),
      },
      usageLogId: (log as any)?.id,
    } as RunLlmTaskResult<T>
  } catch (error) {
    const end = Date.now()
    const errorMessage = error instanceof Error ? error.message : String(error)

    // Fail-safe Debug Log: Capture error details
    logDebugData(`${String(templateId)}_stream_output`, {
      output: '',
      latencyMs: end - start,
      meta: { len: 0, error: errorMessage },
    })

    // Fail-safe Usage Log: Record failure in llm_usage_logs
    const log = await createLlmUsageLogDetailed({
      taskTemplateId: templateId,
      provider: getProvider(modelId),
      modelId,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: end - start,
      isStream: true,
      isSuccess: false,
      errorMessage,
      ...(context.userId ? { userId: context.userId } : {}),
      ...(context.serviceId ? { serviceId: context.serviceId } : {}),
    })

    console.error('Streaming LLM error', {
      templateId,
      modelId,
      error: errorMessage,
      latencyMs: end - start,
    })

    return {
      ok: false,
      raw: '',
      error: errorMessage,
      usageLogId: (log as any)?.id,
    } as RunLlmTaskResult<T>
  }
}
