/**
 * RAG 服务统一入口
 * 导出所有 RAG 相关功能
 */

// 向量化服务
export {
  vectorizeResume,
  vectorizeJobDescription,
  vectorizeKnowledgeEntry,
  batchVectorizeDocuments,
  chunkText,
  type ChunkConfig
} from './document-vectorizer'

// 查询服务
export {
  searchDocuments,
  searchKnowledge,
  findRelevantJobDescriptions,
  findRelevantResumes,
  hybridSearch,
  type SearchResult,
  type KnowledgeSearchResult,
  type QueryConfig
} from './query'

// 数据访问层
export {
  createDocument,
  createKnowledgeEntry,
  searchSimilarDocuments,
  searchSimilarKnowledgeEntries,
  deleteDocumentsBySource,
  getDocumentCount,
  type CreateDocumentParams,
  type CreateKnowledgeEntryParams,
  type SimilaritySearchParams,
  type SimilaritySearchResult
} from '../dal/vector-store'

// 嵌入服务统一入口（建议使用）
export {
  runEmbedding,
  runEmbeddingBatch,
} from '../llm/service'

// 仅类型导出（保留 Provider 类型与配置）
export {
  type EmbeddingConfig,
  type EmbeddingResult,
  type EmbeddingProvider
} from '../llm/embeddings'