/**
 * 缓存数据验证机制
 * 防止缓存投毒攻击和数据完整性问题
 */

import { createHash } from 'crypto'
import { z } from 'zod'
import { logError, logInfo } from '@/lib/logger'

// 缓存数据结构验证Schema
// 定义可缓存数据的Zod schema
const CacheableDataSchema: z.ZodType<CacheableData> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.undefined(),
    z.array(CacheableDataSchema),
    z.record(z.string(), CacheableDataSchema)
  ])
)

export const CacheDataSchema = z.object({
  data: CacheableDataSchema,
  metadata: z.object({
    version: z.string(),
    timestamp: z.number(),
    ttl: z.number(),
    checksum: z.string(),
    source: z.string().optional()
  }),
  signature: z.string()
})

export type CacheData = z.infer<typeof CacheDataSchema>

// 验证配置
export interface ValidationConfig {
  enableChecksumValidation: boolean
  enableSignatureValidation: boolean
  enableSchemaValidation: boolean
  enableTimestampValidation: boolean
  maxAge: number // 最大缓存年龄（毫秒）
  secretKey: string // 签名密钥
}

export const DEFAULT_VALIDATION_CONFIG: ValidationConfig = {
  enableChecksumValidation: true,
  enableSignatureValidation: true,
  enableSchemaValidation: true,
  enableTimestampValidation: true,
  maxAge: 24 * 60 * 60 * 1000, // 24小时
  secretKey: process.env.CACHE_VALIDATION_SECRET || 'default-secret-key'
}

// 定义可缓存的数据类型
type CacheableData = string | number | boolean | null | undefined | CacheableData[] | { [key: string]: CacheableData }

/**
 * 生成数据校验和
 */
export function generateChecksum(data: CacheableData): string {
  const dataString = JSON.stringify(data, Object.keys(data as object).sort())
  return createHash('sha256').update(dataString).digest('hex')
}

/**
 * 生成数据签名
 */
export function generateSignature(data: CacheableData, metadata: CacheData['metadata'], secretKey: string): string {
  const payload = JSON.stringify({ data, metadata })
  return createHash('sha256').update(payload + secretKey).digest('hex')
}

/**
 * 验证数据校验和
 */
export function validateChecksum(data: CacheableData, expectedChecksum: string): boolean {
  const actualChecksum = generateChecksum(data)
  return actualChecksum === expectedChecksum
}

/**
 * 验证数据签名
 */
export function validateSignature(
  data: CacheableData, 
  metadata: CacheData['metadata'], 
  expectedSignature: string, 
  secretKey: string
): boolean {
  const actualSignature = generateSignature(data, metadata, secretKey)
  return actualSignature === expectedSignature
}

/**
 * 验证时间戳
 */
export function validateTimestamp(timestamp: number, maxAge: number): boolean {
  const now = Date.now()
  const age = now - timestamp
  return age >= 0 && age <= maxAge
}

/**
 * 验证TTL
 */
export function validateTTL(timestamp: number, ttl: number): boolean {
  const now = Date.now()
  const expirationTime = timestamp + ttl
  return now < expirationTime
}

/**
 * 创建安全的缓存数据
 */
export function createSecureCacheData(
  data: CacheableData,
  config: ValidationConfig = DEFAULT_VALIDATION_CONFIG,
  customMetadata: Partial<CacheData['metadata']> = {}
): CacheData {
  const timestamp = Date.now()
  const checksum = generateChecksum(data)
  
  const metadata = {
    version: '1.0',
    timestamp,
    ttl: customMetadata.ttl || 60 * 60 * 1000, // 默认1小时
    checksum,
    source: customMetadata.source || 'system',
    ...customMetadata
  }

  const signature = generateSignature(data, metadata, config.secretKey)

  return {
    data,
    metadata,
    signature
  }
}

/**
 * 验证缓存数据完整性
 */
