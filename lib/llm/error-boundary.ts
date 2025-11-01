/**
 * Enhanced Error Handling and Type Safety for LLM Operations
 * 
 * This module provides comprehensive error handling, validation, and monitoring
 * for LLM operations, following Next.js best practices.
 */

import { logError, logInfo } from '../logger'
import { z } from 'zod'

// Error Categories for better debugging and monitoring
export enum LLMErrorCategory {
  INPUT_VALIDATION = 'INPUT_VALIDATION',
  TYPE_SAFETY = 'TYPE_SAFETY', 
  NETWORK = 'NETWORK',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMIT = 'RATE_LIMIT',
  PARSE_ERROR = 'PARSE_ERROR',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  UNKNOWN = 'UNKNOWN'
}

export interface LLMError extends Error {
  category: LLMErrorCategory
  context?: Record<string, unknown>
  retryable: boolean
  userFriendly: string
  originalError?: Error
}

// Zod schemas for runtime type validation
export const SummaryTaskSchema = z.object({
  type: z.enum(['resume', 'job', 'detailed']),
  id: z.string().min(1),
  text: z.string().min(1),
  userId: z.string().min(1),
  serviceId: z.string().min(1),
})

export const RunnableParallelInputSchema = z.record(
  z.string(),
  SummaryTaskSchema
)

export const LLMResponseSchema = z.object({
  content: z.string(),
  usage: z.object({
    totalTokens: z.number().optional(),
  }).optional(),
})

export const LLMTaskResultSchema = z.object({
  taskId: z.string(),
  success: z.boolean(),
  response: LLMResponseSchema.optional(),
  error: z.string().optional(),
  duration: z.number(),
  provider: z.string(),
  model: z.string(),
  tier: z.enum(['free', 'paid']),
  type: z.enum(['vision', 'text']),
})

/**
 * Creates a structured LLM error with proper categorization
 */
export function createLLMError(
  message: string,
  category: LLMErrorCategory,
  context?: Record<string, unknown>,
  originalError?: Error
): LLMError {
  const error = new Error(message) as LLMError
  error.category = category
  if (context !== undefined) {
    error.context = context
  }
  if (originalError !== undefined) {
    error.originalError = originalError
  }
  error.retryable = isRetryableError(category)
  error.userFriendly = getUserFriendlyMessage(category, message)
  
  return error
}

/**
 * Determines if an error is retryable based on its category
 */
function isRetryableError(category: LLMErrorCategory): boolean {
  switch (category) {
    case LLMErrorCategory.NETWORK:
    case LLMErrorCategory.TIMEOUT:
    case LLMErrorCategory.RATE_LIMIT:
    case LLMErrorCategory.PROVIDER_ERROR:
      return true
    case LLMErrorCategory.INPUT_VALIDATION:
    case LLMErrorCategory.TYPE_SAFETY:
    case LLMErrorCategory.PARSE_ERROR:
      return false
    default:
      return false
  }
}

/**
 * Provides user-friendly error messages
 */
function getUserFriendlyMessage(category: LLMErrorCategory, originalMessage: string): string {
  switch (category) {
    case LLMErrorCategory.INPUT_VALIDATION:
      return '输入数据格式不正确，请检查上传的文件内容'
    case LLMErrorCategory.TYPE_SAFETY:
      return '数据类型验证失败，请重试或联系技术支持'
    case LLMErrorCategory.NETWORK:
      return '网络连接异常，请检查网络后重试'
    case LLMErrorCategory.TIMEOUT:
      return '处理超时，请稍后重试'
    case LLMErrorCategory.RATE_LIMIT:
      return '请求过于频繁，请稍后重试'
    case LLMErrorCategory.PARSE_ERROR:
      return 'AI 响应解析失败，正在尝试修复'
    case LLMErrorCategory.PROVIDER_ERROR:
      return 'AI 服务暂时不可用，正在切换备用服务'
    default:
      return '处理过程中出现未知错误，请重试'
  }
}

/**
 * Categorizes errors based on error message patterns
 */
