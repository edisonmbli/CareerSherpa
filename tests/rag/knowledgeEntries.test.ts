import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Document } from 'llamaindex'

// Mock PGVectorStore used by DAL
const memoryStore = new Map<string, Document>()

vi.mock('@/lib/rag/vectorStore', () => ({
  vectorStore: {
    storesText: true,
    add: vi.fn(async (nodes: Document[]) => {
      nodes.forEach((n) => memoryStore.set(n.id_, n))
      return nodes.map((n) => n.id_)
    }),
  },
  getVectorStore: () => ({
    storesText: true,
    add: vi.fn(async (nodes: Document[]) => {
      nodes.forEach((n) => memoryStore.set(n.id_, n))
      return nodes.map((n) => n.id_)
    }),
  }),
}))

import { addKnowledgeEntries } from '@/lib/dal/knowledgeEntries'

describe('DAL addKnowledgeEntries', () => {
  beforeEach(() => {
    memoryStore.clear()
    vi.clearAllMocks()
  })

  it('rejects embeddings that are not 2048-dim', async () => {
    await expect(
      addKnowledgeEntries([
        {
          content: 'text',
          title: 'T',
          lang: 'en',
          category: 'testing',
          embedding: Array(10).fill(0.1),
        },
      ])
    ).rejects.toThrow('Embedding dimension must be 2048')
  })

  it('adds valid entries to the vector store', async () => {
    const entries = [
      {
        content: 'alpha',
        title: 'A',
        lang: 'en' as const,
        category: 'testing',
        embedding: Array(2048).fill(0.01),
        source: 'unit.md',
        isPublic: true,
      },
      {
        content: 'beta',
        title: 'B',
        lang: 'en' as const,
        category: 'testing',
        embedding: Array(2048).fill(0.02),
      },
    ]

    const res = await addKnowledgeEntries(entries)
    expect(res.inserted).toBe(entries.length)
    expect(memoryStore.size).toBe(entries.length)
  })
})
