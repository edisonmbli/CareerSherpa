import { describe, it, expect } from 'vitest'
import { routeTask, type RouteDecision } from '@/lib/llm/task-router'

describe('task-router: routeTask', () => {
  it('routes paid + reasoning for detailed_resume_summary to deepseek-reasoner structured', () => {
    const decision: RouteDecision = routeTask('detailed_resume_summary', true, { preferReasoning: true })
    expect(decision.tier).toBe('paid')
    expect(decision.modelId).toBe('deepseek-reasoner')
    expect(decision.queueId).toBe('q_deepseek_reasoner')
    expect(decision.worker).toBe('structured')
  })

  it('routes free detailed_resume_summary to glm-4.5-flash structured', () => {
    const decision = routeTask('detailed_resume_summary', false, {})
    expect(decision.tier).toBe('free')
    expect(decision.modelId).toBe('glm-4.5-flash')
    expect(decision.queueId).toBe('q_glm_flash')
    expect(decision.worker).toBe('structured')
  })

  it('routes job_match (paid) to deepseek-chat stream', () => {
    const decision = routeTask('job_match', true, {})
    expect(decision.tier).toBe('paid')
    expect(decision.modelId).toBe('deepseek-chat')
    expect(decision.queueId).toBe('q_deepseek_chat')
    expect(decision.worker).toBe('stream')
  })

  it('routes job_match (free) to glm-4.5-flash stream', () => {
    const decision = routeTask('job_match', false, {})
    expect(decision.tier).toBe('free')
    expect(decision.modelId).toBe('glm-4.5-flash')
    expect(decision.queueId).toBe('q_glm_flash')
    expect(decision.worker).toBe('stream')
  })

  it('routes hasImage true to glm-4.1v-thinking-flash structured (paid)', () => {
    const decision = routeTask('job_summary', true, { hasImage: true })
    expect(decision.tier).toBe('paid')
    expect(decision.modelId).toBe('glm-4.1v-thinking-flash')
    expect(decision.queueId).toBe('q_glm_vision_paid')
    expect(decision.worker).toBe('structured')
  })

  it('routes hasImage true to glm-4.1v-thinking-flash structured (free)', () => {
    const decision = routeTask('job_summary', false, { hasImage: true })
    expect(decision.tier).toBe('free')
    expect(decision.modelId).toBe('glm-4.1v-thinking-flash')
    expect(decision.queueId).toBe('q_glm_vision_free')
    expect(decision.worker).toBe('structured')
  })

  it('defaults paid text to deepseek-chat structured', () => {
    const decision = routeTask('resume_summary', true, {})
    expect(decision.modelId).toBe('deepseek-chat')
    expect(decision.worker).toBe('structured')
  })

  it('defaults free text to glm-4.5-flash structured', () => {
    const decision = routeTask('resume_summary', false, {})
    expect(decision.modelId).toBe('glm-4.5-flash')
    expect(decision.worker).toBe('structured')
  })
})