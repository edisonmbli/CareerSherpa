'use server'

import { revalidatePath } from 'next/cache'

import {
  ActionResult,
  createActionContext,
  handleActionError,
  createActionSuccess,
  validateRequiredFields,
} from './utils'
import { withAuth, withAuthDb, withReadAuth } from './auth-wrapper'
import { ensureMigrations } from '@/lib/db-migrations'
import { 
  createService, 
  updateServiceStatus, 
  getServicesByUser, 
  getServiceById,
  getUserQuota,
  updateUserQuota,
} from '@/lib/dal'
import { createServiceWithOrchestration } from '@/lib/services/service-orchestrator'
import { atomicQuotaDeduction, detectQuotaAnomalies, checkQuotaForService } from '@/lib/quota/atomic-operations'
import { checkIdempotency } from '@/lib/idempotency'

export interface CreateServiceParams {
  resumeId: string
  jobId: string
  detailedResumeId?: string
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
    const { resumeId, jobId, detailedResumeId, lang, idempotencyKey } = params
    const userKey = user.id
    const context = createActionContext('create-service', userKey)
  
    // Service creation action started
  
  try {
    validateRequiredFields(params, ['resumeId', 'jobId', 'lang'])
    // Parameters validated
    
    await ensureMigrations()

    // 1. 检查idempotency防止重复请求
    if (idempotencyKey) {
      const idempotencyResult = await checkIdempotency({
        userKey,
        step: 'match', // 使用有效的IdempotencyStep值
        ttlMs: 15 * 60 * 1000, // 15分钟TTL
        requestBody: { resumeId, jobId, detailedResumeId, lang }
      })

      if (!idempotencyResult.shouldProcess) {
        return {
          success: false,
          error: 'duplicate_request',
          message: 'Duplicate request detected',
        }
      }
    }

    // 2. 用户已通过withAuth包装器认证，直接使用userKey
    // Stack Auth会自动处理用户同步到neon_auth.users_sync表

    // 3. 检测异常使用模式
    const anomalyCheck = await detectQuotaAnomalies(userKey, 1)
    if (anomalyCheck.isAnomalous) {
      return {
        success: false,
        error: 'rate_limited',
        message: 'Unusual usage pattern detected. Please try again later.',
      }
    }

    // 4. 检查quota状态，决定使用付费队列还是免费队列
    const quotaCheck = await checkQuotaForService(userKey)
    
    let quotaDeducted = false
    if (!quotaCheck.shouldUseFreeQueue) {
      // 用户有quota，使用付费队列，需要扣费
      const quotaResult = await atomicQuotaDeduction(userKey, 1, 'service_creation', false)
      if (!quotaResult.success) {
        return {
          success: false,
          error: quotaResult.error || 'quota_exceeded',
          message: quotaResult.error === 'quota_exceeded' 
            ? 'User quota exceeded' 
            : 'Quota operation failed',
        }
      }
      quotaDeducted = true
    }
    // 如果shouldUseFreeQueue为true，用户将使用免费队列，无需扣费

    let serviceResult
    try {
      // Starting service orchestration
      
      // 5. 创建服务（传递已获取的quota状态以避免重复查询）
      serviceResult = await createServiceWithOrchestration(
        {
          resume_id: resumeId,
          job_id: jobId,
          ...(detailedResumeId && { detailed_resume_id: detailedResumeId }),
          lang,
        },
        userKey,
        'create-service',
        {
          shouldUseFreeQueue: quotaCheck.shouldUseFreeQueue,
          tier: quotaCheck.shouldUseFreeQueue ? 'free' : 'paid'
        }
      )
      
      // Service orchestration completed successfully

      revalidatePath('/workbench')

      return createActionSuccess(
        { 
          service_id: serviceResult.service_id,
          tier: quotaCheck.shouldUseFreeQueue ? 'free' : 'paid' // 返回队列类型信息
        },
        context,
        'Service created successfully'
      )

    } catch (serviceError) {
      // 6. 服务创建失败，如果已扣费则回滚quota
      if (quotaDeducted) {
        try {
          await atomicQuotaDeduction(userKey, -1, 'service_creation_rollback', false)
        } catch (rollbackError) {
          // 记录回滚失败，但不影响主要错误的抛出
          console.error('Failed to rollback quota after service creation failure:', rollbackError)
        }
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
export const updateServiceStatusAction = withAuthDb(
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

      // 使用已获取的数据库用户信息，避免重复查询
      if (!user.dbUser || service.user.id !== user.dbUser.id) {
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
export const getUserServices = withAuthDb(
  'get-user-services',
  async (user, limit?: number): Promise<ActionResult> => {
    const userKey = user.id
    const context = createActionContext('get-user-services', userKey)

    try {
      await ensureMigrations()

      // 使用已获取的数据库用户信息，避免重复查询
      if (!user.dbUser) {
        return {
          success: false,
          error: 'unauthorized',
          message: 'User not found',
        }
      }

      const services = await getServicesByUser(user.dbUser.id, limit)

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
export const getServiceDetails = withAuthDb(
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

      // 使用已获取的数据库用户信息，避免重复查询
      if (!user.dbUser || service.userId !== user.dbUser.id) {
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