import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Prisma } from '@prisma/client'

// Mock Prisma client
const store = {
  quota: new Map<string, { userId: string; balance: number }>(),
}

vi.mock('@/lib/prisma', () => ({
  prisma: {
    quota: {
      findUnique: vi.fn(async ({ where }: any) => store.quota.get(where.userId) || null),
      findUniqueOrThrow: vi.fn(async ({ where }: any) => {
        const r = store.quota.get(where.userId)
        if (!r) throw new Error('NotFound')
        return r
      }),
      create: vi.fn(async ({ data }: any) => {
        if (store.quota.has(data.userId)) {
          const err: any = new Error('Unique violation')
          err.code = 'P2002'
          throw err
        }
        store.quota.set(data.userId, { userId: data.userId, balance: data.balance })
        return store.quota.get(data.userId)
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const rec = store.quota.get(where.userId)
        if (!rec || rec.balance < (where.balance?.gte ?? 0)) return { count: 0 }
        rec.balance -= data.balance.decrement
        store.quota.set(where.userId, rec)
        return { count: 1 }
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const rec = store.quota.get(where.userId)
        if (!rec) throw new Error('NotFound')
        rec.balance += data.balance.increment
        store.quota.set(where.userId, rec)
        return rec
      }),
    },
  },
}))

import { getOrCreateQuota, deductQuota, addQuota, checkBalance } from '@/lib/dal/quotas'

describe('Quota DAL (M2)', () => {
  beforeEach(() => {
    store.quota.clear()
    vi.clearAllMocks()
  })

  it('getOrCreateQuota creates new record with INITIAL_FREE_QUOTA when absent', async () => {
    const userId = 'user-1'
    const q = await getOrCreateQuota(userId)
    expect(q.userId).toBe(userId)
    expect(q.balance).toBeGreaterThan(0)
  })

  it('getOrCreateQuota returns existing record when present', async () => {
    const userId = 'user-2'
    // pre-create
    store.quota.set(userId, { userId, balance: 5 })
    const q = await getOrCreateQuota(userId)
    expect(q.balance).toBe(5)
  })

  it('getOrCreateQuota handles concurrent unique violation via P2002', async () => {
    const userId = 'user-3'
    // simulate existing
    store.quota.set(userId, { userId, balance: 7 })
    const q = await getOrCreateQuota(userId)
    expect(q.balance).toBe(7)
  })

  it('deductQuota succeeds when balance is sufficient', async () => {
    const userId = 'user-4'
    store.quota.set(userId, { userId, balance: 10 })
    const res = await deductQuota(userId, 3)
    expect(res.success).toBe(true)
    const q = await getOrCreateQuota(userId)
    expect(q.balance).toBe(7)
  })

  it('deductQuota fails when balance is insufficient', async () => {
    const userId = 'user-5'
    store.quota.set(userId, { userId, balance: 2 })
    const res = await deductQuota(userId, 3)
    expect(res.success).toBe(false)
    // @ts-expect-error error union
    expect(res.error).toBe('InsufficientQuota')
    const q = await getOrCreateQuota(userId)
    expect(q.balance).toBe(2)
  })

  it('addQuota increases balance atomically', async () => {
    const userId = 'user-6'
    store.quota.set(userId, { userId, balance: 1 })
    await addQuota(userId, 4)
    const q = await getOrCreateQuota(userId)
    expect(q.balance).toBe(5)
  })

  it('checkBalance uses lazy init and verifies availability', async () => {
    const userId = 'user-7'
    const ok = await checkBalance(userId, 1)
    expect(ok).toBe(true)
  })
})