export function categorizeError(error: Error): LLMErrorCategory {
  const message = error.message.toLowerCase()
  
  if (message.includes('cannot read properties of undefined')) {
    return LLMErrorCategory.TYPE_SAFETY
  }
  if (message.includes('validation') || message.includes('invalid')) {
    return LLMErrorCategory.INPUT_VALIDATION
  }
  if (message.includes('network') || message.includes('connection')) {
    return LLMErrorCategory.NETWORK
  }
  if (message.includes('timeout')) {
    return LLMErrorCategory.TIMEOUT
  }
  if (message.includes('rate limit') || message.includes('quota')) {
    return LLMErrorCategory.RATE_LIMIT
  }
  if (message.includes('json') || message.includes('parse')) {
    return LLMErrorCategory.PARSE_ERROR
  }
  if (message.includes('provider') || message.includes('api')) {
    return LLMErrorCategory.PROVIDER_ERROR
  }
  
  return LLMErrorCategory.UNKNOWN
}

/**
 * Enhanced error boundary for LLM operations
 */
export async function withErrorBoundary<T>(
  operation: () => Promise<T>,
  context: {
    operationName: string
    userId?: string
    serviceId?: string
    taskId?: string
  }
): Promise<{ success: true; data: T } | { success: false; error: LLMError }> {
  try {
    const result = await operation()
    
    logInfo({
      reqId: context.taskId || 'unknown',
      route: context.operationName,
      ...(context.userId && { userKey: context.userId }),
      operation: context.operationName,
      serviceId: context.serviceId,
      taskId: context.taskId
    })
    
    return { success: true, data: result }
  } catch (originalError) {
    const error = originalError as Error
    const category = categorizeError(error)
    
    const llmError = createLLMError(
      `${context.operationName} failed: ${error.message}`,
      category,
      {
        operation: context.operationName,
        userId: context.userId,
        serviceId: context.serviceId,
        taskId: context.taskId,
        stack: error.stack,
      },
      error
    )
    
    logError({
      reqId: context.taskId || 'unknown',
      route: context.operationName,
      ...(context.userId && { userKey: context.userId }),
      error: llmError.message,
      operation: context.operationName,
      category: category,
      retryable: llmError.retryable,
      serviceId: context.serviceId,
      taskId: context.taskId
    })
    
    return { success: false, error: llmError }
  }
}

/**
 * Validates input data with detailed error reporting
 */
export function validateInput<T>(
  data: unknown,
  schema: z.ZodSchema<T>,
  context: string
): { success: true; data: T } | { success: false; error: LLMError } {
  try {
    const validatedData = schema.parse(data)
    return { success: true, data: validatedData }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const llmError = createLLMError(
        `Input validation failed in ${context}: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
        LLMErrorCategory.INPUT_VALIDATION,
        {
          context,
          validationErrors: error.errors,
          receivedData: data,
        }
      )
      
      return { success: false, error: llmError }
    }
    
    const llmError = createLLMError(
      `Unexpected validation error in ${context}: ${(error as Error).message}`,
      LLMErrorCategory.UNKNOWN,
      { context, receivedData: data },
      error as Error
    )
    
    return { success: false, error: llmError }
  }
}

/**
 * Type-safe wrapper for RunnableParallel inputs
 */
export function validateRunnableParallelInput(
  input: unknown
): { success: true; data: Record<string, z.infer<typeof SummaryTaskSchema>> } | { success: false; error: LLMError } {
  return validateInput(input, RunnableParallelInputSchema, 'RunnableParallel input')
}

/**
 * Monitors and reports on error patterns for debugging
 */
export class ErrorPatternMonitor {
  private static errorCounts = new Map<string, number>()
  private static lastReported = new Map<string, number>()
  
  static reportError(error: LLMError): void {
    const key = `${error.category}:${error.message.substring(0, 100)}`
    const count = this.errorCounts.get(key) || 0
    this.errorCounts.set(key, count + 1)
    
    const now = Date.now()
    const lastReport = this.lastReported.get(key) || 0
    
    // Report patterns every 10 occurrences or every 5 minutes
    if (count % 10 === 0 || now - lastReport > 5 * 60 * 1000) {
      logError({
        reqId: 'pattern-monitor',
        route: 'error-pattern',
        error: error.message,
        pattern: key,
        occurrences: count,
        category: error.category,
        retryable: error.retryable,
      })
      
      this.lastReported.set(key, now)
    }
  }
  
  static getErrorStats(): Record<string, number> {
    return Object.fromEntries(this.errorCounts)
  }
  
  static reset(): void {
    this.errorCounts.clear()
    this.lastReported.clear()
  }
}