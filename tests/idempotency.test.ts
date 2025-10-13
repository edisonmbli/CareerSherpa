import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  generateIdempotencyKey,
  checkIdempotency,
  getDefaultTTL,
  withIdempotency,
  DEFAULT_TTL_MS
} from '@/lib/idempotency'
import type { IdempotencyStep } from '@prisma/client'

// Mock the DAL functions
vi.mock('@/lib/dal', () => ({
  createIdempotencyKey: vi.fn(),
  getIdempotencyKey: vi.fn(),
}))

import { createIdempotencyKey, getIdempotencyKey } from '@/lib/dal'

describe('Idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateIdempotencyKey', () => {
    it('should generate consistent keys for same input', () => {
      const userKey = 'user-123'
      const step: IdempotencyStep = 'match'
      const requestBody = { test: 'data' }

      const key1 = generateIdempotencyKey(userKey, step, requestBody)
      const key2 = generateIdempotencyKey(userKey, step, requestBody)

      expect(key1).toBe(key2)
      expect(key1).toMatch(/^idem:user-123:match:[a-f0-9]{16}$/)
    })

    it('should generate different keys for different inputs', () => {
      const userKey = 'user-123'
      const step: IdempotencyStep = 'match'
      const requestBody1 = { test: 'data1' }
      const requestBody2 = { test: 'data2' }

      const key1 = generateIdempotencyKey(userKey, step, requestBody1)
      const key2 = generateIdempotencyKey(userKey, step, requestBody2)

      expect(key1).not.toBe(key2)
    })

    it('should handle no request body', () => {
      const userKey = 'user-123'
      const step: IdempotencyStep = 'match'

      const key = generateIdempotencyKey(userKey, step)

      expect(key).toBe('idem:user-123:match:no-body')
    })
  })

  describe('checkIdempotency', () => {
    it('should allow processing for new key', async () => {
      const config = {
        userKey: 'user-123',
        step: 'match' as IdempotencyStep,
        ttlMs: 15 * 60 * 1000,
        requestBody: { test: 'data' }
      }

      vi.mocked(getIdempotencyKey).mockResolvedValue(null)
      vi.mocked(createIdempotencyKey).mockResolvedValue({
        key: 'test-key',
        userKey: 'user-123',
        step: 'match',
        ttlMs: 900000,
        createdAt: new Date()
      })

      const result = await checkIdempotency(config)

      expect(result.shouldProcess).toBe(true)
      expect(result.isReplay).toBe(false)
      expect(result.key).toMatch(/^idem:user-123:match:[a-f0-9]{16}$/)
      expect(createIdempotencyKey).toHaveBeenCalled()
    })

    it('should prevent processing for existing non-expired key', async () => {
      const config = {
        userKey: 'user-123',
        step: 'match' as IdempotencyStep,
        ttlMs: 15 * 60 * 1000,
        requestBody: { test: 'data' }
      }

      const existingKey = {
        key: 'test-key',
        userKey: 'user-123',
        step: 'match' as IdempotencyStep,
        ttlMs: 15 * 60 * 1000,
        createdAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
      }

      vi.mocked(getIdempotencyKey).mockResolvedValue(existingKey)

      const result = await checkIdempotency(config)

      expect(result.shouldProcess).toBe(false)
      expect(result.isReplay).toBe(true)
      expect(createIdempotencyKey).not.toHaveBeenCalled()
    })

    it('should allow processing for expired key', async () => {
      const config = {
        userKey: 'user-123',
        step: 'match' as IdempotencyStep,
        ttlMs: 15 * 60 * 1000,
        requestBody: { test: 'data' }
      }

      const expiredKey = {
        key: 'test-key',
        userKey: 'user-123',
        step: 'match' as IdempotencyStep,
        ttlMs: 15 * 60 * 1000,
        createdAt: new Date(Date.now() - 20 * 60 * 1000), // 20 minutes ago
      }

      vi.mocked(getIdempotencyKey).mockResolvedValue(expiredKey)

      const result = await checkIdempotency(config)

      expect(result.shouldProcess).toBe(true)
      expect(result.isReplay).toBe(false)
    })

    it('should handle database errors gracefully', async () => {
      const config = {
        userKey: 'user-123',
        step: 'match' as IdempotencyStep,
        ttlMs: 15 * 60 * 1000,
        requestBody: { test: 'data' }
      }

      vi.mocked(getIdempotencyKey).mockResolvedValue(null)
      vi.mocked(createIdempotencyKey).mockRejectedValue(new Error('DB Error'))

      const result = await checkIdempotency(config)

      expect(result.shouldProcess).toBe(false)
      expect(result.isReplay).toBe(true)
    })
  })

  describe('getDefaultTTL', () => {
    it('should return correct TTL for each step', () => {
      expect(getDefaultTTL('match')).toBe(DEFAULT_TTL_MS.match)
      expect(getDefaultTTL('resume')).toBe(DEFAULT_TTL_MS.resume)
      expect(getDefaultTTL('interview')).toBe(DEFAULT_TTL_MS.interview)
    })

    it('should return default TTL for unknown step', () => {
      // @ts-expect-error - testing unknown step
      expect(getDefaultTTL('unknown')).toBe(15 * 60 * 1000)
    })
  })

  describe('withIdempotency', () => {
    it('should execute handler for new request', async () => {
      const config = {
        userKey: 'user-123',
        step: 'match' as IdempotencyStep,
        ttlMs: 15 * 60 * 1000,
        requestBody: { test: 'data' }
      }

      const mockHandler = vi.fn().mockResolvedValue('test result')

      vi.mocked(getIdempotencyKey).mockResolvedValue(null)
      vi.mocked(createIdempotencyKey).mockResolvedValue({
        key: 'test-key',
        userKey: 'user-123',
        step: 'match',
        ttlMs: 900000,
        createdAt: new Date()
      })

      const result = await withIdempotency(config, mockHandler)

      expect(result.isReplay).toBe(false)
      expect(result.result).toBe('test result')
      expect(mockHandler).toHaveBeenCalled()
    })

    it('should skip handler for replay request', async () => {
      const config = {
        userKey: 'user-123',
        step: 'match' as IdempotencyStep,
        ttlMs: 15 * 60 * 1000,
        requestBody: { test: 'data' }
      }

      const mockHandler = vi.fn().mockResolvedValue('test result')

      const existingKey = {
        key: 'test-key',
        userKey: 'user-123',
        step: 'match' as IdempotencyStep,
        ttlMs: 15 * 60 * 1000,
        createdAt: new Date(Date.now() - 5 * 60 * 1000),
      }

      vi.mocked(getIdempotencyKey).mockResolvedValue(existingKey)

      const result = await withIdempotency(config, mockHandler)

      expect(result.isReplay).toBe(true)
      expect(result.result).toBeUndefined()
      expect(mockHandler).not.toHaveBeenCalled()
    })
  })
})