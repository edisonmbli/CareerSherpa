import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logDebug: vi.fn(),
}))

vi.mock('@/lib/dal/services', () => ({
  getServiceSummariesReadOnly: vi.fn().mockResolvedValue({}),
  txMarkMatchCompleted: vi.fn(),
  txMarkMatchFailed: vi.fn(),
  setJobSummaryJson: vi.fn(),
  txMarkSummaryCompleted: vi.fn(),
  txMarkSummaryFailed: vi.fn(),
  updateServiceExecutionStatus: vi.fn(),
  getServiceIdsForMatch: vi.fn().mockResolvedValue({
    resumeId: 'resume_1',
    job: { id: 'job_1' },
  }),
  getServiceWithContext: vi.fn().mockResolvedValue({
    resume: { resumeSummaryJson: { basics: {} } },
    job: { jobSummaryJson: { jobTitle: 'PM' } },
    match: { matchSummaryJson: { score: 80 } },
  }),
}))

vi.mock('@/lib/dal/resume', () => ({
  getResumeOriginalTextById: vi.fn(),
  getDetailedResumeOriginalTextById: vi.fn(),
}))

vi.mock('@/lib/dal/job', () => ({
  getJobOriginalTextById: vi.fn(),
}))

vi.mock('@/lib/dal/coinLedger', () => ({
  recordRefund: vi.fn(),
  markDebitSuccess: vi.fn(),
  markDebitFailed: vi.fn(),
}))

vi.mock('@/lib/observability/timeline', () => ({
  markTimeline: vi.fn(),
}))

vi.mock('@/lib/worker/common', () => ({
  getChannel: vi.fn(() => 'channel_1'),
  publishEvent: vi.fn(),
  buildMatchTaskId: vi.fn(() => 'match_task_1'),
  buildCustomizeTaskId: vi.fn(() => 'customize_task_1'),
  getUserHasQuota: vi.fn().mockResolvedValue(false),
}))

vi.mock('@/lib/queue/producer', () => ({
  pushTask: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/lib/rag/retriever', () => ({
  retrieveCustomizeContext: vi.fn().mockResolvedValue('rag context'),
}))

vi.mock('@/lib/llm/debug', () => ({
  logDebugData: vi.fn(),
}))

vi.mock('@/lib/env', () => ({
  ENV: {
    LOG_DEBUG: false,
  },
}))

vi.mock('@/lib/analytics/index', () => ({
  trackEvent: vi.fn(),
  AnalyticsCategory: { BUSINESS: 'BUSINESS' },
  AnalyticsOutcome: { SUCCESS: 'SUCCESS', FAILED: 'FAILED' },
  AnalyticsRuntime: { NEXTJS: 'NEXTJS' },
  AnalyticsSource: { WORKER: 'WORKER' },
}))

describe('worker strategy sentry noise classification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('downgrades customize pending publish failures to warnings', async () => {
    const { publishEvent } = await import('@/lib/worker/common')
    const { logWarn, logError } = await import('@/lib/logger')
    const { customizeStrategy } = await import('@/lib/worker/strategies/customize')

    vi.mocked(publishEvent).mockRejectedValueOnce(new Error('redis unavailable'))

    await customizeStrategy.onStart?.(
      { executionSessionId: 'sess_1' },
      {
        serviceId: 'service_1',
        userId: 'user_1',
        requestId: 'req_1',
      } as any,
    )

    expect(logWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        route: 'worker/customize',
        phase: 'publish_customize_pending_failed',
      }),
    )
    expect(logError).not.toHaveBeenCalled()
  })

  it('downgrades match parse failures to warnings', async () => {
    const { logWarn, logError } = await import('@/lib/logger')
    const { MatchStrategy } = await import('@/lib/worker/strategies/match')

    const strategy = new MatchStrategy()
    await strategy.writeResults(
      {
        ok: false,
        raw: '',
        error: 'stream returned no content',
      } as any,
      {
        wasPaid: false,
        cost: 0,
      } as any,
      {
        serviceId: 'service_1',
        userId: 'user_1',
        requestId: 'req_1',
        traceId: 'trace_1',
        taskId: 'match_task_1',
        runtime: 'NEXTJS',
        shouldRefund: false,
      } as any,
    )

    expect(logWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        route: 'worker/match',
        phase: 'parse_validate',
      }),
    )
    expect(logError).not.toHaveBeenCalled()
  })
})
