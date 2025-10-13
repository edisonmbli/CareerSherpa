import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { logError } from '@/lib/logger'

export interface ApiContext {
  reqId: string
  route: string
  userKey: string
  startTime: number
}

export interface ApiError {
  code: string
  message: string
  statusCode: number
}

export const API_ERRORS = {
  MISSING_FIELDS: { code: 'missing_fields', message: 'Required fields are missing', statusCode: 400 },
  INVALID_REQUEST: { code: 'invalid_request', message: 'Invalid request format', statusCode: 400 },
  UNAUTHORIZED: { code: 'unauthorized', message: 'Unauthorized access', statusCode: 401 },
  FORBIDDEN: { code: 'forbidden', message: 'Access forbidden', statusCode: 403 },
  NOT_FOUND: { code: 'not_found', message: 'Resource not found', statusCode: 404 },
  RATE_LIMITED: { code: 'rate_limited', message: 'Rate limit exceeded', statusCode: 429 },
  QUOTA_EXCEEDED: { code: 'quota_exceeded', message: 'Quota exceeded', statusCode: 429 },
  LANGUAGE_INCONSISTENT: { code: 'language_inconsistent', message: 'Language inconsistency detected', statusCode: 422 },
  INVALID_RESUME_OR_JOB: { code: 'invalid_resume_or_job', message: 'Invalid resume or job data', statusCode: 422 },
  TOO_MANY_PENDING: { code: 'too_many_pending_services', message: 'Too many pending services', statusCode: 429 },
  UPSTREAM_ERROR: { code: 'upstream_error', message: 'External service error', statusCode: 502 },
  INTERNAL_ERROR: { code: 'internal_error', message: 'Internal server error', statusCode: 500 },
} as const

/**
 * 创建API上下文
 */
export function createApiContext(req: Request, route: string): ApiContext {
  const headers = Object.fromEntries(req.headers)
  const userKey =
    (headers['x-user-key'] as string | undefined) ??
    (headers['x-forwarded-for'] as string | undefined)?.split(',')[0] ??
    'unknown'

  return {
    reqId: crypto.randomUUID(),
    route,
    userKey,
    startTime: Date.now(),
  }
}

/**
 * 处理API错误并返回标准化响应
 */
export function handleApiError(error: unknown, context: ApiContext): NextResponse {
  const { reqId, route, userKey, startTime } = context
  const durationMs = Date.now() - startTime

  let apiError: ApiError

  if (error instanceof Error) {
    // 根据错误消息映射到预定义的API错误
    const errorKey = Object.keys(API_ERRORS).find(key => 
      error.message.includes(API_ERRORS[key as keyof typeof API_ERRORS].code)
    ) as keyof typeof API_ERRORS | undefined

    apiError = errorKey ? API_ERRORS[errorKey] : API_ERRORS.INTERNAL_ERROR
  } else {
    apiError = API_ERRORS.INTERNAL_ERROR
  }

  // 记录错误日志
  logError({
    reqId,
    route,
    userKey,
    durationMs,
    error: apiError.code,
    message: error instanceof Error ? error.message : 'Unknown error',
  })

  return NextResponse.json(
    { error: apiError.code, message: apiError.message },
    { status: apiError.statusCode }
  )
}

/**
 * 创建成功响应
 */
export function createSuccessResponse<T>(
  data: T,
  context: ApiContext,
  statusCode: number = 200
): NextResponse {
  const { reqId, route, userKey, startTime } = context
  const durationMs = Date.now() - startTime

  // 可以在这里添加成功日志记录
  // logInfo({ reqId, route, userKey, durationMs, status: 'success' })

  return NextResponse.json(data, { status: statusCode })
}

/**
 * 验证请求体字段
 */
export function validateRequiredFields<T extends Record<string, unknown>>(
  body: T,
  requiredFields: (keyof T)[]
): void {
  const missingFields = requiredFields.filter(field => !body[field])
  
  if (missingFields.length > 0) {
    throw new Error(`missing_fields: ${missingFields.join(', ')}`)
  }
}

/**
 * 安全地解析JSON请求体
 */
export async function parseRequestBody<T>(req: Request): Promise<T> {
  try {
    return await req.json()
  } catch (error) {
    throw new Error('invalid_request: Invalid JSON format')
  }
}

/**
 * 包装API处理器，提供统一的错误处理
 */
export function withApiHandler<T extends unknown[]>(
  handler: (context: ApiContext, ...args: T) => Promise<NextResponse>
) {
  return async (req: Request, route: string, ...args: T): Promise<NextResponse> => {
    const context = createApiContext(req, route)
    
    try {
      return await handler(context, ...args)
    } catch (error) {
      return handleApiError(error, context)
    }
  }
}

/**
 * 提取用户标识
 */
export function extractUserKey(req: Request): string {
  const headers = Object.fromEntries(req.headers)
  return (
    (headers['x-user-key'] as string | undefined) ??
    (headers['x-forwarded-for'] as string | undefined)?.split(',')[0] ??
    'unknown'
  )
}