import { describe, it, expect } from 'vitest'
import { getTaskRouting, getJobVisionTaskRouting } from '@/lib/llm/task-router'

describe('Task Router', () => {
  it('routes job_match to stream with paid/free tiers', () => {
    const paid = getTaskRouting('job_match', true)
    const free = getTaskRouting('job_match', false)
    expect(paid.isStream).toBe(true)
    expect(free.isStream).toBe(true)
    // 队列标识采用小写字符串值（q_paid_* / q_free_*），断言具体枚举值
    expect(String(paid.queueId)).toBe('q_paid_stream')
    expect(String(free.queueId)).toBe('q_free_stream')
  })

  it('routes detailed_resume_summary to structured reasoning (paid) and flash (free)', () => {
    const paid = getTaskRouting('detailed_resume_summary', true)
    const free = getTaskRouting('detailed_resume_summary', false)
    expect(paid.isStream).toBe(false)
    expect(free.isStream).toBe(false)
    expect(paid.modelId).toBe('deepseek-reasoner')
    expect(free.modelId).toBe('glm-4.5-flash')
  })

  it('routes vision tasks to structured vision queues', () => {
    const paid = getJobVisionTaskRouting(true)
    const free = getJobVisionTaskRouting(false)
    expect(paid.isStream).toBe(false)
    expect(free.isStream).toBe(false)
    expect(String(paid.queueId)).toBe('q_paid_vision')
    expect(String(free.queueId)).toBe('q_free_vision')
  })
})