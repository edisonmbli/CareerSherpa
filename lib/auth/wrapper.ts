import { stackServerApp } from '@/stack/server'
import { authenticateAndSyncUserWithDb } from '@/lib/actions/auth'
import { getUserByStackId } from '@/lib/dal'

/**
 * Server Action 认证封装器（M2）
 * - 获取当前登录用户（Stack Auth）
 * - 验证并加载 neon_auth.users_sync 中的用户记录（过滤 deleted_at）
 * - 将数据库用户对象传入业务函数
 */
export type AuthenticatedAction<TInput, TOutput> = (
  input: TInput,
  user: {
    id: string
    email?: string | null
  }
) => Promise<TOutput>

export function withAuth<TInput, TOutput>(
  action: AuthenticatedAction<TInput, TOutput>
) {
  return async (input: TInput): Promise<TOutput> => {
    const stackUser = await stackServerApp.getUser()
    if (!stackUser || !stackUser.id) {
      throw new Error('AuthenticationRequired: User is not authenticated.')
    }
    const dbUser = await getUserByStackId(stackUser.id)
    if (!dbUser) {
      throw new Error('UserNotFound: User record not found or is deleted.')
    }
    return await action(input, { id: dbUser.id, email: dbUser.email })
  }
}

export function requireAuthForAction(actionName: string) {
  return async () => {
    const res = await authenticateAndSyncUserWithDb(actionName)
    if (!res.user) {
      throw new Error('AuthenticationRequired')
    }
    return res.user
  }
}

export function withServerActionAuthWrite<TIn, TOut>(
  actionName: string,
  handler: (input: TIn, ctx: { userId: string; email?: string; dbUser?: any }) => Promise<TOut>
) {
  return async (input: TIn): Promise<TOut> => {
    const res = await authenticateAndSyncUserWithDb(actionName)
    if (!res.user) {
      throw new Error('AuthenticationRequired')
    }
    const { id, email, primaryEmail, dbUser } = res.user
    return await handler(input, { userId: id, email: email ?? primaryEmail, dbUser })
  }
}