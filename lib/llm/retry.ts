/**
 * Tier-Aware Smart Retry Module for LLM Operations
 *
 * Design Philosophy:
 * - Free Tier (Gemini): Aggressive retry (3x) - API is naturally unstable, no token cost
 * - Paid Tier (DeepSeek/Zhipu): Conservative retry (1x) - Avoid wasting tokens on non-transient errors
 *
 * This module handles retry WITHIN a single worker execution.
 * QStash queue-level retry remains disabled (retries: 0) to prevent double-charging.
 */

import { logError, logInfo } from '../logger'

// ============================================================================
// Configuration
// ============================================================================

export interface RetryConfig {
  /**
   * Maximum number of retry attempts (not including original attempt)
   */
  maxRetries: number

  /**
   * Base delay in milliseconds for exponential backoff
   */
  baseDelayMs: number

  /**
   * Maximum delay cap in milliseconds
   */
  maxDelayMs: number

  /**
   * HTTP status codes that should trigger a retry
   */
  retryableStatusCodes: number[]
}

/**
 * Free tier configuration: Aggressive retry for unstable Gemini API
 */
const FREE_TIER_CONFIG: RetryConfig = {
  maxRetries: 0,
  baseDelayMs: 1000, // 1s, 2s, 4s
  maxDelayMs: 30000, // Cap at 30s
  retryableStatusCodes: [429, 500, 502, 503, 504],
}

/**
 * Paid tier configuration: Conservative retry only for clearly transient errors
 */
const PAID_TIER_CONFIG: RetryConfig = {
  maxRetries: 0,
  baseDelayMs: 2000, // 2s
  maxDelayMs: 10000, // Cap at 10s
  retryableStatusCodes: [429, 503], // Only rate limit and service unavailable
}

/**
 * Get retry configuration based on tier
 */
export function getRetryConfig(tier: 'free' | 'paid'): RetryConfig {
  return tier === 'free' ? FREE_TIER_CONFIG : PAID_TIER_CONFIG
}

// ============================================================================
// Error Classification
// ============================================================================

/**
 * Determine if an error is retryable based on pattern matching
 */
export function isRetryableError(
  error: any,
  config: RetryConfig,
  tier: 'free' | 'paid',
): boolean {
  const message = (error?.message || '').toLowerCase()
  const statusCode = error?.status || error?.code || extractStatusCode(message)

  // Hard failures - never retry regardless of tier
  if (isHardFailure(message)) {
    return false
  }

  // Status code in retryable list
  if (
    typeof statusCode === 'number' &&
    config.retryableStatusCodes.includes(statusCode)
  ) {
    return true
  }

  // Pattern matching for error messages
  if (
    message.includes('rate limit') ||
    message.includes('429') ||
    message.includes('quota')
  ) {
    return true
  }

  if (
    message.includes('server overloaded') ||
    message.includes('503') ||
    message.includes('service unavailable')
  ) {
    return true
  }

  // Free tier: more aggressive on transient errors
  if (tier === 'free') {
    if (message.includes('timeout')) return true
    if (message.includes('network') || message.includes('connection'))
      return true
    if (
      message.includes('500') ||
      message.includes('502') ||
      message.includes('504')
    )
      return true
    if (message.includes('server error')) return true
  }

  // Paid tier: only retry on explicit transient indicators
  if (tier === 'paid') {
    if (message.includes('timeout') && message.includes('temporary'))
      return true
  }

  return false
}

/**
 * Hard failures that should never be retried
 */
function isHardFailure(message: string): boolean {
  const hardFailurePatterns = [
    'unauthorized',
    '401',
    'invalid api key',
    'insufficient balance',
    '402',
    'invalid parameter',
    'invalid request',
    'json parse',
    'parse error',
    'json_parse_failed',
    'zod validation',
    'schema validation',
    'model not found',
    'context length exceeded',
    'token limit',
  ]

  return hardFailurePatterns.some((pattern) => message.includes(pattern))
}

/**
 * Extract HTTP status code from error message
 */
