import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}))

vi.mock('@/lib/dal/analyticsEvent', () => ({
  listPendingAnalyticsOutbox: vi.fn(),
  markAnalyticsOutboxExported: vi.fn(),
  markAnalyticsOutboxRetry: vi.fn(),
}))

vi.mock('@/lib/env', () => ({
  ENV: {
    POSTHOG_API_KEY: 'phc_test',
    POSTHOG_HOST: 'https://us.i.posthog.com',
    ANALYTICS_OUTBOX_BATCH_SIZE: 200,
  },
}))

describe('background sentry noise classification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('downgrades analytics outbox export failures to warnings', async () => {
    const {
      listPendingAnalyticsOutbox,
      markAnalyticsOutboxRetry,
      markAnalyticsOutboxExported,
    } = await import('@/lib/dal/analyticsEvent')
    const { flushAnalyticsOutboxToPostHog } = await import('@/lib/analytics/outbox')
    const { logWarn, logError } = await import('@/lib/logger')

    vi.mocked(listPendingAnalyticsOutbox).mockResolvedValue([
      {
        id: 'outbox_1',
        retryCount: 0,
        payload: {
          eventId: 'evt_1',
          eventName: 'TEST_EVENT',
          userId: 'user_1',
          source: 'ACTION',
          runtime: 'NEXTJS',
          payload: { foo: 'bar' },
        },
      } as any,
    ])

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => 'service unavailable',
      }) as unknown as typeof fetch,
    )

    const result = await flushAnalyticsOutboxToPostHog()

    expect(result.success).toBe(false)
    expect(markAnalyticsOutboxRetry).toHaveBeenCalled()
    expect(markAnalyticsOutboxExported).not.toHaveBeenCalled()
    expect(logWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        route: 'analytics/outbox',
        phase: 'flush_failed',
        errorCode: 'analytics_outbox_flush_failed',
      }),
    )
    expect(logError).not.toHaveBeenCalled()
  })
})
