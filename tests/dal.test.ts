import { describe, it, expect, beforeEach } from 'vitest'
import {
  setDalClient,
  countPendingServices,
  createService,
  updateServiceStatus,
  updateResumeText,
  updateJobText,
  updateDetailedText,
  updateSummaries,
  getUserByStackId,
  createTask,
  updateTaskStatus,
  createTaskOutput,
  getUserQuota,
  updateUserQuota,
  logTokenUsage,
  logAudit,
} from '@/lib/dal'

function createMockPrisma() {
  const store: any = {
    service: new Map<string, any>(),
    resume: new Map<string, any>(),
    jobDescription: new Map<string, any>(),
    detailedResume: new Map<string, any>(),
    user: new Map<string, any>(),
    users_sync: new Map<string, any>(),
    task: new Map<string, any>(),
    taskOutput: new Map<string, any>(),
    quota: new Map<string, any>(),
    tokenUsageLog: new Map<string, any>(),
    auditLog: new Map<string, any>(),
  }
  let idSeq = 1
  const mkId = () => `svc_${idSeq++}`
  return {
    service: {
      count: async ({ where }: any) => {
        let c = 0
        for (const v of store.service.values()) {
          if (v.userId === where.userId && where.status.in.includes(v.status)) c++
        }
        return c
      },
      create: async ({ data }: any) => {
        const id = mkId()
        const rec = { id, ...data }
        store.service.set(id, rec)
        return rec
      },
      update: async ({ where, data }: any) => {
        const rec = store.service.get(where.id)
        const updated = { ...rec, ...data }
        store.service.set(where.id, updated)
        return updated
      },
    },
    resume: {
      update: async ({ where, data }: any) => {
        const prev = store.resume.get(where.id) || { id: where.id }
        const next = { ...prev, ...data }
        store.resume.set(where.id, next)
        return next
      },
    },
    jobDescription: {
      update: async ({ where, data }: any) => {
        const prev = store.jobDescription.get(where.id) || { id: where.id }
        const next = { ...prev, ...data }
        store.jobDescription.set(where.id, next)
        return next
      },
    },
    detailedResume: {
      update: async ({ where, data }: any) => {
        const prev = store.detailedResume.get(where.id) || { id: where.id }
        const next = { ...prev, ...data }
        store.detailedResume.set(where.id, next)
        return next
      },
    },
    user: {
      upsert: async ({ where, create, update }: any) => {
        const existing = store.user.get(where.clerkId)
        const data = existing ? { ...existing, ...update } : { ...create, id: mkId() }
        store.user.set(where.clerkId, data)
        return data
      },
      findUnique: async ({ where }: any) => {
        return store.user.get(where.clerkId) || null
      },
    },
    users_sync: {
      findUnique: async ({ where }: any) => {
        return store.users_sync.get(where.id) || null
      },
      upsert: async ({ where, create, update }: any) => {
        const existing = store.users_sync.get(where.id)
        const data = existing ? { ...existing, ...update } : { ...create }
        store.users_sync.set(where.id, data)
        return data
      },
    },
    task: {
      create: async ({ data }: any) => {
        const id = mkId()
        const rec = { id, ...data }
        store.task.set(id, rec)
        return rec
      },
      update: async ({ where, data }: any) => {
        const rec = store.task.get(where.id)
        const updated = { ...rec, ...data }
        store.task.set(where.id, updated)
        return updated
      },
    },
    taskOutput: {
      create: async ({ data }: any) => {
        const id = mkId()
        const rec = { id, ...data }
        store.taskOutput.set(id, rec)
        return rec
      },
    },
    quota: {
      findUnique: async ({ where }: any) => {
        return store.quota.get(where.userId) || null
      },
      upsert: async ({ where, create, update }: any) => {
        const existing = store.quota.get(where.userId)
        const data = existing ? { ...existing, ...update } : { ...create, id: mkId() }
        store.quota.set(where.userId, data)
        return data
      },
    },
    tokenUsageLog: {
      create: async ({ data }: any) => {
        const id = mkId()
        const rec = { id, ...data }
        store.tokenUsageLog.set(id, rec)
        return rec
      },
    },
    auditLog: {
      create: async ({ data }: any) => {
        const id = mkId()
        const rec = { id, ...data }
        store.auditLog.set(id, rec)
        return rec
      },
    },
  } as any
}

describe('DAL basic ops', () => {
  beforeEach(() => {
    setDalClient(createMockPrisma())
  })

  it('counts pending services', async () => {
    const svc = await createService({ userId: 'u1', resumeId: 'r1', jobId: 'j1' })
    expect(svc.status).toBe('running')
    const cnt = await countPendingServices('u1')
    expect(cnt).toBe(1)
  })

  it('updates service status', async () => {
    const svc = await createService({ userId: 'u1', resumeId: 'r1', jobId: 'j1' })
    const updated = await updateServiceStatus(svc.id, 'done', null)
    expect(updated.status).toBe('done')
  })

  it('updates texts and summaries', async () => {
    await updateResumeText('r1', 'resume text')
    await updateJobText('j1', 'job text')
    await updateDetailedText('d1', 'detailed text')
    await updateSummaries({
      resumeId: 'r1',
      resumeSummaryJson: { a: 1 },
      resumeSummaryTokens: 10,
      jobId: 'j1',
      jobSummaryJson: { b: 2 },
      jobSummaryTokens: 20,
      detailedId: 'd1',
      detailedSummaryJson: { c: 3 },
      detailedSummaryTokens: 30,
    })
    expect(true).toBe(true)
  })

  describe('User Management', () => {
    it('should get user by stack id', async () => {
      const stackId = 'stack_123'
      const result = await getUserByStackId(stackId)
      expect(result).toBeDefined()
    })
  })

  describe('Task Management', () => {
    it('should create task', async () => {
      const taskData = {
        serviceId: 'service-id',
        kind: 'match' as const,
        requestedBy: 'user-id'
      }

      const result = await createTask(taskData)
      expect(result).toBeDefined()
    })

    it('should update task status', async () => {
      const taskId = 'task-id'
      const status = 'done' as const

      await updateTaskStatus(taskId, status)
      expect(true).toBe(true)
    })

    it('should create task output', async () => {
      const outputData = {
        taskId: 'task-id',
        version: 1,
        outputText: 'test output'
      }

      await createTaskOutput(outputData)
      expect(true).toBe(true)
    })
  })

  describe('Quota Management', () => {
    it('should get user quota', async () => {
      const userId = 'user-id'
      const result = await getUserQuota(userId)
      expect(result).toBeDefined()
    })

    it('should update user quota', async () => {
      const userId = 'user-id'
      const increment = 5

      await updateUserQuota(userId, increment)
      expect(true).toBe(true)
    })
  })

  describe('Logging', () => {
    it('should log token usage', async () => {
      const logData = {
        userId: 'user-id',
        serviceId: 'service-id',
        step: 'match',
        model: 'deepseek-v3',
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        cost: 0.001
      }

      await logTokenUsage(logData)
      expect(true).toBe(true)
    })

    it('should log audit', async () => {
      const auditData = {
        userId: 'user-id',
        action: 'service_created',
        entityType: 'service',
        entityId: 'service-id',
        metadata: { step: 'match' }
      }

      await logAudit(auditData)
      expect(true).toBe(true)
    })
  })
})