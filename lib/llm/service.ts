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
import {
  BaseMessage,
  SystemMessage,
  HumanMessage,
} from '@langchain/core/messages'
import {
  getTaskSchema,
  detailedResumeDeepSchema,
  type TaskOutput,
} from '@/lib/llm/zod-schemas'
import { validateJson } from '@/lib/llm/json-validator'
import { createLlmUsageLogDetailed } from '@/lib/dal/llmUsageLog'
import { getProvider, getCost } from '@/lib/llm/utils'
import { UI_LOCALE_LABELS } from '@/lib/constants'
import { glmEmbeddingProvider } from '@/lib/llm/embeddings'
import { ENV } from '@/lib/env'
import { getTaskLimits } from '@/lib/llm/config'
import { executeWithSmartRetry, getTierFromModelId } from '@/lib/llm/retry'
import { shouldUseStructuredOutput } from '@/lib/llm/capability'
import {
  runGeminiStructured,
  runGeminiStreaming,
  runGeminiVision,
  shouldUseGeminiDirect,
} from '@/lib/llm/gemini-direct'
import {
  extractTokenUsageFromMessage,
  extractTokenUsageFromModel,
} from '@/lib/llm/usage-extractor'
import { FailureCode } from '@prisma/client'

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

function getUiLocaleLabel(locale: Locale) {
  return UI_LOCALE_LABELS[locale] ?? locale
}

