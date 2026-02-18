import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'
import { ENV } from './env'
import { buildPrismaUrl } from './prismaConnection'
import { PrismaNeon } from '@prisma/adapter-neon'
import { neonConfig } from '@neondatabase/serverless'
import { logError, logInfo } from '@/lib/logger'

// Use fetch channel to avoid WebSocket dependency in Node
neonConfig.poolQueryViaFetch = true

let _prisma: PrismaClient | null = null
let _migrated = false

export function getPrismaClient() {
  if (!_prisma) {
    if (!ENV.DATABASE_URL) {
      throw new Error('missing_DATABASE_URL')
    }
    const connectionString = buildPrismaUrl(ENV.DATABASE_URL)
    const adapter = new PrismaNeon({ connectionString })
    _prisma = new PrismaClient({ adapter })
  }
  return _prisma
}

/**
 * 确保数据库schema已初始化
 * 使用Prisma migrations替代直接SQL操作
 */
export async function ensureMigrations() {
  if (_migrated) return
  
  try {
    const prisma = getPrismaClient()
    
    // 检查数据库连接
    await prisma.$connect()
    
    // 验证关键表是否存在
    const tableCheck = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'resumes', 'detailed_resumes', 'job_descriptions', 'services', 'quotas')
    ` as Array<{ table_name: string }>
    
    const existingTables = tableCheck.map(row => row.table_name)
    const requiredTables = ['users', 'resumes', 'detailed_resumes', 'job_descriptions', 'services', 'quotas']
    const missingTables = requiredTables.filter(table => !existingTables.includes(table))
    
    if (missingTables.length > 0) {
      logInfo({
        reqId: 'db-migrations',
        route: 'db-migrations/ensure',
        phase: 'missing_tables',
        tables: missingTables,
        message: 'Please run: npx prisma migrate deploy',
      })
      
      // 在开发环境下，可以尝试自动运行migration
      if (process.env.NODE_ENV === 'development') {
        logInfo({
          reqId: 'db-migrations',
          route: 'db-migrations/ensure',
          phase: 'attempt_migrate',
        })
        try {
          execSync('npx prisma migrate deploy', { stdio: 'inherit' })
          logInfo({
            reqId: 'db-migrations',
            route: 'db-migrations/ensure',
            phase: 'migrate_completed',
          })
        } catch (error) {
          logError({
            reqId: 'db-migrations',
            route: 'db-migrations/ensure',
            phase: 'migrate_failed',
            error: error instanceof Error ? error : String(error),
          })
          throw new Error('Database schema not initialized. Please run: npx prisma migrate deploy')
        }
      } else {
        throw new Error('Database schema not initialized. Please run: npx prisma migrate deploy')
      }
    }
    
    _migrated = true
    logInfo({
      reqId: 'db-migrations',
      route: 'db-migrations/ensure',
      phase: 'schema_validated',
    })
    
  } catch (error) {
    logError({
      reqId: 'db-migrations',
      route: 'db-migrations/ensure',
      phase: 'migration_check_failed',
      error: error instanceof Error ? error : String(error),
    })
    throw error
  }
}

/**
 * 优雅关闭数据库连接
 */
export async function closeDatabaseConnection() {
  if (_prisma) {
    await _prisma.$disconnect()
    _prisma = null
    _migrated = false
  }
}

/**
 * 重置迁移状态（主要用于测试）
 */
export function resetMigrationState() {
  _migrated = false
}
