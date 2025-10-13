'use server'

import { revalidatePath } from 'next/cache'

import {
  ActionResult,
  createActionContext,
  handleActionError,
  createActionSuccess,
  validateRequiredFields,
} from './utils'
import { withAuth, withReadAuth } from './auth-wrapper'
import { ensureMigrations } from '@/lib/db-migrations'
import { 
  createService, 
  updateServiceStatus, 
  getServicesByUser, 
  getServiceById,
  getUserByStackId,
  createOrUpdateUser,
  getUserQuota,
  updateUserQuota,
} from '@/lib/dal'
import { createServiceWithOrchestration } from '@/lib/services/service-orchestrator'
import { atomicQuotaDeduction, detectQuotaAnomalies } from '@/lib/quota/atomic-operations'
import { checkIdempotency } from '@/lib/idempotency'

export interface CreateServiceParams {
  resumeId: string
  jobId: string
  lang: string
  idempotencyKey?: string
  [key: string]: unknown
}

export interface UpdateServiceParams {
  serviceId: string
  status: 'done' | 'error'
  depth?: 'a' | 'b' | 'c' | null
  [key: string]: unknown
}

/**
 * 创建服务 - 使用原子性quota扣费和idempotency防重复
 */
export const createServiceAction = withAuth(
  'create-service',
  async (user, params: CreateServiceParams): Promise<ActionResult> => {
    const { resumeId, jobId, lang, idempotencyKey } = params
    const userKey = user.id
    const context = createActionContext('create-service', userKey)
  
  try {
    validateRequiredFields(params, ['resumeId', 'jobId', 'lang'])
    
    await ensureMigrations()

    // 1. 检查idempotency防止重复请求
    if (idempotencyKey) {
      const idempotencyResult = await checkIdempotency({
        userKey,
        step: 'match', // 使用现有的IdempotencyStep枚举
        ttlMs: 15 * 60 * 1000, // 15分钟TTL
        requestBody: { resumeId, jobId, lang }
      })

      if (!idempotencyResult.shouldProcess) {
        return {
          success: false,
          error: 'duplicate_request',
          message: 'Duplicate request detected',
        }
      }
    }

    // 2. 获取或创建用户
    const user = await createOrUpdateUser({
      stackUserId: userKey,
      langPref: lang,
    })

    // 3. 检测异常使用模式
    const anomalyCheck = await detectQuotaAnomalies(user.id, 1)
    if (anomalyCheck.isAnomalous) {
      return {
        success: false,
        error: 'rate_limited',
        message: 'Unusual usage pattern detected. Please try again later.',
      }
    }

    // 4. 原子性quota扣费（在服务创建前）
    const quotaResult = await atomicQuotaDeduction(user.id, 1, 'service_creation')
    if (!quotaResult.success) {
      return {
        success: false,
        error: quotaResult.error || 'quota_exceeded',
        message: quotaResult.error === 'quota_exceeded' 
          ? 'User quota exceeded' 
          : 'Quota operation failed',
      }
    }

    let serviceResult
    try {
      // 5. 创建服务（quota已扣费，失败时需要回滚）
      serviceResult = await createServiceWithOrchestration(
        {
          resume_id: resumeId,
          job_id: jobId,
          lang,
        },
        user.id
      )

      revalidatePath('/workbench')

      return createActionSuccess(
        { service_id: serviceResult.service_id },
        context,
        'Service created successfully'
      )

    } catch (serviceError) {
      // 6. 服务创建失败，回滚quota
      try {
        await atomicQuotaDeduction(user.id, -1, 'service_creation_rollback')
      } catch (rollbackError) {
        // 记录回滚失败，但不影响主要错误的抛出
        console.error('Failed to rollback quota after service creation failure:', rollbackError)
      }
      
      throw serviceError
    }

  } catch (error: unknown) {
    return handleActionError(error, context)
  }
})

/**
 * 更新服务状态
 */
export const updateServiceStatusAction = withAuth(
  'update-service-status',
  async (user, params: UpdateServiceParams): Promise<ActionResult> => {
    const { serviceId, status, depth } = params
    const userKey = user.id
    const context = createActionContext('update-service-status', userKey)

    try {
      validateRequiredFields(params, ['serviceId', 'status'])

      await ensureMigrations()

      // 验证服务存在且用户有权限
      const service = await getServiceById(serviceId)
      if (!service) {
        return {
          success: false,
          error: 'service_not_found',
          message: 'Service not found',
        }
      }

      const dbUser = await getUserByStackId(userKey)
      if (!dbUser || service.user.id !== dbUser.id) {
        return {
          success: false,
          error: 'unauthorized',
          message: 'Unauthorized access',
        }
      }

      // 更新状态
      await updateServiceStatus(serviceId, status, depth)

      revalidatePath('/workbench')

      return createActionSuccess(
        { service_id: serviceId, status },
        context,
        'Service status updated successfully'
      )

    } catch (error: unknown) {
      return handleActionError(error, context)
    }
  }
)

/**
 * 获取用户服务列表
 */
export const getUserServices = withReadAuth(
  'get-user-services',
  async (user, limit?: number): Promise<ActionResult> => {
    const userKey = user.id
    const context = createActionContext('get-user-services', userKey)

    try {
      await ensureMigrations()

      const dbUser = await getUserByStackId(userKey)
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
 * 获取服务详情
 */
export const getServiceDetails = withReadAuth(
  'get-service-details',
  async (user, serviceId: string): Promise<ActionResult> => {
    const userKey = user.id
    const context = createActionContext('get-service-details', userKey)

    try {
      validateRequiredFields({ serviceId }, ['serviceId'])

      await ensureMigrations()

      const service = await getServiceById(serviceId)
      if (!service) {
        return {
          success: false,
          error: 'service_not_found',
          message: 'Service not found',
        }
      }

      const dbUser = await getUserByStackId(userKey)
      if (!dbUser || (service as any).users.id !== dbUser.id) {
        return {
          success: false,
          error: 'unauthorized',
          message: 'Unauthorized access',
        }
      }

      return createActionSuccess(
        { service },
        context,
        'Service details retrieved successfully'
      )

    } catch (error: unknown) {
      return handleActionError(error, context)
    }
  }
)