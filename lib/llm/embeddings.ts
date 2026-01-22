/**
 * GLM Embedding-3 模型集成
 * 用于生成文档和查询的向量嵌入
 */

import { ENV } from '@/lib/env'

export interface EmbeddingConfig {
  model: string
  dimensions: number
  maxTokens: number
  batchSize: number
}

export interface EmbeddingResult {
  embedding: number[]
  usage?: {
    totalTokens: number
  }
}

export interface EmbeddingProvider {
  name: string
  isReady(): boolean
  embed(text: string): Promise<EmbeddingResult>
  embedBatch(texts: string[]): Promise<EmbeddingResult[]>
  getDimensions(): number
}

/**
 * GLM Embedding-3 Provider
 */
export class GLMEmbeddingProvider implements EmbeddingProvider {
  name = 'glm-embedding-3'
  private config: EmbeddingConfig

  constructor(config?: Partial<EmbeddingConfig>) {
    this.config = {
      model: 'embedding-3',
      dimensions: 2048,
      maxTokens: 8192,
      // 许多嵌入 API 对每次请求的数组长度有限制，保守默认 16
      batchSize: 16,
      ...config,
    }
  }

  isReady(): boolean {
    return !!ENV.ZHIPUAI_API_KEY
  }

  async embed(text: string): Promise<EmbeddingResult> {
    if (!this.isReady()) {
      throw new Error('GLM API key not configured')
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout

      const response = await fetch(
        'https://open.bigmodel.cn/api/paas/v4/embeddings',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${ENV.ZHIPUAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.config.model,
            input: text,
            dimensions: this.config.dimensions,
          }),
          signal: controller.signal,
        },
      ).finally(() => clearTimeout(timeoutId))

      if (!response.ok) {
        throw new Error(
          `GLM API error: ${response.status} ${response.statusText}`,
        )
      }

      const data = await response.json()

      if (!data.data || !data.data[0] || !data.data[0].embedding) {
        throw new Error('Invalid embedding response from GLM API')
      }

      const result: EmbeddingResult = {
        embedding: data.data[0].embedding,
      }

      if (data.usage) {
        result.usage = {
          totalTokens: data.usage.total_tokens,
        }
      }

      return result
    } catch (error) {
      console.error('GLM embedding error:', error)
      throw error
    }
  }

  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    if (!this.isReady()) {
      throw new Error('GLM API key not configured')
    }

    // 分批处理以避免超过API限制
    const results: EmbeddingResult[] = []
    const batchSize = Math.max(1, Math.min(this.config.batchSize, 16))

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize)
      const cleanBatch = batch
        .map((t) => (typeof t === 'string' ? t.trim() : ''))
        .filter((t) => t.length > 0)
      if (cleanBatch.length === 0) continue

      try {
        const response = await fetch(
          'https://open.bigmodel.cn/api/paas/v4/embeddings',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${ENV.ZHIPUAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: this.config.model,
              input: cleanBatch,
              dimensions: this.config.dimensions,
            }),
          },
        )

        if (!response.ok) {
          const bodyText = await response.text().catch(() => '')
          throw new Error(
            `GLM API error: ${response.status} ${response.statusText} ${bodyText}`,
          )
        }

        const data = await response.json()

        if (!data.data || !Array.isArray(data.data)) {
          throw new Error('Invalid batch embedding response from GLM API')
        }

        const batchResults = data.data.map((item: any) => ({
          embedding: item.embedding,
          usage: data.usage
            ? {
                totalTokens: Math.floor(data.usage.total_tokens / batch.length),
              }
            : undefined,
        }))

        results.push(...batchResults)
      } catch (error) {
        console.error(
          `GLM batch embedding error for batch ${i / batchSize + 1}:`,
          error,
        )
        throw error
      }
    }

    return results
  }

  getDimensions(): number {
    return this.config.dimensions
  }
}

// 全局嵌入提供商实例
export const glmEmbeddingProvider = new GLMEmbeddingProvider({
  // 允许通过环境变量控制每次请求的批大小，但仍做上限保护
  batchSize: Math.max(1, Math.min(ENV.BATCH_OPERATION_SIZE || 10, 16)),
})

/**
 * 便捷函数：生成单个文本的嵌入
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const result = await glmEmbeddingProvider.embed(text)
  return result.embedding
}

/**
 * 便捷函数：批量生成嵌入
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const results = await glmEmbeddingProvider.embedBatch(texts)
  return results.map((result) => result.embedding)
}

/**
 * 获取嵌入维度
 */
export function getEmbeddingDimensions(): number {
  return glmEmbeddingProvider.getDimensions()
}
