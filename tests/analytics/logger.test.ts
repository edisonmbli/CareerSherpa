import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AnalyticsCategory,
  AnalyticsOutcome,
  AnalyticsQueueKind,
  AnalyticsRuntime,
  AnalyticsSource,
} from '@prisma/client'

vi.mock('@/lib/analytics/index', () => ({
  trackEvent: vi.fn(),
}))

describe('observability/logger.logEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('passes category/trace/source/runtime metadata through trackEvent', async () => {
    const { logEvent } = await import('@/lib/observability/logger')
    const { trackEvent } = await import('@/lib/analytics/index')

    logEvent(
      'TASK_ENQUEUED',
      { userId: 'u1', serviceId: 's1', taskId: 't1' },
      { templateId: 'job_match', kind: 'batch' },
      {
        category: AnalyticsCategory.SYSTEM,
        traceId: 'trace_1',
        source: AnalyticsSource.PRODUCER,
        runtime: AnalyticsRuntime.NEXTJS,
        queueKind: AnalyticsQueueKind.BATCH,
        outcome: AnalyticsOutcome.ACCEPTED,
        errorCode: 'NONE',
        idempotencyKey: 'idem_1',
      },
    )

    expect(trackEvent).toHaveBeenCalledTimes(1)
    expect(trackEvent).toHaveBeenCalledWith(
      'TASK_ENQUEUED',
      expect.objectContaining({
        userId: 'u1',
        serviceId: 's1',
        taskId: 't1',
        traceId: 'trace_1',
        category: AnalyticsCategory.SYSTEM,
        source: AnalyticsSource.PRODUCER,
        runtime: AnalyticsRuntime.NEXTJS,
        queueKind: AnalyticsQueueKind.BATCH,
        outcome: AnalyticsOutcome.ACCEPTED,
        errorCode: 'NONE',
        idempotencyKey: 'idem_1',
      }),
    )
  })
})
