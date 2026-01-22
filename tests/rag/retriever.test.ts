import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Document, NodeWithScore } from 'llamaindex'
import { queryRag, queryRagByCategory } from '@/lib/rag/retriever'

// Mock the LlamaIndex PGVectorStore used by retriever
const memoryStore = new Map<string, Document>()

vi.mock('@/lib/rag/vectorStore', () => ({
  vectorStore: {
    storesText: true,
    add: vi.fn(async (nodes: Document[]) => {
      nodes.forEach((n) => memoryStore.set(n.id_, n))
      return nodes.map((n) => n.id_)
    }),
    retrieve: vi.fn(async (options: any) => {
      const results: NodeWithScore[] = []
      for (const doc of memoryStore.values()) {
        let match = true
        if (options.filters) {
          for (const f of options.filters.filters) {
            if (doc.metadata[f.key] !== f.value) {
              match = false
              break
            }
          }
        }
        if (match) {
          results.push({ node: doc, score: 0.9 })
        }
      }
      return results.slice(0, options.similarityTopK)
    }),
  },
  getVectorStore: () => ({
    storesText: true,
    add: vi.fn(async (nodes: Document[]) => {
      nodes.forEach((n) => memoryStore.set(n.id_, n))
      return nodes.map((n) => n.id_)
    }),
    retrieve: vi.fn(async (options: any) => {
      const results: NodeWithScore[] = []
      for (const doc of memoryStore.values()) {
        let match = true
        if (options.filters) {
          for (const f of options.filters.filters) {
            if (doc.metadata[f.key] !== f.value) {
              match = false
              break
            }
          }
        }
        if (match) {
          results.push({ node: doc, score: 0.9 })
        }
      }
      return results.slice(0, options.similarityTopK)
    }),
  }),
}))

describe('RAG retriever (LlamaIndex)', () => {
  beforeEach(() => {
    memoryStore.clear()
    vi.clearAllMocks()
    // seed memory docs
    const docs = [
      new Document({
        id_: 'd1',
        text: 'alpha content for jobs',
        metadata: { id: 'd1', title: 'A', lang: 'en', category: 'job', is_public: true },
      }),
      new Document({
        id_: 'd2',
        text: 'beta content for general',
        metadata: { id: 'd2', title: 'B', lang: 'en', category: 'general', is_public: true },
      }),
      new Document({
        id_: 'd3',
        text: 'gamma 内容',
        metadata: { id: 'd3', title: 'C', lang: 'zh', category: 'job', is_public: true },
      }),
    ]
    docs.forEach((d) => memoryStore.set(d.id_, d))
  })

  it('filters by lang and respects topK', async () => {
    const res = await queryRag('engineer', { lang: 'en', topK: 2 })
    expect(res.length).toBeLessThanOrEqual(2)
    res.forEach((r) => expect(r.lang).toBe('en'))
  })

  it('filters by category when provided', async () => {
    const res = await queryRagByCategory('engineer', 'job', { lang: 'en', topK: 5 })
    expect(res.length).toBeGreaterThan(0)
    res.forEach((r) => expect(r.category).toBe('job'))
  })

  it('applies minScore threshold', async () => {
    const res = await queryRag('engineer', { lang: 'en', topK: 5, minScore: 0.95 })
    // our mock score is 0.9, so threshold excludes everything
    expect(res.length).toBe(0)
  })
})
