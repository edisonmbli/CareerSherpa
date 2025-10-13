import { prisma } from '@/lib/prisma'
import type { Document, KnowledgeEntry, DocumentSourceType } from '@prisma/client'
import { logError, logInfo } from '@/lib/logger'

// 相似度搜索结果类型
export interface SimilaritySearchResult {
  id: string
  content: string
  similarity: number
  sourceType?: DocumentSourceType
  sourceId?: string
  metadata?: any
  chunkIndex?: number
  title?: string
  category?: string
}

// 创建文档参数类型
export interface CreateDocumentParams {
  content: string
  embedding: number[]
  sourceType: DocumentSourceType
  sourceId: string
  userId: string
  metadata?: any
  chunkIndex?: number
}

// 创建知识条目参数类型
export interface CreateKnowledgeEntryParams {
  content: string
  embedding: number[]
  title?: string
  category?: string
  userId: string
  metadata?: any
}

// 相似度搜索参数类型
export interface SimilaritySearchParams {
  queryEmbedding: number[]
  limit: number
  threshold?: number
  sourceType?: DocumentSourceType
  userId?: string
}

/**
 * 创建文档并存储向量
 */
export async function createDocument(params: CreateDocumentParams): Promise<Document | null> {
  try {
    logInfo({
      reqId: 'vector-store',
      route: 'createDocument',
      userKey: params.userId,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      contentLength: params.content.length,
      embeddingDim: params.embedding.length
    })

    // 使用原始 SQL 插入向量数据
    const result = await prisma.$executeRaw`
      INSERT INTO "documents" (
        content, embedding, source_type, source_id, user_id, metadata, chunk_index, created_at, updated_at
      ) VALUES (
        ${params.content},
        ${`[${params.embedding.join(',')}]`}::vector,
        ${params.sourceType}::"DocumentSourceType",
        ${params.sourceId},
        ${params.userId},
        ${JSON.stringify(params.metadata || {})}::jsonb,
        ${params.chunkIndex || null},
        NOW(),
        NOW()
      )
    `

    // 获取创建的文档
    const document = await prisma.document.findFirst({
      where: {
        sourceId: params.sourceId,
        sourceType: params.sourceType,
        userId: params.userId
      },
      orderBy: { createdAt: 'desc' }
    })

    logInfo({
      reqId: 'vector-store',
      route: 'createDocument',
      userKey: params.userId,
      documentId: document?.id,
      success: true
    })

    return document
  } catch (error) {
    logError({
      reqId: 'vector-store',
      route: 'createDocument',
      userKey: params.userId,
      error: error instanceof Error ? error.message : 'Unknown error',
      sourceType: params.sourceType,
      sourceId: params.sourceId
    })
    return null
  }
}

/**
 * 创建知识条目并存储向量
 */
export async function createKnowledgeEntry(params: CreateKnowledgeEntryParams): Promise<KnowledgeEntry | null> {
  try {
    logInfo({
      reqId: 'vector-store',
      route: 'createKnowledgeEntry',
      userKey: params.userId,
      title: params.title,
      category: params.category,
      contentLength: params.content.length,
      embeddingDim: params.embedding.length
    })

    // 使用原始 SQL 插入向量数据
    const result = await prisma.$executeRaw`
      INSERT INTO "knowledge_entries" (
        content, embedding, title, category, user_id, metadata, created_at, updated_at
      ) VALUES (
        ${params.content},
        ${`[${params.embedding.join(',')}]`}::vector,
        ${params.title || null},
        ${params.category || null},
        ${params.userId},
        ${JSON.stringify(params.metadata || {})}::jsonb,
        NOW(),
        NOW()
      )
    `

    // 获取创建的知识条目
    const knowledgeEntry = await prisma.knowledgeEntry.findFirst({
      where: {
        userId: params.userId,
        title: params.title || undefined
      },
      orderBy: { createdAt: 'desc' }
    })

    logInfo({
      reqId: 'vector-store',
      route: 'createKnowledgeEntry',
      userKey: params.userId,
      knowledgeEntryId: knowledgeEntry?.id,
      success: true
    })

    return knowledgeEntry
  } catch (error) {
    logError({
      reqId: 'vector-store',
      route: 'createKnowledgeEntry',
      userKey: params.userId,
      error: error instanceof Error ? error.message : 'Unknown error',
      title: params.title,
      category: params.category
    })
    return null
  }
}

/**
 * 搜索相似文档
 */
