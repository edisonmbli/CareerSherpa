/**
 * 用户数据迁移方案
 * 处理从临时userKey到Neon Auth用户ID的数据迁移
 */

import { prisma } from '@/lib/prisma'
import { logInfo, logError } from '@/lib/logger'
import { randomUUID } from 'crypto'
import type { Prisma } from '@prisma/client'

// 迁移状态枚举
export enum MigrationStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  ROLLBACK = 'rollback',
}

// 迁移记录接口
export interface MigrationRecord {
  id: string
  tempUserKey: string
  neonAuthUserId: string
  status: MigrationStatus
  startedAt: Date
  completedAt?: Date
  errorMessage?: string
  dataSnapshot?: any
  rollbackData?: any
}

// 迁移结果接口
export interface MigrationResult {
  success: boolean
  migrationId: string
  migratedRecords: number
  errors: string[]
  rollbackAvailable: boolean
}

/**
 * 创建迁移记录
 */
async function createMigrationRecord(
  tempUserKey: string,
  neonAuthUserId: string,
  reqId: string,
): Promise<string> {
  const migrationId = randomUUID()

  try {
    // 创建迁移记录表（如果不存在）
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS user_migrations (
        id VARCHAR(36) PRIMARY KEY,
        temp_user_key VARCHAR(255) NOT NULL,
        neon_auth_user_id VARCHAR(255) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP NULL,
        error_message TEXT NULL,
        data_snapshot JSONB NULL,
        rollback_data JSONB NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `

    // 插入迁移记录
    await prisma.$executeRaw`
      INSERT INTO user_migrations (
        id, temp_user_key, neon_auth_user_id, status, started_at
      ) VALUES (
        ${migrationId}, ${tempUserKey}, ${neonAuthUserId}, ${MigrationStatus.PENDING}, NOW()
      )
    `

    logInfo({
      reqId,
      route: 'migration',
      userKey: tempUserKey,
      phase: 'migration_record_created',
      migrationId,
      message: 'Migration record created',
    })

    return migrationId
  } catch (error) {
    logError({
      reqId,
      route: 'migration',
      userKey: tempUserKey,
      phase: 'migration_record_creation',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    throw error
  }
}

/**
 * 更新迁移状态
 */
async function updateMigrationStatus(
  migrationId: string,
  status: MigrationStatus,
  errorMessage?: string,
  reqId?: string,
): Promise<void> {
  try {
    if (status === MigrationStatus.COMPLETED) {
      await prisma.$executeRaw`
        UPDATE user_migrations 
        SET status = ${status}, completed_at = NOW(), updated_at = NOW()
        WHERE id = ${migrationId}
      `
    } else if (status === MigrationStatus.FAILED && errorMessage) {
      await prisma.$executeRaw`
        UPDATE user_migrations 
        SET status = ${status}, error_message = ${errorMessage}, updated_at = NOW()
        WHERE id = ${migrationId}
      `
    } else {
      await prisma.$executeRaw`
        UPDATE user_migrations 
        SET status = ${status}, updated_at = NOW()
        WHERE id = ${migrationId}
      `
    }

    if (reqId) {
      logInfo({
        reqId,
        route: 'migration',
        phase: 'status_update',
        migrationId,
        status,
        message: 'Migration status updated',
      })
    }
  } catch (error) {
    if (reqId) {
      logError({
        reqId,
        route: 'migration',
        phase: 'status_update',
        migrationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
    throw error
  }
}

/**
 * 获取用户数据快照
 * @deprecated 此函数已弃用，因为我们已完全迁移到 Neon Auth
 */
async function getUserDataSnapshot(tempUserKey: string): Promise<any> {
  logInfo({
    reqId: tempUserKey,
    route: 'auth/migration',
    phase: 'deprecated_get_snapshot',
    message:
      'getUserDataSnapshot is deprecated. Migration to Neon Auth is complete.',
  })

  // 返回空快照，因为迁移已完成
  return {
    user: null,
    timestamp: new Date().toISOString(),
    recordCounts: {
      services: 0,
      tasks: 0,
      outputs: 0,
      resumes: 0,
      quotas: 0,
      quotaReservations: 0,
      payments: 0,
      tokenUsageLogs: 0,
      auditLogs: 0,
    },
  }
}

/**
 * 执行数据迁移
 * 注意：当前schema中只有User表的clerkUserId字段需要更新
 * 其他表通过userId外键关联，不需要直接更新userKey
 */
/**
 * @deprecated 此函数已弃用，因为我们已完全迁移到 Neon Auth
 */
async function migrateUserData(
  tempUserKey: string,
  neonAuthUserId: string,
  migrationId: string,
  reqId: string,
): Promise<number> {
  logInfo({
    ...(reqId ? { reqId } : {}),
    route: 'auth/migration',
    phase: 'deprecated_migrate_user_data',
    message:
      'migrateUserData is deprecated. Migration to Neon Auth is complete.',
  })
  return 0
}

/**
 * 主迁移函数
 * @deprecated 此函数已弃用，因为我们已完全迁移到 Neon Auth
 */
export async function migrateUserFromTempToNeon(
  tempUserKey: string,
  neonAuthUserId: string,
  reqId?: string,
): Promise<MigrationResult> {
  logInfo({
    ...(reqId ? { reqId } : {}),
    route: 'auth/migration',
    phase: 'deprecated_migrate_user',
    message:
      'migrateUserFromTempToNeon is deprecated. Migration to Neon Auth is complete.',
  })

  // 返回成功状态，因为迁移已完成
  return {
    success: true,
    migrationId: 'migration-complete',
    migratedRecords: 0,
    errors: [],
    rollbackAvailable: false,
  }
}

/**
 * 回滚迁移
 */
export async function rollbackMigration(
  migrationId: string,
  reqId?: string,
): Promise<MigrationResult> {
  const requestId = reqId || randomUUID()
  let migratedRecords = 0
  const errors: string[] = []

  try {
    // 1. 获取迁移记录
    const migrationRecord = await prisma.$queryRaw<any[]>`
      SELECT * FROM user_migrations WHERE id = ${migrationId}
    `

    if (!migrationRecord || migrationRecord.length === 0) {
      throw new Error('Migration record not found')
    }

    const migration = migrationRecord[0]
    const {
      temp_user_key: tempUserKey,
      neon_auth_user_id: neonAuthUserId,
      data_snapshot: dataSnapshot,
    } = migration

    // 2. 更新状态为回滚中
    await updateMigrationStatus(
      migrationId,
      MigrationStatus.ROLLBACK,
      undefined,
      requestId,
    )

    // 3. 执行回滚（将数据改回临时userKey）
    migratedRecords = await migrateUserData(
      neonAuthUserId,
      tempUserKey,
      migrationId,
      requestId,
    )

    logInfo({
      reqId: requestId,
      route: 'migration',
      userKey: tempUserKey,
      phase: 'rollback_completed',
      migrationId,
      migratedRecords,
      message: 'Migration rollback completed successfully',
    })

    return {
      success: true,
      migrationId,
      migratedRecords,
      errors: [],
      rollbackAvailable: false,
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown rollback error'
    errors.push(errorMessage)

    logError({
      reqId: requestId,
      route: 'migration',
      phase: 'rollback_failed',
      migrationId,
      error: errorMessage,
    })

    return {
      success: false,
      migrationId,
      migratedRecords,
      errors,
      rollbackAvailable: false,
    }
  }
}

/**
 * 获取迁移状态
 */
export async function getMigrationStatus(
  migrationId: string,
): Promise<MigrationRecord | null> {
  try {
    const migrationRecord = await prisma.$queryRaw<any[]>`
      SELECT * FROM user_migrations WHERE id = ${migrationId}
    `

    if (!migrationRecord || migrationRecord.length === 0) {
      return null
    }

    const migration = migrationRecord[0]
    return {
      id: migration.id,
      tempUserKey: migration.temp_user_key,
      neonAuthUserId: migration.neon_auth_user_id,
      status: migration.status as MigrationStatus,
      startedAt: migration.started_at,
      completedAt: migration.completed_at,
      errorMessage: migration.error_message,
      dataSnapshot: migration.data_snapshot,
      rollbackData: migration.rollback_data,
    }
  } catch (error) {
    return null
  }
}

/**
 * 清理旧的迁移记录
 */
export async function cleanupOldMigrations(
  daysOld: number = 30,
): Promise<number> {
  try {
    const result = await prisma.$executeRaw`
      DELETE FROM user_migrations 
      WHERE created_at < NOW() - INTERVAL '${daysOld} days'
      AND status IN ('completed', 'failed')
    `

    return result as number
  } catch (error) {
    return 0
  }
}