function extractStatusCode(message: string): number | null {
  // Pattern: [429 Too Many Requests], 429:, status: 429, etc.
  const patterns = [
    /\[(\d{3})\s/,
    /status[:\s]+(\d{3})/i,
    /^(\d{3})[\s:]/,
    /error\s*(\d{3})/i,
  ]

  for (const pattern of patterns) {
    const match = message.match(pattern)
    if (match && match[1]) {
      return parseInt(match[1], 10)
    }
  }

  return null
}

// ============================================================================
// Backoff Calculation
// ============================================================================

/**
 * Calculate delay with exponential backoff and jitter
 *
 * Formula: min(baseDelay * 2^attempt, maxDelay) * jitter
 * Jitter: ±25% to prevent thundering herd
 */
export function calculateBackoff(attempt: number, config: RetryConfig): number {
  const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt)
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs)

  // Add jitter: multiply by random factor between 0.75 and 1.25
  const jitterMultiplier = 0.75 + Math.random() * 0.5

  return Math.floor(cappedDelay * jitterMultiplier)
}

// ============================================================================
// Main Retry Executor
// ============================================================================

export interface RetryContext {
  templateId: string
  modelId: string
  serviceId: string | undefined
  userId: string | undefined
}

export interface RetryResult<T> {
  success: boolean
  data?: T
  error?: Error
  attempts: number
  totalDelayMs: number
}

/**
 * Execute an LLM operation with tier-aware smart retry
 *
 * @param operation - The async operation to execute
 * @param tier - 'free' or 'paid' tier for retry strategy
 * @param context - Logging and debugging context
 * @returns The operation result or throws after max retries
 */
export async function executeWithSmartRetry<T>(
  operation: () => Promise<T>,
  tier: 'free' | 'paid',
  context: RetryContext,
): Promise<T> {
  const config = getRetryConfig(tier)
  let lastError: Error | null = null
  let totalDelayMs = 0

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const result = await operation()

      // Log successful retry if this wasn't the first attempt
      if (attempt > 0) {
        logInfo({
          reqId: context.serviceId || 'unknown',
          route: 'llm/retry',
          phase: 'retry_succeeded',
          templateId: context.templateId,
          modelId: context.modelId,
          attempt: attempt + 1,
          totalDelayMs,
          tier,
        })
      }

      return result
    } catch (error: any) {
      lastError = error

      // Check if error is retryable
      if (!isRetryableError(error, config, tier)) {
        // Non-retryable error, fail immediately
        if (attempt > 0) {
          logError({
            reqId: context.serviceId || 'unknown',
            route: 'llm/retry',
            error: error.message?.slice(0, 200),
            phase: 'non_retryable_after_attempts',
            templateId: context.templateId,
            modelId: context.modelId,
            attempt: attempt + 1,
            tier,
          })
        }
        throw error
      }

      // Check if max retries reached
      if (attempt >= config.maxRetries) {
        logError({
          reqId: context.serviceId || 'unknown',
          route: 'llm/retry',
          error: error.message?.slice(0, 200),
          phase: 'max_retries_exhausted',
          templateId: context.templateId,
          modelId: context.modelId,
          attempts: attempt + 1,
          totalDelayMs,
          tier,
        })
        throw error
      }

      // Calculate backoff delay
      const delay = calculateBackoff(attempt, config)
      totalDelayMs += delay

      logInfo({
        reqId: context.serviceId || 'unknown',
        route: 'llm/retry',
        phase: 'retry_scheduled',
        templateId: context.templateId,
        modelId: context.modelId,
        attempt: attempt + 1,
        totalAttempts: config.maxRetries + 1,
        delayMs: delay,
        error: error.message?.slice(0, 100),
        tier,
      })

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  // This shouldn't happen, but just in case
  throw lastError || new Error('Retry exhausted with unknown error')
}

// ============================================================================
// Helper for determining tier from model ID
// ============================================================================

/**
 * Determine tier based on model ID
 * Gemini models are free tier, others are paid
 */
export function getTierFromModelId(modelId: string): 'free' | 'paid' {
  if (modelId.startsWith('gemini')) {
    return 'free'
  }
  return 'paid'
}
