import { prisma } from './prisma'
import { isProdRedisReady } from './env'
import type {
  ServiceStatus,
  ServiceDepth,
  TaskKind,
  TaskStatus,
  IdempotencyStep,
  Prisma,
} from '@prisma/client'
import {
  createLightCacheData,
  smartValidateCache,
  ValidationLevel,
  FAST_VALIDATION_CONFIG,
  SECURE_VALIDATION_CONFIG,
  validationMonitor,
  type LightCacheData,
} from './cache/optimized-validation'

// Allow override in tests
type PrismaLike = typeof prisma
let client: PrismaLike = prisma
export function setDalClient(p: PrismaLike) {
  client = p
}

// Cache layer for short TTL results
const memCache = new Map<string, { data: unknown; expiresAt: number }>()

async function upstashGet(key: string) {
  if (!isProdRedisReady()) return null
  try {
    const res = await fetch(
      `${process.env['UPSTASH_REDIS_REST_URL']}/get/${key}`,
      {
        headers: {
          Authorization: `Bearer ${process.env['UPSTASH_REDIS_REST_TOKEN']}`,
        },
      }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.result
  } catch {
    return null
  }
}

async function upstashSet(key: string, value: string, ttlSec: number) {
  if (!isProdRedisReady()) return
  try {
    await fetch(
      `${
        process.env['UPSTASH_REDIS_REST_URL']
      }/setex/${key}/${ttlSec}/${encodeURIComponent(value)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env['UPSTASH_REDIS_REST_TOKEN']}`,
        },
      }
    )
  } catch {
    // fallback to memory cache
  }
}

async function getCached<T>(
  key: string,
  ttlSec: number,
  fetcher: () => Promise<T>,
  dataType: string = 'general'
): Promise<T> {
  const startTime = performance.now()
  let isCacheHit = false

  try {
    // 确定数据源类型（从key中推断）
    const source = key.includes('quota')
      ? 'quota'
      : key.includes('user')
      ? 'user'
      : key.includes('service')
      ? 'service'
      : 'general'

    // Try Redis first
    if (isProdRedisReady()) {
      const cached = await upstashGet(key)
      if (cached) {
        try {
          // 如果 cached 已经是对象，直接使用；否则解析 JSON
          const parsedCache = typeof cached === 'string' ? JSON.parse(cached) : cached
          const validation = smartValidateCache(parsedCache, source, dataType)

          if (validation.isValid && validation.data !== undefined) {
            isCacheHit = true
            validationMonitor.recordValidation(
              performance.now() - startTime,
              true,
              true
            )
            return validation.data as T
          } else {
            // 缓存验证失败，清除无效缓存
            await clearCache(key)
          }
        } catch {
          // 解析失败，清除缓存
          await clearCache(key)
        }
      }
    } else {
      // Try memory cache
      const cached = memCache.get(key)
      if (cached && Date.now() < cached.expiresAt) {
        const validation = smartValidateCache(cached.data, source, dataType)

        if (validation.isValid && validation.data !== undefined) {
          isCacheHit = true
          validationMonitor.recordValidation(
            performance.now() - startTime,
            true,
            true
          )
          return validation.data as T
        } else {
          // 缓存验证失败，清除无效缓存
          memCache.delete(key)
        }
      }
    }

    // Fetch fresh data
    const data = await fetcher()

    // 创建安全的缓存数据
    const config =
      source === 'quota' ? SECURE_VALIDATION_CONFIG : FAST_VALIDATION_CONFIG
    const cacheData = createLightCacheData(data, config, ttlSec * 1000)

    // Cache the result
    const serialized = JSON.stringify(cacheData)
    if (isProdRedisReady()) {
      await upstashSet(key, serialized, ttlSec)
    } else {
      memCache.set(key, {
        data: cacheData,
        expiresAt: Date.now() + ttlSec * 1000,
      })
    }

    validationMonitor.recordValidation(
      performance.now() - startTime,
      true,
      isCacheHit
    )

    return data
  } catch (error) {
    validationMonitor.recordValidation(
      performance.now() - startTime,
      false,
      isCacheHit
    )
    throw error
  }
}

// 清除缓存的辅助函数
async function clearCache(key: string) {
  if (isProdRedisReady()) {
    try {
      await fetch(`${process.env['UPSTASH_REDIS_REST_URL']}/del/${key}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env['UPSTASH_REDIS_REST_TOKEN']}`,
        },
      })
    } catch {
      // 忽略清除失败
    }
  } else {
    memCache.delete(key)
  }
}

