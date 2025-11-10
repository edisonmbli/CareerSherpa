import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { Document, NodeWithScore } from 'llamaindex'

// Mock the vector store, the core of the new architecture
const memoryStore = new Map<string, Document>()

vi.mock('@/lib/rag/vectorStore', () => ({
  vectorStore: {
    add: vi.fn(async (nodes: Document[]) => {
      nodes.forEach((node) => memoryStore.set(node.id_, node))
      return nodes.map((node) => node.id_)
    }),
    retrieve: vi.fn(async (options: any) => {
      // Simulate filtering and retrieval
      const nodes: NodeWithScore[] = []
      for (const doc of memoryStore.values()) {
        let match = true
        if (options.filters) {
          for (const filter of options.filters.filters) {
            if (doc.metadata[filter.key] !== filter.value) {
              match = false
              break
            }
          }
        }
        if (match) {
          nodes.push({ node: doc, score: 0.9 }) // Return with a mock score
        }
      }
      return nodes.slice(0, options.similarityTopK)
    }),
  },
}))

// The DAL's `addKnowledgeEntries` no longer calls the embedding service directly,
// so we don't need to mock it here for this test. The test will provide the embeddings.

import { addKnowledgeEntries } from '@/lib/dal/knowledgeEntries'
import { queryRag } from '@/lib/rag/retriever'

describe('Ingest + Retrieve pipeline (LlamaIndex mock)', () => {
  beforeEach(() => {
    memoryStore.clear()
    vi.clearAllMocks()
  })

  it('ingests markdown chunks with embeddings via DAL and retrieves top results', async () => {
    const fp = path.join(
      process.cwd(),
      'rag_documents',
      '求职干货宝典_rag_en_test.md'
    )
    const text = await fs.readFile(fp, 'utf8')

    // Minimal chunk bodies for testing
    const chunks = text
      .split(/\n{2,}/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 5)

    // The test now provides the embeddings directly, simulating the behavior
    // of the ingest script.
    const entries = chunks.map((chunk, i) => ({
      content: chunk,
      title: `Test Title ${i}`,
      lang: 'en' as const,
      category: 'testing',
      source: 'test-file.md',
      embedding: Array(2048).fill(0.01 + i * 0.001), // Add mock embedding
      isPublic: true,
    }))

    // Ingest via the refactored DAL function
    const result = await addKnowledgeEntries(entries)
    expect(result.inserted).toBe(entries.length)
    expect(memoryStore.size).toBe(entries.length)

    // Verify that the documents in the store have embeddings
    const firstIter = memoryStore.values().next()
    expect(firstIter.done).toBe(false)
    const firstDocInStore = firstIter.value as Document
    expect(firstDocInStore.embedding).toBeDefined()
    expect(firstDocInStore.embedding?.length).toBe(2048)

    // Retrieve via queryRag, which now uses the LlamaIndex retriever
    const searchResults = await queryRag('career', {
      lang: 'en',
      topK: 3,
      minScore: 0,
    })

    expect(searchResults.length).toBeGreaterThan(0)
    expect(searchResults.length).toBeLessThanOrEqual(3)

    // Verify the structure of the results
    const firstResult = searchResults[0]!
    expect(firstResult).toHaveProperty('id')
    expect(firstResult).toHaveProperty('content')
    expect(firstResult).toHaveProperty('score')
    expect(firstResult.lang).toBe('en')
    expect(firstResult.category).toBe('testing')
  })
})