export function validateCacheData(
  cacheData: unknown,
  config: ValidationConfig = DEFAULT_VALIDATION_CONFIG
): { isValid: boolean; errors: string[]; data?: CacheableData } {
  const errors: string[] = []

  try {
    // Schema验证
    if (config.enableSchemaValidation) {
      const parseResult = CacheDataSchema.safeParse(cacheData)
      if (!parseResult.success) {
        errors.push(`Schema validation failed: ${parseResult.error.message}`)
        return { isValid: false, errors }
      }
    }

    const validatedData = cacheData as CacheData

    // 时间戳验证
    if (config.enableTimestampValidation) {
      if (!validateTimestamp(validatedData.metadata.timestamp, config.maxAge)) {
        errors.push('Timestamp validation failed: data is too old')
      }

      if (!validateTTL(validatedData.metadata.timestamp, validatedData.metadata.ttl)) {
        errors.push('TTL validation failed: data has expired')
      }
    }

    // 校验和验证
    if (config.enableChecksumValidation) {
      if (!validateChecksum(validatedData.data, validatedData.metadata.checksum)) {
        errors.push('Checksum validation failed: data integrity compromised')
      }
    }

    // 签名验证
    if (config.enableSignatureValidation) {
      if (!validateSignature(
        validatedData.data,
        validatedData.metadata,
        validatedData.signature,
        config.secretKey
      )) {
        errors.push('Signature validation failed: data authenticity compromised')
      }
    }

    const isValid = errors.length === 0

    if (!isValid) {
      logError({
        reqId: 'cache-validation',
        route: 'cache/validation',
        error: 'Cache validation failed',
        errors: errors.join(', '),
        metadata: validatedData.metadata
      })
    } else {
      logInfo({
        reqId: 'cache-validation',
        route: 'cache/validation',
        source: validatedData.metadata.source,
        timestamp: validatedData.metadata.timestamp
      })
    }

    return {
      isValid,
      errors,
      data: isValid ? validatedData.data : undefined
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown validation error'
    errors.push(`Validation exception: ${errorMessage}`)
    logError({
      reqId: 'cache-validation-exception',
      route: 'cache/validation',
      error: errorMessage
    })
    
    return { isValid: false, errors }
  }
}

/**
 * 安全的缓存读取
 */
export function safeReadCache(
  cacheData: unknown,
  config: ValidationConfig = DEFAULT_VALIDATION_CONFIG
): CacheableData | null {
  const validation = validateCacheData(cacheData, config)
  
  if (validation.isValid) {
    return validation.data
  }

  logError({
    reqId: 'cache-read-validation',
    route: 'cache/safe-read',
    error: 'Cache read failed validation',
    validationErrors: validation.errors.join(', ')
  })
  return null
}

/**
 * 检测潜在的缓存投毒攻击
 */
export function detectCachePoisoning(
  cacheKey: string,
  cacheData: unknown,
  config: ValidationConfig = DEFAULT_VALIDATION_CONFIG
): { isPoisoned: boolean; reasons: string[] } {
  const reasons: string[] = []

  try {
    // 基本结构检查
    if (typeof cacheData !== 'object' || cacheData === null) {
      reasons.push('Invalid cache data structure')
      return { isPoisoned: true, reasons }
    }

    const data = cacheData as any

    // 检查是否包含恶意字段
    const maliciousFields = ['__proto__', 'constructor', 'prototype']
    
    function checkForMaliciousFields(obj: any, path = ''): void {
      if (typeof obj !== 'object' || obj === null) return
      
      // 使用Object.keys和Object.getOwnPropertyNames来获取所有属性
      const allKeys = [...new Set([...Object.keys(obj), ...Object.getOwnPropertyNames(obj)])]
      
      for (const key of allKeys) {
        if (maliciousFields.includes(key)) {
          reasons.push(`Potential prototype pollution: contains ${key} at ${path || 'root'}`)
        }
        
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          checkForMaliciousFields(obj[key], path ? `${path}.${key}` : key)
        }
      }
      
      // 检查__proto__属性 - 使用in操作符和直接访问
      if ('__proto__' in obj && obj['__proto__'] !== Object.prototype) {
        reasons.push(`Potential prototype pollution: contains __proto__ at ${path || 'root'}`)
      }
      
      // 检查constructor属性是否被篡改
      if (obj.constructor && obj.constructor !== Object && obj.constructor !== Array) {
        const constructorName = obj.constructor.name
        if (constructorName !== 'Object' && constructorName !== 'Array') {
          reasons.push(`Potential prototype pollution: suspicious constructor at ${path || 'root'}`)
        }
      }
    }
    
    checkForMaliciousFields(data)

    // 检查数据大小异常
    const dataString = JSON.stringify(data)
    const dataSize = Buffer.byteLength(dataString, 'utf8')
    const maxSize = 1024 * 1024 // 1MB
    if (dataSize > maxSize) {
      reasons.push(`Suspicious data size: ${dataSize} bytes exceeds limit`)
    }

    // 检查嵌套深度
    const maxDepth = 10
    const depth = getObjectDepth(data)
    if (depth > maxDepth) {
      reasons.push(`Suspicious nesting depth: ${depth} exceeds limit`)
    }

    // 检查是否包含可执行代码
    const codePatterns = [
      /function\s*\(/,
      /eval\s*\(/,
      /setTimeout\s*\(/,
      /setInterval\s*\(/,
      /<script/i,
      /javascript:/i
    ]

    for (const pattern of codePatterns) {
      if (pattern.test(dataString)) {
        reasons.push(`Potential code injection: matches pattern ${pattern}`)
      }
    }

    // 验证数据完整性
    const validation = validateCacheData(data, config)
    if (!validation.isValid) {
      reasons.push(...validation.errors.map(error => `Integrity check failed: ${error}`))
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    reasons.push(`Detection error: ${errorMessage}`)
  }

  const isPoisoned = reasons.length > 0

  if (isPoisoned) {
    logError({
      reqId: 'cache-poisoning-detection',
      route: 'cache/poisoning-detection',
      error: 'Cache poisoning detected',
      cacheKey, 
      reasons: reasons.join(', '),
      timestamp: Date.now()
    })
  }

  return { isPoisoned, reasons }
}

/**
 * 获取对象嵌套深度
 */
function getObjectDepth(obj: unknown, depth = 0): number {
  if (depth > 20) return depth // 防止无限递归
  
  if (typeof obj !== 'object' || obj === null) {
    return depth
  }

  let maxDepth = depth
  for (const key in obj as Record<string, unknown>) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const childDepth = getObjectDepth((obj as Record<string, unknown>)[key], depth + 1)
      maxDepth = Math.max(maxDepth, childDepth)
    }
  }

  return maxDepth
}

/**
 * 清理可疑的缓存数据
 */
export function sanitizeCacheData(data: CacheableData): CacheableData {
  if (typeof data !== 'object' || data === null) {
    return data
  }

  // 处理数组
  if (Array.isArray(data)) {
    return data.map(item => sanitizeCacheData(item))
  }

  // 处理对象
  const obj = data as { [key: string]: CacheableData }
  
  // 移除危险字段
  const dangerousFields = ['__proto__', 'constructor', 'prototype']
  const sanitized = { ...obj }

  for (const field of dangerousFields) {
    delete sanitized[field]
  }

  // 递归清理嵌套对象
  for (const key in sanitized) {
    if (Object.prototype.hasOwnProperty.call(sanitized, key)) {
      sanitized[key] = sanitizeCacheData(sanitized[key])
    }
  }

  return sanitized
}

/**
 * 缓存健康检查
 */
export function performCacheHealthCheck(
  cacheEntries: Array<{ key: string; data: unknown }>,
  config: ValidationConfig = DEFAULT_VALIDATION_CONFIG
): {
  totalEntries: number
  validEntries: number
  invalidEntries: number
  poisonedEntries: number
  healthScore: number
  issues: Array<{ key: string; issues: string[] }>
} {
  const issues: Array<{ key: string; issues: string[] }> = []
  let validEntries = 0
  let poisonedEntries = 0

  for (const entry of cacheEntries) {
    const entryIssues: string[] = []

    // 验证数据完整性
    const validation = validateCacheData(entry.data, config)
    if (!validation.isValid) {
      entryIssues.push(...validation.errors)
    } else {
      validEntries++
    }

    // 检测缓存投毒
    const poisoning = detectCachePoisoning(entry.key, entry.data, config)
    if (poisoning.isPoisoned) {
      entryIssues.push(...poisoning.reasons)
      poisonedEntries++
    }

    if (entryIssues.length > 0) {
      issues.push({ key: entry.key, issues: entryIssues })
    }
  }

  const totalEntries = cacheEntries.length
  const invalidEntries = totalEntries - validEntries
  const healthScore = totalEntries > 0 ? (validEntries / totalEntries) * 100 : 100

  logInfo({
    reqId: 'cache-health-check',
    route: 'cache/health-check',
    totalEntries,
    validEntries,
    invalidEntries,
    poisonedEntries,
    healthScore
  })

  return {
    totalEntries,
    validEntries,
    invalidEntries,
    poisonedEntries,
    healthScore,
    issues
  }
}