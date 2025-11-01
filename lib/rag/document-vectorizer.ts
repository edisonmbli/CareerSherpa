/**
 * 文档向量化服务
 * 负责将文档内容转换为向量并存储到数据库
 */

import { generateEmbedding, generateEmbeddings } from '@/lib/llm/embeddings'
import { 
  createDocument, 
  createKnowledgeEntry, 
  deleteDocumentsBySource,
  type CreateDocumentParams,
  type CreateKnowledgeEntryParams 
} from '@/lib/dal/vector-store'
import type { DocumentSourceType } from '@prisma/client'
import { logError, logInfo } from '@/lib/logger'

// 文档分块配置
export interface ChunkConfig {
  maxChunkSize: number
  overlapSize: number
  minChunkSize: number
}

// 默认分块配置
const DEFAULT_CHUNK_CONFIG: ChunkConfig = {
  maxChunkSize: 1000,  // 最大块大小（字符数）
  overlapSize: 100,    // 重叠大小
  minChunkSize: 100    // 最小块大小
}

/**
 * 将长文本分割成块
 */
export function chunkText(text: string, config: ChunkConfig = DEFAULT_CHUNK_CONFIG): string[] {
  const { maxChunkSize, overlapSize, minChunkSize } = config
  
  if (text.length <= maxChunkSize) {
    return [text]
  }

  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    let end = start + maxChunkSize
    
    // 如果不是最后一块，尝试在句号、换行符或空格处分割
    if (end < text.length) {
      const searchEnd = Math.min(end + 50, text.length)
      const lastPeriod = text.lastIndexOf('。', searchEnd)
      const lastNewline = text.lastIndexOf('\n', searchEnd)
      const lastSpace = text.lastIndexOf(' ', searchEnd)
      
      const breakPoint = Math.max(lastPeriod, lastNewline, lastSpace)
      if (breakPoint > start + minChunkSize) {
        end = breakPoint + 1
      }
    }

    const chunk = text.slice(start, end).trim()
    if (chunk.length >= minChunkSize) {
      chunks.push(chunk)
    }

    // 计算下一个开始位置，考虑重叠
    start = Math.max(start + 1, end - overlapSize)
  }

  return chunks
}

/**
 * 向量化简历文档
 */
