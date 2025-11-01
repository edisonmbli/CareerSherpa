/**
 * 异步审计日志系统
 * 避免阻塞主流程，提高性能
 */

import { prisma } from '../prisma'
import { logInfo, logError } from '../logger'
import { isProdRedisReady } from '../env'
import type { Prisma } from '@prisma/client'

// 审计日志条目接口
export interface AuditLogEntry {
  userId: string
  action: string
  entityType: string
  entityId: string
  metadata?: Prisma.InputJsonValue
  timestamp?: Date
  reqId?: string
  route?: string
  userAgent?: string
  ipAddress?: string
}

// 批量审计日志结果
export interface BatchAuditResult {
  success: boolean
  processed: number
  failed: number
  errors: string[]
}

// 内存队列用于缓存审计日志
class AuditLogQueue {
  private queue: AuditLogEntry[] = []
  private processing = false
  private maxQueueSize = 1000
  private batchSize = 50
  private flushInterval = 5000 // 5秒
  private retryAttempts = 3
  private retryDelay = 1000 // 1秒

  constructor() {
    // 定期刷新队列
    setInterval(() => {
      this.flush()
    }, this.flushInterval)

    // 进程退出时刷新队列
    process.on('beforeExit', () => {
      this.flush()
    })
  }

  /**
   * 添加审计日志到队列
   */
  enqueue(entry: AuditLogEntry): boolean {
    if (this.queue.length >= this.maxQueueSize) {
      logError({
        reqId: entry.reqId || 'audit-queue',
        route: 'audit-queue',
        error: 'audit_queue_full',
        queueSize: this.queue.length
      })
      return false
    }

    // 添加时间戳
    const auditEntry: AuditLogEntry = {
      ...entry,
      timestamp: entry.timestamp || new Date()
    }

    this.queue.push(auditEntry)

    // 如果队列达到批处理大小，立即刷新
    if (this.queue.length >= this.batchSize) {
      setImmediate(() => this.flush())
    }

    return true
  }

  /**
   * 刷新队列到数据库
   */
  async flush(): Promise<BatchAuditResult> {
    if (this.processing || this.queue.length === 0) {
      return { success: true, processed: 0, failed: 0, errors: [] }
    }

    this.processing = true
    const batch = this.queue.splice(0, this.batchSize)
    const errors: string[] = []
    let processed = 0
    let failed = 0

    try {
      // 批量插入到数据库
      const result = await this.batchInsert(batch)
      processed = result.processed
      failed = result.failed
      errors.push(...result.errors)

      logInfo({
        reqId: `audit-flush-${Date.now()}`,
        route: 'audit-flush',
        processed,
        failed,
        queueSize: this.queue.length
      })

    } catch (error) {
      // 插入失败，将条目放回队列前端
      this.queue.unshift(...batch)
      failed = batch.length
      const errorMessage = error instanceof Error ? error.message : 'unknown_error'
      errors.push(errorMessage)

      logError({
        reqId: `audit-flush-${Date.now()}`,
        route: 'audit-flush',
        error: errorMessage,
        batchSize: batch.length
      })
    } finally {
      this.processing = false
    }

    return {
      success: failed === 0,
      processed,
      failed,
      errors
    }
  }

  /**
   * 批量插入审计日志
   */
  private async batchInsert(entries: AuditLogEntry[]): Promise<BatchAuditResult> {
    let processed = 0
    let failed = 0
    const errors: string[] = []

    try {
      // 使用事务批量插入
      await prisma.$transaction(async (tx) => {
        for (const entry of entries) {
          try {
            await tx.auditLog.create({
              data: {
                userId: entry.userId,
                action: entry.action,
                entityType: entry.entityType,
                entityId: entry.entityId,
                ...(entry.metadata !== undefined && { metadata: entry.metadata }),
                createdAt: entry.timestamp || new Date()
              }
            })
            processed++
          } catch (error) {
            failed++
            const errorMessage = error instanceof Error ? error.message : 'unknown_error'
            errors.push(`Entry ${entry.action}: ${errorMessage}`)
          }
        }
      })
    } catch (error) {
      // 事务失败，所有条目都失败
      failed = entries.length
      processed = 0
      const errorMessage = error instanceof Error ? error.message : 'transaction_failed'
      errors.push(errorMessage)
    }

    return { success: failed === 0, processed, failed, errors }
  }

  /**
   * 获取队列状态
   */
  getStatus() {
    return {
      queueSize: this.queue.length,
      processing: this.processing,
      maxQueueSize: this.maxQueueSize,
      batchSize: this.batchSize
    }
  }

  /**
   * 清空队列（仅用于测试）
   */
  clear() {
    this.queue = []
  }
}

// 全局审计日志队列实例
const auditQueue = new AuditLogQueue()

/**
 * 异步记录审计日志（非阻塞）
 */
export function logAuditAsync(entry: AuditLogEntry): boolean {
  return auditQueue.enqueue(entry)
}

/**
 * 同步记录审计日志（阻塞，仅用于关键操作）
 */
export async function logAuditSync(entry: AuditLogEntry): Promise<boolean> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        ...(entry.metadata !== undefined && { metadata: entry.metadata }),
        createdAt: entry.timestamp || new Date()
      }
    })

    logInfo({
      reqId: entry.reqId || `audit-sync-${Date.now()}`,
      route: entry.route || 'audit-sync',
      userKey: entry.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId
    })

    return true
  } catch (error) {
    logError({
      reqId: entry.reqId || `audit-sync-${Date.now()}`,
      route: entry.route || 'audit-sync',
      userKey: entry.userId,
      error: error instanceof Error ? error.message : 'unknown_error',
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId
    })

    return false
  }
}