export async function searchSimilarDocuments(params: SimilaritySearchParams): Promise<SimilaritySearchResult[]> {
  try {
    logInfo({
      reqId: 'vector-store',
      route: 'searchSimilarDocuments',
      userKey: params.userId,
      limit: params.limit,
      threshold: params.threshold,
      sourceType: params.sourceType,
      embeddingDim: params.queryEmbedding.length
    })

    const queryEmbeddingStr = `[${params.queryEmbedding.join(',')}]`
    
    // 构建基础查询
    let query = `
      SELECT 
        id,
        content,
        (1 - (embedding <=> '${queryEmbeddingStr}'::vector)) as similarity,
        source_type as "sourceType",
        source_id as "sourceId",
        metadata,
        chunk_index as "chunkIndex"
      FROM "documents"
      WHERE 1=1
    `
    
    // 添加条件
    if (params.threshold !== undefined) {
      query += ` AND (1 - (embedding <=> '${queryEmbeddingStr}'::vector)) >= ${params.threshold}`
    }
    
    if (params.sourceType) {
      query += ` AND source_type = '${params.sourceType}'::"DocumentSourceType"`
    }
    
    if (params.userId) {
      query += ` AND user_id = '${params.userId}'`
    }
    
    query += ` ORDER BY embedding <=> '${queryEmbeddingStr}'::vector LIMIT ${params.limit}`

    // 使用余弦相似度搜索
    const results: any[] = await prisma.$queryRawUnsafe(query)

    const searchResults: SimilaritySearchResult[] = results.map(row => ({
      id: row.id,
      content: row.content,
      similarity: parseFloat(row.similarity),
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      metadata: row.metadata,
      chunkIndex: row.chunkIndex ?? undefined
    }))

    logInfo({
      reqId: 'vector-store',
      route: 'searchSimilarDocuments',
      userKey: params.userId,
      resultsCount: searchResults.length,
      success: true
    })

    return searchResults
  } catch (error) {
    logError({
      reqId: 'vector-store',
      route: 'searchSimilarDocuments',
      userKey: params.userId,
      error: error instanceof Error ? error.message : 'Unknown error',
      limit: params.limit,
      sourceType: params.sourceType
    })
    return []
  }
}

/**
 * 搜索相似知识条目
 */
export async function searchSimilarKnowledgeEntries(params: SimilaritySearchParams): Promise<SimilaritySearchResult[]> {
  try {
    logInfo({
      reqId: 'vector-store',
      route: 'searchSimilarKnowledgeEntries',
      userKey: params.userId,
      limit: params.limit,
      threshold: params.threshold,
      embeddingDim: params.queryEmbedding.length
    })

    const queryEmbeddingStr = `[${params.queryEmbedding.join(',')}]`
    
    // 构建基础查询
    let query = `
      SELECT 
        id,
        content,
        (1 - (embedding <=> '${queryEmbeddingStr}'::vector)) as similarity,
        title,
        category,
        metadata
      FROM "knowledge_entries"
      WHERE 1=1
    `
    
    // 添加条件
    if (params.threshold !== undefined) {
      query += ` AND (1 - (embedding <=> '${queryEmbeddingStr}'::vector)) >= ${params.threshold}`
    }
    
    if (params.userId) {
      query += ` AND user_id = '${params.userId}'`
    }
    
    query += ` ORDER BY embedding <=> '${queryEmbeddingStr}'::vector LIMIT ${params.limit}`

    // 使用余弦相似度搜索
    const results: any[] = await prisma.$queryRawUnsafe(query)

    const searchResults: SimilaritySearchResult[] = results.map(row => ({
      id: row.id,
      content: row.content,
      similarity: parseFloat(row.similarity),
      title: row.title ?? undefined,
      category: row.category ?? undefined,
      metadata: row.metadata
    }))

    logInfo({
      reqId: 'vector-store',
      route: 'searchSimilarKnowledgeEntries',
      userKey: params.userId,
      resultsCount: searchResults.length,
      success: true
    })

    return searchResults
  } catch (error) {
    logError({
      reqId: 'vector-store',
      route: 'searchSimilarKnowledgeEntries',
      userKey: params.userId,
      error: error instanceof Error ? error.message : 'Unknown error',
      limit: params.limit
    })
    return []
  }
}

/**
 * 根据来源删除文档
 */
export async function deleteDocumentsBySource(
  sourceType: DocumentSourceType,
  sourceId: string,
  userId: string
): Promise<number> {
  try {
    logInfo({
      reqId: 'vector-store',
      route: 'deleteDocumentsBySource',
      userKey: userId,
      sourceType,
      sourceId
    })

    const result = await prisma.document.deleteMany({
      where: {
        sourceType,
        sourceId,
        userId
      }
    })

    logInfo({
      reqId: 'vector-store',
      route: 'deleteDocumentsBySource',
      userKey: userId,
      deletedCount: result.count,
      sourceType,
      sourceId,
      success: true
    })

    return result.count
  } catch (error) {
    logError({
      reqId: 'vector-store',
      route: 'deleteDocumentsBySource',
      userKey: userId,
      error: error instanceof Error ? error.message : 'Unknown error',
      sourceType,
      sourceId
    })
    return 0
  }
}

/**
 * 获取文档数量统计
 */
export async function getDocumentCount(sourceType?: DocumentSourceType, userId?: string): Promise<number> {
  try {
    const count = await prisma.document.count({
      where: {
        ...(sourceType && { sourceType }),
        ...(userId && { userId })
      }
    })

    return count
  } catch (error) {
    logError({
      reqId: 'vector-store',
      route: 'getDocumentCount',
      userKey: userId,
      error: error instanceof Error ? error.message : 'Unknown error',
      sourceType
    })
    return 0
  }
}