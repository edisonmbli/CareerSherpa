/**
 * 原子性Quota操作模块（简化版）
 * 防止竞态条件攻击，确保quota扣费的准确性和一致性
 */

import { prisma } from '@/lib/prisma'
import { acquireLock, releaseLock } from '@/lib/concurrencyLock'
import { isProdRedisReady } from '@/lib/env'
import { logInfo, logError } from '@/lib/logger'
import { auditQuotaOperation } from '@/lib/audit/async-audit'
import type { Prisma } from '@prisma/client'

// 性能监控指标
interface PerformanceMetrics {
  operationType: string
  duration: number
  cacheHit: boolean
  lockWaitTime: number
  dbQueryTime: number
  userId: string
}

// 性能监控收集器
const performanceMetrics: PerformanceMetrics[] = []

// 记录性能指标
function recordPerformanceMetric(metric: PerformanceMetrics) {
  performanceMetrics.push(metric)
  // 保持最近1000条记录
  if (performanceMetrics.length > 1000) {
    performanceMetrics.shift()
  }
}

// 获取性能统计
export function getPerformanceStats() {
  if (performanceMetrics.length === 0) return null
  
  const avgDuration = performanceMetrics.reduce((sum, m) => sum + m.duration, 0) / performanceMetrics.length
  const cacheHitRate = performanceMetrics.filter(m => m.cacheHit).length / performanceMetrics.length
  const avgLockWaitTime = performanceMetrics.reduce((sum, m) => sum + m.lockWaitTime, 0) / performanceMetrics.length
  
  return {
    totalOperations: performanceMetrics.length,
    avgDuration,
    cacheHitRate,
    avgLockWaitTime,
    recentOperations: performanceMetrics.slice(-10)
  }
}

