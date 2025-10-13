'use server'

import { revalidatePath } from 'next/cache'
import { withAuth, withReadAuth } from './auth-wrapper'
import { ActionResult, validateRequiredFields, createActionContext, handleActionError, createActionSuccess } from './utils'
import { getServicesByUser, getUserByStackId } from '@/lib/dal'
import { ensureMigrations } from '@/lib/db-migrations'

/**
 * 重构示例：使用认证包装器的 getUserServices
 * 
 * 优点：
 * 1. 代码更简洁，减少重复的认证逻辑
 * 2. 类型安全，user 参数保证非空
 * 3. 统一的错误处理
 * 4. 使用 withReadAuth 避免不必要的用户同步
 */
export const getUserServicesRefactored = withReadAuth(
  'get-user-services',
  async (user, limit?: number): Promise<ActionResult> => {
    const context = createActionContext('get-user-services', user.id)

    try {
      await ensureMigrations()

      const dbUser = await getUserByStackId(user.id)
      if (!dbUser) {
        return {
          success: false,
          error: 'unauthorized',
          message: 'User not found',
        }
      }

      const services = await getServicesByUser(dbUser.id, limit)

      return createActionSuccess(
        { services },
        context,
        'Services retrieved successfully'
      )

    } catch (error: unknown) {
      return handleActionError(error, context)
    }
  }
)

/**
 * 重构示例：使用认证包装器的 createService
 * 
 * 对于需要用户同步的操作，使用 withAuth
 */
export const createServiceRefactored = withAuth(
  'create-service',
  async (user, params: { resumeId: string; jobId: string; lang: string }): Promise<ActionResult> => {
    const { resumeId, jobId, lang } = params
    const context = createActionContext('create-service', user.id)

    try {
      validateRequiredFields(params, ['resumeId', 'jobId', 'lang'])
      await ensureMigrations()

      // 业务逻辑直接开始，无需重复认证
      // ... 其他业务逻辑

      return createActionSuccess(
        { message: 'Service created successfully' },
        context,
        'Service created'
      )

    } catch (error: unknown) {
      return handleActionError(error, context)
    }
  }
)

/**
 * 传统方式 vs 新方式对比
 * 
 * 传统方式（约 15-20 行认证代码）：
 * ```typescript
 * export async function oldWay(params: any): Promise<ActionResult> {
 *   const authResult = await authenticateAndSyncUser('action-name')
 *   if (!authResult.user) {
 *     return {
 *       success: false,
 *       error: 'unauthorized',
 *       message: authResult.error || 'Authentication required',
 *     }
 *   }
 *   const userKey = authResult.user.id
 *   const context = createActionContext('action-name', userKey)
 *   // ... 业务逻辑
 * }
 * ```
 * 
 * 新方式（约 3-5 行）：
 * ```typescript
 * export const newWay = withAuth('action-name', async (user, params) => {
 *   const context = createActionContext('action-name', user.id)
 *   // ... 业务逻辑直接开始
 * })
 * ```
 */