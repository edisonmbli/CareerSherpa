import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/dal/analyticsEvent', () => ({
  createAnalyticsEvent: vi.fn().mockResolvedValue({ id: 'evt1' }),
}))

import { trackEvent } from '@/lib/analytics/index'
import { createAnalyticsEvent } from '@/lib/dal/analyticsEvent'

describe('analytics: trackEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps context serviceId/taskId as source of truth', async () => {
    trackEvent('CUSTOMIZE_SAVE_CLICKED', {
      userId: 'u1',
      serviceId: 'svc_ctx',
      taskId: 'task_ctx',
      payload: { serviceId: 'svc_payload' },
    })

    await new Promise((r) => setTimeout(r, 0))

    expect(createAnalyticsEvent).toHaveBeenCalledTimes(1)
    const arg = (createAnalyticsEvent as any).mock.calls[0][0]
    expect(arg.serviceId).toBe('svc_ctx')
    expect(arg.taskId).toBe('task_ctx')
    expect(arg.payload.serviceId).toBe('svc_ctx')
    expect(arg.payload.taskId).toBe('task_ctx')
  })

  it('forwards to DAL with normalized payload', async () => {
    trackEvent('TASK_ENQUEUED', {
      userId: 'u1',
      serviceId: 's1',
      taskId: 't1',
      payload: { templateId: 'job_match', kind: 'stream' },
    })

    // flush microtask queue for fire-and-forget call
    await new Promise((r) => setTimeout(r, 0))

    expect(createAnalyticsEvent).toHaveBeenCalledTimes(1)
    const arg = (createAnalyticsEvent as any).mock.calls[0][0]
    expect(arg.eventName).toBe('TASK_ENQUEUED')
    expect(arg.userId).toBe('u1')
    expect(arg.serviceId).toBe('s1')
    expect(arg.taskId).toBe('t1')
    expect(arg.payload.serviceId).toBe('s1')
    expect(arg.payload.taskId).toBe('t1')
    expect(arg.payload.templateId).toBe('job_match')
    expect(arg.payload.kind).toBe('stream')
  })

  it('drops invalid payload fields and still records base context', async () => {
    trackEvent('RESUME_SHARE_VIEW', {
      serviceId: 's_invalid',
      taskId: 't_invalid',
      payload: {
        shareId: 'share-1',
        templateId: 'standard',
        source: 'x'.repeat(100), // invalid by schema (max 24)
      },
    })

    await new Promise((r) => setTimeout(r, 0))

    expect(createAnalyticsEvent).toHaveBeenCalledTimes(1)
    const arg = (createAnalyticsEvent as any).mock.calls[0][0]
    expect(arg.eventName).toBe('RESUME_SHARE_VIEW')
    expect(arg.payload).toEqual({
      serviceId: 's_invalid',
      taskId: 't_invalid',
    })
  })

  it('accepts CUSTOMIZE_SHARE_CLICKED payload and forwards normalized fields', async () => {
    trackEvent('CUSTOMIZE_SHARE_CLICKED', {
      userId: 'u_share',
      serviceId: 'svc_share',
      payload: {
        shareId: 'share_key_1',
        templateId: 'standard',
        source: 'web',
      },
    })

    await new Promise((r) => setTimeout(r, 0))

    expect(createAnalyticsEvent).toHaveBeenCalledTimes(1)
    const arg = (createAnalyticsEvent as any).mock.calls[0][0]
    expect(arg.eventName).toBe('CUSTOMIZE_SHARE_CLICKED')
    expect(arg.userId).toBe('u_share')
    expect(arg.serviceId).toBe('svc_share')
    expect(arg.payload).toEqual({
      serviceId: 'svc_share',
      shareId: 'share_key_1',
      templateId: 'standard',
      source: 'web',
    })
  })
})
