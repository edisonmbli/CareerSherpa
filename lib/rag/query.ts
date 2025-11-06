/**
 * RAG 查询系统
 * 负责向量检索和相似度搜索
 */

import { runEmbedding } from '@/lib/llm/service'
import { 
  searchSimilarDocuments, 
  searchSimilarKnowledgeEntries,
  type SimilaritySearchParams 
} from '@/lib/dal/vector-store'
import type { DocumentSourceType } from '@prisma/client'
import { logError, logInfo } from '@/lib/logger'

// 搜索结果接口
export interface SearchResult {
  id: string
  content: string
  similarity: number
  sourceType?: DocumentSourceType
  sourceId?: string
  metadata?: any
  chunkIndex?: number
}

export interface KnowledgeSearchResult {
  id: string
  title: string
  content: string
  similarity: number
  category?: string
  metadata?: any
}

// 查询配置
export interface QueryConfig {
  limit: number
  minSimilarity: number
  sourceTypes?: DocumentSourceType[]
  sourceIds?: string[]
}

// 默认查询配置
const DEFAULT_QUERY_CONFIG: QueryConfig = {
  limit: 10,
  minSimilarity: 0.7
}

/**
 * 搜索相似文档
 */
export async function searchDocuments(
  query: string,
  userId: string,
  config: Partial<QueryConfig> = {}
): Promise<{ success: boolean; results: SearchResult[]; error?: string }> {
  try {
    const finalConfig = { ...DEFAULT_QUERY_CONFIG, ...config }
    
    logInfo({
      reqId: 'rag-query',
      route: 'searchDocuments',
      userKey: userId,
      query: query.substring(0, 100),
      config: finalConfig
    })

    // 生成查询向量（统一入口，含详细使用日志）
    const embRes = await runEmbedding(query, { userId })
    if (!embRes.ok || !embRes.vector) {
      throw new Error(embRes.error || 'Failed to generate query embedding')
    }
    const queryEmbedding = embRes.vector

    // 构建搜索参数
    const searchParams: SimilaritySearchParams = {
      queryEmbedding,
      userId,
      limit: finalConfig.limit,
      threshold: finalConfig.minSimilarity,
    }
    
    // 只有当 sourceTypes 存在且有值时才设置 sourceType
    if (finalConfig.sourceTypes && finalConfig.sourceTypes.length > 0) {
      const firstSourceType = finalConfig.sourceTypes[0]
      if (firstSourceType) {
        searchParams.sourceType = firstSourceType
      }
    }

    // 执行向量搜索
    const documents = await searchSimilarDocuments(searchParams)

    // 转换结果格式
    const results: SearchResult[] = documents.map(doc => {
      const result: SearchResult = {
        id: doc.id,
        content: doc.content,
        similarity: doc.similarity
      }
      
      if (doc.sourceType !== undefined) {
        result.sourceType = doc.sourceType
      }
      if (doc.sourceId !== undefined) {
        result.sourceId = doc.sourceId
      }
      if (doc.metadata !== undefined) {
        result.metadata = doc.metadata
      }
      if (doc.chunkIndex !== undefined) {
        result.chunkIndex = doc.chunkIndex
      }
      
      return result
    })

    logInfo({
      reqId: 'rag-query',
      route: 'searchDocuments',
      userKey: userId,
      resultsCount: results.length,
      success: true
    })

    return { success: true, results }
  } catch (error) {
    logError({
      reqId: 'rag-query',
      route: 'searchDocuments',
      userKey: userId,
      query: query.substring(0, 100),
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    return { 
      success: false, 
      results: [], 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * 搜索知识库条目
 */
export async function searchKnowledge(
  query: string,
  userId: string,
  category?: string,
  limit: number = 5,
  minSimilarity: number = 0.7
): Promise<{ success: boolean; results: KnowledgeSearchResult[]; error?: string }> {
  try {
    logInfo({
      reqId: 'rag-query',
      route: 'searchKnowledge',
      userKey: userId,
      query: query.substring(0, 100),
      category,
      limit,
      minSimilarity
    })

    // 生成查询向量（统一入口，含详细使用日志）
    const embRes = await runEmbedding(query, { userId })
    if (!embRes.ok || !embRes.vector) {
      throw new Error(embRes.error || 'Failed to generate query embedding')
    }
    const queryEmbedding = embRes.vector

    // 构建搜索参数
    const searchParams: SimilaritySearchParams = {
      queryEmbedding,
      userId,
      limit,
      threshold: minSimilarity
    }

    // 执行向量搜索
    const entries = await searchSimilarKnowledgeEntries(searchParams)

    // 转换结果格式
    const results: KnowledgeSearchResult[] = entries.map(entry => {
      const result: KnowledgeSearchResult = {
        id: entry.id,
        title: entry.title || '',
        content: entry.content,
        similarity: entry.similarity
      }
      
      if (entry.category !== undefined) {
        result.category = entry.category
      }
      if (entry.metadata !== undefined) {
        result.metadata = entry.metadata
      }
      
      return result
    })

    logInfo({
      reqId: 'rag-query',
      route: 'searchKnowledge',
      userKey: userId,
      resultsCount: results.length,
      success: true
    })

    return { success: true, results }
  } catch (error) {
    logError({
      reqId: 'rag-query',
      route: 'searchKnowledge',
      userKey: userId,
      query: query.substring(0, 100),
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    return { 
      success: false, 
      results: [], 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * 基于简历搜索相关职位描述
 */
export async function findRelevantJobDescriptions(
  resumeId: string,
  userId: string,
  limit: number = 5
): Promise<{ success: boolean; results: SearchResult[]; error?: string }> {
  try {
    logInfo({
      reqId: 'rag-query',
      route: 'findRelevantJobDescriptions',
      userKey: userId,
      resumeId,
      limit
    })

    // 首先获取简历的向量表示（使用第一个块作为代表）
    const resumeChunks = await searchSimilarDocuments({
      queryEmbedding: [], // 这里需要一个占位符，实际会被忽略
      userId,
      limit: 1,
      threshold: 0,
      sourceType: 'resume'
    })

    if (resumeChunks.length === 0) {
      return { success: false, results: [], error: 'Resume not found' }
    }

    // 使用简历内容作为查询
    const resumeContent = resumeChunks[0]?.content
    if (!resumeContent) {
      return { success: false, results: [], error: 'Resume content not found' }
    }
    
    // 搜索相关的职位描述
    return await searchDocuments(resumeContent, userId, {
      limit,
      sourceTypes: ['job_description'],
      minSimilarity: 0.6
    })
  } catch (error) {
    logError({
      reqId: 'rag-query',
      route: 'findRelevantJobDescriptions',
      userKey: userId,
      resumeId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    return { 
      success: false, 
      results: [], 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * 基于职位描述搜索相关简历
 */
export async function findRelevantResumes(
  jobId: string,
  userId: string,
  limit: number = 5
): Promise<{ success: boolean; results: SearchResult[]; error?: string }> {
  try {
    logInfo({
      reqId: 'rag-query',
      route: 'findRelevantResumes',
      userKey: userId,
      jobId,
      limit
    })

    // 首先获取职位描述的向量表示
    const jobChunks = await searchSimilarDocuments({
      queryEmbedding: [], // 占位符
      userId,
      limit: 1,
      threshold: 0,
      sourceType: 'job_description'
    })

    if (jobChunks.length === 0) {
      return { success: false, results: [], error: 'Job description not found' }
    }

    // 使用职位描述内容作为查询
    const jobContent = jobChunks[0]?.content
    if (!jobContent) {
      return { success: false, results: [], error: 'Job description content not found' }
    }
    
    // 搜索相关的简历
    return await searchDocuments(jobContent, userId, {
      limit,
      sourceTypes: ['resume'],
      minSimilarity: 0.6
    })
  } catch (error) {
    logError({
      reqId: 'rag-query',
      route: 'findRelevantResumes',
      userKey: userId,
      jobId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    return { 
      success: false, 
      results: [], 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * 混合搜索：同时搜索文档和知识库
 */
export async function hybridSearch(
  query: string,
  userId: string,
  config: {
    documentLimit?: number
    knowledgeLimit?: number
    minSimilarity?: number
    sourceTypes?: DocumentSourceType[]
    knowledgeCategory?: string
  } = {}
): Promise<{
  success: boolean
  documents: SearchResult[]
  knowledge: KnowledgeSearchResult[]
  error?: string
}> {
  try {
    const {
      documentLimit = 5,
      knowledgeLimit = 3,
      minSimilarity = 0.7,
      sourceTypes,
      knowledgeCategory
    } = config

    logInfo({
      reqId: 'rag-query',
      route: 'hybridSearch',
      userKey: userId,
      query: query.substring(0, 100),
      config
    })

    // 并行执行文档搜索和知识库搜索
    const documentSearchConfig: Partial<QueryConfig> = {
      limit: documentLimit,
      minSimilarity,
    }
    if (sourceTypes !== undefined) {
      documentSearchConfig.sourceTypes = sourceTypes
    }
    
    const [documentResult, knowledgeResult] = await Promise.all([
      searchDocuments(query, userId, documentSearchConfig),
      searchKnowledge(query, userId, knowledgeCategory, knowledgeLimit, minSimilarity)
    ])

    const success = documentResult.success && knowledgeResult.success
    const error = documentResult.error || knowledgeResult.error

    logInfo({
      reqId: 'rag-query',
      route: 'hybridSearch',
      userKey: userId,
      documentCount: documentResult.results.length,
      knowledgeCount: knowledgeResult.results.length,
      success
    })

    const result = {
      success,
      documents: documentResult.results,
      knowledge: knowledgeResult.results,
    } as {
      success: boolean
      documents: SearchResult[]
      knowledge: KnowledgeSearchResult[]
      error?: string
    }
    
    if (error !== undefined) {
      result.error = error
    }
    
    return result
  } catch (error) {
    logError({
      reqId: 'rag-query',
      route: 'hybridSearch',
      userKey: userId,
      query: query.substring(0, 100),
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    return {
      success: false,
      documents: [],
      knowledge: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}