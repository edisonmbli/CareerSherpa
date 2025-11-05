import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock stack server
vi.mock('@/stack/server', () => ({
  stackServerApp: {
    getUser: vi.fn(),
  },
}))

// Mock prisma users_sync
vi.mock('@/lib/prisma', () => ({
  prisma: {
    users_sync: {
      findFirst: vi.fn(async ({ where }: any) => {
        if (where.id === 'u-1' && where.deleted_at === null) {
          return { id: 'u-1', email: 'u1@test.local' }
        }
        return null
      }),
    },
  },
}))

import { stackServerApp } from '@/stack/server'
import { withAuth } from '@/lib/auth/wrapper'

describe('withAuth wrapper (M2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('allows execution when authenticated and user exists', async () => {
    vi.mocked(stackServerApp.getUser).mockResolvedValue({ id: 'u-1', primaryEmail: 'u1@test.local' } as any)

    const action = withAuth(async (input: { x: number }, user) => {
      return { ok: true, input: input.x, userId: user.id, email: user.email }
    })

    const res = await action({ x: 42 })
    expect(res).toEqual({ ok: true, input: 42, userId: 'u-1', email: 'u1@test.local' })
  })

  it('throws when unauthenticated', async () => {
    vi.mocked(stackServerApp.getUser).mockResolvedValue(null as any)

    const action = withAuth(async () => ({ ok: true }))
    await expect(action({} as any)).rejects.toThrow(/AuthenticationRequired/i)
  })

  it('throws when users_sync record missing (deleted or not synced)', async () => {
    vi.mocked(stackServerApp.getUser).mockResolvedValue({ id: 'missing' } as any)
    const action = withAuth(async () => ({ ok: true }))
    await expect(action({} as any)).rejects.toThrow(/UserNotFound/i)
  })
})