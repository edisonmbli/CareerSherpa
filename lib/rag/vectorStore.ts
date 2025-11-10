import { Pool } from 'pg'
import { PGVectorAdapter } from '@/lib/rag/pgVectorAdapter'

// Create a new pool instance with the connection string from environment variables.
// This ensures that the application connects to the correct Neon database.
const pool = new Pool({
  connectionString: process.env['DATABASE_URL'] as string,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
  keepAlive: true,
})

// Instantiate PGVectorStore to act as the interface to our pgvector table.
export const vectorStore = new PGVectorAdapter({
  db: pool,
  tableName: 'knowledge_entries',
  vectorColumnName: 'embedding',
  textColumnName: 'content',
  storesText: true,
  metadataColumnNames: [
    'id',
    'title',
    'lang',
    'category',
    'is_public',
    'source',
    'created_at',
    'updated_at',
  ],
})

/**
 * Returns a singleton instance of the PGVectorStore.
 * This function ensures that we reuse the same store instance throughout the application,
 * which is more efficient than creating a new one for every operation.
 */
export function getVectorStore(): PGVectorAdapter {
  return vectorStore
}
