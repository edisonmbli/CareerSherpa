import crypto from 'crypto'
import { createIdempotencyKey, getIdempotencyKey } from './dal'
import type { IdempotencyStep } from '@prisma/client'

export interface IdempotencyConfig {
  step: IdempotencyStep
  ttlMs: number
  userKey: string
  requestBody?: any
}

export interface IdempotencyResult {
  key: string
  isReplay: boolean
  shouldProcess: boolean
}

/**
 * Generate idempotency key from request parameters
 */
export function generateIdempotencyKey(
  userKey: string,
  step: IdempotencyStep,
  requestBody?: any
): string {
  const bodyHash = requestBody 
    ? crypto.createHash('sha256').update(JSON.stringify(requestBody)).digest('hex').slice(0, 16)
    : 'no-body'
  
  return `idem:${userKey}:${step}:${bodyHash}`
}

/**
 * Check and create idempotency key
 * Returns whether this is a replay request and if processing should continue
 */
export async function checkIdempotency(config: IdempotencyConfig): Promise<IdempotencyResult> {
  const key = generateIdempotencyKey(config.userKey, config.step, config.requestBody)
  
  try {
    // Check if key already exists
    const existing = await getIdempotencyKey(key)
    
    if (existing) {
      // Check if key has expired
      const isExpired = Date.now() - existing.createdAt.getTime() > existing.ttlMs
      
      if (isExpired) {
        // Key expired, allow processing
        return {
          key,
          isReplay: false,
          shouldProcess: true
        }
      } else {
        // Key exists and not expired, this is a replay
        return {
          key,
          isReplay: true,
          shouldProcess: false
        }
      }
    }
    
    // Key doesn't exist, create it and allow processing
    await createIdempotencyKey(key, config.userKey, config.step, config.ttlMs)
    
    return {
      key,
      isReplay: false,
      shouldProcess: true
    }
  } catch (error) {
    // If there's an error (e.g., unique constraint violation from concurrent requests),
    // treat it as a replay to be safe
    return {
      key,
      isReplay: true,
      shouldProcess: false
    }
  }
}

/**
 * Default TTL configurations for different steps
 */
export const DEFAULT_TTL_MS = {
  match: 15 * 60 * 1000,      // 15 minutes
  resume: 30 * 60 * 1000,     // 30 minutes
  interview: 30 * 60 * 1000,  // 30 minutes
} as const

/**
 * Helper function to get default TTL for a step
 */
export function getDefaultTTL(step: IdempotencyStep): number {
  return DEFAULT_TTL_MS[step] || 15 * 60 * 1000
}

/**
 * Middleware helper for API routes to handle idempotency
 */
export async function withIdempotency<T>(
  config: IdempotencyConfig,
  handler: () => Promise<T>
): Promise<{ result?: T; isReplay: boolean; key: string }> {
  const idempotencyResult = await checkIdempotency(config)
  
  if (!idempotencyResult.shouldProcess) {
    // This is a replay, return without processing
    return {
      isReplay: true,
      key: idempotencyResult.key
    }
  }
  
  // Process the request
  const result = await handler()
  
  return {
    result,
    isReplay: false,
    key: idempotencyResult.key
  }
}