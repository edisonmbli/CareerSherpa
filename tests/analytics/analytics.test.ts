import { describe, it, expect } from 'vitest'

vi.mock('@/lib/dal/analyticsEvent', () => ({
  createAnalyticsEvent: vi.fn().mockResolvedValue({ id: 'evt1' }),
}))

import { trackEvent } from '@/lib/analytics/index'
import { createAnalyticsEvent } from '@/lib/dal/analyticsEvent'

describe('analytics: trackEvent', () => {
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
    expect(arg.payload.serviceId).toBe('s1')
    expect(arg.payload.taskId).toBe('t1')
    expect(arg.payload.templateId).toBe('job_match')
    expect(arg.payload.kind).toBe('stream')
  })
})