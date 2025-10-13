'use server'

import { stackServerApp } from '@/stack/server'
import { logError } from '@/lib/logger'
import { getUserByStackId, createOrUpdateUser } from '@/lib/dal'

export interface ServerActionUser {
  id: string
  email?: string
  primaryEmail?: string
}

export interface ServerActionAuthResult {
  user: ServerActionUser | null
  error: string | null
}

/**
 * Server Actions认证验证
 * 必须在所有Server Actions中调用此函数进行认证
 */
export async function authenticateServerAction(
  actionName: string
): Promise<ServerActionAuthResult> {
  try {
    // 使用Stack Auth验证用户
    const user = await stackServerApp.getUser()
    
    if (!user) {
      logError({
        reqId: 'server-action',
        route: actionName,
        userKey: 'anonymous',
        phase: 'authentication',
        error: 'No authenticated user found'
      })
      
      return {
        user: null,
        error: 'Authentication required'
      }
    }

    return {
      user: {
        id: user.id,
        email: user.primaryEmail || undefined,
        primaryEmail: user.primaryEmail || undefined
      },
      error: null
    }
  } catch (error) {
    logError({
      reqId: 'server-action',
      route: actionName,
      userKey: 'unknown',
      phase: 'authentication',
      error: error instanceof Error ? error.message : 'Authentication failed'
    })

    return {
      user: null,
      error: 'Authentication failed'
    }
  }
}

/**
 * 增强的认证函数，自动处理用户数据同步
 * 推荐在新代码中使用此函数
 */
export async function authenticateAndSyncUser(
  actionName: string
): Promise<ServerActionAuthResult> {
  try {
    // 使用Stack Auth验证用户
    const stackUser = await stackServerApp.getUser()
    
    if (!stackUser) {
      logError({
        reqId: 'server-action',
        route: actionName,
        userKey: 'anonymous',
        phase: 'authentication',
        error: 'No authenticated user found'
      })
      
      return {
        user: null,
        error: 'Authentication required'
      }
    }

    // 确保用户数据在本地数据库中存在（自动同步）
    await createOrUpdateUser({
      stackUserId: stackUser.id,
      email: stackUser.primaryEmail || undefined,
    })

    return {
      user: {
        id: stackUser.id,
        email: stackUser.primaryEmail || undefined,
        primaryEmail: stackUser.primaryEmail || undefined
      },
      error: null
    }
  } catch (error) {
    logError({
      reqId: 'server-action',
      route: actionName,
      userKey: 'unknown',
      phase: 'authentication',
      error: error instanceof Error ? error.message : 'Authentication failed'
    })

    return {
      user: null,
      error: 'Authentication failed'
    }
  }
}