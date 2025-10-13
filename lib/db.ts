import { neon } from '@neondatabase/serverless'
import { ENV } from './env'
import { ensureMigrations } from './db-migrations'

let _sql: ReturnType<typeof neon> | null = null

export function sql() {
  if (!_sql) {
    if (!ENV.DATABASE_URL) {
      throw new Error('missing_DATABASE_URL')
    }
    _sql = neon(ENV.DATABASE_URL)
  }
  return _sql
}

/**
 * 确保数据库schema已初始化
 * @deprecated 使用 ensureMigrations() 替代直接SQL操作
 */
export async function ensureSchema() {
  console.warn('ensureSchema() is deprecated. Use ensureMigrations() from db-migrations.ts instead.')
  await ensureMigrations()
}
