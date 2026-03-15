import { describe, it, expect } from 'vitest'
import {
  getTaskRouting,
  getJobVisionTaskRouting,
  getDetailedResumeRoutingPlan,
} from '@/lib/llm/task-router'
import { getDetailedResumeTaskConfig } from '@/lib/llm/config'

describe('task-router: getTaskRouting', () => {
  it('routes short paid detailed_resume_summary to deepseek-chat on light queue', () => {
    const decision = getTaskRouting('detailed_resume_summary', true, 9000)
    expect(decision.modelId).toBe('deepseek-chat')
    expect(decision.isStream).toBe(false)
  })

  it('routes long paid detailed_resume_summary to deepseek-reasoner on heavy queue', () => {
    const decision = getTaskRouting('detailed_resume_summary', true, 12000)
    expect(decision.modelId).toBe('deepseek-reasoner')
    expect(decision.isStream).toBe(false)
  })

  it('routes detailed_resume_summary: free gemini-3-flash-preview structured', () => {
    const decision = getTaskRouting('detailed_resume_summary', false, 9000)
    expect(decision.modelId).toBe('gemini-3-flash-preview')
    expect(decision.isStream).toBe(false)
  })

  it('exposes detailed resume plan and token profile by input length', () => {
    const shortPlan = getDetailedResumeRoutingPlan(true, 8000)
    const longPlan = getDetailedResumeRoutingPlan(true, 12000)
    const shortConfig = getDetailedResumeTaskConfig(8000)
    const longConfig = getDetailedResumeTaskConfig(12000)

    expect(shortPlan.profile).toBe('compact')
    expect(shortPlan.modelId).toBe('deepseek-chat')
    expect(shortConfig.maxTokens).toBe(8000)

    expect(longPlan.profile).toBe('deep')
    expect(longPlan.modelId).toBe('deepseek-reasoner')
    expect(longConfig.maxTokens).toBe(14000)
  })

  it('routes job_match (paid) to deepseek-reasoner stream', () => {
    const decision = getTaskRouting('job_match', true)
    expect(decision.modelId).toBe('deepseek-reasoner')
    expect(decision.isStream).toBe(true)
  })

  it('routes job_match (free) to gemini-3-flash-preview stream', () => {
    const decision = getTaskRouting('job_match', false)
    expect(decision.modelId).toBe('gemini-3-flash-preview')
    expect(decision.isStream).toBe(true)
  })

  it('routes vision (paid) to baidu-ocr-api structured', () => {
    const decision = getJobVisionTaskRouting(true)
    expect(decision.modelId).toBe('baidu-ocr-api')
    expect(decision.isStream).toBe(false)
  })

  it('routes vision (free) to gemini-3-flash-preview structured', () => {
    const decision = getJobVisionTaskRouting(false)
    expect(decision.modelId).toBe('gemini-3-flash-preview')
    expect(decision.isStream).toBe(false)
  })

  it('defaults paid text to deepseek-chat structured', () => {
    const decision = getTaskRouting('resume_summary', true)
    expect(decision.modelId).toBe('deepseek-chat')
    expect(decision.isStream).toBe(false)
  })

  it('defaults free text to gemini-3-flash-preview structured', () => {
    const decision = getTaskRouting('resume_summary', false)
    expect(decision.modelId).toBe('gemini-3-flash-preview')
    expect(decision.isStream).toBe(false)
  })
})
