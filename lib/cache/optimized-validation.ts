/**
 * 优化的缓存验证机制
 * 减少性能开销，支持分级验证和快速路径
 */

// 简单的同步hash函数，避免Edge Runtime问题
import { z } from 'zod'
import { logError, logInfo } from '@/lib/logger'

// 简单的字符串hash函数（FNV-1a算法的简化版本）
function simpleHash(str: string): string {
  let hash = 2166136261
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash *= 16777619
  }
  return (hash >>> 0).toString(16)
}

// 验证级别枚举
export enum ValidationLevel {
  NONE = 0,        // 无验证（最快）
  BASIC = 1,       // 基础验证（结构+时间）
  STANDARD = 2,    // 标准验证（基础+校验和）
  STRICT = 3       // 严格验证（标准+签名）
}

// 轻量级缓存数据结构
export interface LightCacheData {
  d: any           // data (压缩字段名)
  t: number        // timestamp
  e: number        // expires (timestamp + ttl)
  c?: string       // checksum (可选)
  s?: string       // signature (可选)
  v?: string       // version (可选)
}

// 验证配置
export interface OptimizedValidationConfig {
  level: ValidationLevel
  maxAge: number
  secretKey?: string
  enableCompression: boolean
  skipValidationForTrustedSources: boolean
  trustedSources: Set<string>
}

export const FAST_VALIDATION_CONFIG: OptimizedValidationConfig = {
  level: ValidationLevel.BASIC,
  maxAge: 24 * 60 * 60 * 1000, // 24小时
  enableCompression: true,
  skipValidationForTrustedSources: true,
  trustedSources: new Set(['system', 'database', 'internal'])
}

export const SECURE_VALIDATION_CONFIG: OptimizedValidationConfig = {
  level: ValidationLevel.STRICT,
  maxAge: 24 * 60 * 60 * 1000,
  secretKey: process.env.CACHE_VALIDATION_SECRET || 'default-secret-key',
  enableCompression: true,
  skipValidationForTrustedSources: false,
  trustedSources: new Set()
}

// 快速校验和生成（使用更快的算法）
function fastChecksum(data: any): string {
  const str = typeof data === 'string' ? data : JSON.stringify(data)
  const hash = simpleHash(str)
  return hash.substring(0, 16) // 只取前16位
}

// 快速签名生成
function fastSignature(data: any, timestamp: number, secretKey: string): string {
  const checksum = fastChecksum(data)
  const payload = `${checksum}.${timestamp}`
  const hash = simpleHash(payload + secretKey)
  return hash.substring(0, 32)
}

/**
 * 创建轻量级缓存数据
 */
export function createLightCacheData(
  data: any,
  config: OptimizedValidationConfig = FAST_VALIDATION_CONFIG,
  ttlMs: number = 60 * 60 * 1000
): LightCacheData {
  const now = Date.now()
  const cacheData: LightCacheData = {
    d: data,
    t: now,
    e: now + ttlMs
  }

  // 根据验证级别添加相应字段
  if (config.level >= ValidationLevel.STANDARD) {
    cacheData.c = fastChecksum(data)
  }

  if (config.level >= ValidationLevel.STRICT && config.secretKey) {
    cacheData.s = fastSignature(data, now, config.secretKey)
  }

  return cacheData
}

/**
 * 快速验证缓存数据
 */
export function fastValidateCache(
  cacheData: unknown,
  config: OptimizedValidationConfig = FAST_VALIDATION_CONFIG
): { isValid: boolean; data?: any; skipReason?: string } {
  // 无验证模式
  if (config.level === ValidationLevel.NONE) {
    return { isValid: true, data: (cacheData as any)?.d }
  }

  // 基础结构检查
  if (!cacheData || typeof cacheData !== 'object') {
    return { isValid: false }
  }

  const data = cacheData as LightCacheData

  // 基础验证：时间检查
  if (config.level >= ValidationLevel.BASIC) {
    const now = Date.now()
    
    // 快速过期检查
    if (data.e && now > data.e) {
      return { isValid: false }
    }

    // 最大年龄检查
    if (data.t && (now - data.t) > config.maxAge) {
      return { isValid: false }
    }
  }

  // 标准验证：校验和检查
  if (config.level >= ValidationLevel.STANDARD && data.c) {
    const expectedChecksum = fastChecksum(data.d)
    if (data.c !== expectedChecksum) {
      return { isValid: false }
    }
  }

  // 严格验证：签名检查
  if (config.level >= ValidationLevel.STRICT && data.s && config.secretKey) {
    const expectedSignature = fastSignature(data.d, data.t, config.secretKey)
    if (data.s !== expectedSignature) {
      return { isValid: false }
    }
  }

  return { isValid: true, data: data.d }
}

/**
 * 智能验证：根据数据源和类型选择验证级别
 */
export function smartValidateCache(
  cacheData: unknown,
  source: string = 'unknown',
  dataType: string = 'general'
): { isValid: boolean; data?: any; validationLevel: ValidationLevel } {
  // 为不同数据类型选择合适的验证级别
  let config: OptimizedValidationConfig

  if (source === 'quota' || source === 'payment') {
    // 关键数据使用严格验证
    config = SECURE_VALIDATION_CONFIG
  } else if (source === 'user' || source === 'service') {
    // 重要数据使用标准验证
    config = { ...FAST_VALIDATION_CONFIG, level: ValidationLevel.STANDARD }
  } else {
    // 一般数据使用快速验证
    config = FAST_VALIDATION_CONFIG
  }

  // 信任源跳过验证
  if (config.skipValidationForTrustedSources && config.trustedSources.has(source)) {
    return {
      isValid: true,
      data: (cacheData as any)?.d,
      validationLevel: ValidationLevel.NONE
    }
  }

  const result = fastValidateCache(cacheData, config)
  return {
    ...result,
    validationLevel: config.level
  }
}

