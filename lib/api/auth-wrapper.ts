import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { logInfo, logError } from '@/lib/logger'
import { getUserByStackId } from '@/lib/dal'
import { ensureMigrations } from '@/lib/db-migrations'

/**
 * API 用户信息
 */
export interface ApiUser {
  id: string
  email: string
}

/**
 * API 上下文接口
 */
export interface ApiContext {
  reqId: string
  route: string
  userKey: string
  start: number
}

/**
 * API 处理函数类型
 */
export type ApiHandler<T = any> = (
  user: ApiUser,
  req: NextRequest,
  context: ApiContext
) => Promise<NextResponse<T>>

/**
 * 只读 API 处理函数类型（不需要用户同步）
 */
export type ReadOnlyApiHandler<T = any> = (
  userKey: string,
  req: NextRequest,
  context: ApiContext
) => Promise<NextResponse<T>>

/**
 * 提取用户标识
 */
function extractUserKey(headers: Headers): string {
  const headerObj = Object.fromEntries(headers)
  return (
    (headerObj['x-user-key'] as string | undefined) ??
    (headerObj['authorization'] as string | undefined) ??
    (headerObj['x-forwarded-for'] as string | undefined)?.split(',')[0] ??
    'unknown'
  )
}

/**
 * 创建 API 上下文
 */
function createApiContext(route: string, userKey: string): ApiContext {
  return {
    reqId: crypto.randomUUID(),
    route,
    userKey,
    start: Date.now(),
  }
}

/**
 * 处理 API 错误
 */
function handleApiError(error: unknown, context: ApiContext): NextResponse {
  const duration = Date.now() - context.start
  
  logError({
    reqId: context.reqId,
    route: context.route,
    userKey: context.userKey,
    error: error instanceof Error ? error.message : String(error),
    duration,
  })

  if (error instanceof Error) {
    // 根据错误类型返回适当的状态码
    if (error.message.includes('invalid_user_key') || error.message.includes('unauthorized')) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    if (error.message.includes('forbidden')) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
    if (error.message.includes('not_found')) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }
    if (error.message.includes('validation')) {
      return NextResponse.json({ error: 'validation_error' }, { status: 400 })
    }
    if (error.message.includes('rate_limit')) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
    }
  }

  return NextResponse.json({ error: 'internal_error' }, { status: 500 })
}

/**
 * 记录 API 成功
 */
function logApiSuccess(context: ApiContext, data?: any): void {
  const duration = Date.now() - context.start
  
  logInfo({
    reqId: context.reqId,
    route: context.route,
    userKey: context.userKey,
    duration,
    data: data ? JSON.stringify(data).slice(0, 100) : undefined,
  })
}

/**
 * 带认证的 API 包装器（需要用户同步）
 * 
 * @param route API 路由名称
 * @param handler API 处理函数
 * @returns 包装后的 API 处理函数
 */
export function withApiAuth<T>(
  route: string,
  handler: ApiHandler<T>
) {
  return async (req: NextRequest): Promise<NextResponse<T>> => {
    const userKey = extractUserKey(req.headers)
    const context = createApiContext(route, userKey)

    try {
      // 验证用户密钥
      if (!isValidUserKey(userKey)) {
        throw new Error('invalid_user_key')
      }

      // 确保数据库迁移
      await ensureMigrations()

      // 获取用户信息（Stack Auth会自动同步到neon_auth.users_sync表）
      const user = await getUserByStackId(userKey)

      if (!user) {
        // 如果用户不在本地数据库中，这可能是新用户或同步延迟
        // 我们使用userKey作为临时ID，Stack Auth会处理同步
        logError({
          reqId: context.reqId,
          route: context.route,
          userKey: context.userKey,
          phase: 'user_sync',
          error: 'User not found in local database, using Stack Auth ID'
        })
      }

      const apiUser: ApiUser = {
        id: user?.id || userKey, // 使用本地用户ID或Stack Auth ID
        email: user?.email || '', // 如果本地用户不存在，email为空
      }

      // 调用处理函数
      const response = await handler(apiUser, req, context)
      
      // 记录成功响应
      logApiSuccess(context, response.status)
      
      return response

    } catch (error: unknown) {
      return handleApiError(error, context) as NextResponse<T>
    }
  }
}

/**
 * 只读 API 包装器（不需要用户同步）
 * 
 * @param route API 路由名称
 * @param handler API 处理函数
 * @returns 包装后的 API 处理函数
 */
export function withReadOnlyApiAuth<T = any>(
  route: string,
  handler: ReadOnlyApiHandler<T>
) {
  return async (req: NextRequest): Promise<NextResponse<T>> => {
    const userKey = extractUserKey(req.headers)
    const context = createApiContext(route, userKey)

    try {
      // 确保数据库迁移
      await ensureMigrations()

      // 调用处理函数
      const response = await handler(userKey, req, context)
      
      // 记录成功响应
      logApiSuccess(context, response.status)
      
      return response

    } catch (error: unknown) {
      return handleApiError(error, context) as NextResponse<T>
    }
  }
}

/**
 * 简单的用户密钥验证（用于不需要数据库操作的场景）
 * 
 * @param userKey 用户标识
 * @returns 是否为有效用户
 */
export function isValidUserKey(userKey: string): boolean {
  return userKey !== 'unknown' && userKey.length > 0
}

/**
 * 要求有效用户密钥的包装器
 * 
 * @param route API 路由名称
 * @param handler API 处理函数
 * @returns 包装后的 API 处理函数
 */
export function requireValidUserKey<T = any>(
  route: string,
  handler: ReadOnlyApiHandler<T>
) {
  return withReadOnlyApiAuth(route, async (userKey, req, context) => {
    if (!isValidUserKey(userKey)) {
      throw new Error('unauthorized: Invalid user key')
    }
    
    return handler(userKey, req, context)
  })
}