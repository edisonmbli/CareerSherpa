import { ChatZhipuAI } from '@langchain/community/chat_models/zhipuai'
import { ChatOpenAI } from '@langchain/openai'
import { ChatDeepSeek } from '@langchain/deepseek'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import { ENV } from '../env'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { generateEmbedding, generateEmbeddings, getEmbeddingDimensions } from './embeddings'
import { logDebug } from '@/lib/logger'

export interface LLMConfig {
  model: string
  maxTokens?: number
  temperature?: number
  timeout?: number // 以毫秒为单位（与 LangChain/OpenAI 客户端一致）
  provider: 'zhipu' | 'deepseek' | 'openai'
  tier: 'free' | 'paid'
  jsonMode?: boolean // 启用 JSON 输出模式 (response_format / responseMimeType)
}

export interface LLMResponse {
  content: string
  usage?: {
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
    cost?: number
  }
  metadata?: any
  prompt?: string
  modelConfig?: {
    model: string
    provider: string
    maxTokens?: number
    temperature?: number
  }
}

export interface LLMProvider {
  name: string
  tier: 'free' | 'paid'
  isReady(): boolean
  createModel(config: LLMConfig): any
  parseResponse(response: any): LLMResponse
}

/**
 * 智谱AI Provider
 */
export class ZhipuProvider implements LLMProvider {
  name = 'zhipu'
  tier: 'free' | 'paid' = 'free'

  isReady(): boolean {
    return !!ENV.ZHIPUAI_API_KEY
  }

  createModel(config: LLMConfig) {
    if (!this.isReady()) {
      throw new Error('Zhipu API key not configured')
    }

    return new ChatZhipuAI({
      apiKey: ENV.ZHIPUAI_API_KEY,
      model: config.model,
      temperature: config.temperature ?? 0.3,
      maxTokens: config.maxTokens ?? this.getDefaultMaxTokens(config.model),
      // JSON Mode: GLM API 可能支持 response_format，但 LangChain 封装尚未验证
      // 如果 ChatZhipuAI 不支持此参数，将被忽略
      ...(config.jsonMode && {
        modelKwargs: {
          response_format: { type: 'json_object' }
        }
      }),
    })
  }

  parseResponse(response: any): LLMResponse {
    const content = response?.content || ''
    const usage =
      response?.response_metadata?.tokenUsage ||
      response?.response_metadata?.token_usage ||
      response?.additional_kwargs?.usage

    const result: LLMResponse = {
      content,
      metadata: response?.response_metadata,
    }

    if (usage) {
      result.usage = {
        inputTokens: usage.prompt_tokens || usage.input_tokens,
        outputTokens: usage.completion_tokens || usage.output_tokens,
        totalTokens: usage.total_tokens || usage.totalTokens,
      }
    }

    return result
  }

  private getDefaultMaxTokens(model: string): number {
    // 基于智谱官网信息：GLM-4.5和GLM-4.5-Flash的max_tokens限制为65536
    if (
      model.includes('thinking') ||
      model.includes('vision') ||
      model.includes('1v')
    ) {
      return 16000 // 视觉模型提高到16000
    }
    if (model.includes('flash') || model.includes('glm-4.5')) {
      return 30000 // GLM-4.5和GLM-4.5-Flash提高到30000
    }
    return 4000 // 其他模型保持默认
  }
}

/**
 * DeepSeek Provider
 */
export class DeepSeekProvider implements LLMProvider {
  name = 'deepseek'
  tier: 'free' | 'paid' = 'paid'

  isReady(): boolean {
    return !!ENV.DEEPSEEK_API_KEY
  }

  createModel(config: LLMConfig) {
    if (!this.isReady()) {
      throw new Error('DeepSeek API key not configured')
    }

    return new ChatDeepSeek({
      apiKey: ENV.DEEPSEEK_API_KEY,
      model: config.model,
      temperature: config.temperature ?? 0.3,
      maxTokens: config.maxTokens ?? 4000,
      timeout: config.timeout ?? 180000, // 毫秒；默认3分钟
      // JSON Mode: 强制模型输出有效 JSON
      ...(config.jsonMode && {
        modelKwargs: {
          response_format: { type: 'json_object' }
        }
      }),
    })
  }

