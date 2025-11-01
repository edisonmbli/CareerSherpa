import { ChatZhipuAI } from '@langchain/community/chat_models/zhipuai'
import { ChatOpenAI } from '@langchain/openai'
import { ChatDeepSeek } from '@langchain/deepseek'
import { ENV } from '../env'

export interface LLMConfig {
  model: string
  maxTokens?: number
  temperature?: number
  timeout?: number // 添加 timeout 参数（以秒为单位）
  provider: 'zhipu' | 'deepseek' | 'openai'
  tier: 'free' | 'paid'
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

    // 将timeout从毫秒转换为秒，并确保有兜底值
    const timeoutInSeconds = config.timeout
      ? Math.ceil(config.timeout / 1000)
      : 180 // 默认3分钟

    return new ChatDeepSeek({
      apiKey: ENV.DEEPSEEK_API_KEY,
      model: config.model,
      temperature: config.temperature ?? 0.3,
      maxTokens: config.maxTokens ?? 4000,
      timeout: timeoutInSeconds, // DeepSeek期望秒
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

    // 将timeout从毫秒转换为秒，并确保有兜底值
    const timeoutInSeconds = config.timeout
      ? Math.ceil(config.timeout / 1000)
      : 180 // 默认3分钟

    return new ChatOpenAI({
      apiKey: ENV.OPENAI_API_KEY,
      model: config.model,
      temperature: config.temperature ?? 0.3,
      maxTokens: config.maxTokens ?? 4000,
      timeout: timeoutInSeconds, // OpenAI期望秒
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
 * Provider Registry
 */
export class ProviderRegistry {
  private providers = new Map<string, LLMProvider>()

  constructor() {
    this.register(new ZhipuProvider())
    this.register(new DeepSeekProvider())
    this.register(new OpenAIProvider())
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
    text_fallback: {
      provider: 'zhipu' as const,
      model: 'glm-4.5',
      tier: 'paid' as const,
      maxTokens: 30000, // GLM-4.5官方限制65536，提高到30000
    },
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
export function getModelConfig(
  tier: 'free' | 'paid',
  type: 'text' | 'vision' | 'reasoning' | 'text_fallback' = 'text'
): LLMConfig {
  const configs = MODEL_CONFIGS[tier]

  if (type === 'reasoning' && tier === 'paid') {
    return (configs as typeof MODEL_CONFIGS.paid).reasoning
  }

  if (type === 'text_fallback' && tier === 'paid') {
    return (configs as typeof MODEL_CONFIGS.paid).text_fallback
  }

  if (type === 'vision' && configs.vision) {
    return configs.vision
  }

  return configs.text
}
