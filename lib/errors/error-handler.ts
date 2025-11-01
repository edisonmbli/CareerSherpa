/**
 * 增强的错误处理工具类
 * 集成错误映射、日志记录和用户友好的错误响应
 */

import { 
  getUserFriendlyError, 
  formatErrorForLogging, 
  isRetryableError,
  shouldContactSupport,
  getErrorSeverity,
  type UserFriendlyError,
  type SupportedLocale,
  type ErrorSeverity
} from './error-mapping'

export interface ErrorContext {
  userId?: string
  serviceId?: string
  action?: string
  requestId?: string
  userAgent?: string
  ip?: string
  timestamp?: Date
  [key: string]: any
}

export interface ProcessedError {
  errorCode: string
  userFriendlyError: UserFriendlyError
  originalError?: Error | string
  context?: ErrorContext
  shouldLog: boolean
  shouldNotifyUser: boolean
  retryAfter?: number // seconds
}

export class ErrorHandler {
  private static instance: ErrorHandler
  
  private constructor() {}
  
  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler()
    }
    return ErrorHandler.instance
  }
  
  /**
   * 处理错误并返回用户友好的响应
   */
  processError(
    error: Error | string,
    errorCode?: string,
    context?: ErrorContext,
    locale: SupportedLocale = 'en'
  ): ProcessedError {
    // 自动检测错误代码
    const detectedCode = errorCode || this.detectErrorCode(error)
    
    // 获取用户友好的错误信息
    const userFriendlyError = getUserFriendlyError(
      detectedCode,
      locale,
      error instanceof Error ? error.message : error
    )
    
    // 构建处理后的错误对象
    const processedError: ProcessedError = {
      errorCode: detectedCode,
      userFriendlyError,
      originalError: error,
      context: {
        ...context,
        timestamp: new Date()
      },
      shouldLog: this.shouldLogError(detectedCode, userFriendlyError.severity),
      shouldNotifyUser: this.shouldNotifyUser(detectedCode, userFriendlyError.severity)
    }
    
    // 设置重试延迟
    if (isRetryableError(detectedCode)) {
      processedError.retryAfter = this.getRetryDelay(detectedCode)
    }
    
    // 记录错误日志
    if (processedError.shouldLog) {
      this.logError(processedError)
    }
    
    return processedError
  }
  
  /**
   * 自动检测错误代码
   */
  private detectErrorCode(error: Error | string): string {
    const message = error instanceof Error ? error.message : error
    const lowerMessage = message.toLowerCase()
    
    // 认证相关
    if (lowerMessage.includes('unauthorized') || lowerMessage.includes('not authenticated')) {
      return 'unauthorized'
    }
    if (lowerMessage.includes('forbidden') || lowerMessage.includes('access denied')) {
      return 'forbidden'
    }
    
    // 配额相关
    if (lowerMessage.includes('quota exceeded') || lowerMessage.includes('usage limit')) {
      return 'quota_exceeded'
    }
    if (lowerMessage.includes('rate limit') || lowerMessage.includes('too many requests')) {
      return 'rate_limited'
    }
    if (lowerMessage.includes('too many pending') || lowerMessage.includes('concurrent limit')) {
      return 'too_many_pending_services'
    }
    
    // 验证相关
    if (lowerMessage.includes('missing') && lowerMessage.includes('field')) {
      return 'missing_fields'
    }
    if (lowerMessage.includes('invalid') && (lowerMessage.includes('resume') || lowerMessage.includes('job'))) {
      return 'invalid_resume_or_job'
    }
    if (lowerMessage.includes('language') && lowerMessage.includes('inconsistent')) {
      return 'language_inconsistent'
    }
    
    // 系统相关
    if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
      return 'timeout'
    }
    if (lowerMessage.includes('network') || lowerMessage.includes('connection')) {
      return 'network_error'
    }
    if (lowerMessage.includes('upstream') || lowerMessage.includes('service unavailable')) {
      return 'upstream_error'
    }
    if (lowerMessage.includes('duplicate') || lowerMessage.includes('already exists')) {
      return 'duplicate_request'
    }
    if (lowerMessage.includes('not found')) {
      return 'service_not_found'
    }
    
    // 默认为内部错误
    return 'internal_error'
  }
  
  /**
   * 判断是否应该记录错误日志
   */
  private shouldLogError(errorCode: string, severity: ErrorSeverity): boolean {
    // 所有错误都记录，但可以根据需要调整
    return true
  }
  
  /**
   * 判断是否应该通知用户
   */
  private shouldNotifyUser(errorCode: string, severity: ErrorSeverity): boolean {
    // 除了 info 级别，其他都通知用户
    return severity !== 'info'
  }
  
  /**
   * 获取重试延迟时间（秒）
   */
  private getRetryDelay(errorCode: string): number {
    switch (errorCode) {
      case 'rate_limited':
        return 60 // 1分钟
      case 'too_many_pending_services':
        return 30 // 30秒
      case 'timeout':
        return 5 // 5秒
      case 'upstream_error':
        return 10 // 10秒
      case 'network_error':
        return 3 // 3秒
      default:
        return 5 // 默认5秒
    }
  }
  
  /**
   * 记录错误日志
   */
  private logError(processedError: ProcessedError): void {
    const logMessage = formatErrorForLogging(
      processedError.errorCode,
      processedError.originalError,
      processedError.context
    )
    
    // 根据严重级别选择日志方法
    switch (processedError.userFriendlyError.severity) {
      case 'critical':
        console.error('[CRITICAL ERROR]', logMessage)
        break
      case 'error':
        console.error('[ERROR]', logMessage)
        break
      case 'warning':
        console.warn('[WARNING]', logMessage)
        break
      case 'info':
        console.info('[INFO]', logMessage)
        break
    }
    
    // 在生产环境中，这里可以集成外部日志服务
    // 如 Sentry, LogRocket, DataDog 等
  }
  
  /**
   * 创建标准化的错误响应
   */
  createErrorResponse(
    processedError: ProcessedError,
    includeDetails: boolean = false
  ): {
    success: false
    error: {
      code: string
      title: string
      message: string
      suggestion?: string
      severity: ErrorSeverity
      retryable: boolean
      retryAfter?: number
      contactSupport: boolean
      details?: any
    }
  } {
    const { errorCode, userFriendlyError, retryAfter } = processedError
    
    const errorResponse: any = {
      code: errorCode,
      title: userFriendlyError.title,
      message: userFriendlyError.message,
      severity: userFriendlyError.severity,
      retryable: userFriendlyError.retryable,
      contactSupport: userFriendlyError.contactSupport
    }
    
    // 只在有值时添加可选属性
    if (userFriendlyError.suggestion) {
      errorResponse.suggestion = userFriendlyError.suggestion
    }
    
    if (retryAfter !== undefined) {
      errorResponse.retryAfter = retryAfter
    }
    
    if (includeDetails) {
      errorResponse.details = {
        originalError: processedError.originalError instanceof Error 
          ? processedError.originalError.message 
          : processedError.originalError,
        context: processedError.context
      }
    }
    
    return {
      success: false,
      error: errorResponse
    }
  }
  
  /**
   * 便捷方法：处理并返回错误响应
   */
  handleError(
    error: Error | string,
    errorCode?: string,
    context?: ErrorContext,
    locale: SupportedLocale = 'en',
    includeDetails: boolean = false
  ) {
    const processedError = this.processError(error, errorCode, context, locale)
    return this.createErrorResponse(processedError, includeDetails)
  }
}

// 导出单例实例
export const errorHandler = ErrorHandler.getInstance()

// 便捷函数
export function handleError(
  error: Error | string,
  errorCode?: string,
  context?: ErrorContext,
  locale: SupportedLocale = 'en'
) {
  return errorHandler.handleError(error, errorCode, context, locale)
}

export function processError(
  error: Error | string,
  errorCode?: string,
  context?: ErrorContext,
  locale: SupportedLocale = 'en'
) {
  return errorHandler.processError(error, errorCode, context, locale)
}