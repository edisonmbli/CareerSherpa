import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/wrapper', () => ({
  withServerActionAuthWrite: (_name: string, handler: unknown) => handler,
}))

vi.mock('@/lib/dal/quotas', () => ({
  getOrCreateQuota: vi.fn().mockResolvedValue({ balance: 5 }),
}))

vi.mock('@/lib/quota/atomic-operations', () => ({
  checkQuotaForService: vi.fn().mockResolvedValue({ shouldUseFreeQueue: false }),
}))

vi.mock('@/lib/dal/coinLedger', () => ({
  recordDebit: vi.fn().mockResolvedValue({ ok: true, id: 'debit_1' }),
  markDebitSuccess: vi.fn(),
  markDebitFailed: vi.fn(),
  recordRefund: vi.fn(),
}))

vi.mock('@/lib/dal/resume', () => ({
  getLatestResume: vi.fn(),
  getLatestDetailedResume: vi.fn(),
}))

vi.mock('@/lib/constants', () => ({
  getTaskCost: vi.fn().mockReturnValue(1),
  JOB_IMAGE_MAX_BYTES: 3 * 1024 * 1024,
}))

vi.mock('@/lib/dal/services', () => ({
  createService: vi.fn(),
  createJobForService: vi.fn(),
  ensureMatchRecord: vi.fn(),
  ensureCustomizedResumeRecord: vi.fn().mockResolvedValue({ id: 'custom_1' }),
  ensureInterviewRecord: vi.fn(),
  setCustomizedResumeResult: vi.fn(),
  getServiceWithContext: vi.fn().mockResolvedValue({
    id: 'svc_1',
    resume: { id: 'resume_1' },
    job: { id: 'job_1' },
  }),
  updateMatchStatus: vi.fn(),
  updateCustomizedResumeEditedData: vi.fn(),
  updateCustomizedResumeStatus: vi.fn(),
  updateServiceExecutionStatus: vi.fn(),
}))

vi.mock('@/lib/queue/producer', () => ({
  pushTask: vi.fn(),
}))

vi.mock('@/lib/actions/enqueue', () => ({
  ensureEnqueued: vi.fn().mockResolvedValue({ ok: true }),
}))

vi.mock('@/lib/redis/lock', () => ({
  acquireLock: vi.fn(),
}))

vi.mock('@/lib/env', () => ({
  ENV: {
    CONCURRENCY_LOCK_TIMEOUT_MS: 10000,
  },
}))

vi.mock('@/lib/analytics/index', () => ({
  trackEvent: vi.fn(),
  AnalyticsCategory: { BUSINESS: 'BUSINESS' },
  AnalyticsOutcome: { ACCEPTED: 'ACCEPTED' },
  AnalyticsRuntime: { NEXTJS: 'NEXTJS' },
  AnalyticsSource: { ACTION: 'ACTION' },
}))

vi.mock('@/lib/rateLimiter', () => ({
  checkOperationRateLimit: vi.fn().mockResolvedValue({ ok: true }),
}))

vi.mock('@/lib/observability/timeline', () => ({
  markTimeline: vi.fn(),
}))

vi.mock('next/server', () => ({
  after: (cb: () => unknown) => cb(),
}))

vi.mock('@/lib/types/task-context', () => ({
  buildTaskId: vi.fn().mockReturnValue('task_1'),
}))

describe('service.actions: customize analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('tracks CUSTOMIZE_SESSION_STARTED after enqueue success', async () => {
    const { customizeResumeAction } = await import('@/lib/actions/service.actions')
    const { trackEvent } = await import('@/lib/analytics/index')

    const result = await (customizeResumeAction as any)(
      { locale: 'en', serviceId: 'svc_1' },
      { userId: 'user_1' } as any,
    )

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        taskType: 'customize',
      }),
    )
    expect(trackEvent).toHaveBeenCalledWith(
      'CUSTOMIZE_SESSION_STARTED',
      expect.objectContaining({
        userId: 'user_1',
        serviceId: 'svc_1',
        payload: { serviceId: 'svc_1' },
      }),
    )
  })
})