export async function getResumeById(id: string) {
  return client.resume.findUnique({ where: { id } })
}

export async function getJobById(id: string) {
  return client.jobDescription.findUnique({ where: { id } })
}

export async function getDetailedById(id: string) {
  return client.detailedResume.findUnique({ where: { id } })
}

export async function getResumeByIdForUser(id: string, userId: string) {
  return client.resume.findFirst({ where: { id, userId } })
}

export async function getJobByIdForUser(id: string, userId: string) {
  return client.jobDescription.findFirst({ where: { id, userId } })
}

export async function getDetailedByIdForUser(id: string, userId: string) {
  return client.detailedResume.findFirst({ where: { id, userId } })
}

export async function createService(params: {
  userId: string
  resumeId: string
  jobId: string
}) {
  return client.service.create({
    data: {
      userId: params.userId,
      resumeId: params.resumeId,
      jobId: params.jobId,
      status: 'running',
    },
  })
}

export async function updateServiceStatus(
  id: string,
  status: 'done' | 'error',
  depth?: ServiceDepth | null
) {
  return client.service.update({
    where: { id },
    data: { status, depth: depth ?? null },
  })
}

export async function updateResumeText(id: string, text: string) {
  return client.resume.update({
    where: { id },
    data: { originalText: text },
  })
}

export async function updateDetailedText(id: string, text: string) {
  return client.detailedResume.update({
    where: { id },
    data: { originalText: text },
  })
}

export async function updateJobText(id: string, text: string) {
  return client.jobDescription.update({
    where: { id },
    data: { rawText: text },
  })
}

export async function updateSummaries(params: {
  resumeId: string
  resumeSummaryJson?: Prisma.InputJsonValue
  resumeSummaryTokens?: number
  jobId: string
  jobSummaryJson?: Prisma.InputJsonValue
  jobSummaryTokens?: number
  detailedId?: string
  detailedSummaryJson?: Prisma.InputJsonValue
  detailedSummaryTokens?: number
}) {
  const { resumeId, jobId, detailedId } = params
  const ops: Promise<any>[] = []
  
  // Build resume update data conditionally
  const resumeUpdateData: any = {}
  if (params.resumeSummaryJson !== undefined) {
    resumeUpdateData.resumeSummaryJson = params.resumeSummaryJson
  }
  if (params.resumeSummaryTokens !== undefined) {
    resumeUpdateData.totalTokens = params.resumeSummaryTokens
  }
  
  if (Object.keys(resumeUpdateData).length > 0) {
    ops.push(
      client.resume.update({
        where: { id: resumeId },
        data: resumeUpdateData,
      })
    )
  }
  
  // Build job update data conditionally
  const jobUpdateData: any = {}
  if (params.jobSummaryJson !== undefined) {
    jobUpdateData.jobSummaryJson = params.jobSummaryJson
  }
  if (params.jobSummaryTokens !== undefined) {
    jobUpdateData.totalTokens = params.jobSummaryTokens
  }
  
  if (Object.keys(jobUpdateData).length > 0) {
    ops.push(
      client.jobDescription.update({
        where: { id: jobId },
        data: jobUpdateData,
      })
    )
  }
  
  // Build detailed resume update data conditionally
  if (detailedId) {
    const detailedUpdateData: any = {}
    if (params.detailedSummaryJson !== undefined) {
      detailedUpdateData.detailedSummaryJson = params.detailedSummaryJson
    }
    if (params.detailedSummaryTokens !== undefined) {
      detailedUpdateData.totalTokens = params.detailedSummaryTokens
    }
    
    if (Object.keys(detailedUpdateData).length > 0) {
      ops.push(
        client.detailedResume.update({
          where: { id: detailedId },
          data: detailedUpdateData,
        })
      )
    }
  }
  
  await Promise.all(ops)
}

export async function countPendingServices(userId: string) {
  return client.service.count({
    where: { userId, status: { in: ['created', 'running'] } },
  })
}

// === Enhanced DAL Functions with Caching ===

// User management - 使用 Neon Auth 最佳实践
export async function getUserByStackId(stackUserId: string) {
  return getCached(
    `user:stack:${stackUserId}`,
    300, // 5 min TTL
    async () => {
      // 直接查询 neon_auth.users_sync 表，使用 Prisma 对象方法
      return client.users_sync.findUnique({
        where: { 
          id: stackUserId,
          deleted_at: null // 过滤已删除用户
        }
      });
    }
  )
}