/**
 * 手动刷新审计日志队列
 */
export async function flushAuditQueue(): Promise<BatchAuditResult> {
  return auditQueue.flush()
}

/**
 * 获取审计队列状态
 */
export function getAuditQueueStatus() {
  return auditQueue.getStatus()
}

/**
 * 便捷函数：记录用户操作审计
 */
export function auditUserAction(
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Record<string, any>,
  context?: {
    reqId?: string
    route?: string
    userAgent?: string
    ipAddress?: string
  }
): boolean {
  return logAuditAsync({
    userId,
    action,
    entityType,
    entityId,
    ...(metadata !== undefined && { metadata }),
    ...(context?.reqId && { reqId: context.reqId }),
    ...(context?.route && { route: context.route }),
    ...(context?.userAgent && { userAgent: context.userAgent }),
    ...(context?.ipAddress && { ipAddress: context.ipAddress })
  })
}

/**
 * 便捷函数：记录服务操作审计
 */
export function auditServiceOperation(
  userId: string,
  serviceId: string,
  operation: string,
  metadata?: Record<string, any>,
  context?: {
    reqId?: string
    route?: string
    userAgent?: string
    ipAddress?: string
  }
): boolean {
  return logAuditAsync({
    userId,
    action: `service_${operation}`,
    entityType: 'service',
    entityId: serviceId,
    ...(metadata !== undefined && { metadata }),
    ...(context?.reqId && { reqId: context.reqId }),
    ...(context?.route && { route: context.route }),
    ...(context?.userAgent && { userAgent: context.userAgent }),
    ...(context?.ipAddress && { ipAddress: context.ipAddress })
  })
}

/**
 * 便捷函数：记录配额操作审计
 */
export function auditQuotaOperation(
  userId: string,
  operation: string,
  amount: number,
  metadata?: Record<string, any>,
  context?: {
    reqId?: string
    route?: string
    userAgent?: string
    ipAddress?: string
  }
): boolean {
  return logAuditAsync({
    userId,
    action: `quota_${operation}`,
    entityType: 'quota',
    entityId: userId, // 配额以用户ID作为实体ID
    metadata: {
      amount,
      ...(metadata && metadata)
    },
    ...(context?.reqId && { reqId: context.reqId }),
    ...(context?.route && { route: context.route }),
    ...(context?.userAgent && { userAgent: context.userAgent }),
    ...(context?.ipAddress && { ipAddress: context.ipAddress })
  })
}

/**
 * 便捷函数：记录认证操作审计
 */
export function auditAuthOperation(
  userId: string,
  operation: string,
  success: boolean,
  metadata?: Record<string, any>,
  context?: {
    reqId?: string
    route?: string
    userAgent?: string
    ipAddress?: string
  }
): boolean {
  return logAuditAsync({
    userId,
    action: `auth_${operation}`,
    entityType: 'user',
    entityId: userId,
    metadata: {
      success,
      ...(metadata && metadata)
    },
    ...(context?.reqId && { reqId: context.reqId }),
    ...(context?.route && { route: context.route }),
    ...(context?.userAgent && { userAgent: context.userAgent }),
    ...(context?.ipAddress && { ipAddress: context.ipAddress })
  })
}

/**
 * 性能监控：审计日志性能指标
 */
export interface AuditPerformanceMetrics {
  queueSize: number
  processing: boolean
  totalProcessed: number
  totalFailed: number
  avgProcessingTime: number
  lastFlushTime: Date | null
}

// 性能指标收集器
class AuditPerformanceCollector {
  private metrics = {
    totalProcessed: 0,
    totalFailed: 0,
    processingTimes: [] as number[],
    lastFlushTime: null as Date | null
  }

  recordFlush(result: BatchAuditResult, duration: number) {
    this.metrics.totalProcessed += result.processed
    this.metrics.totalFailed += result.failed
    this.metrics.processingTimes.push(duration)
    this.metrics.lastFlushTime = new Date()

    // 保持最近100次记录
    if (this.metrics.processingTimes.length > 100) {
      this.metrics.processingTimes.shift()
    }
  }

  getMetrics(): AuditPerformanceMetrics {
    const avgProcessingTime = this.metrics.processingTimes.length > 0
      ? this.metrics.processingTimes.reduce((sum, time) => sum + time, 0) / this.metrics.processingTimes.length
      : 0

    const queueStatus = auditQueue.getStatus()

    return {
      queueSize: queueStatus.queueSize,
      processing: queueStatus.processing,
      totalProcessed: this.metrics.totalProcessed,
      totalFailed: this.metrics.totalFailed,
      avgProcessingTime,
      lastFlushTime: this.metrics.lastFlushTime
    }
  }

  reset() {
    this.metrics = {
      totalProcessed: 0,
      totalFailed: 0,
      processingTimes: [],
      lastFlushTime: null
    }
  }
}

// 全局性能收集器
const performanceCollector = new AuditPerformanceCollector()

/**
 * 获取审计日志性能指标
 */
export function getAuditPerformanceMetrics(): AuditPerformanceMetrics {
  return performanceCollector.getMetrics()
}

/**
 * 重置性能指标（仅用于测试）
 */
export function resetAuditPerformanceMetrics() {
  performanceCollector.reset()
}

// 导出队列实例用于测试
export { auditQueue }