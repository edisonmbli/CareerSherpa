import { describe, expect, it } from 'vitest'

import { QueueId } from '@/lib/llm/task-router'
import { withEnqueuedQueueId } from '@/lib/worker/steps/decision'

describe('worker/decision: withEnqueuedQueueId', () => {
  it('keeps the computed queue when no producer queue is provided', () => {
    const decision = {
      modelId: 'deepseek-reasoner' as const,
      queueId: QueueId.PAID_HEAVY_1,
      isStream: false,
    }

    expect(withEnqueuedQueueId(decision)).toEqual(decision)
  })

  it('reuses the producer-selected queue id inside the worker', () => {
    const decision = {
      modelId: 'deepseek-reasoner' as const,
      queueId: QueueId.PAID_HEAVY_1,
      isStream: false,
    }

    expect(withEnqueuedQueueId(decision, QueueId.PAID_HEAVY_2)).toEqual({
      ...decision,
      queueId: QueueId.PAID_HEAVY_2,
    })
  })
})
