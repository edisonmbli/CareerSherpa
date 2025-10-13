import { authenticateAndSyncUser, type ServerActionAuthResult } from './auth'
import { ActionResult } from './utils'

/**
 * 认证包装器 - 简化 Server Actions 的认证逻辑
 * 使用高阶函数模式，减少重复代码
 */
export function withAuth<T extends any[], R>(
  actionName: string,
  handler: (user: NonNullable<ServerActionAuthResult['user']>, ...args: T) => Promise<R>
) {
  const wrappedAction = async (...args: T): Promise<R | ActionResult> => {
    const authResult = await authenticateAndSyncUser(actionName)
    
    if (!authResult.user) {
      return {
        success: false,
        error: 'unauthorized',
        message: authResult.error || 'Authentication required',
      } as ActionResult
    }

    return handler(authResult.user, ...args)
  }
  
  return wrappedAction
}

/**
 * 只读操作的轻量级认证包装器
 * 不进行用户同步，适用于查询操作
 */
export function withReadAuth<T extends any[], R>(
  actionName: string,
  handler: (user: NonNullable<ServerActionAuthResult['user']>, ...args: T) => Promise<R>
) {
  const wrappedAction = async (...args: T): Promise<R | ActionResult> => {
    const { authenticateServerAction } = await import('./auth')
    const authResult = await authenticateServerAction(actionName)
    
    if (!authResult.user) {
      return {
        success: false,
        error: 'unauthorized',
        message: authResult.error || 'Authentication required',
      } as ActionResult
    }

    return handler(authResult.user, ...args)
  }
  
  return wrappedAction
}

/**
 * 类型安全的认证检查
 * 返回类型守卫，确保用户已认证
 */
export async function requireAuth(actionName: string): Promise<{
  user: NonNullable<ServerActionAuthResult['user']>
  error?: never
} | {
  user?: never
  error: ActionResult
}> {
  const authResult = await authenticateAndSyncUser(actionName)
  
  if (!authResult.user) {
    return {
      error: {
        success: false,
        error: 'unauthorized',
        message: authResult.error || 'Authentication required',
      }
    }
  }

  return { user: authResult.user }
}