  parseResponse(response: any): LLMResponse {
    const content = response?.content || ''
    const usage =
      response?.response_metadata?.tokenUsage ||
      response?.additional_kwargs?.usage

    const result: LLMResponse = {
      content,
      metadata: response?.response_metadata,
    }

    if (usage) {
      result.usage = {
        inputTokens: usage.prompt_tokens,
        outputTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      }
    }

    return result
  }
}

/**
 * OpenAI Provider (for embeddings and fallback)
 */
export class OpenAIProvider implements LLMProvider {
  name = 'openai'
  tier: 'free' | 'paid' = 'paid'

  isReady(): boolean {
    return !!ENV.OPENAI_API_KEY
  }

  createModel(config: LLMConfig) {
    if (!this.isReady()) {
      throw new Error('OpenAI API key not configured')
    }

    return new ChatOpenAI({
      apiKey: ENV.OPENAI_API_KEY,
      model: config.model,
      temperature: config.temperature ?? 0.3,
      maxTokens: config.maxTokens ?? 4000,
      timeout: config.timeout ?? 180000, // 毫秒；默认3分钟
    })
  }

  parseResponse(response: any): LLMResponse {
    const content = response?.content || ''
    const usage =
      response?.response_metadata?.tokenUsage ||
      response?.additional_kwargs?.usage

    const result: LLMResponse = {
      content,
      metadata: response?.response_metadata,
    }

    if (usage) {
      result.usage = {
        inputTokens: usage.prompt_tokens,
        outputTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      }
    }

    return result
  }
}

/**
 * Gemini Provider (for Free tier)
 * Server-side only - API key must never be exposed to client
 */
export class GeminiProvider implements LLMProvider {
  name = 'gemini'
  tier: 'free' | 'paid' = 'free'

  isReady(): boolean {
    return !!process.env['GEMINI_API_KEY']
  }

  createModel(config: LLMConfig) {
    if (!this.isReady()) {
      throw new Error('Gemini API key not configured')
    }

    // Anti-repetition params per docs/53.Gemini_Repeat_Issue_Fix.md
    // Note: TypeScript types may be outdated, but runtime API supports these params
    const antiRepetitionConfig = {
      frequencyPenalty: 0.5, // Strong penalty to break repetition loops
      presencePenalty: 0.3,  // Encourage new content
    }

    // CRITICAL: Gemini 3 MUST use temperature=1.0
    // Per official docs: "Changing the temperature (setting it below 1.0) may lead to 
    // unexpected behavior, such as looping or degraded performance"
    // See: https://ai.google.dev/gemini-api/docs/gemini-3
    const gemini3Temperature = 1.0

    logDebug({
      reqId: 'llm',
      route: 'llm/providers',
      phase: 'gemini_create_model',
      meta: {
        model: config.model || 'gemini-3-flash-preview',
        temperature: gemini3Temperature,
        maxOutputTokens: config.maxTokens ?? 8000,
        ...antiRepetitionConfig,
        jsonMode: config.jsonMode,
      },
    })

    // frequencyPenalty/presencePenalty types may be outdated but runtime API supports them
    return new ChatGoogleGenerativeAI({
      apiKey: process.env['GEMINI_API_KEY']!,
      model: config.model || 'gemini-3-flash-preview',
      temperature: gemini3Temperature, // MUST be 1.0 for Gemini 3 to prevent looping
      maxOutputTokens: config.maxTokens ?? 8000,
      // NOTE: Removed stopSequences as they may cause premature termination
      // temperature=1.0 should handle looping prevention per Gemini 3 docs
      // Anti-repetition penalties (runtime supported even if types outdated)
      ...antiRepetitionConfig,
      // JSON Mode (for non-structured output paths)
      json: config.jsonMode ?? false,
    })
  }

  parseResponse(response: any): LLMResponse {
    const content = response?.content || ''
    const usage =
      response?.response_metadata?.tokenUsage ||
      response?.usage_metadata ||
      response?.additional_kwargs?.usage

    const result: LLMResponse = {
      content,
      metadata: response?.response_metadata,
    }

    if (usage) {
      result.usage = {
        inputTokens: usage.prompt_tokens || usage.promptTokenCount || usage.input_tokens,
        outputTokens: usage.completion_tokens || usage.candidatesTokenCount || usage.output_tokens,
        totalTokens: usage.total_tokens || usage.totalTokenCount,
      }
    }

    return result
  }
}

/**
 * Provider Registry
 */