export async function vectorizeResume(
  resumeId: string,
  content: string,
  userId: string,
  metadata?: any
): Promise<{ success: boolean; chunksCreated: number; error?: string }> {
  try {
    logInfo({
      reqId: 'vectorizer',
      route: 'vectorizeResume',
      userKey: userId,
      resumeId,
      contentLength: content.length
    })

    // 先删除现有的向量数据
    await deleteDocumentsBySource('resume', resumeId, userId)

    // 分块处理
    const chunks = chunkText(content)
    
    if (chunks.length === 0) {
      return { success: false, chunksCreated: 0, error: 'No valid chunks created' }
    }

    // 批量生成嵌入
    const embeddings = await generateEmbeddings(chunks)

    // 存储到数据库
    let successCount = 0
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const embedding = embeddings[i]
      
      if (!chunk || !embedding) {
        logError({
          reqId: 'vectorizer',
          route: 'vectorizeResume',
          userKey: userId,
          error: `Missing chunk or embedding at index ${i}`,
          index: i,
          hasChunk: !!chunk,
          hasEmbedding: !!embedding
        })
        continue
      }
      
      const params: CreateDocumentParams = {
        content: chunk,
        embedding: embedding,
        sourceType: 'resume',
        sourceId: resumeId,
        userId,
        metadata: {
          ...metadata,
          chunkIndex: i,
          totalChunks: chunks.length
        },
        chunkIndex: i
      }

      const document = await createDocument(params)
      if (document) {
        successCount++
      }
    }

    logInfo({
      reqId: 'vectorizer',
      route: 'vectorizeResume',
      userKey: userId,
      resumeId,
      totalChunks: chunks.length,
      successCount,
      success: true
    })

    return { 
      success: successCount > 0, 
      chunksCreated: successCount 
    }
  } catch (error) {
    logError({
      reqId: 'vectorizer',
      route: 'vectorizeResume',
      userKey: userId,
      resumeId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    return { 
      success: false, 
      chunksCreated: 0, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * 向量化职位描述文档
 */
export async function vectorizeJobDescription(
  jobId: string,
  content: string,
  userId: string,
  metadata?: any
): Promise<{ success: boolean; chunksCreated: number; error?: string }> {
  try {
    logInfo({
      reqId: 'vectorizer',
      route: 'vectorizeJobDescription',
      userKey: userId,
      jobId,
      contentLength: content.length
    })

    // 先删除现有的向量数据
    await deleteDocumentsBySource('job_description', jobId, userId)

    // 分块处理
    const chunks = chunkText(content)
    
    if (chunks.length === 0) {
      return { success: false, chunksCreated: 0, error: 'No valid chunks created' }
    }

    // 批量生成嵌入
    const embeddings = await generateEmbeddings(chunks)

    // 存储到数据库
    let successCount = 0
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const embedding = embeddings[i]
      
      if (!chunk || !embedding) {
        logError({
          reqId: 'vectorizer',
          route: 'vectorizeJobDescription',
          userKey: userId,
          error: `Missing chunk or embedding at index ${i}`,
          index: i,
          hasChunk: !!chunk,
          hasEmbedding: !!embedding
        })
        continue
      }
      
      const params: CreateDocumentParams = {
        content: chunk,
        embedding: embedding,
        sourceType: 'job_description',
        sourceId: jobId,
        userId,
        metadata: {
          ...metadata,
          chunkIndex: i,
          totalChunks: chunks.length
        },
        chunkIndex: i
      }

      const document = await createDocument(params)
      if (document) {
        successCount++
      }
    }

    logInfo({
      reqId: 'vectorizer',
      route: 'vectorizeJobDescription',
      userKey: userId,
      jobId,
      totalChunks: chunks.length,
      successCount,
      success: true
    })

    return { 
      success: successCount > 0, 
      chunksCreated: successCount 
    }
  } catch (error) {
    logError({
      reqId: 'vectorizer',
      route: 'vectorizeJobDescription',
      userKey: userId,
      jobId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    return { 
      success: false, 
      chunksCreated: 0, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * 向量化知识库条目
 */
export async function vectorizeKnowledgeEntry(
  title: string,
  content: string,
  userId: string,
  category?: string,
  metadata?: any
): Promise<{ success: boolean; entryId?: string; error?: string }> {
  try {
    logInfo({
      reqId: 'vectorizer',
      route: 'vectorizeKnowledgeEntry',
      userKey: userId,
      title,
      category,
      contentLength: content.length
    })

    // 生成嵌入
    const embedding = await generateEmbedding(content)

    // 存储到数据库
    const params: CreateKnowledgeEntryParams = {
      content,
      embedding,
      title,
      userId,
      metadata
    }
    
    if (category) {
      params.category = category
    }

    const knowledgeEntry = await createKnowledgeEntry(params)

    if (knowledgeEntry) {
      logInfo({
        reqId: 'vectorizer',
        route: 'vectorizeKnowledgeEntry',
        userKey: userId,
        entryId: knowledgeEntry.id,
        success: true
      })

      return { 
        success: true, 
        entryId: knowledgeEntry.id 
      }
    } else {
      return { 
        success: false, 
        error: 'Failed to create knowledge entry' 
      }
    }
  } catch (error) {
    logError({
      reqId: 'vectorizer',
      route: 'vectorizeKnowledgeEntry',
      userKey: userId,
      title,
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * 批量向量化文档
 */
export async function batchVectorizeDocuments(
  documents: Array<{
    sourceType: DocumentSourceType
    sourceId: string
    content: string
    userId: string
    metadata?: any
  }>
): Promise<{ 
  success: boolean
  results: Array<{ sourceId: string; success: boolean; chunksCreated?: number; error?: string }>
}> {
  const results: Array<{ sourceId: string; success: boolean; chunksCreated?: number; error?: string }> = []

  for (const doc of documents) {
    try {
      let result: { success: boolean; chunksCreated: number; error?: string }

      if (doc.sourceType === 'resume') {
        result = await vectorizeResume(doc.sourceId, doc.content, doc.userId, doc.metadata)
      } else if (doc.sourceType === 'job_description') {
        result = await vectorizeJobDescription(doc.sourceId, doc.content, doc.userId, doc.metadata)
      } else {
        result = { success: false, chunksCreated: 0, error: 'Unsupported source type' }
      }

      const resultItem: { sourceId: string; success: boolean; chunksCreated?: number; error?: string } = {
        sourceId: doc.sourceId,
        success: result.success,
      }
      
      if (result.chunksCreated !== undefined) {
        resultItem.chunksCreated = result.chunksCreated
      }
      
      if (result.error) {
        resultItem.error = result.error
      }
      
      results.push(resultItem)
    } catch (error) {
      results.push({
        sourceId: doc.sourceId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  const successCount = results.filter(r => r.success).length
  
  return {
    success: successCount > 0,
    results
  }
}