// 获取用户及其业务数据 - 使用 LEFT JOIN 模式
export async function getUserWithBusinessData(stackUserId: string) {
  return getCached(
    `user:business:${stackUserId}`,
    300, // 5 min TTL
    async () => {
      // 首先获取用户基本信息
      const user = await client.users_sync.findUnique({
        where: { 
          id: stackUserId,
          deleted_at: null
        }
      });

      if (!user) {
        return null;
      }

      // 然后获取业务数据
      const [resumes, services, quotas] = await Promise.all([
        client.resume.findMany({
          where: { 
            userId: stackUserId,
            active: true 
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        }),
        client.service.findMany({
          where: { userId: stackUserId },
          orderBy: { createdAt: 'desc' },
          take: 20
        }),
        client.quota.findMany({
          where: { userId: stackUserId }
        })
      ]);

      // 组合返回数据
      return {
        ...user,
        resumes,
        services,
        quotas
      };
    }
  )
}

// 已弃用：用户创建/更新应该通过 Stack Auth SDK 处理
// 这个函数仅用于向后兼容，新代码应该使用 Stack Auth SDK


// Service management with caching
export async function getServiceById(id: string) {
  return getCached(
    `service:${id}`,
    60, // 1 min TTL
    () =>
      client.service.findUnique({
        where: { id },
        include: {
          user: true,
          resume: true,
          jobDescription: true,
          tasks: {
            include: { outputs: true },
            orderBy: { createdAt: 'desc' },
          },
        },
      })
  )
}

export async function getServicesByUser(userId: string, limit = 20) {
  return getCached(
    `services:user:${userId}:${limit}`,
    120, // 2 min TTL
    () =>
      client.service.findMany({
        where: { userId },
        include: {
          resume: { select: { id: true, title: true } },
          jobDescription: { select: { id: true, title: true } },
          tasks: { select: { id: true, kind: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })
  )
}

// Task management
export async function createTask(data: {
  id?: string // 添加可选的自定义ID参数
  serviceId: string
  kind: TaskKind
  requestedBy: string
  inputContextJson?: Prisma.InputJsonValue
  contextRefs?: Prisma.InputJsonValue
  meta?: Prisma.InputJsonValue
}) {
  const createData: any = {
    serviceId: data.serviceId,
    kind: data.kind,
    requestedBy: data.requestedBy,
  }
  
  // 如果提供了自定义ID，则使用它
  if (data.id !== undefined) {
    createData.id = data.id
  }
  
  if (data.inputContextJson !== undefined) {
    createData.inputContextJson = data.inputContextJson
  }
  if (data.contextRefs !== undefined) {
    createData.contextRefs = data.contextRefs
  }
  if (data.meta !== undefined) {
    createData.meta = data.meta
  }
  
  return client.task.create({
    data: createData,
  })
}

export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
  meta?: Prisma.InputJsonValue
) {
  const updateData: {
    status: TaskStatus
    startedAt?: Date
    finishedAt?: Date
    meta?: Prisma.InputJsonValue
  } = { status }
  if (status === 'running') updateData.startedAt = new Date()
  if (status === 'done' || status === 'error')
    updateData.finishedAt = new Date()
  if (meta) updateData.meta = meta

  return client.task.update({
    where: { id: taskId },
    data: updateData,
  })
}

export async function getTaskById(taskId: string) {
  return client.task.findUnique({
    where: { id: taskId },
    include: {
      outputs: true,
      service: true,
    },
  })
}

export async function createTaskOutput(data: {
  taskId: string
  version: number
  previousResponseId?: string
  outputJson?: Prisma.InputJsonValue
  outputText?: string
  model?: string
  provider?: string
  inputTokens?: number
  outputTokens?: number
  cost?: number
}) {
  const createData: any = {
    taskId: data.taskId,
    version: data.version,
  }
  
  if (data.previousResponseId !== undefined) {
    createData.previousResponseId = data.previousResponseId
  }
  if (data.outputJson !== undefined) {
    createData.outputJson = data.outputJson
  }
  if (data.outputText !== undefined) {
    createData.outputText = data.outputText
  }
  if (data.model !== undefined) {
    createData.model = data.model
  }
  if (data.provider !== undefined) {
    createData.provider = data.provider
  }
  if (data.inputTokens !== undefined) {
    createData.inputTokens = data.inputTokens
  }
  if (data.outputTokens !== undefined) {
    createData.outputTokens = data.outputTokens
  }
  if (data.cost !== undefined) {
    createData.cost = data.cost
  }
  
  return client.taskOutput.create({
    data: createData,
  })
}

// Quota management
export async function getUserQuota(userId: string) {
  return getCached(
    `quota:${userId}`,
    60, // 1 min TTL
    () => client.quota.findUnique({ where: { userId } }),
    'quota' // 使用严格验证
  )
}

export async function updateUserQuota(userId: string, used: number) {
  const { acquireLock, releaseLock } = await import('./concurrencyLock')

  // 使用并发锁保护quota更新操作
  const lockAcquired = await acquireLock(userId, 'quota-update', 30) // 30秒锁定时间
  if (!lockAcquired) {
    throw new Error('quota_update_locked')
  }

  try {
    // Clear cache when updating
    if (isProdRedisReady()) {
      try {
        await fetch(
          `${process.env['UPSTASH_REDIS_REST_URL']}/del/quota:${userId}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${process.env['UPSTASH_REDIS_REST_TOKEN']}`,
            },
          }
        )
      } catch {}
    } else {
      memCache.delete(`quota:${userId}`)
    }

    // 原子性更新数据库，同时更新remaining字段
    const result = await client.quota.upsert({
      where: { userId },
      create: { 
        userId, 
        used,
        remaining: Math.max(0, 0 - used) // 新用户默认remaining为0
      },
      update: { 
        used, 
        remaining: {
          decrement: used // 原子性递减remaining
        },
        updatedAt: new Date() 
      },
    })

    return result
  } finally {
    // 确保锁被释放
    await releaseLock(userId, 'quota-update')
  }
}

// 新增：原子性配额扣减函数，支持remaining字段
export async function atomicQuotaDeduction(
  userId: string, 
  amount: number,
  operation: string = 'service_creation'
): Promise<{
  success: boolean
  quota?: any
  error?: 'quota_not_found' | 'quota_exceeded' | 'quota_operation_locked' | 'insufficient_quota'
}> {
  const { acquireLock, releaseLock } = await import('./concurrencyLock')

  // 使用并发锁保护quota操作
  const lockAcquired = await acquireLock(userId, 'quota-deduction', 30)
  if (!lockAcquired) {
    return { success: false, error: 'quota_operation_locked' }
  }

  try {
    // 清除缓存
    await clearCache(`quota:${userId}`)

    // 首先检查当前配额
    const currentQuota = await client.quota.findUnique({
      where: { userId }
    })

    if (!currentQuota) {
      return { success: false, error: 'quota_not_found' }
    }

    // 检查是否有足够的配额
    if (currentQuota.remaining < amount) {
      return { success: false, error: 'insufficient_quota' }
    }

    // 原子性更新配额
    const updatedQuota = await client.quota.update({
      where: { userId },
      data: {
        used: { increment: amount },
        remaining: { decrement: amount },
        updatedAt: new Date()
      }
    })

    // 记录审计日志
    await logAudit({
      userId,
      action: 'quota_deduction',
      entityType: 'quota',
      entityId: updatedQuota.id,
      metadata: { amount, operation, previousRemaining: currentQuota.remaining }
    })

    return { success: true, quota: updatedQuota }
  } catch (error) {
    console.error('Atomic quota deduction failed:', error)
    return { success: false, error: 'quota_exceeded' }
  } finally {
    await releaseLock(userId, 'quota-deduction')
  }
}

// 新增：初始化用户配额（包含remaining字段）
export async function initializeUserQuota(
  userId: string, 
  initialGrant: number = 0,
  purchased: number = 0
) {
  const remaining = initialGrant + purchased
  
  return client.quota.upsert({
    where: { userId },
    create: {
      userId,
      initialGrant,
      purchased,
      used: 0,
      remaining
    },
    update: {
      initialGrant,
      purchased,
      remaining: { set: initialGrant + purchased - 0 }, // 重置remaining
      updatedAt: new Date()
    }
  })
}

// 新增：增加用户配额（购买等场景）
export async function addUserQuota(userId: string, amount: number) {
  const { acquireLock, releaseLock } = await import('./concurrencyLock')

  const lockAcquired = await acquireLock(userId, 'quota-add', 30)
  if (!lockAcquired) {
    throw new Error('quota_add_locked')
  }

  try {
    await clearCache(`quota:${userId}`)

    const result = await client.quota.upsert({
      where: { userId },
      create: {
        userId,
        purchased: amount,
        remaining: amount,
        used: 0,
        initialGrant: 0
      },
      update: {
        purchased: { increment: amount },
        remaining: { increment: amount },
        updatedAt: new Date()
      }
    })

    // 记录审计日志
    await logAudit({
      userId,
      action: 'quota_addition',
      entityType: 'quota',
      entityId: result.id,
      metadata: { amount }
    })

    return result
  } finally {
    await releaseLock(userId, 'quota-add')
  }
}

// Idempotency key management
export async function createIdempotencyKey(
  key: string,
  userKey: string,
  step: IdempotencyStep,
  ttlMs: number
) {
  return client.idempotencyKey.create({
    data: { key, userKey, step, ttlMs },
  })
}

export async function getIdempotencyKey(key: string) {
  return client.idempotencyKey.findUnique({ where: { key } })
}

export async function deleteExpiredIdempotencyKeys() {
  const now = new Date()
  return client.idempotencyKey.deleteMany({
    where: {
      createdAt: {
        lt: new Date(now.getTime() - 24 * 60 * 60 * 1000), // 24 hours ago
      },
    },
  })
}

// Token usage logging
export async function logTokenUsage(data: {
  userId: string
  serviceId?: string
  taskId?: string
  provider?: string
  model?: string
  inputTokens?: number
  outputTokens?: number
  cost?: number
}) {
  return client.tokenUsageLog.create({ data })
}

// Audit logging (异步处理，避免阻塞主流程)
export async function logAudit(data: {
  userId: string
  action: string
  entityType: string
  entityId: string
  metadata?: Prisma.InputJsonValue
}) {
  // 导入异步审计日志函数
  const { logAuditAsync } = await import('./audit/async-audit')

  // 使用异步处理，不阻塞主流程
  const asyncData: any = {
    userId: data.userId,
    action: data.action,
    entityType: data.entityType,
    entityId: data.entityId,
  }
  
  if (data.metadata !== undefined) {
    asyncData.metadata = data.metadata
  }
  
  const success = logAuditAsync(asyncData)

  if (!success) {
    // 如果异步队列满了，降级为同步处理
    const createData: any = {
      userId: data.userId,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId,
    }
    
    if (data.metadata !== undefined) {
      createData.metadata = data.metadata
    }
    
    return client.auditLog.create({ data: createData })
  }

  // 返回模拟的结果，保持接口兼容性
  return {
    id: `async-${Date.now()}`,
    ...data,
    createdAt: new Date(),
  }
}

// Resume versions
export async function createResumeVersion(data: {
  resumeId: string
  sourceTaskId?: string
  version: number
  contentText?: string
  diffJson?: Prisma.InputJsonValue
}) {
  return client.resumeVersion.create({ data })
}

export async function getResumeVersions(resumeId: string) {
  return getCached(
    `resume:versions:${resumeId}`,
    300, // 5 min TTL
    () =>
      client.resumeVersion.findMany({
        where: { resumeId },
        orderBy: { version: 'desc' },
      })
  )
}

// Create functions for upload entities
export async function createResume(data: {
  id: string
  userId: string
  lang: string
  originalText: string
  sourceType: string
  contentType: string
  charCount: number
  mediaBase64?: string | null
}) {
  return client.resume.create({
    data: {
      id: data.id,
      userId: data.userId,
      lang: data.lang,
      originalText: data.originalText,
      active: true,
      sourceType: data.sourceType,
      contentType: data.contentType,
      charCount: data.charCount,
      mediaBase64: data.mediaBase64 || null,
    },
  })
}

export async function createJobDescription(data: {
  id: string
  userId: string
  lang: string
  rawText: string
  sourceType: string
  contentType: string
  charCount: number
  mediaBase64?: string | null
}) {
  return client.jobDescription.create({
    data: {
      id: data.id,
      userId: data.userId,
      lang: data.lang,
      rawText: data.rawText,
      sourceType: data.sourceType,
      contentType: data.contentType,
      charCount: data.charCount,
      mediaBase64: data.mediaBase64 || null,
    },
  })
}

export async function createDetailedResume(data: {
  id: string
  userId: string
  lang: string
  originalText: string
  sourceType: string
  contentType: string
  charCount: number
  mediaBase64?: string | null
}) {
  return client.detailedResume.create({
    data: {
      id: data.id,
      userId: data.userId,
      lang: data.lang,
      originalText: data.originalText,
      sourceType: data.sourceType,
      contentType: data.contentType,
      charCount: data.charCount,
      mediaBase64: data.mediaBase64 || null,
    },
  })
}

// Cleanup utilities
export async function cleanupOldData() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  // Clean up old audit logs
  await client.auditLog.deleteMany({
    where: { createdAt: { lt: thirtyDaysAgo } },
  })

  // Clean up old token usage logs
  await client.tokenUsageLog.deleteMany({
    where: { createdAt: { lt: thirtyDaysAgo } },
  })

  // Clean up expired idempotency keys
  await deleteExpiredIdempotencyKeys()
}