export class ProviderRegistry {
  private providers = new Map<string, LLMProvider>()

  constructor() {
    this.register(new ZhipuProvider())
    this.register(new DeepSeekProvider())
    this.register(new OpenAIProvider())
    this.register(new GeminiProvider())
  }

  register(provider: LLMProvider) {
    this.providers.set(provider.name, provider)
  }

  get(name: string): LLMProvider | undefined {
    return this.providers.get(name)
  }

  getAvailable(tier?: 'free' | 'paid'): LLMProvider[] {
    return Array.from(this.providers.values()).filter(
      (p) => p.isReady() && (!tier || p.tier === tier)
    )
  }

  getPreferred(tier: 'free' | 'paid'): LLMProvider | null {
    const available = this.getAvailable(tier)
    if (available.length === 0) return null

    // Preference order
    if (tier === 'free') {
      return available.find((p) => p.name === 'zhipu') || available[0] || null
    } else {
      return (
        available.find((p) => p.name === 'deepseek') ||
        available.find((p) => p.name === 'openai') ||
        available[0] ||
        null
      )
    }
  }
}

// Global registry instance
export const providerRegistry = new ProviderRegistry()

/**
 * Model configurations for different use cases
 */
export const MODEL_CONFIGS = {
  // Free tier models
  free: {
    text: {
      provider: 'zhipu' as const,
      model: ENV.ZHIPU_TEXT_MODEL || 'glm-4.5-flash',
      tier: 'free' as const,
      maxTokens: 30000, // 提高到30000以支持detailed_resume任务，GLM-4.5-Flash官方限制65536
    },
    vision: {
      provider: 'zhipu' as const,
      model: ENV.ZHIPU_VISION_MODEL || 'glm-4.1v-thinking-flash',
      tier: 'free' as const,
      maxTokens: 16000, // 视觉模型也适当提高
    },
  },
  // Paid tier models
  paid: {
    text: {
      provider: 'deepseek' as const,
      model: 'deepseek-chat',
      tier: 'paid' as const,
      maxTokens: 8000,
    },
    // text_fallback: {
    //   provider: 'zhipu' as const,
    //   model: 'glm-4.5',
    //   tier: 'paid' as const,
    //   maxTokens: 30000, // GLM-4.5官方限制65536，提高到30000
    // },
    reasoning: {
      provider: 'deepseek' as const,
      model: 'deepseek-reasoner',
      tier: 'paid' as const,
      maxTokens: 30000, // 提升到30000以支持detailed_resume任务
    },
    vision: {
      provider: 'zhipu' as const,
      model: ENV.ZHIPU_VISION_MODEL || 'glm-4.1v-thinking-flash',
      tier: 'paid' as const,
      maxTokens: 16000, // 视觉模型也适当提高
    },
  },
} as const

/**
 * Get model configuration for a specific use case
 */
// export function getModelConfig(
//   tier: 'free' | 'paid',
//   type: 'text' | 'vision' | 'reasoning' | 'text_fallback' = 'text'
// ): LLMConfig {
//   const configs = MODEL_CONFIGS[tier]

//   if (type === 'reasoning' && tier === 'paid') {
//     return (configs as typeof MODEL_CONFIGS.paid).reasoning
//   }

//   if (type === 'text_fallback' && tier === 'paid') {
//     return (configs as typeof MODEL_CONFIGS.paid).text_fallback
//   }

//   if (type === 'vision' && configs.vision) {
//     return configs.vision
//   }

//   return configs.text
// }

// --- M4: Export canonical ModelId and getModel per routing table ---
// 运行时可用的模型 ID 常量，避免仅类型导出导致的运行时 undefined
export const ModelId = {
  DEEPSEEK_REASONER: 'deepseek-reasoner',
  DEEPSEEK_CHAT: 'deepseek-chat',
  GLM_45_FLASH: 'glm-4.5-flash',
  GLM_VISION_THINKING_FLASH: 'glm-4.1v-thinking-flash',
  GLM_EMBEDDING_3: 'glm-embedding-3',
  GEMINI_3_FLASH_PREVIEW: 'gemini-3-flash-preview',
} as const

export type ModelId = typeof ModelId[keyof typeof ModelId]

export function providerFromModelId(modelId: ModelId): 'deepseek' | 'zhipu' | 'gemini' {
  if (modelId.startsWith('deepseek')) return 'deepseek'
  if (modelId.startsWith('gemini')) return 'gemini'
  return 'zhipu'
}

