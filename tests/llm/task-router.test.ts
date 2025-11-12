import { describe, it, expect } from 'vitest'
import { getTaskRouting, getJobVisionTaskRouting } from '@/lib/llm/task-router'

describe('task-router: getTaskRouting', () => {
  it('routes detailed_resume_summary: paid deepseek-reasoner structured', () => {
    const decision = getTaskRouting('detailed_resume_summary', true)
    expect(decision.modelId).toBe('deepseek-reasoner')
    expect(decision.isStream).toBe(false)
  })

  it('routes detailed_resume_summary: free glm-4.5-flash structured', () => {
    const decision = getTaskRouting('detailed_resume_summary', false)
    expect(decision.modelId).toBe('glm-4.5-flash')
    expect(decision.isStream).toBe(false)
  })

  it('routes job_match (paid) to deepseek-reasoner stream', () => {
    const decision = getTaskRouting('job_match', true)
    expect(decision.modelId).toBe('deepseek-reasoner')
    expect(decision.isStream).toBe(true)
  })

  it('routes job_match (free) to glm-4.5-flash stream', () => {
    const decision = getTaskRouting('job_match', false)
    expect(decision.modelId).toBe('glm-4.5-flash')
    expect(decision.isStream).toBe(true)
  })

  it('routes vision (paid) to glm-4.1v-thinking-flash structured', () => {
    const decision = getJobVisionTaskRouting(true)
    expect(decision.modelId).toBe('glm-4.1v-thinking-flash')
    expect(decision.isStream).toBe(false)
  })

  it('routes vision (free) to glm-4.1v-thinking-flash structured', () => {
    const decision = getJobVisionTaskRouting(false)
    expect(decision.modelId).toBe('glm-4.1v-thinking-flash')
    expect(decision.isStream).toBe(false)
  })

  it('defaults paid text to deepseek-chat structured', () => {
    const decision = getTaskRouting('resume_summary', true)
    expect(decision.modelId).toBe('deepseek-chat')
    expect(decision.isStream).toBe(false)
  })

  it('defaults free text to glm-4.5-flash structured', () => {
    const decision = getTaskRouting('resume_summary', false)
    expect(decision.modelId).toBe('glm-4.5-flash')
    expect(decision.isStream).toBe(false)
  })
})