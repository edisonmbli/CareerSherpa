/**
 * 缓存验证机制测试
 * 验证防缓存投毒攻击和数据完整性保护
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  generateChecksum,
  generateSignature,
  validateChecksum,
  validateSignature,
  validateTimestamp,
  validateTTL,
  createSecureCacheData,
  validateCacheData,
  safeReadCache,
  detectCachePoisoning,
  sanitizeCacheData,
  performCacheHealthCheck,
  DEFAULT_VALIDATION_CONFIG
} from '@/lib/cache/validation'

// Mock logger
vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn()
}))

describe('Cache Validation System Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Checksum Generation and Validation', () => {
    it('should generate consistent checksums for same data', () => {
      const data1 = { name: 'test', value: 123 }
      const data2 = { name: 'test', value: 123 }
      const data3 = { value: 123, name: 'test' } // 不同顺序

      const checksum1 = generateChecksum(data1)
      const checksum2 = generateChecksum(data2)
      const checksum3 = generateChecksum(data3)

      expect(checksum1).toBe(checksum2)
      expect(checksum1).toBe(checksum3) // 应该忽略属性顺序
      expect(checksum1).toHaveLength(64) // SHA256 hex长度
    })

    it('should generate different checksums for different data', () => {
      const data1 = { name: 'test1', value: 123 }
      const data2 = { name: 'test2', value: 123 }

      const checksum1 = generateChecksum(data1)
      const checksum2 = generateChecksum(data2)

      expect(checksum1).not.toBe(checksum2)
    })

    it('should validate checksums correctly', () => {
      const data = { name: 'test', value: 123 }
      const validChecksum = generateChecksum(data)
      const invalidChecksum = 'invalid-checksum'

      expect(validateChecksum(data, validChecksum)).toBe(true)
      expect(validateChecksum(data, invalidChecksum)).toBe(false)
    })
  })

  describe('Signature Generation and Validation', () => {
    it('should generate and validate signatures correctly', () => {
      const data = { name: 'test', value: 123 }
      const metadata = { timestamp: Date.now(), version: '1.0' }
      const secretKey = 'test-secret-key'

      const signature = generateSignature(data, metadata, secretKey)
      
      expect(signature).toHaveLength(64) // SHA256 hex长度
      expect(validateSignature(data, metadata, signature, secretKey)).toBe(true)
      expect(validateSignature(data, metadata, signature, 'wrong-key')).toBe(false)
    })

    it('should detect signature tampering', () => {
      const data = { name: 'test', value: 123 }
      const metadata = { timestamp: Date.now(), version: '1.0' }
      const secretKey = 'test-secret-key'

      const signature = generateSignature(data, metadata, secretKey)
      
      // 篡改数据
      const tamperedData = { name: 'test', value: 456 }
      expect(validateSignature(tamperedData, metadata, signature, secretKey)).toBe(false)

      // 篡改元数据
      const tamperedMetadata = { timestamp: Date.now() + 1000, version: '1.0' }
      expect(validateSignature(data, tamperedMetadata, signature, secretKey)).toBe(false)
    })
  })

  describe('Timestamp and TTL Validation', () => {
    it('should validate timestamps correctly', () => {
      const now = Date.now()
      const validTimestamp = now - 1000 // 1秒前
      const oldTimestamp = now - 25 * 60 * 60 * 1000 // 25小时前
      const futureTimestamp = now + 1000 // 1秒后
      const maxAge = 24 * 60 * 60 * 1000 // 24小时

      expect(validateTimestamp(validTimestamp, maxAge)).toBe(true)
      expect(validateTimestamp(oldTimestamp, maxAge)).toBe(false)
      expect(validateTimestamp(futureTimestamp, maxAge)).toBe(false)
    })

    it('should validate TTL correctly', () => {
      const now = Date.now()
      const timestamp = now - 1000 // 1秒前创建
      const validTTL = 60000 // 60秒TTL
      const expiredTTL = 500 // 0.5秒TTL（已过期）

      expect(validateTTL(timestamp, validTTL)).toBe(true)
      expect(validateTTL(timestamp, expiredTTL)).toBe(false)
    })
  })

  describe('Secure Cache Data Creation', () => {
    it('should create secure cache data with all required fields', () => {
      const data = { name: 'test', value: 123 }
      const cacheData = createSecureCacheData(data)

      expect(cacheData).toHaveProperty('data', data)
      expect(cacheData).toHaveProperty('metadata')
      expect(cacheData).toHaveProperty('signature')

      expect(cacheData.metadata).toHaveProperty('version')
      expect(cacheData.metadata).toHaveProperty('timestamp')
      expect(cacheData.metadata).toHaveProperty('ttl')
      expect(cacheData.metadata).toHaveProperty('checksum')
      expect(cacheData.metadata).toHaveProperty('source')

      expect(typeof cacheData.signature).toBe('string')
      expect(cacheData.signature).toHaveLength(64)
    })

    it('should create cache data with custom metadata', () => {
      const data = { name: 'test', value: 123 }
      const customMetadata = {
        ttl: 120000,
        source: 'custom-source'
      }

      const cacheData = createSecureCacheData(data, DEFAULT_VALIDATION_CONFIG, customMetadata)

      expect(cacheData.metadata.ttl).toBe(120000)
      expect(cacheData.metadata.source).toBe('custom-source')
    })
  })

  describe('Cache Data Validation', () => {
    it('should validate correct cache data', () => {
      const data = { name: 'test', value: 123 }
      const cacheData = createSecureCacheData(data)

      const validation = validateCacheData(cacheData)

      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)
      expect(validation.data).toEqual(data)
    })

    it('should reject invalid schema', () => {
      const invalidData = {
        data: { name: 'test' },
        // 缺少metadata和signature
      }

      const validation = validateCacheData(invalidData)

      expect(validation.isValid).toBe(false)
      expect(validation.errors.length).toBeGreaterThan(0)
      expect(validation.errors[0]).toContain('Schema validation failed')
    })

    it('should reject expired data', () => {
      const data = { name: 'test', value: 123 }
      const expiredTimestamp = Date.now() - 25 * 60 * 60 * 1000 // 25小时前
      
      const cacheData = createSecureCacheData(data)
      cacheData.metadata.timestamp = expiredTimestamp

      const validation = validateCacheData(cacheData)

      expect(validation.isValid).toBe(false)
      expect(validation.errors.some(error => error.includes('too old'))).toBe(true)
    })

    it('should reject data with invalid checksum', () => {
      const data = { name: 'test', value: 123 }
      const cacheData = createSecureCacheData(data)
      
      // 篡改checksum
      cacheData.metadata.checksum = 'invalid-checksum'

      const validation = validateCacheData(cacheData)

      expect(validation.isValid).toBe(false)
      expect(validation.errors.some(error => error.includes('Checksum validation failed'))).toBe(true)
    })

    it('should reject data with invalid signature', () => {
      const data = { name: 'test', value: 123 }
      const cacheData = createSecureCacheData(data)
      
      // 篡改signature
      cacheData.signature = 'invalid-signature'

      const validation = validateCacheData(cacheData)

      expect(validation.isValid).toBe(false)
      expect(validation.errors.some(error => error.includes('Signature validation failed'))).toBe(true)
    })
  })

  describe('Safe Cache Reading', () => {
    it('should return data for valid cache', () => {
      const data = { name: 'test', value: 123 }
      const cacheData = createSecureCacheData(data)

      const result = safeReadCache(cacheData)

      expect(result).toEqual(data)
    })

    it('should return null for invalid cache', () => {
      const invalidData = { invalid: 'data' }

      const result = safeReadCache(invalidData)

      expect(result).toBeNull()
    })
  })

  describe('Cache Poisoning Detection', () => {
    it('should detect prototype pollution attempts', () => {
      const maliciousData = {
        data: {
          name: 'test',
          '__proto__': { polluted: true }
        },
        metadata: {
          version: '1.0',
          timestamp: Date.now(),
          ttl: 60000,
          checksum: 'fake-checksum'
        },
        signature: 'fake-signature'
      }

      const detection = detectCachePoisoning('test-key', maliciousData)

      expect(detection.isPoisoned).toBe(true)
      expect(detection.reasons.some(reason => reason.includes('prototype pollution'))).toBe(true)
    })

    it('should detect oversized data', () => {
      const largeData = {
        data: {
          name: 'test',
          largeField: 'x'.repeat(2 * 1024 * 1024) // 2MB
        },
        metadata: {
          version: '1.0',
          timestamp: Date.now(),
          ttl: 60000,
          checksum: 'fake-checksum'
        },
        signature: 'fake-signature'
      }

      const detection = detectCachePoisoning('test-key', largeData)

      expect(detection.isPoisoned).toBe(true)
      expect(detection.reasons.some(reason => reason.includes('Suspicious data size'))).toBe(true)
    })

    it('should detect deep nesting', () => {
      // 创建深度嵌套对象
      const deepObject: any = {}
      let current = deepObject
      for (let i = 0; i < 15; i++) {
        current.nested = {}
        current = current.nested
      }

      const maliciousData = {
        data: deepObject,
        metadata: {
          version: '1.0',
          timestamp: Date.now(),
          ttl: 60000,
          checksum: 'fake-checksum'
        },
        signature: 'fake-signature'
      }

      const detection = detectCachePoisoning('test-key', maliciousData)

      expect(detection.isPoisoned).toBe(true)
      expect(detection.reasons.some(reason => reason.includes('nesting depth'))).toBe(true)
    })

    it('should detect potential code injection', () => {
      const maliciousData = {
        data: {
          name: 'test',
          script: '<script>alert("xss")</script>',
          code: 'function malicious() { eval("dangerous code"); }'
        },
        metadata: {
          version: '1.0',
          timestamp: Date.now(),
          ttl: 60000,
          checksum: 'fake-checksum'
        },
        signature: 'fake-signature'
      }

      const detection = detectCachePoisoning('test-key', maliciousData)

      expect(detection.isPoisoned).toBe(true)
      expect(detection.reasons.some(reason => reason.includes('code injection'))).toBe(true)
    })

    it('should not flag clean data as poisoned', () => {
      const cleanData = createSecureCacheData({ name: 'test', value: 123 })

      const detection = detectCachePoisoning('test-key', cleanData)

      expect(detection.isPoisoned).toBe(false)
      expect(detection.reasons).toHaveLength(0)
    })
  })

  describe('Data Sanitization', () => {
    it('should remove dangerous fields', () => {
      const maliciousData = {
        name: 'test',
        value: 123,
        '__proto__': { polluted: true },
        'constructor': { dangerous: true },
        'prototype': { harmful: true }
      }

      const sanitized = sanitizeCacheData(maliciousData)

      expect(sanitized).not.toHaveProperty('__proto__')
      expect(sanitized).not.toHaveProperty('constructor')
      expect(sanitized).not.toHaveProperty('prototype')
      expect(sanitized).toHaveProperty('name', 'test')
      expect(sanitized).toHaveProperty('value', 123)
    })

    it('should recursively sanitize nested objects', () => {
      const maliciousData = {
        name: 'test',
        nested: {
          value: 456,
          '__proto__': { polluted: true }
        }
      }

      const sanitized = sanitizeCacheData(maliciousData)

      expect(sanitized.nested).not.toHaveProperty('__proto__')
      expect(sanitized.nested).toHaveProperty('value', 456)
    })
  })

  describe('Cache Health Check', () => {
    it('should assess cache health correctly', () => {
      const validData1 = createSecureCacheData({ name: 'test1', value: 123 })
      const validData2 = createSecureCacheData({ name: 'test2', value: 456 })
      const invalidData = { invalid: 'data' }

      const cacheEntries = [
        { key: 'valid1', data: validData1 },
        { key: 'valid2', data: validData2 },
        { key: 'invalid1', data: invalidData }
      ]

      const healthCheck = performCacheHealthCheck(cacheEntries)

      expect(healthCheck.totalEntries).toBe(3)
      expect(healthCheck.validEntries).toBe(2)
      expect(healthCheck.invalidEntries).toBe(1)
      expect(healthCheck.healthScore).toBeCloseTo(66.67, 1)
      expect(healthCheck.issues).toHaveLength(1)
      expect(healthCheck.issues[0].key).toBe('invalid1')
    })

    it('should handle empty cache', () => {
      const healthCheck = performCacheHealthCheck([])

      expect(healthCheck.totalEntries).toBe(0)
      expect(healthCheck.validEntries).toBe(0)
      expect(healthCheck.invalidEntries).toBe(0)
      expect(healthCheck.healthScore).toBe(100)
      expect(healthCheck.issues).toHaveLength(0)
    })
  })
})