export function getModel(
  modelId: ModelId,
  opts: { temperature?: number; maxTokens?: number; timeoutMs?: number; jsonMode?: boolean } = {}
): BaseChatModel {
  const { temperature, maxTokens, timeoutMs, jsonMode } = opts
  const timeout = timeoutMs ?? undefined
  // 收敛 provider 层的调试输出：参数确认交由路由层打印一次

  if (modelId === 'deepseek-reasoner') {
    // Prefer native DeepSeek adapter to avoid OpenAI adapter timeout issues
    const params: any = {
      apiKey: ENV.DEEPSEEK_API_KEY,
      model: 'deepseek-reasoner',
      ...(temperature !== undefined ? { temperature } : {}),
      ...(maxTokens !== undefined ? { maxTokens } : {}),
      ...(timeout !== undefined ? { timeout } : {}),
      // DeepSeek R1 Thinking Mode (if supported by API)
      modelKwargs: {
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
        extra_body: { thinking: { type: 'enabled' } }
      }
    }
    return new ChatDeepSeek(params)
  }

  if (modelId === 'deepseek-chat') {
    const params: any = {
      apiKey: ENV.DEEPSEEK_API_KEY,
      model: 'deepseek-chat',
      ...(temperature !== undefined ? { temperature } : {}),
      ...(maxTokens !== undefined ? { maxTokens } : {}),
      ...(timeout !== undefined ? { timeout } : {}),
      // JSON Mode: 强制输出有效 JSON
      ...(jsonMode ? { modelKwargs: { response_format: { type: 'json_object' } } } : {}),
    }
    return new ChatDeepSeek(params)
  }

  if (modelId === 'glm-4.5-flash') {
    const params: any = {
      apiKey: ENV.ZHIPUAI_API_KEY,
      model: 'glm-4.5-flash',
      ...(temperature !== undefined ? { temperature } : {}),
      ...(maxTokens !== undefined ? { maxTokens } : {}),
      ...(timeout !== undefined ? { timeout } : {}),
    }
    return new ChatZhipuAI(params)
  }

  if (modelId === 'glm-4.1v-thinking-flash') {
    const params: any = {
      apiKey: ENV.ZHIPUAI_API_KEY,
      model: 'glm-4.1v-thinking-flash',
      ...(temperature !== undefined ? { temperature } : {}),
      ...(maxTokens !== undefined ? { maxTokens } : {}),
      ...(timeout !== undefined ? { timeout } : {}),
    }
    return new ChatZhipuAI(params)
  }

  // Phase 1.5: Gemini for Free tier
  if (modelId === 'gemini-3-flash-preview') {
    if (!process.env['GEMINI_API_KEY']) {
      throw new Error('GEMINI_API_KEY not configured')
    }
    return new ChatGoogleGenerativeAI({
      apiKey: process.env['GEMINI_API_KEY'],
      model: 'gemini-3-flash-preview',
      ...(temperature !== undefined ? { temperature } : {}),
      ...(maxTokens !== undefined ? { maxOutputTokens: maxTokens } : {}),
      // JSON Mode: 强制输出有效 JSON
      ...(jsonMode ? { generationConfig: { responseMimeType: 'application/json' } } : {}),
    })
  }

  // Fallback: paid text
  const params: any = {
    apiKey: ENV.DEEPSEEK_API_KEY,
    baseURL: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    ...(temperature !== undefined ? { temperature } : {}),
    ...(maxTokens !== undefined ? { maxTokens } : {}),
    ...(timeout !== undefined ? { timeout } : {}),
  }
  return new ChatOpenAI(params)
}

/**
 * 返回一个兼容 LlamaIndex TS 的 EmbeddingModel
 * - 方法：getTextEmbedding / getTextEmbeddings
 * - 维度：通过 GLMEmbeddingProvider 的 getEmbeddingDimensions 保持 2048
 */
export function getLlamaIndexEmbeddingModel() {
  const dimensions = getEmbeddingDimensions()
  return {
    dimension: dimensions,
    // LlamaIndex TS 约定的方法名
    async getTextEmbedding(text: string): Promise<number[]> {
      return await generateEmbedding(text)
    },
    async getTextEmbeddings(texts: string[]): Promise<number[][]> {
      return await generateEmbeddings(texts)
    },
  }
}
