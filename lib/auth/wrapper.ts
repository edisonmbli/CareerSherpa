import { stackServerApp } from '@/stack/server'
import { prisma } from '@/lib/prisma'

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
    // 1) 获取当前会话用户（Stack Auth）
    const stackUser = await stackServerApp.getUser()
    if (!stackUser || !stackUser.id) {
      throw new Error('AuthenticationRequired: User is not authenticated.')
    }

    // 2) 从 users_sync 读取有效用户（过滤软删除）
    const dbUser = await prisma.users_sync.findFirst({
      where: { id: stackUser.id, deleted_at: null },
      select: { id: true, email: true },
    })

    if (!dbUser) {
      // Neon Auth 同步有延迟或用户刚创建；上层可重试或提示
      throw new Error('UserNotFound: User record not found or is deleted.')
    }

    // 3) 执行业务逻辑
    return await action(input, { id: dbUser.id, email: dbUser.email })
  }
}