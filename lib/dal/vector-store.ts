import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

// Keep local alias to avoid enum import issues while remaining structurally compatible
export type DocumentSourceType = 'resume' | 'job_description'

// --- Types ---
export interface CreateDocumentParams {
  content: string
  embedding: number[]
  sourceType: DocumentSourceType
  sourceId: string
  userId: string
  metadata?: any
  chunkIndex?: number
}

export interface CreateKnowledgeEntryParams {
  title?: string
  content: string
  embedding: number[]
  category?: string
  userId?: string
  metadata?: any
}

export interface SimilaritySearchParams {
  queryEmbedding: number[]
  userId: string
  limit: number
  threshold: number
  sourceType?: DocumentSourceType
}

export interface SimilaritySearchResult {
  id: string
  content: string
  similarity: number
  // Optional fields depending on table
  title?: string
  sourceType?: DocumentSourceType
  sourceId?: string
  metadata?: any
  chunkIndex?: number
  category?: string
}

// --- Document operations ---
export async function createDocument(params: CreateDocumentParams) {
  const { content, embedding, sourceType, sourceId, userId, metadata, chunkIndex } = params

  // Insert via raw SQL to support pgvector
  await prisma.$executeRaw`
    INSERT INTO "public"."documents" (content, embedding, user_id, source_type, source_id, metadata, chunk_index)
    VALUES (
      ${content},
      ${`[${embedding.join(',')}]`}::vector,
      ${userId},
      ${sourceType},
      ${sourceId},
      ${metadata ?? null},
      ${typeof chunkIndex === 'number' ? chunkIndex : null}
    )
  `

  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "public"."documents"
    WHERE user_id = ${userId} AND source_type = ${sourceType} AND source_id = ${sourceId}
    ORDER BY created_at DESC
    LIMIT 1
  `
  const firstRow = rows[0]
  if (!firstRow) return null
  const id = firstRow.id

  // Return a normalized shape used by callers
  return { id }
}

export async function deleteDocumentsBySource(
  sourceType: DocumentSourceType,
  sourceId: string,
  userId: string
) {
  // Use raw SQL with RETURNING to get affected row count
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    DELETE FROM "public"."documents"
    WHERE user_id = ${userId} AND source_type = ${sourceType} AND source_id = ${sourceId}
    RETURNING id
  `
  return rows.length
}

export async function getDocumentCount(
  userId?: string,
  sourceType?: DocumentSourceType
) {
  if (userId && sourceType) {
    const rows = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count FROM "public"."documents"
      WHERE user_id = ${userId} AND source_type = ${sourceType}
    `
    const first = rows[0]
    return first ? first.count : 0
  }
  if (userId) {
    const rows = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count FROM "public"."documents"
      WHERE user_id = ${userId}
    `
    const first = rows[0]
    return first ? first.count : 0
  }
  if (sourceType) {
    const rows = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count FROM "public"."documents"
      WHERE source_type = ${sourceType}
    `
    const first = rows[0]
    return first ? first.count : 0
  }
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS count FROM "public"."documents"
  `
  const first = rows[0]
  return first ? first.count : 0
}

export async function searchSimilarDocuments(params: SimilaritySearchParams): Promise<SimilaritySearchResult[]> {
  const { queryEmbedding, userId, limit, threshold, sourceType } = params
  const vec = `[${queryEmbedding.join(',')}]`

  // Compute a bounded similarity score: 1 / (1 + distance)
  const rows = await prisma.$queryRaw<Array<{
    id: string
    content: string
    source_type: DocumentSourceType
    source_id: string
    metadata: any
    chunk_index: number | null
    sim: number
  }>>(Prisma.sql`
    SELECT
      id,
      content,
      source_type,
      source_id,
      metadata,
      chunk_index,
      (1.0 / (1.0 + (embedding <-> ${vec}::vector))) AS sim
    FROM "public"."documents"
    WHERE user_id = ${userId}
    ${sourceType ? Prisma.sql` AND source_type = ${sourceType}` : Prisma.empty}
    ORDER BY embedding <-> ${vec}::vector
    LIMIT ${limit}
  `)

  const results = rows
    .filter((r) => (typeof r.sim === 'number' ? r.sim : 0) >= threshold)
    .map((r) => {
      const base: SimilaritySearchResult = {
        id: r.id,
        content: r.content,
        similarity: Number(r.sim) || 0,
        sourceType: r.source_type,
        sourceId: r.source_id,
      }
      if (r.metadata != null) {
        ;(base as any).metadata = r.metadata
      }
      if (r.chunk_index != null) {
        base.chunkIndex = r.chunk_index
      }
      return base
    })
  return results
}

// --- Knowledge operations ---
export async function createKnowledgeEntry(params: CreateKnowledgeEntryParams) {
  const { title, content, embedding, category, userId, metadata } = params

  await prisma.$executeRaw`
    INSERT INTO "public"."knowledge_entries" (title, content, embedding, category, source)
    VALUES (
      ${title ?? null},
      ${content},
      ${`[${embedding.join(',')}]`}::vector,
      ${category ?? null},
      ${userId ?? null}
    )
  `

  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "public"."knowledge_entries"
    ORDER BY created_at DESC
    LIMIT 1
  `
  const firstRow = rows[0]
  if (!firstRow) return null
  const id = firstRow.id
  return { id, ...(title != null ? { title } : {}), ...(metadata != null ? { metadata } : {}) }
}

export async function searchSimilarKnowledgeEntries(
  params: SimilaritySearchParams
): Promise<SimilaritySearchResult[]> {
  const { queryEmbedding, userId, limit, threshold } = params
  const vec = `[${queryEmbedding.join(',')}]`

  const rows = await prisma.$queryRaw<Array<{
    id: string
    title: string | null
    content: string
    category: string | null
    sim: number
  }>>`
    SELECT
      id,
      title,
      content,
      category,
      (1.0 / (1.0 + (embedding <-> ${vec}::vector))) AS sim
    FROM "public"."knowledge_entries"
    WHERE (is_public = TRUE OR source = ${userId})
    ORDER BY embedding <-> ${vec}::vector
    LIMIT ${limit}
  `

  return rows
    .filter((r) => (typeof r.sim === 'number' ? r.sim : 0) >= threshold)
    .map((r) => {
      const base: SimilaritySearchResult = {
        id: r.id,
        content: r.content,
        similarity: Number(r.sim) || 0,
      }
      if (r.title != null) {
        ;(base as any).title = r.title
      }
      if (r.category != null) {
        ;(base as any).category = r.category
      }
      return base
    })
}