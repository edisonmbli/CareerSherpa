import { ENV, isProdRedisReady } from '@/lib/env'
import { prisma } from '@/lib/prisma'
import { withPrismaGuard } from '@/lib/guard/prismaGuard'

export type IdempotencyStep = 'match' | 'customize' | 'interview'

export interface StoredIdempotencyKey {
  key: string
  userKey: string
  step: IdempotencyStep
  ttlMs: number
  createdAt: Date
}

// In-memory fallback for local/dev when Upstash is not configured
const memIdem = new Map<string, StoredIdempotencyKey>()

/**
 * Fetch idempotency key state.
 */
export async function getIdempotencyKey(
  key: string
): Promise<StoredIdempotencyKey | null> {
  if (isProdRedisReady()) {
    try {
      const res = await fetch(`${ENV.UPSTASH_REDIS_REST_URL}/get/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${ENV.UPSTASH_REDIS_REST_TOKEN}` },
      })
      if (!res.ok) return null
      const data = await res.json()
      if (!data?.result) return null
      try {
        const parsed = JSON.parse(data.result)
        // revive createdAt
        if (parsed && parsed.createdAt) parsed.createdAt = new Date(parsed.createdAt)
        return parsed as StoredIdempotencyKey
      } catch {
        return null
      }
    } catch {
      return null
    }
  }

  // Memory fallback
  return memIdem.get(key) ?? null
}

/**
 * Create idempotency key with TTL; if it already exists, Upstash will overwrite because setex always sets value.
 */
export async function createIdempotencyKey(
  key: string,
  userKey: string,
  step: IdempotencyStep,
  ttlMs: number
): Promise<StoredIdempotencyKey> {
  const record: StoredIdempotencyKey = {
    key,
    userKey,
    step,
    ttlMs,
    createdAt: new Date(),
  }

  if (isProdRedisReady()) {
    try {
      const ttlSec = Math.max(1, Math.floor(ttlMs / 1000))
      const payload = encodeURIComponent(JSON.stringify(record))
      const res = await fetch(`${ENV.UPSTASH_REDIS_REST_URL}/setex/${encodeURIComponent(key)}/${ttlSec}/${payload}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ENV.UPSTASH_REDIS_REST_TOKEN}` },
      })
      if (!res.ok) {
        // fall back to memory on failure
        memIdem.set(key, record)
      }
    } catch {
      memIdem.set(key, record)
    }
  } else {
    memIdem.set(key, record)
  }

  return record
}

/**
 * 根据 Stack Auth 的用户 ID 查询本地用户（neon_auth.users_sync）
 * 返回完整记录或 null；用于 Server Actions 认证增强流程。
 */
export async function getUserByStackId(id: string): Promise<any | null> {
  if (!id || typeof id !== 'string') return null
  try {
    return await withPrismaGuard(async (client) => {
      const user = await client.users_sync.findUnique({ where: { id } })
      return user ?? null
    }, { attempts: 3, prewarm: true })
  } catch {
    return null
  }
}

/**
 * Service/Dataset retrieval helpers used by BusinessLogicService
 * Minimal, read-only DAL wrappers with access control checks.
 */
export async function getServiceById(serviceId: string): Promise<{
  id: string
  userId: string
  resumeId: string
  detailedResumeId: string | null
  currentStep: string
  // Business layer expects these fields; we derive jobId and a synthetic status
  jobId: string
  status: 'done' | 'pending' | 'error'
} | null> {
  if (!serviceId) return null
  try {
    return await withPrismaGuard(async (client) => {
      const service = await client.service.findUnique({ where: { id: serviceId } })
      if (!service) return null

      const job = await client.job.findFirst({ where: { serviceId: service.id } })
      const status: 'done' | 'pending' | 'error' = 'done'

      return {
        id: service.id,
        userId: service.userId,
        resumeId: service.resumeId,
        detailedResumeId: service.detailedResumeId ?? null,
        currentStep: service.currentStep as unknown as string,
        jobId: job?.id ?? '',
        status,
      }
    }, { attempts: 3, prewarm: true })
  } catch {
    return null
  }
}

export async function getResumeByIdForUser(resumeId: string, userId: string) {
  if (!resumeId || !userId) return null
  try {
    return await withPrismaGuard(async (client) => {
      const resume = await client.resume.findFirst({ where: { id: resumeId, userId } })
      return resume ?? null
    }, { attempts: 3, prewarm: true })
  } catch {
    return null
  }
}

export async function getJobByIdForUser(jobId: string, userId: string) {
  if (!jobId || !userId) return null
  try {
    return await withPrismaGuard(async (client) => {
      const job = await client.job.findUnique({ where: { id: jobId } })
      if (!job) return null
      const service = await client.service.findUnique({ where: { id: job.serviceId } })
      if (!service || service.userId !== userId) return null
      return job
    }, { attempts: 3, prewarm: true })
  } catch {
    return null
  }
}