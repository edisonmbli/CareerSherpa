import crypto from 'crypto'
import { logError, logInfo } from '@/lib/logger'

export interface ActionContext {
  reqId: string
  action: string
  userKey: string
  startTime: number
}

export interface ActionResult<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export const ACTION_ERRORS = {
  MISSING_FIELDS: { code: 'missing_fields', message: 'Required fields are missing' },
  INVALID_REQUEST: { code: 'invalid_request', message: 'Invalid request format' },
  UNAUTHORIZED: { code: 'unauthorized', message: 'Unauthorized access' },
  FORBIDDEN: { code: 'forbidden', message: 'Access forbidden' },
  NOT_FOUND: { code: 'not_found', message: 'Resource not found' },
  RATE_LIMITED: { code: 'rate_limited', message: 'Rate limit exceeded' },
  QUOTA_EXCEEDED: { code: 'quota_exceeded', message: 'Quota exceeded' },
  LANGUAGE_INCONSISTENT: { code: 'language_inconsistent', message: 'Language inconsistency detected' },
  INVALID_RESUME_OR_JOB: { code: 'invalid_resume_or_job', message: 'Invalid resume or job data' },
  TOO_MANY_PENDING: { code: 'too_many_pending_services', message: 'Too many pending services' },
  UPSTREAM_ERROR: { code: 'upstream_error', message: 'External service error' },
  INTERNAL_ERROR: { code: 'internal_error', message: 'Internal server error' },
  FILE_TOO_LARGE: { code: 'file_too_large', message: 'File size exceeds limit' },
  UNSUPPORTED_FILE_TYPE: { code: 'unsupported_file_type', message: 'Unsupported file type' },
  SERVICE_NOT_FOUND: { code: 'service_not_found', message: 'Service not found' },
} as const

/**
 * 创建Action上下文
 */
export function createActionContext(action: string, userKey: string): ActionContext {
  return {
    reqId: crypto.randomUUID(),
    action,
    userKey,
    startTime: Date.now(),
  }
}

/**
 * 处理Action错误并返回标准化响应
 */
export function handleActionError<T = any>(error: unknown, context: ActionContext): ActionResult<T> {
  const { reqId, action, userKey, startTime } = context
  const durationMs = Date.now() - startTime

  let errorCode: string
  let errorMessage: string

  if (error instanceof Error) {
    // 根据错误消息映射到预定义的Action错误
    const errorKey = Object.keys(ACTION_ERRORS).find(key => 
      error.message.includes(ACTION_ERRORS[key as keyof typeof ACTION_ERRORS].code)
    ) as keyof typeof ACTION_ERRORS | undefined

    if (errorKey) {
      errorCode = ACTION_ERRORS[errorKey].code
      errorMessage = ACTION_ERRORS[errorKey].message
    } else {
      errorCode = ACTION_ERRORS.INTERNAL_ERROR.code
      errorMessage = error.message || ACTION_ERRORS.INTERNAL_ERROR.message
    }
  } else {
    errorCode = ACTION_ERRORS.INTERNAL_ERROR.code
    errorMessage = ACTION_ERRORS.INTERNAL_ERROR.message
  }

  // 记录错误日志
  logError({
    reqId,
    route: action,
    userKey,
    durationMs,
    error: errorCode,
    message: error instanceof Error ? error.message : 'Unknown error',
  })

  return {
    success: false,
    error: errorCode,
    message: errorMessage,
  }
}

/**
 * 创建成功响应
 */
export function createActionSuccess<T>(
  data: T,
  context: ActionContext,
  message?: string
): ActionResult<T> {
  const { reqId, action, userKey, startTime } = context
  const durationMs = Date.now() - startTime

  // 记录成功日志
  logInfo({
    reqId,
    route: action,
    userKey,
    durationMs,
    status: 'success',
  })

  return {
    success: true,
    data,
    message,
  }
}

/**
 * 验证必需字段
 */
export function validateRequiredFields<T extends Record<string, unknown>>(
  data: T,
  requiredFields: (keyof T)[]
): void {
  const missingFields = requiredFields.filter(field => !data[field])
  
  if (missingFields.length > 0) {
    throw new Error(`missing_fields: ${missingFields.join(', ')}`)
  }
}

/**
 * 包装Action处理器，提供统一的错误处理
 */
export function withActionHandler<T extends unknown[], R = any>(
  handler: (context: ActionContext, ...args: T) => Promise<ActionResult<R>>
) {
  return async (action: string, userKey: string, ...args: T): Promise<ActionResult<R>> => {
    const context = createActionContext(action, userKey)
    
    try {
      return await handler(context, ...args)
    } catch (error) {
      return handleActionError(error, context)
    }
  }
}

/**
 * 从FormData中提取用户标识
 */
export function extractUserKeyFromFormData(formData: FormData): string {
  return formData.get('userKey') as string || 'unknown'
}

/**
 * 验证文件类型
 */
export function validateFileType(file: File, allowedTypes: string[]): void {
  if (!allowedTypes.includes(file.type)) {
    throw new Error('unsupported_file_type')
  }
}

/**
 * 验证文件大小
 */
export function validateFileSize(file: File, maxSizeBytes: number): void {
  if (file.size > maxSizeBytes) {
    throw new Error('file_too_large')
  }
}

/**
 * 安全地从FormData获取字符串值
 */
export function getFormDataString(formData: FormData, key: string, defaultValue?: string): string {
  const value = formData.get(key)
  if (typeof value === 'string') {
    return value
  }
  if (defaultValue !== undefined) {
    return defaultValue
  }
  throw new Error(`missing_fields: ${key}`)
}

/**
 * 安全地从FormData获取文件
 */
export function getFormDataFile(formData: FormData, key: string): File {
  const file = formData.get(key)
  if (file instanceof File) {
    return file
  }
  throw new Error(`missing_fields: ${key}`)
}

/**
 * 验证用户权限（用户只能访问自己的资源）
 */
export function validateUserAccess(
  authenticatedUserId: string,
  resourceUserId: string,
  actionName: string
): boolean {
  if (authenticatedUserId !== resourceUserId) {
    logError({
      reqId: 'server-action',
      route: actionName,
      userKey: authenticatedUserId,
      phase: 'authorization',
      error: `Unauthorized access to user ${resourceUserId}`
    })
    return false
  }
  return true
}