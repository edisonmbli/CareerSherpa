'use server'

import { stackServerApp } from '@/stack/server'
import { logError } from '@/lib/logger'
import { getUserByStackId } from '@/lib/dal'

export interface ServerActionUser {
  id: string
  email?: string
  primaryEmail?: string
}

export interface ServerActionUserWithDb {
  id: string
  email?: string
  primaryEmail?: string
  dbUser?: any // 完整的数据库用户信息
}

export interface ServerActionAuthResult {
  user: ServerActionUser | null
  error: string | null
}

export interface ServerActionAuthResultWithDb {
  user: ServerActionUserWithDb | null
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
        error: 'No authenticated user found',
      })

      return {
        user: null,
        error: 'Authentication required',
      }
    }

    return {
      user: {
        id: user.id,
        ...(user.primaryEmail && {
          email: user.primaryEmail,
          primaryEmail: user.primaryEmail,
        }),
      },
      error: null,
    }
  } catch (error) {
    logError({
      reqId: 'server-action',
      route: actionName,
      userKey: 'unknown',
      phase: 'authentication',
      error: error instanceof Error ? error.message : 'Authentication failed',
    })

    return {
      user: null,
      error: 'Authentication failed',
    }
  }
}

/**
 * 增强的认证函数，使用Stack Auth进行用户管理
 * Stack Auth会自动处理用户数据同步到neon_auth.users_sync表
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
        error: 'No authenticated user found',
      })

      return {
        user: null,
        error: 'Authentication required',
      }
    }

    // Stack Auth会自动同步用户数据到neon_auth.users_sync表
    // 我们只需要验证用户在本地数据库中是否存在
    const localUser = await getUserByStackId(stackUser.id)

    if (!localUser) {
      // 如果用户不在本地数据库中，这可能是新用户或同步延迟
      // Stack Auth会处理同步，我们返回Stack用户信息
      logError({
        reqId: 'server-action',
        route: actionName,
        userKey: stackUser.id,
        phase: 'user_sync',
        error: 'User not found in local database, Stack Auth will handle sync',
      })
    }

    return {
      user: {
        id: stackUser.id,
        ...(stackUser.primaryEmail && {
          email: stackUser.primaryEmail,
          primaryEmail: stackUser.primaryEmail,
        }),
      },
      error: null,
    }
  } catch (error) {
    logError({
      reqId: 'server-action',
      route: actionName,
      userKey: 'unknown',
      phase: 'authentication',
      error: error instanceof Error ? error.message : 'Authentication failed',
    })

    return {
      user: null,
      error: 'Authentication failed',
    }
  }
}

/**
 * 增强的认证函数，返回完整的数据库用户信息以避免重复查询
 */
export async function authenticateAndSyncUserWithDb(
  actionName: string
): Promise<ServerActionAuthResultWithDb> {
  try {
    // 使用Stack Auth验证用户
    const stackUser = await stackServerApp.getUser()

    if (!stackUser) {
      logError({
        reqId: 'server-action',
        route: actionName,
        userKey: 'anonymous',
        phase: 'authentication',
        error: 'No authenticated user found',
      })

      return {
        user: null,
        error: 'Authentication required',
      }
    }

    // 获取完整的数据库用户信息
    const localUser = await getUserByStackId(stackUser.id)

    if (!localUser) {
      // 如果用户不在本地数据库中，这可能是新用户或同步延迟
      logError({
        reqId: 'server-action',
        route: actionName,
        userKey: stackUser.id,
        phase: 'user_sync',
        error: 'User not found in local database, Stack Auth will handle sync',
      })
    }

    return {
      user: {
        id: stackUser.id,
        ...(stackUser.primaryEmail && {
          email: stackUser.primaryEmail,
          primaryEmail: stackUser.primaryEmail,
        }),
        dbUser: localUser, // 包含完整的数据库用户信息
      },
      error: null,
    }
  } catch (error) {
    logError({
      reqId: 'server-action',
      route: actionName,
      userKey: 'unknown',
      phase: 'authentication',
      error: error instanceof Error ? error.message : 'Authentication failed',
    })

    return {
      user: null,
      error: 'Authentication failed',
    }
  }
}