// 清除quota缓存的辅助函数
async function clearQuotaCache(userId: string): Promise<void> {
  if (isProdRedisReady()) {
    try {
      await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/del/quota:${userId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` }
      })
    } catch {
      // 忽略缓存清除错误
    }
  }
}

// 批量清除缓存
async function batchClearQuotaCache(userIds: string[]): Promise<void> {
  if (!isProdRedisReady() || userIds.length === 0) return
  
  try {
    const pipeline = userIds.map(userId => `del quota:${userId}`).join('\n')
    await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/pipeline`, {
      method: 'POST',
      headers: { 
        Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(pipeline.split('\n').map(cmd => cmd.split(' ')))
    })
  } catch {
    // 忽略批量清除失败
  }
}

// 预热配额缓存
export async function preloadQuotaCache(userIds: string[]): Promise<void> {
  if (!isProdRedisReady() || userIds.length === 0) return
  
  try {
    const quotas = await prisma.quota.findMany({
      where: { userId: { in: userIds } },
      select: {
        userId: true,
        used: true,
        initialGrant: true,
        purchased: true
      }
    })
    
    // 批量写入缓存
    const pipeline = quotas.map(quota => [
      'setex',
      `quota:${quota.userId}`,
      '60', // 1分钟TTL
      JSON.stringify(quota)
    ])
    
    if (pipeline.length > 0) {
      await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/pipeline`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(pipeline)
      })
    }
  } catch (error) {
    logError({
      reqId: `preload-${Date.now()}`,
      route: 'preload-quota-cache',
      error: error instanceof Error ? error.message : 'unknown_error'
    })
  }
}

export interface QuotaOperationResult {
  success: boolean
  quota?: {
    id: string
    userId: string
    used: number
    remaining: number
    initialGrant: number
    purchased: number
  }
  error?: 'quota_not_found' | 'quota_exceeded' | 'quota_operation_locked' | 'insufficient_quota' | 'invalid_amount'
  metrics?: {
    duration: number
    cacheHit: boolean
    lockWaitTime: number
  }
}

// 批量配额操作结果
export interface BatchQuotaOperationResult {
  success: boolean
  results: Array<{
    userId: string
    success: boolean
    quota?: any
    error?: string
  }>
  totalProcessed: number
  totalSuccessful: number
  metrics: {
    totalDuration: number
    avgDuration: number
    cacheHitRate: number
  }
}

/**
 * 原子性quota扣费操作（优化版）
 * 使用数据库事务确保检查和扣费的原子性，添加性能监控
 */
export async function atomicQuotaDeduction(
  userId: string, 
  amount: number,
  operation: string = 'service_creation'
): Promise<QuotaOperationResult> {
  const startTime = Date.now()
  const lockWaitStart = Date.now()
  const cacheHit = false
  
  const lockAcquired = await acquireLock(userId, 'quota-operation', 60000) // 60秒锁定
  const lockWaitTime = Date.now() - lockWaitStart
  
  if (!lockAcquired) {
    const duration = Date.now() - startTime
    recordPerformanceMetric({
      operationType: 'quota_deduction_failed',
      duration,
      cacheHit: false,
      lockWaitTime,
      dbQueryTime: 0,
      userId
    })
    
    logError({ 
      reqId: `quota-${Date.now()}`, 
      route: 'atomic-quota-deduction',
      userKey: userId,
      error: 'quota_operation_locked'
    })
    return { 
      success: false, 
      error: 'quota_operation_locked',
      metrics: { duration, cacheHit: false, lockWaitTime }
    }
  }

  try {
    logInfo({ 
      reqId: `quota-${Date.now()}`, 
      route: 'atomic-quota-deduction',
      userKey: userId,
      operation,
      amount
    })

    const dbQueryStart = Date.now()
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. 获取当前quota状态
      const quota = await tx.quota.findUnique({
        where: { userId }
      })

      if (!quota) {
        throw new Error('quota_not_found')
      }

      // 2. 检查remaining字段是否足够（优先使用remaining字段）
      if (quota.remaining < amount) {
        logError({ 
          reqId: `quota-${Date.now()}`, 
          route: 'atomic-quota-deduction',
          userKey: userId,
          error: 'insufficient_quota',
          currentRemaining: quota.remaining,
          requestAmount: amount
        })
        throw new Error('insufficient_quota')
      }

      // 3. 检查是否为负数（防止恶意回滚）
      if (amount < 0) {
        throw new Error('invalid_amount')
      }

      // 4. 原子性更新quota - 同时更新used和remaining
      const updatedQuota = await tx.quota.update({
        where: { userId },
        data: { 
          used: { increment: amount },
          remaining: { decrement: amount },
          updatedAt: new Date() 
        }
      })

      return updatedQuota
    })
    
    const dbQueryTime = Date.now() - dbQueryStart

    // 6. 清除缓存
    await clearQuotaCache(userId)

    const duration = Date.now() - startTime
    
    // 7. 记录审计日志（异步，不阻塞）
    auditQuotaOperation(
      userId,
      'deduction',
      amount,
      {
        operation,
        newUsed: result.used,
        totalAvailable: result.initialGrant + result.purchased,
        duration,
        lockWaitTime,
        dbQueryTime
      },
      {
        reqId: `quota-${Date.now()}`,
        route: 'atomic-quota-deduction'
      }
    )
    
    recordPerformanceMetric({
      operationType: 'quota_deduction_success',
      duration,
      cacheHit,
      lockWaitTime,
      dbQueryTime,
      userId
    })

    logInfo({ 
      reqId: `quota-${Date.now()}`, 
      route: 'atomic-quota-deduction',
      userKey: userId,
      operation,
      newUsed: result.used,
      duration,
      lockWaitTime,
      dbQueryTime
    })

    return { 
      success: true, 
      quota: result,
      metrics: { duration, cacheHit, lockWaitTime }
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'unknown_error'
    const duration = Date.now() - startTime
    
    recordPerformanceMetric({
      operationType: 'quota_deduction_error',
      duration,
      cacheHit,
      lockWaitTime,
      dbQueryTime: 0,
      userId
    })
    
    logError({ 
      reqId: `quota-${Date.now()}`, 
      route: 'atomic-quota-deduction',
      userKey: userId,
      error: errorMessage,
      duration
    })

    if (errorMessage === 'quota_not_found') {
      return { 
        success: false, 
        error: 'quota_not_found',
        metrics: { duration, cacheHit, lockWaitTime }
      }
    }
    if (errorMessage === 'quota_exceeded') {
      return { 
        success: false, 
        error: 'quota_exceeded',
        metrics: { duration, cacheHit, lockWaitTime }
      }
    }
    if (errorMessage === 'insufficient_quota') {
      return { 
        success: false, 
        error: 'insufficient_quota',
        metrics: { duration, cacheHit, lockWaitTime }
      }
    }

    throw error
  } finally {
    await releaseLock(userId, 'quota-operation')
  }
}

/**
 * 批量配额扣费操作
 * 优化多用户同时扣费的性能
 */
export async function batchQuotaDeduction(
  operations: Array<{
    userId: string
    amount: number
    operation?: string
  }>
): Promise<BatchQuotaOperationResult> {
  const startTime = Date.now()
  const results: Array<{
    userId: string
    success: boolean
    quota?: any
    error?: string
  }> = []
  
  let totalCacheHits = 0
  
  // 预热缓存
  const userIds = operations.map(op => op.userId)
  await preloadQuotaCache(userIds)
  
  // 批量处理
  for (const op of operations) {
    const result = await atomicQuotaDeduction(
      op.userId,
      op.amount,
      op.operation || 'batch_operation'
    )
    
    results.push({
      userId: op.userId,
      success: result.success,
      quota: result.quota,
      error: result.error
    })
    
    if (result.metrics?.cacheHit) {
      totalCacheHits++
    }
  }
  
  const totalDuration = Date.now() - startTime
  const totalSuccessful = results.filter(r => r.success).length
  const avgDuration = totalDuration / operations.length
  const cacheHitRate = totalCacheHits / operations.length
  
  return {
    success: totalSuccessful > 0,
    results,
    totalProcessed: operations.length,
    totalSuccessful,
    metrics: {
      totalDuration,
      avgDuration,
      cacheHitRate
    }
  }
}

/**
 * 检测异常quota使用模式
 */
export async function detectQuotaAnomalies(
  userId: string,
  timeWindowHours: number = 1
): Promise<{ isAnomalous: boolean; details?: any }> {
  try {
    const since = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000)
    
    // 获取最近的服务创建记录
    const recentServices = await prisma.service.findMany({
      where: {
        userId,
        createdAt: { gte: since }
      },
      select: {
        id: true,
        createdAt: true,
        status: true
      }
    })

    const NORMAL_USAGE_THRESHOLD = 10 // 1小时内正常使用阈值
    const isAnomalous = recentServices.length > NORMAL_USAGE_THRESHOLD

    if (isAnomalous) {
      logError({ 
        reqId: `anomaly-${Date.now()}`, 
        route: 'quota-anomaly-detection',
        userKey: userId,
        error: 'quota_usage_anomaly',
        serviceCount: recentServices.length,
        threshold: NORMAL_USAGE_THRESHOLD
      })
    }

    return {
      isAnomalous,
      details: {
        timeWindow: timeWindowHours,
        serviceCount: recentServices.length,
        threshold: NORMAL_USAGE_THRESHOLD,
        recentServices: recentServices.slice(0, 5) // 只返回前5个用于分析
      }
    }

  } catch (error) {
    logError({ 
      reqId: `anomaly-${Date.now()}`, 
      route: 'quota-anomaly-detection',
      userKey: userId,
      error: 'detection_failed'
    })
    return { isAnomalous: false }
  }
}