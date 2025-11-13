import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/queue/qstash', () => ({ getQStash: () => ({ publishJSON: async () => ({ messageId: 'm' }) }) }))
vi.mock('@/lib/env', async (orig) => {
  const mod = await (orig as any)()
  return {
    ...mod,
    getPerformanceConfig: () => ({ cacheTtlSeconds: 300, batchOperationSize: 10, concurrencyLockTimeoutMs: 30000, maxTotalWaitMs: { stream: 1000, batch: 1000 } }),
  }
})

vi.mock('@/lib/quota/atomic-operations', () => ({
  checkQuotaForService: async () => ({ shouldUseFreeQueue: false }),
}))

import { requeueWithDelay, getMaxTotalWaitMs } from '@/lib/worker/common'

describe('delay requeue helpers', () => {
  it('max total wait ms reads from env', () => {
    expect(getMaxTotalWaitMs('stream')).toBe(1000)
    expect(getMaxTotalWaitMs('batch')).toBe(1000)
  })

  it('requeueWithDelay publishes without throwing', async () => {
    await expect(requeueWithDelay('stream', 'svc', { taskId: 't', userId: 'u', serviceId: 's', locale: 'en', templateId: 'job_match', variables: {}, enqueuedAt: Date.now(), retryCount: 0 } as any, 1)).resolves.toBeUndefined()
  })
})
