import { prisma } from '@/lib/prisma'
import { withPrismaGuard } from '@/lib/guard/prismaGuard'
import { Prisma } from '@prisma/client'
import { Document } from 'llamaindex'
import { nanoid } from 'nanoid'
import { vectorStore } from '../rag/vectorStore'

export type RagLocale = 'en' | 'zh'

export interface CreateKnowledgeEntryParams {
  title?: string
  content: string
  embedding: number[] // must be 2048-dim (GLM embedding-3)
  lang: RagLocale
  category?: string
  source?: string
  isPublic?: boolean
}

export interface SimilarKnowledgeFilters {
  lang?: RagLocale
  category?: string
  isPublic?: boolean
}

export interface RagSearchRow {
  id: string
  title: string | null
  content: string
  lang: string
  category: string | null
  score: number
}

export interface KnowledgeEntryCreatedRow {
  id: string
  title: string | null
  content: string
  lang: string
  category: string | null
  source: string | null
  is_public: boolean
  created_at: Date
  updated_at: Date
}

// Create a single knowledge entry using raw SQL to support vector type
export async function createKnowledgeEntry(
  params: CreateKnowledgeEntryParams
): Promise<KnowledgeEntryCreatedRow> {
  const {
    title,
    content,
    embedding,
    lang,
    category,
    source,
    isPublic = true,
  } = params

  if (!Array.isArray(embedding) || embedding.length !== 2048) {
    throw new Error('Embedding dimension must be 2048 for GLM embedding-3')
  }

  const vec = `[${embedding.join(',')}]`

  const rows = await withPrismaGuard(async (client) => {
    return await client.$queryRaw<KnowledgeEntryCreatedRow[]>(
      Prisma.sql`
        INSERT INTO "public"."knowledge_entries" (title, content, embedding, lang, category, source, is_public, updated_at)
        VALUES (${title ?? null}, ${content}, ${vec}::vector, ${lang}, ${category ?? null}, ${source ?? null}, ${isPublic}, NOW())
        RETURNING id, title, content, lang, category, source, is_public, created_at, updated_at;
      `
    )
  }, { attempts: 3, prewarm: true })

  const row = rows?.[0]
  if (!row) {
    throw new Error('Failed to create knowledge entry')
  }
  return row
}

// Find similar knowledge entries using pgvector cosine distance
export async function findSimilarKnowledgeEntries(
  queryEmbedding: number[],
  filters: SimilarKnowledgeFilters = {},
  topK: number = 8,
  minScore: number = 0
): Promise<RagSearchRow[]> {
  if (!Array.isArray(queryEmbedding) || queryEmbedding.length !== 2048) {
    throw new Error('Query embedding dimension must be 2048')
  }

  const vec = `[${queryEmbedding.join(',')}]`

  const whereClauses: Prisma.Sql[] = []
  // Ensure we only compare entries with non-null embeddings
  whereClauses.push(Prisma.sql`embedding IS NOT NULL`)

  const isPublic =
    typeof filters.isPublic === 'boolean' ? filters.isPublic : true
  whereClauses.push(Prisma.sql`is_public = ${isPublic}`)

  if (filters.lang) {
    whereClauses.push(Prisma.sql`lang = ${filters.lang}`)
  }
  if (filters.category) {
    whereClauses.push(Prisma.sql`category = ${filters.category}`)
  }

  const where = whereClauses.length
    ? Prisma.sql`WHERE ${Prisma.join(whereClauses, ' AND ')}`
    : Prisma.empty

  const rows = await withPrismaGuard(async (client) => {
    return await client.$queryRaw<RagSearchRow[]>(
      Prisma.sql`
        SELECT
          id,
          title,
          content,
          lang,
          category,
          1 - (embedding <-> ${vec}::vector) / 2 AS score
        FROM "public"."knowledge_entries"
        ${where}
        ORDER BY embedding <-> ${vec}::vector
        LIMIT ${topK};
      `
    )
  }, { attempts: 3, prewarm: true })

  // Filter by minScore and normalize just in case
  const out = (rows || [])
    .map((r) => ({ ...r, score: Math.max(0, Math.min(1, r.score)) }))
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score)

  return out
}

// Retrieve similar knowledge entries via vectorStore (pg.Pool + pgvector)
export async function findSimilarKnowledgeEntriesViaVectorStore(
  queryText: string,
  filters: SimilarKnowledgeFilters = {},
  topK: number = 8,
  minScore: number = 0
): Promise<RagSearchRow[]> {
  const q = queryText?.trim()
  if (!q) return []

  const simpleFilters: { key: string; value: any }[] = []
  const isPublic = typeof filters.isPublic === 'boolean' ? filters.isPublic : true
  simpleFilters.push({ key: 'is_public', value: isPublic })
  if (filters.lang) simpleFilters.push({ key: 'lang', value: filters.lang })
  if (filters.category) simpleFilters.push({ key: 'category', value: filters.category })

  const nodes = await vectorStore.retrieve({
    query: q,
    similarityTopK: Math.max(1, topK ?? 8),
    filters: { filters: simpleFilters },
  })

  const rows: RagSearchRow[] = (nodes || []).map((item) => {
    const doc = item.node
    const md = (doc.metadata || {}) as Record<string, any>
    const score = Math.max(0, Math.min(1, Number(item.score) || 0))
    const contentText = (doc as any)?.text ?? ''
    return {
      id: String(md['id'] ?? ''),
      title: (md['title'] ?? null) as string | null,
      content: String(contentText),
      lang: String(md['lang'] ?? ''),
      category: (md['category'] ?? null) as string | null,
      score,
    }
  })

  return rows.filter((r) => r.score >= minScore).sort((a, b) => b.score - a.score)
}

// Batch insert multiple knowledge entries via LlamaIndex PGVectorStore
export async function addKnowledgeEntries(
  items: CreateKnowledgeEntryParams[]
): Promise<{ inserted: number }> {
  if (!Array.isArray(items) || items.length === 0) {
    return { inserted: 0 }
  }

  const documents: Document[] = items.map((item) => {
    const {
      title,
      content,
      embedding,
      lang,
      category,
      source,
      isPublic = true,
    } = item
    if (!Array.isArray(embedding) || embedding.length !== 2048) {
      throw new Error('Embedding dimension must be 2048 for GLM embedding-3')
    }

    return new Document({
      id_: nanoid(),
      text: content,
      embedding: embedding,
      metadata: {
        title,
        lang,
        category,
        source,
        is_public: isPublic,
      },
    })
  })

  await vectorStore.add(documents)

  return { inserted: items.length }
}
