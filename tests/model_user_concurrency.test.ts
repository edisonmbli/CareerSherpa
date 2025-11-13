import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/env', async (orig) => {
  const mod = await (orig as any)()
  return {
    ...mod,
    getConcurrencyConfig: () => ({
      deepseekMaxWorkers: 5,
      glmMaxWorkers: 5,
      workerTimeoutMs: 60000,
      queueMaxSize: 100,
      queuePositionUpdateIntervalMs: 2000,
      queueLimits: { paidStream: 100, freeStream: 100, paidBatch: 100, freeBatch: 100, paidVision: 100, freeVision: 100 },
      userMaxActive: { stream: 1, batch: 2 },
      modelTierLimits: { dsReasonerPaid: 1, dsChatPaid: 1, glmFlashFree: 1, glmVisionPaid: 1, glmVisionFree: 1 },
    }),
  }
})

vi.mock('@/lib/quota/atomic-operations', () => ({
  checkQuotaForService: async () => ({ shouldUseFreeQueue: false }),
}))

import { enterModelConcurrency, exitModelConcurrency, enterUserConcurrency, exitUserConcurrency } from '@/lib/worker/common'

describe('model & user concurrency gates', () => {
  it('model gate blocks on second entry for same model/tier', async () => {
    const ttlSec = 1
    const queueId = 'q_paid_stream'
    const modelId = 'deepseek-reasoner'
    const r1 = await enterModelConcurrency(modelId, queueId, ttlSec)
    expect(r1.ok).toBe(true)
    const r2 = await enterModelConcurrency(modelId, queueId, ttlSec)
    expect(r2.ok).toBe(false)
    await exitModelConcurrency(modelId, queueId)
  })

  it('user gate blocks according to userMaxActive for stream', async () => {
    const ttlSec = 1
    const userId = 'u_test'
    const r1 = await enterUserConcurrency(userId, 'stream', ttlSec)
    expect(r1.ok).toBe(true)
    const r2 = await enterUserConcurrency(userId, 'stream', ttlSec)
    expect(r2.ok).toBe(false)
    await exitUserConcurrency(userId, 'stream')
  })
})
