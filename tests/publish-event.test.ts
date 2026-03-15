import { beforeEach, describe, it, expect, vi } from 'vitest'

const published: Array<{ channel: string; payload: string }> = []

vi.mock('@/lib/redis/client', () => ({
  getRedis: () => ({
    publish: async (channel: string, payload: string) => {
      published.push({ channel, payload })
    },
    xadd: async () => '1-0',
    expire: async () => 1,
    xtrim: async () => 1,
  }),
}))

// 避免在导入 common.ts 时触发配额/DAL 依赖
vi.mock('@/lib/quota/atomic-operations', () => ({
  checkQuotaForService: async () => ({ shouldUseFreeQueue: false })
}))

vi.mock('@/lib/env', () => ({
  ENV: {
    LOG_DEBUG: false,
    SSE_DEBUG: false,
    STREAM_FLUSH_INTERVAL_MS: 20,
    STREAM_FLUSH_SIZE: 5,
    STREAM_TTL_SECONDS: 0,
    STREAM_TRIM_MAXLEN: 0,
    UPSTASH_REDIS_REST_URL: '',
    UPSTASH_REDIS_REST_TOKEN: '',
  },
  getConcurrencyConfig: () => ({
    userMaxActive: { stream: 3, batch: 3 },
  }),
  getPerformanceConfig: () => ({
    maxTotalWaitMs: { stream: 1, batch: 1 },
  }),
}))

// 避免引入 Prisma 依赖的审计模块导致环境变量要求
vi.mock('@/lib/audit/async-audit', () => ({
  auditUserAction: async () => {}
}))

import { flushPendingChannelEvents, publishEvent } from '@/lib/worker/common'

describe('publishEvent', () => {
  beforeEach(() => {
    published.length = 0
  })

  it('publishes to channel without throwing', async () => {
    await expect(
      publishEvent('cs:events:u:s:t', {
        type: 'status',
        taskId: 't',
        status: 'MATCH_PENDING',
      }),
    ).resolves.toBeUndefined()
  })

  it('flushes buffered token events into a token_batch payload', async () => {
    await publishEvent('cs:events:u:s:t', {
      type: 'token',
      taskId: 't',
      text: 'hello',
      requestId: 'req1',
      traceId: 'trace1',
    })

    expect(published).toHaveLength(0)

    await flushPendingChannelEvents('cs:events:u:s:t')

    expect(published).toHaveLength(1)
    const payload = JSON.parse(published[0]!.payload)
    expect(payload).toMatchObject({
      type: 'token_batch',
      taskId: 't',
      text: 'hello',
      requestId: 'req1',
      traceId: 'trace1',
    })
  })
})
