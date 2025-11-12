import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/redis/client', () => ({
  getRedis: () => ({ publish: async (_c: string, _p: string) => {} }),
}))

// 避免在导入 common.ts 时触发配额/DAL 依赖
vi.mock('@/lib/quota/atomic-operations', () => ({
  checkQuotaForService: async () => ({ shouldUseFreeQueue: false })
}))

vi.mock('@/lib/env', () => ({
  ENV: {
    UPSTASH_REDIS_REST_URL: '',
    UPSTASH_REDIS_REST_TOKEN: '',
  },
}))

// 避免引入 Prisma 依赖的审计模块导致环境变量要求
vi.mock('@/lib/audit/async-audit', () => ({
  auditUserAction: async () => {}
}))

import { publishEvent } from '@/lib/worker/common'

describe('publishEvent', () => {
  it('publishes to channel without throwing', async () => {
    await expect(publishEvent('cs:events:u:s:t', { type: 'token', text: 'x' })).resolves.toBeUndefined()
  })
})