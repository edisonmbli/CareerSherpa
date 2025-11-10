import { Pool } from 'pg'
import { nanoid } from 'nanoid'
import { Document, NodeWithScore } from 'llamaindex'
import { generateEmbedding } from '@/lib/llm/embeddings'

export interface PGVectorAdapterConfig {
  db: Pool
  tableName: string
  vectorColumnName: string
  textColumnName: string
  storesText?: boolean
  metadataColumnNames?: string[]
}

export interface SimpleFilter {
  key: string
  value: any
  operator?: '==' | '!='
}

export interface RetrieveOptions {
  query: string
  similarityTopK?: number
  filters?: { filters: SimpleFilter[]; condition?: 'and' | 'or' }
}

/**
 * Minimal PGVector adapter that mimics the LlamaIndex PGVectorStore shape
 * for `.add()` and `.retrieve()` along with `.asRetriever()`.
 *
 * It writes to the `knowledge_entries` table and performs cosine-similarity
 * retrieval via pgvector's `<->` operator.
 */
export class PGVectorAdapter {
  private db: Pool
  private table: string
  private vecCol: string
  private textCol: string
  public storesText: boolean
  public metadataColumnNames: string[]

  constructor(config: PGVectorAdapterConfig) {
    this.db = config.db
    this.table = config.tableName
    this.vecCol = config.vectorColumnName
    this.textCol = config.textColumnName
    this.storesText = Boolean(config.storesText)
    this.metadataColumnNames = config.metadataColumnNames ?? []
  }

  /**
   * Batch insert documents with embeddings into the PG table.
   * Returns inserted row IDs.
   */
  async add(nodes: Document[]): Promise<string[]> {
    if (!Array.isArray(nodes) || nodes.length === 0) return []

    const client = await this.db.connect()
    const insertedIds: string[] = []
    try {
      await client.query('BEGIN')

      for (const node of nodes) {
        const text = node.getContent() ?? ''
        const embedding = node.embedding
        const md = (node.metadata || {}) as Record<string, any>

        if (!Array.isArray(embedding) || embedding.length !== 2048) {
          throw new Error('Embedding dimension must be 2048 for GLM embedding-3')
        }

        const vecLiteral = `[${embedding.join(',')}]`

        // Map metadata to table columns
        const idValue = (md['id'] ?? node.id_ ?? nanoid()) as string
        const title = md['title'] ?? null
        const lang = md['lang'] ?? null
        const category = md['category'] ?? null
        const source = md['source'] ?? null
        const isPublic = typeof md['is_public'] === 'boolean' ? md['is_public'] : true

        const sql = `
          INSERT INTO "public"."${this.table}" (id, title, ${this.textCol}, ${this.vecCol}, lang, category, source, is_public, updated_at)
          VALUES ($1, $2, $3, $4::vector, $5, $6, $7, $8, NOW())
          RETURNING id
        `
        const res = await client.query(sql, [
          idValue,
          title,
          text,
          vecLiteral,
          lang,
          category,
          source,
          isPublic,
        ])
        const id = res.rows?.[0]?.id
        if (id) insertedIds.push(String(id))
      }

      await client.query('COMMIT')
      return insertedIds
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }

  /**
   * Retrieve top-K similar documents using pgvector.
   */
  async retrieve(options: RetrieveOptions): Promise<NodeWithScore[]> {
    const queryText = options.query?.trim()
    if (!queryText) return []

    const topK = Math.max(1, options.similarityTopK ?? 8)
    const filters = options.filters?.filters ?? []

    // Generate query embedding via our GLM provider
    const queryEmbedding = await generateEmbedding(queryText)
    const vecLiteral = `[${queryEmbedding.join(',')}]`

    // Build WHERE clauses from simple filters (== only)
    const whereParts: string[] = []
    const params: any[] = []
    let p = 1
    for (const f of filters) {
      const op = f.operator === '!=' ? '!=' : '='
      // Protect against SQL injection by using param placeholders
      whereParts.push(`${f.key} ${op} $${p++}`)
      params.push(f.value)
    }
    // Always ensure embedding is not null
    whereParts.push(`${this.vecCol} IS NOT NULL`)

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : ''

    const sql = `
      SELECT id, title, ${this.textCol} AS content, lang, category,
             1 - (${this.vecCol} <-> $${p}::vector) / 2 AS score,
             is_public
      FROM "public"."${this.table}"
      ${whereSql}
      ORDER BY ${this.vecCol} <-> $${p}::vector
      LIMIT ${topK}
    `
    params.push(vecLiteral)

    const res = await this.db.query(sql, params)

    const out: NodeWithScore[] = []
    for (const row of res.rows ?? []) {
      const doc = new Document({
        id_: String(row.id),
        text: this.storesText ? String(row.content ?? '') : '',
        metadata: {
          id: String(row.id),
          title: row.title ?? undefined,
          lang: row.lang ?? undefined,
          category: row.category ?? undefined,
          is_public: Boolean(row.is_public),
        },
      })
      out.push({ node: doc, score: typeof row.score === 'number' ? row.score : 0 })
    }

    return out
  }

  /**
   * Provide a retriever facade compatible with LlamaIndex api.
   */
  asRetriever(config: { similarityTopK?: number; filters?: { filters: SimpleFilter[]; condition?: 'and' | 'or' } }) {
    const { similarityTopK, filters } = config
    return {
      retrieve: async (query: string) => {
        const options: RetrieveOptions = { query }
        if (typeof similarityTopK === 'number') {
          options.similarityTopK = similarityTopK
        }
        if (filters) {
          options.filters = filters
        }
        return await this.retrieve(options)
      },
    }
  }
}