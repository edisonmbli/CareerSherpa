import { ChatZhipuAI } from '@langchain/community/chat_models/zhipuai'
import { ChatOpenAI } from '@langchain/openai'
import { ENV } from '@/lib/env'

export interface LLMConfig {
  model: string
  maxTokens?: number
  temperature?: number
  provider: 'zhipu' | 'deepseek' | 'openai'
  tier: 'free' | 'paid'
}

export interface LLMResponse {
  content: string
  usage?: {
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
  }
  metadata?: any
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
    const usage = response?.response_metadata?.tokenUsage || 
                  response?.response_metadata?.token_usage ||
                  response?.additional_kwargs?.usage

    return {
      content,
      usage: usage ? {
        inputTokens: usage.prompt_tokens || usage.input_tokens,
        outputTokens: usage.completion_tokens || usage.output_tokens,
        totalTokens: usage.total_tokens || usage.totalTokens,
      } : undefined,
      metadata: response?.response_metadata
    }
  }

  private getDefaultMaxTokens(model: string): number {
    if (model.includes('thinking') || model.includes('vision') || model.includes('1v')) {
      return 8000
    }
    if (model.includes('flash')) {
      return 6000
    }
    return 4000
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

    return new ChatOpenAI({
      apiKey: ENV.DEEPSEEK_API_KEY,
      configuration: {
        baseURL: 'https://api.deepseek.com',
      },
      model: config.model,
      temperature: config.temperature ?? 0.3,
      maxTokens: config.maxTokens ?? 4000,
    })
  }

  parseResponse(response: any): LLMResponse {
    const content = response?.content || ''
    const usage = response?.response_metadata?.tokenUsage ||
                  response?.additional_kwargs?.usage

    return {
      content,
      usage: usage ? {
        inputTokens: usage.prompt_tokens,
        outputTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      } : undefined,
      metadata: response?.response_metadata
    }
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
    })
  }

  parseResponse(response: any): LLMResponse {
    const content = response?.content || ''
    const usage = response?.response_metadata?.tokenUsage ||
                  response?.additional_kwargs?.usage

    return {
      content,
      usage: usage ? {
        inputTokens: usage.prompt_tokens,
        outputTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      } : undefined,
      metadata: response?.response_metadata
    }
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
    return Array.from(this.providers.values())
      .filter(p => p.isReady() && (!tier || p.tier === tier))
  }

  getPreferred(tier: 'free' | 'paid'): LLMProvider | null {
    const available = this.getAvailable(tier)
    if (available.length === 0) return null

    // Preference order
    if (tier === 'free') {
      return available.find(p => p.name === 'zhipu') || available[0]
    } else {
      return available.find(p => p.name === 'deepseek') || 
             available.find(p => p.name === 'openai') || 
             available[0]
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
      maxTokens: 6000,
    },
    vision: {
      provider: 'zhipu' as const,
      model: ENV.ZHIPU_VISION_MODEL || 'glm-4.1v-thinking-flash',
      tier: 'free' as const,
      maxTokens: 8000,
    },
  },
  // Paid tier models
  paid: {
    text: {
      provider: 'deepseek' as const,
      model: 'deepseek-v3',
      tier: 'paid' as const,
      maxTokens: 4000,
    },
    reasoning: {
      provider: 'deepseek' as const,
      model: 'deepseek-reasoner',
      tier: 'paid' as const,
      maxTokens: 8000,
    },
    vision: {
      provider: 'zhipu' as const,
      model: ENV.ZHIPU_VISION_MODEL || 'glm-4.1v-thinking-flash',
      tier: 'paid' as const,
      maxTokens: 8000,
    },
  },
} as const

/**
 * Get model configuration for a specific use case
 */
export function getModelConfig(
  tier: 'free' | 'paid',
  type: 'text' | 'vision' | 'reasoning' = 'text'
): LLMConfig {
  const configs = MODEL_CONFIGS[tier]
  
  if (type === 'reasoning' && tier === 'paid') {
    return (configs as typeof MODEL_CONFIGS.paid).reasoning
  }
  
  if (type === 'vision' && configs.vision) {
    return configs.vision
  }
  
  return configs.text
}