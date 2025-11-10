import { NodeWithScore, MetadataMode } from 'llamaindex'
import { vectorStore } from '@/lib/rag/vectorStore'

export type RagLocale = 'en' | 'zh'

export interface RagQueryOptions {
  lang?: RagLocale
  category?: string
  topK?: number
  minScore?: number
}

export interface RagSearchResult {
  id: string
  title?: string
  content: string
  category?: string
  lang: RagLocale
  score: number // normalized to 0..1
}

/**
 * RAG 检索主函数
 * - 使用 LlamaIndex PGVectorStore 检索 Top-K
 * - 支持 `lang` 与 `category` 元数据过滤
 * - 返回得分已标准化到 0-1
 */
export async function queryRag(
  queryText: string,
  options: RagQueryOptions = {}
): Promise<RagSearchResult[]> {
  return await queryRagViaLlamaIndex(queryText, options)
}

/**
 * 按分类便捷检索（封装 category）
 */
export async function queryRagByCategory(
  queryText: string,
  category: string,
  options: Omit<RagQueryOptions, 'category'> = {}
): Promise<RagSearchResult[]> {
  return queryRag(queryText, { ...options, category })
}

/**
 * 使用 LlamaIndex 的 VectorStoreIndex + PGVectorStore 检索
 * - 元数据过滤：lang 必须；category 可选
 * - 返回结构化 RagSearchResult
 */
async function queryRagViaLlamaIndex(
  queryText: string,
  options: RagQueryOptions
): Promise<RagSearchResult[]> {
  if (!queryText || queryText.trim().length === 0) return []
  const lang: RagLocale = options.lang ?? 'en'
  const topK = Math.max(1, options.topK ?? 8)
  const minScore = options.minScore ?? 0.3 // Default min score
  const category = options.category

  // Construct metadata filters
  type SimpleFilter = { key: string; value: any; operator?: string }
  const filterList: SimpleFilter[] = [
    { key: 'lang', value: lang, operator: '==' },
    { key: 'is_public', value: true, operator: '==' },
  ]
  if (category) {
    filterList.push({ key: 'category', value: category, operator: '==' })
  }
  const filters: { filters: SimpleFilter[]; condition?: 'and' | 'or' } = {
    filters: filterList,
    condition: 'and',
  }
  let nodes: NodeWithScore[]
  const anyStore = vectorStore as any
  if (typeof anyStore.asRetriever === 'function') {
    const retriever = anyStore.asRetriever({ similarityTopK: topK, filters: filters as any })
    nodes = await retriever.retrieve(queryText)
  } else if (typeof anyStore.retrieve === 'function') {
    nodes = await anyStore.retrieve({ query: queryText, similarityTopK: topK, filters: filters as any })
  } else {
    throw new Error('Vector store does not support retrieval')
  }

  const out: RagSearchResult[] = []
  for (const node of nodes) {
    const score = node.score ?? 0
    if (score < minScore) continue

    const metadata = (node.node.metadata || {}) as {
      id: string
      title?: string
      category?: string
      lang: string
    }

    const item: RagSearchResult = {
      id: metadata.id,
      // LlamaIndex 在严格类型下要求传入 MetadataMode
      content: node.node.getContent(MetadataMode.NONE),
      lang:
        metadata.lang === 'en' || metadata.lang === 'zh' ? metadata.lang : lang,
      score,
    }
    if (metadata.title) {
      item.title = metadata.title
    }
    if (metadata.category) {
      item.category = metadata.category
    }
    out.push(item)
  }

  // The retriever already returns sorted results
  return out
}
