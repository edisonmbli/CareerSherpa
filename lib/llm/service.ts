import type { Locale } from '@/i18n-config'
import { getTemplate } from '@/lib/prompts/index'
import type { TaskTemplateId } from '@/lib/prompts/types'
import { getModel, type ModelId } from '@/lib/llm/providers'
import { routeTask } from '@/lib/llm/task-router'
import { ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate } from '@langchain/core/prompts'
import { getTaskSchema, type TaskOutput } from '@/lib/llm/zod-schemas'
import { validateJson } from '@/lib/llm/json-validator'
import { createLlmUsageLogDetailed } from '@/lib/dal/llmUsageLog'
import { getProvider, getCost } from '@/lib/llm/utils'
import { glmEmbeddingProvider } from '@/lib/llm/embeddings'

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
    // 支持 {{var}} 与 {{ var }} 两种写法
    const pattern = new RegExp(`{{\s*${key}\s*}}`, 'g')
    rendered = rendered.replace(pattern, val ?? '')
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
  const hasImage = options.hasImage ?? Boolean(variables['image'] || variables['jobImage'])
  const decision = routeTask(
    taskId,
    userHasQuota,
    {
      hasImage,
      // exactOptionalPropertyTypes: 仅在定义时传入，否则省略
      ...(options.preferReasoning !== undefined
        ? { preferReasoning: options.preferReasoning }
        : {})
    }
  )

  if (decision.worker === 'stream') {
    return runStreamingLlmTask(decision.modelId, taskId, locale, variables, {}) as Promise<RunLlmTaskResult<T>>
  }
  return runStructuredLlmTask(decision.modelId, taskId, locale, variables, {})
}

// --- M4 additions: structured & streaming entry points ---
interface TaskContext {
  userId?: string
  serviceId?: string
}

// Robust token usage extraction helpers for heterogeneous providers
function extractTokenUsageFromMessage(msg: any) {
  const usage =
    msg?.response_metadata?.tokenUsage ||
    msg?.response_metadata?.token_usage ||
    msg?.additional_kwargs?.usage ||
    msg?.metadata?.usage

  const inputTokens =
    usage?.prompt_tokens ?? usage?.input_tokens ?? usage?.promptTokens ?? 0
  const outputTokens =
    usage?.completion_tokens ?? usage?.output_tokens ?? usage?.completionTokens ?? 0
  return { inputTokens: Number(inputTokens) || 0, outputTokens: Number(outputTokens) || 0 }
}

function extractTokenUsageFromModel(model: any) {
  const usage =
    model?.lc_serializable?.tokenUsage ||
    model?.lc_serializable?.token_usage ||
    model?.tokenUsage
  const inputTokens =
    usage?.promptTokens ?? usage?.prompt_tokens ?? usage?.input_tokens ?? 0
  const outputTokens =
    usage?.completionTokens ?? usage?.completion_tokens ?? usage?.output_tokens ?? 0
  return { inputTokens: Number(inputTokens) || 0, outputTokens: Number(outputTokens) || 0 }
}

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
    return { ok: false, error: error instanceof Error ? error.message : 'unknown_error' }
  }
}

/**
 * 批量生成嵌入，保持统一入口与日志记录（按批汇总）
 */
export async function runEmbeddingBatch(
  texts: string[],
  context: TaskContext = {}
): Promise<{ ok: boolean; vectors?: number[][]; error?: string; usage?: { inputTokens?: number; totalTokens?: number; cost?: number; model?: string; provider?: string; dimensions?: number } }> {
  const start = Date.now()
  try {
    const results = await glmEmbeddingProvider.embedBatch(texts)
    const vectors = results.map((r) => r.embedding)
    const inputTokens = results.reduce((sum, r) => sum + Number(r.usage?.totalTokens ?? 0), 0)

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
    return { ok: false, error: error instanceof Error ? error.message : 'unknown_error' }
  }
}

export async function runStructuredLlmTask<T extends TaskTemplateId>(
  modelId: ModelId,
  templateId: T,
  locale: Locale,
  variables: Record<string, any>,
  context: TaskContext = {}
): Promise<RunLlmTaskResult<T>> {
  const start = Date.now()
  try {
    const template = getTemplate(locale, templateId)
    const prompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(template.systemPrompt),
      HumanMessagePromptTemplate.fromTemplate(template.userPrompt),
    ])
    const model = getModel(modelId, { temperature: 0.3 })

    const chain = prompt.pipe(model)
    const aiMessage = await chain.invoke(variables)
    const { inputTokens, outputTokens } = extractTokenUsageFromMessage(aiMessage)

    const content: string = (aiMessage as any)?.content ?? (aiMessage as any)?.text ?? ''
    const parsed = validateJson(content)
    if (!parsed.success || !parsed.data) {
      await createLlmUsageLogDetailed({
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
      return { ok: false, raw: content, error: parsed.error ?? 'json_parse_failed' }
    }

    const schema = getTaskSchema(templateId)
    const safe = schema.safeParse(parsed.data)
    const ok = safe.success

    await createLlmUsageLogDetailed({
      taskTemplateId: templateId,
      provider: getProvider(modelId),
      modelId,
      inputTokens,
      outputTokens,
      latencyMs: Date.now() - start,
      cost: getCost(modelId, inputTokens, outputTokens),
      isStream: false,
      isSuccess: ok,
      ...(ok ? {} : { errorMessage: (safe as any)?.error?.message }),
      ...(context.userId ? { userId: context.userId } : {}),
      ...(context.serviceId ? { serviceId: context.serviceId } : {}),
    })

    if (!ok) {
      return {
        ok: false,
        raw: content,
        error: (safe as any)?.error?.message ?? 'zod_validation_failed',
      }
    }

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
    }
  } catch (error) {
    await createLlmUsageLogDetailed({
      taskTemplateId: templateId,
      provider: getProvider(modelId),
      modelId,
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

export async function runStreamingLlmTask<T extends TaskTemplateId>(
  modelId: ModelId,
  templateId: T,
  locale: Locale,
  variables: Record<string, any>,
  context: TaskContext = {}
) {
  const start = Date.now()
  const template = getTemplate(locale, templateId)
  const prompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(template.systemPrompt),
    HumanMessagePromptTemplate.fromTemplate(template.userPrompt),
  ])
  const model = getModel(modelId, { temperature: 0.3 })
  const chain = prompt.pipe(model)

  // Stream tokens to consumer; when finished, log usage
  const stream = await chain.stream(variables)
  let fullText = ''
  for await (const chunk of stream) {
    const text = (chunk as any)?.content ?? (chunk as any)?.text ?? ''
    fullText += text
  }
  const end = Date.now()

  // token usage may be available on model after stream; best-effort
  const { inputTokens, outputTokens } = extractTokenUsageFromModel(model)

  await createLlmUsageLogDetailed({
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
  } as RunLlmTaskResult<T>
}