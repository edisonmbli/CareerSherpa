import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/queue/producer', () => ({
  pushTask: vi.fn(),
}))

describe('ensureEnqueued', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns replay metadata instead of pretending fresh enqueue', async () => {
    const { pushTask } = await import('@/lib/queue/producer')
    vi.mocked(pushTask).mockResolvedValue({
      url: 'https://worker',
      replay: true,
      idemKey: 'idem_1',
    } as any)

    const { ensureEnqueued } = await import('@/lib/actions/enqueue')
    const result = await ensureEnqueued({
      kind: 'batch',
      serviceId: 'svc_1',
      taskId: 'task_1',
      userId: 'user_1',
      locale: 'en',
      templateId: 'resume_summary',
      variables: { resumeId: 'resume_1', wasPaid: false, cost: 0 },
    } as any)

    expect(result).toEqual({ ok: true, replay: true, idemKey: 'idem_1' })
  })

  it('maps enqueue pressure/rate-limit failures', async () => {
    const { pushTask } = await import('@/lib/queue/producer')
    vi.mocked(pushTask).mockResolvedValue({
      url: 'https://worker',
      rateLimited: true,
      backpressured: true,
      retryAfter: 42,
      error: 'backpressured',
    } as any)

    const { ensureEnqueued } = await import('@/lib/actions/enqueue')
    const result = await ensureEnqueued({
      kind: 'stream',
      serviceId: 'svc_1',
      taskId: 'task_1',
      userId: 'user_1',
      locale: 'en',
      templateId: 'job_match',
      variables: {
        rag_context: '',
        resumeId: 'resume_1',
        jobId: 'job_1',
        resume_summary_json: '',
        job_summary_json: '',
        wasPaid: false,
        cost: 0,
      },
    } as any)

    expect(result).toEqual({
      ok: false,
      error: 'backpressured',
      rateLimited: true,
      backpressured: true,
      retryAfter: 42,
    })
  })

  it('returns ok for normal enqueue', async () => {
    const { pushTask } = await import('@/lib/queue/producer')
    vi.mocked(pushTask).mockResolvedValue({
      url: 'https://worker',
      messageId: 'msg_1',
    } as any)

    const { ensureEnqueued } = await import('@/lib/actions/enqueue')
    const result = await ensureEnqueued({
      kind: 'batch',
      serviceId: 'svc_1',
      taskId: 'task_1',
      userId: 'user_1',
      locale: 'en',
      templateId: 'resume_summary',
      variables: { resumeId: 'resume_1', wasPaid: false, cost: 0 },
    } as any)

    expect(result).toEqual({ ok: true })
  })
})