/**
 * 批量验证缓存数据
 */
export function batchValidateCache(
  entries: Array<{ key: string; data: unknown; source?: string }>,
  config: OptimizedValidationConfig = FAST_VALIDATION_CONFIG
): {
  validEntries: Array<{ key: string; data: any }>
  invalidEntries: Array<{ key: string; reason: string }>
  stats: {
    total: number
    valid: number
    invalid: number
    validationTime: number
  }
} {
  const startTime = performance.now()
  const validEntries: Array<{ key: string; data: any }> = []
  const invalidEntries: Array<{ key: string; reason: string }> = []

  for (const entry of entries) {
    const validation = smartValidateCache(entry.data, entry.source)
    
    if (validation.isValid && validation.data !== undefined) {
      validEntries.push({ key: entry.key, data: validation.data })
    } else {
      invalidEntries.push({ 
        key: entry.key, 
        reason: 'validation_failed' 
      })
    }
  }

  const validationTime = performance.now() - startTime

  return {
    validEntries,
    invalidEntries,
    stats: {
      total: entries.length,
      valid: validEntries.length,
      invalid: invalidEntries.length,
      validationTime
    }
  }
}

/**
 * 缓存预热：批量创建和验证缓存数据
 */
export function preheatCache<T>(
  dataMap: Map<string, T>,
  config: OptimizedValidationConfig = FAST_VALIDATION_CONFIG,
  ttlMs: number = 60 * 60 * 1000
): Map<string, LightCacheData> {
  const cacheMap = new Map<string, LightCacheData>()

  for (const [key, data] of dataMap) {
    const cacheData = createLightCacheData(data, config, ttlMs)
    cacheMap.set(key, cacheData)
  }

  return cacheMap
}

/**
 * 性能监控：验证性能统计
 */
export class ValidationPerformanceMonitor {
  private stats = {
    totalValidations: 0,
    validationTime: 0,
    cacheHits: 0,
    cacheMisses: 0,
    validationErrors: 0
  }

  recordValidation(timeMs: number, isValid: boolean, isCacheHit: boolean) {
    this.stats.totalValidations++
    this.stats.validationTime += timeMs
    
    if (isCacheHit) {
      this.stats.cacheHits++
    } else {
      this.stats.cacheMisses++
    }

    if (!isValid) {
      this.stats.validationErrors++
    }
  }

  getStats() {
    return {
      ...this.stats,
      averageValidationTime: this.stats.totalValidations > 0 
        ? this.stats.validationTime / this.stats.totalValidations 
        : 0,
      cacheHitRate: this.stats.totalValidations > 0 
        ? this.stats.cacheHits / this.stats.totalValidations 
        : 0,
      errorRate: this.stats.totalValidations > 0 
        ? this.stats.validationErrors / this.stats.totalValidations 
        : 0
    }
  }

  reset() {
    this.stats = {
      totalValidations: 0,
      validationTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      validationErrors: 0
    }
  }
}

// 全局性能监控实例
export const validationMonitor = new ValidationPerformanceMonitor()

/**
 * 装饰器：自动性能监控
 */
export function withValidationMonitoring<T extends (...args: any[]) => any>(
  fn: T,
  name: string
): T {
  return ((...args: any[]) => {
    const startTime = performance.now()
    const result = fn(...args)
    const endTime = performance.now()
    
    const isValid = result?.isValid ?? true
    const isCacheHit = result?.data !== undefined
    
    validationMonitor.recordValidation(endTime - startTime, isValid, isCacheHit)
    
    return result
  }) as T
}

/**
 * 缓存健康检查（优化版）
 */
export function quickHealthCheck(
  sampleSize: number = 100,
  config: OptimizedValidationConfig = FAST_VALIDATION_CONFIG
): Promise<{
  healthScore: number
  averageValidationTime: number
  recommendedLevel: ValidationLevel
}> {
  return new Promise((resolve) => {
    // 模拟健康检查逻辑
    const startTime = performance.now()
    
    // 这里应该从实际缓存中采样数据进行检查
    // 为了演示，我们模拟一些数据
    const mockValidations = Array(sampleSize).fill(null).map(() => {
      const mockData = createLightCacheData({ test: 'data' }, config)
      return fastValidateCache(mockData, config)
    })
    
    const validCount = mockValidations.filter(v => v.isValid).length
    const healthScore = (validCount / sampleSize) * 100
    const averageValidationTime = (performance.now() - startTime) / sampleSize
    
    // 根据性能推荐验证级别
    let recommendedLevel = ValidationLevel.STANDARD
    if (averageValidationTime < 0.1) {
      recommendedLevel = ValidationLevel.STRICT
    } else if (averageValidationTime > 1) {
      recommendedLevel = ValidationLevel.BASIC
    }
    
    resolve({
      healthScore,
      averageValidationTime,
      recommendedLevel
    })
  })
}