export async function runLlmTask<T extends TaskTemplateId>(
  taskId: T,
  locale: Locale,
  variables: Record<string, string>,
  options: RunTaskOptions = {},
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
      {},
    ) as Promise<RunLlmTaskResult<T>>
  }
  return runStructuredLlmTask(
    decision.modelId,
    effectiveTemplateId,
    locale,
    variables,
    {},
    options,
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
  context: TaskContext = {},
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
    const errorCode = mapErrorToCode(error)
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
      ...(errorCode ? { errorCode } : {}),
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
  context: TaskContext = {},
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
      0,
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
    const errorCode = mapErrorToCode(error)
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
      ...(errorCode ? { errorCode } : {}),
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
import { logDebug, logError } from '@/lib/logger'

export async function runStructuredLlmTask<T extends TaskTemplateId>(
  modelId: ModelId,
  templateId: T,
  locale: Locale,
  variables: Record<string, any>,
  context: TaskContext = {},
  options: RunTaskOptions = {},
): Promise<RunLlmTaskResult<T>> {
  const start = Date.now()
  try {
    const template = getTemplate(locale, templateId)
    const limits = getTaskLimits(String(templateId))
    const schemaJson = JSON.stringify(
      (template as any).outputSchema ?? {},
      null,
      2,
    )
    const runtimeVariables = {
      ...variables,
      current_date: new Date().toISOString().slice(0, 10),
      ui_locale: getUiLocaleLabel(locale),
    }
    const renderedSystemPrompt = renderVariables(
      template.systemPrompt,
      runtimeVariables,
    )

    // Debug Log: Input
    logDebugData(`${String(templateId)}_input`, {
      input: JSON.stringify({
        system: renderedSystemPrompt,
        user: template.userPrompt,
        variables: runtimeVariables,
      }),
      meta: { modelId, limits, serviceId: context.serviceId },
    })

    const prompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(renderedSystemPrompt),
      new SystemMessage(
        `You MUST output a single valid JSON object that conforms to the following JSON Schema. Do NOT include any prose or code fences.\n\nJSON Schema:\n${schemaJson}`,
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
      (String(templateId) === 'ocr_extract' ||
        String(templateId) === 'job_vision_summary') &&
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
    let schema = getTaskSchema(templateId)

    // [New] Dynamic Schema Selection
    // For detailed resume summary on Paid tier (DeepSeek/High-end Gemini), usage of Deep Schema is allowed
    // This addresses the recursion limit on Free Tier Gemini models while enabling rich nesting for Paid models
    if (
      String(templateId) === 'detailed_resume_summary' &&
      options.tier === 'paid'
    ) {
      schema = detailedResumeDeepSchema
    }

    // PHASE 1A: Gemini Direct Vision Path (for OCR/vision tasks)
    if (shouldUseGeminiDirect(modelId) && schema && hasVisionImage) {
      logDebug({
        reqId: context.serviceId || 'llm',
        route: 'llm/structured',
        phase: 'gemini_direct_vision',
        templateId: String(templateId),
      })

      const renderedUserPrompt = renderVariables(template.userPrompt, {
        ...runtimeVariables,
        image: '[attached]',
      })

      // Get image data from variables
      const imageData = String(
        variables['image'] || variables['jobImage'] || '',
      )
      if (!imageData) {
        return {
          ok: false,
          error: 'No image data provided for vision task',
        } as RunLlmTaskResult<T>
      }

      const geminiResult = await runGeminiVision(
        renderedSystemPrompt,
        renderedUserPrompt,
        imageData,
        schema,
        {
          maxOutputTokens: options.maxTokens ?? limits.maxTokens,
          ...(options.timeoutMs !== undefined
            ? { timeoutMs: options.timeoutMs }
            : {}),
          ...(options.temperature !== undefined
            ? { temperature: options.temperature }
            : {}),
        },
      )

      // Debug Log: Output
      logDebugData(`${String(templateId)}_output`, {
        output: geminiResult.raw || JSON.stringify(geminiResult.data),
        meta: {
          modelId,
          elapsed: Date.now() - start,
          usage: geminiResult.usage,
          ok: geminiResult.ok,
          error: geminiResult.error,
          isVision: true,
          serviceId: context.serviceId,
        },
      })

      if (!geminiResult.ok) {
        return {
          ok: false,
          error: geminiResult.error,
          raw: geminiResult.raw || '',
          usage: geminiResult.usage,
        } as RunLlmTaskResult<T>
      }

      return {
        ok: true,
        data: geminiResult.data,
        raw: geminiResult.raw || '',
        usage: geminiResult.usage,
      } as RunLlmTaskResult<T>
    }

    // PHASE 1B: Gemini Direct API Path (for text-only structured tasks)
    // For Gemini 3 models, use native API for better structured output reliability
    if (shouldUseGeminiDirect(modelId) && schema && !hasVisionImage) {
      logDebug({
        reqId: context.serviceId || 'llm',
        route: 'llm/structured',
        phase: 'gemini_direct',
        templateId: String(templateId),
      })

      // Render prompts with variables
      const renderedUserPrompt = renderVariables(
        template.userPrompt,
        runtimeVariables,
      )

      const geminiResult = await runGeminiStructured(
        renderedSystemPrompt,
        renderedUserPrompt,
        schema,
        {
          maxOutputTokens: options.maxTokens ?? limits.maxTokens,
          ...(options.timeoutMs !== undefined
            ? { timeoutMs: options.timeoutMs }
            : {}),
          ...(options.temperature !== undefined
            ? { temperature: options.temperature }
            : {}),
        },
      )

      // Debug Log: Output
      logDebugData(`${String(templateId)}_output`, {
        output: geminiResult.raw || JSON.stringify(geminiResult.data),
        meta: {
          modelId,
          elapsed: Date.now() - start,
          usage: geminiResult.usage,
          ok: geminiResult.ok,
          error: geminiResult.error,
          serviceId: context.serviceId,
        },
      })

      if (!geminiResult.ok) {
        return {
          ok: false,
          error: geminiResult.error,
          raw: geminiResult.raw || '',
          usage: geminiResult.usage,
        } as RunLlmTaskResult<T>
      }

      return {
        ok: true,
        data: geminiResult.data,
        raw: geminiResult.raw || '',
        usage: geminiResult.usage,
      } as RunLlmTaskResult<T>
    }

    // PHASE 2: LangChain Path (for other models or fallback)
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
            new SystemMessage(renderedSystemPrompt),
          ]

          if (hasVisionImage) {
            messages.push(
              new HumanMessage({
                content: [
                  {
                    type: 'text',
                    text: renderVariables((template as any).userPrompt, {
                      ...runtimeVariables,
                      image: '[attached]',
                    }),
                  },
                  {
                    type: 'image_url',
                    image_url: { url: String(variables['image']) },
                  },
                ],
              }),
            )
          } else {
            messages.push(
              new HumanMessage(
                renderVariables((template as any).userPrompt, runtimeVariables),
              ),
            )
          }

          return structuredModel.invoke(messages)
        }

        // Case B: Legacy/Standard Provider Path (e.g. Zhipu GLM)
        if (hasVisionImage) {
          // Standardize message structure: separate system prompt and schema instruction
          // This aligns with how ChatPromptTemplate is constructed for text tasks
          // and relies on the model's ability to handle multiple system messages (common in modern providers)
          const legacyMessages: BaseMessage[] = [
            new SystemMessage(renderedSystemPrompt),
            new SystemMessage(
              `You MUST output a single valid JSON object that conforms to the following JSON Schema. Do NOT include any prose or code fences.\n\nJSON Schema:\n${schemaJson}`,
            ),
          ]

          legacyMessages.push(
            new HumanMessage({
              content: [
                {
                  type: 'text',
                  text: renderVariables((template as any).userPrompt, {
                    ...runtimeVariables,
                    image: '[attached]',
                  }),
                },
                {
                  type: 'image_url',
                  image_url: { url: String(variables['image']) },
                },
              ],
            }),
          )

          return model.invoke(legacyMessages)
        }

        // Standard Text Task (Legacy)
        return chain.invoke(runtimeVariables)
      },
      tier,
      retryContext,
    )

    // Hybrid Result Processing
    let content: string = ''
    let inputTokens = 0
    let outputTokens = 0
    let parsedData: any = null
    let preValidated = false

    // Case A: Structured Output ({ parsed, raw })
    if (
      result &&
      typeof result === 'object' &&
      'parsed' in result &&
      'raw' in result
    ) {
      parsedData = result.parsed
      preValidated = true
      content = JSON.stringify(result.parsed)
      const usage = extractTokenUsageFromMessage(result.raw)
      inputTokens = usage.inputTokens
      outputTokens = usage.outputTokens

      // DEBUG: If parsed is null, investigate why LangChain withStructuredOutput fails
      // Key question: is it Zod validation or LangChain's internal schema conversion?
      if (parsedData === null && ENV.LOG_DEBUG) {
        const rawContent = (result.raw as any)?.content
        logDebug({
          reqId: context.serviceId || 'llm',
          route: 'llm/structured',
          phase: 'structured_parsed_null',
          meta: {
            rawContentType: typeof rawContent,
            schemaName: schema?.description || 'no description',
          },
        })

        // Check if there's a parsing_error in the result
        if ((result as any).parsing_error) {
          logDebug({
            reqId: context.serviceId || 'llm',
            route: 'llm/structured',
            phase: 'structured_parsing_error',
            meta: { parsingError: (result as any).parsing_error },
          })
        }

        // Save full raw content to file for analysis
        if (process.env.NODE_ENV !== 'production') {
          logDebugData(`structured_raw_${context.serviceId || 'llm'}`, {
            meta: {
              schemaName: schema?.description || 'no description',
              timestamp: new Date().toISOString(),
            },
            output:
              typeof rawContent === 'string'
                ? rawContent
                : JSON.stringify(rawContent, null, 2),
          })
          logDebug({
            reqId: context.serviceId || 'llm',
            route: 'llm/structured',
            phase: 'structured_raw_saved',
          })
        }

        // Try manual safeParse to compare with LangChain
        if (typeof rawContent === 'string') {
          try {
            const parsed = JSON.parse(rawContent)
            const validateResult = schema.safeParse(parsed)
            if (!validateResult.success) {
              logDebug({
                reqId: context.serviceId || 'llm',
                route: 'llm/structured',
                phase: 'manual_safeparse_failed',
                meta: { issues: validateResult.error.issues },
              })
            } else {
              logDebug({
                reqId: context.serviceId || 'llm',
                route: 'llm/structured',
                phase: 'manual_safeparse_succeeded',
              })
            }
          } catch (e) {
            logDebug({
              reqId: context.serviceId || 'llm',
              route: 'llm/structured',
              phase: 'manual_json_parse_error',
              error: e instanceof Error ? e : String(e),
            })
          }
        }
      }
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
      meta: {
        inputTokens,
        outputTokens,
        mode: preValidated ? 'structured' : 'legacy',
        serviceId: context.serviceId,
      },
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
        usageLogId: (log as any)?.id, // M5: Return unified usage log ID
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
        : ((safe as any)?.error?.message ?? 'zod_validation_failed')
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
    const errorCode = mapErrorToCode(error)
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
      ...(errorCode ? { errorCode } : {}),
      ...(context.userId ? { userId: context.userId } : {}),
      ...(context.serviceId ? { serviceId: context.serviceId } : {}),
    })
    logError({
      reqId: context.serviceId || 'llm',
      route: 'llm/structured',
      phase: 'structured_error',
      error: mapErrorToMessage(error),
      meta: { templateId, modelId },
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

function mapErrorToCode(error: any): FailureCode | undefined {
  const message = error instanceof Error ? error.message : String(error)
  const normalized = message.toLowerCase()
  if (
    normalized.includes('timeout') ||
    normalized.includes('timed out') ||
    normalized.includes('deadline')
  ) {
    return FailureCode.MODEL_TOO_BUSY
  }
  if (normalized.includes('parse') || normalized.includes('json')) {
    return FailureCode.JSON_PARSE_FAILED
  }
  return undefined
}

export async function runStreamingLlmTask<T extends TaskTemplateId>(
  modelId: ModelId,
  templateId: T,
  locale: Locale,
  variables: Record<string, any>,
  context: TaskContext = {},
  options: RunTaskOptions = {},
  onToken?: (t: string) => void | Promise<void>,
) {
  const start = Date.now()
  const template = getTemplate(locale, templateId)
  const runtimeVariables = {
    ...variables,
    current_date: new Date().toISOString().slice(0, 10),
    ui_locale: getUiLocaleLabel(locale),
  }
  const renderedSystemPrompt = renderVariables(
    template.systemPrompt,
    runtimeVariables,
  )

  // Debug Log: Input (Streaming)
  logDebugData(`${String(templateId)}_stream_input`, {
    input: JSON.stringify({
      system: renderedSystemPrompt,
      user: template.userPrompt,
      variables: runtimeVariables,
    }),
    meta: { modelId, serviceId: context.serviceId },
  })

  // PHASE 1: Gemini Direct Streaming Path (bypasses LangChain)
  // For Gemini 3 models, use native API for better streaming reliability
  if (shouldUseGeminiDirect(modelId)) {
    logDebug({
      reqId: context.serviceId || 'llm',
      route: 'llm/stream',
      phase: 'gemini_direct_stream',
      templateId: String(templateId),
    })

    const limits = getTaskLimits(String(templateId))

    // Check for image in variables (renderVariables renders it as text if we don't handle it,
    // but we need to pass it separately to the vision API)
    // For vision tasks, we should replace the {image} placeholder with [attached] in text prompt
    // to avoid dumping base64 into the text part.
    const hasImage =
      variables['image'] && typeof variables['image'] === 'string'

    const renderedUserPrompt = renderVariables(template.userPrompt, {
      ...runtimeVariables,
      ...(hasImage ? { image: '[attached]' } : {}),
    })

    const schema = getTaskSchema(templateId)

    const geminiResult = await runGeminiStreaming(
      renderedSystemPrompt,
      renderedUserPrompt,
      schema,
      {
        maxOutputTokens: limits.maxTokens,
        ...(options.timeoutMs !== undefined
          ? { timeoutMs: options.timeoutMs }
          : {}),
        ...(options.temperature !== undefined
          ? { temperature: options.temperature }
          : {}),
      },
      onToken,
      hasImage ? variables['image'] : undefined,
    )

    const end = Date.now()

    // Debug Log: Output (Streaming)
    logDebugData(`${String(templateId)}_stream_output`, {
      output: geminiResult.raw || JSON.stringify(geminiResult.data),
      latencyMs: end - start,
      meta: {
        len: geminiResult.raw?.length || 0,
        ok: geminiResult.ok,
        serviceId: context.serviceId,
      },
    })

    // Log usage (estimate if not provided)
    const inputTokens = Math.ceil(renderedUserPrompt.length / 4)
    const outputTokens = Math.ceil((geminiResult.raw?.length || 0) / 4)

    // Fail-safe Usage Log: Record failure in llm_usage_logs
    const logParams: any = {
      taskTemplateId: templateId,
      provider: 'gemini',
      modelId,
      inputTokens: Math.ceil(renderedUserPrompt.length / 4),
      outputTokens: 0,
      latencyMs: end - start,
      cost: 0,
      isStream: true,
      isSuccess: geminiResult.ok,
      ...(context.userId ? { userId: context.userId } : {}),
      ...(context.serviceId ? { serviceId: context.serviceId } : {}),
    }
    if (geminiResult.error) {
      logParams.errorMessage = geminiResult.error
      const code = mapErrorToCode(geminiResult.error)
      if (code) {
        logParams.errorCode = code
      }
    }

    const log = await createLlmUsageLogDetailed(logParams)

    if (!geminiResult.ok) {
      return {
        ok: false,
        error: geminiResult.error,
        raw: geminiResult.raw || '',
        usageLogId: (log as any)?.id,
      } as RunLlmTaskResult<T>
    }

    return {
      ok: true,
      raw: geminiResult.raw || '',
      data: geminiResult.data,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
      },
    } as RunLlmTaskResult<T>
  }

  // PHASE 2: LangChain Streaming Path (for other models)
  try {
    const prompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(renderedSystemPrompt),
      HumanMessagePromptTemplate.fromTemplate(template.userPrompt),
    ])
    const limits = getTaskLimits(String(templateId))
    const model = getModel(modelId, {
      temperature: options.temperature ?? 0.3,
      timeoutMs: options.timeoutMs ?? ENV.WORKER_TIMEOUT_MS,
      maxTokens: options.maxTokens ?? limits.maxTokens,
      jsonMode: true, // 强制 JSON 输出模式
    })
    const chain = prompt.pipe(model)

    // Stream tokens to consumer; when finished, log usage
    const stream = await chain.stream(runtimeVariables)
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
      meta: { len: fullText.length, serviceId: context.serviceId },
    })

    // token usage may be available on model after stream; best-effort
    let { inputTokens, outputTokens } = extractTokenUsageFromModel(model)
    if (!inputTokens && !outputTokens) {
      try {
        const estIn = Math.ceil(JSON.stringify(variables).length / 4)
        const estOut = Math.ceil(fullText.length / 4)
        inputTokens = estIn
        outputTokens = estOut
      } catch {}
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
    const errorCode = mapErrorToCode(error)

    // Fail-safe Debug Log: Capture error details
    logDebugData(`${String(templateId)}_stream_output`, {
      output: '',
      latencyMs: end - start,
      meta: { len: 0, error: errorMessage, serviceId: context.serviceId },
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
      ...(errorCode ? { errorCode } : {}),
      ...(context.userId ? { userId: context.userId } : {}),
      ...(context.serviceId ? { serviceId: context.serviceId } : {}),
    })
    logError({
      reqId: context.serviceId || 'llm',
      route: 'llm/stream',
      phase: 'stream_error',
      error: errorMessage,
      meta: {
        templateId,
        modelId,
        latencyMs: end - start,
      },
    })

    return {
      ok: false,
      raw: '',
      error: errorMessage,
      usageLogId: (log as any)?.id,
    } as RunLlmTaskResult<T>
  }
}
