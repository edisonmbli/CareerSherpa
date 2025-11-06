import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mocks
const mockEmbed = vi.fn()
const mockEmbedBatch = vi.fn()

// capture detailed logs
const { createDetailedLog } = vi.hoisted(() => {
  return { createDetailedLog: vi.fn() }
})

vi.mock('@/lib/llm/embeddings', () => {
  return {
    glmEmbeddingProvider: {
      embed: (text: string) => mockEmbed(text),
      embedBatch: (texts: string[]) => mockEmbedBatch(texts),
      getDimensions: () => 2048,
    },
  }
})

vi.mock('@/lib/dal/llmUsageLog', () => {
  return {
    createLlmUsageLogDetailed: createDetailedLog,
    createLlmUsageLog: vi.fn(),
  }
})

vi.mock('@/lib/llm/utils', () => {
  return {
    getProvider: () => 'zhipu',
    getCost: () => 0.123,
  }
})

import { runEmbedding, runEmbeddingBatch } from '@/lib/llm/service'

describe('llm/service: embeddings unified entry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('runEmbedding returns vector and logs success', async () => {
    mockEmbed.mockResolvedValueOnce({ embedding: [0.1, 0.2], usage: { totalTokens: 100 } })

    const res = await runEmbedding('hello world', { userId: 'u1', serviceId: 'svc1' })

    expect(res.ok).toBe(true)
    expect(res.vector).toEqual([0.1, 0.2])
    expect(res.usage?.inputTokens).toBe(100)
    expect(res.usage?.totalTokens).toBe(100)
    const payload = createDetailedLog.mock.calls.pop()?.[0]
    expect(payload.taskTemplateId).toBe('rag_embedding')
    expect(payload.provider).toBe('zhipu')
    expect(payload.modelId).toBe('glm-embedding-3')
    expect(payload.inputTokens).toBe(100)
    expect(payload.outputTokens).toBe(0)
    expect(payload.isStream).toBe(false)
    expect(payload.isSuccess).toBe(true)
    expect(payload.userId).toBe('u1')
    expect(payload.serviceId).toBe('svc1')
  })

  it('runEmbedding handles error and logs failure', async () => {
    mockEmbed.mockRejectedValueOnce(new Error('embedding failed'))

    const res = await runEmbedding('oops', { userId: 'u2' })

    expect(res.ok).toBe(false)
    expect(res.error).toBe('embedding failed')
    const payload = createDetailedLog.mock.calls.pop()?.[0]
    expect(payload.isSuccess).toBe(false)
    expect(payload.errorMessage).toBe('embedding failed')
    expect(payload.taskTemplateId).toBe('rag_embedding')
  })

  it('runEmbeddingBatch returns vectors and logs aggregated tokens', async () => {
    mockEmbedBatch.mockResolvedValueOnce([
      { embedding: [1, 2], usage: { totalTokens: 10 } },
      { embedding: [3, 4], usage: { totalTokens: 20 } },
    ])

    const res = await runEmbeddingBatch(['a', 'b'], { userId: 'u3' })

    expect(res.ok).toBe(true)
    expect(res.vectors).toEqual([[1, 2], [3, 4]])
    expect(res.usage?.inputTokens).toBe(30)
    const payload = createDetailedLog.mock.calls.pop()?.[0]
    expect(payload.isSuccess).toBe(true)
    expect(payload.inputTokens).toBe(30)
    expect(payload.modelId).toBe('glm-embedding-3')
  })
})