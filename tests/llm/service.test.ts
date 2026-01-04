import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs'

// Mocks
const structuredInvoke = vi.fn()
const streamingStream = vi.fn()
let currentModel: any

vi.mock('@langchain/core/prompts', () => {
  return {
    ChatPromptTemplate: {
      fromMessages: () => ({
        pipe: (model: any) => ({
          invoke: (vars: any) => model.invoke(vars),
          stream: (vars: any) => model.stream(vars),
        }),
      }),
    },
    SystemMessagePromptTemplate: {
      fromTemplate: (t: string) => t,
    },
    HumanMessagePromptTemplate: {
      fromTemplate: (t: string) => t,
    },
  }
})

vi.mock('@/lib/llm/providers', async () => {
  const ModelId = {
    DEEPSEEK_REASONER: 'deepseek-reasoner',
    DEEPSEEK_CHAT: 'deepseek-chat',
    GLM_45_FLASH: 'glm-4.5-flash',
    GLM_VISION_THINKING_FLASH: 'glm-4.1v-thinking-flash',
    GLM_EMBEDDING_3: 'glm-embedding-3',
  } as const
  return {
    ModelId,
    getModel: (_modelId: string, _opts?: any) => currentModel,
  }
})

// Use vi.hoisted to make the mock function available during factory hoisting
const { createDetailedLog } = vi.hoisted(() => {
  return { createDetailedLog: vi.fn() }
})
vi.mock('@/lib/dal/llmUsageLog', () => {
  return {
    createLlmUsageLogDetailed: createDetailedLog,
    createLlmUsageLog: vi.fn(),
  }
})

vi.mock('@/lib/llm/utils', () => {
  return {
    getProvider: (modelId: string) => (modelId.startsWith('deepseek') ? 'deepseek' : 'zhipu'),
    getCost: () => 0.123,
  }
})

import { runStructuredLlmTask, runStreamingLlmTask, runLlmTask } from '@/lib/llm/service'
import { routeTask } from '@/lib/llm/task-router'

describe('llm/service: structured + streaming', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('runStructuredLlmTask returns parsed data and logs usage (success)', async () => {
    // Prepare structured model with valid resume_customize schema
    const validResumeCustomize = {
      fact_check: {
        extracted_name: 'Test User',
        extracted_company: 'Test Company',
        verification_status: 'PASS',
      },
      optimizeSuggestion: '# Key Changes\n- Improved summary',
      resumeData: {
        basics: { name: 'Test User' },
        educations: [],
        workExperiences: [],
        projectExperiences: [],
        customSections: [],
      },
    }
    const json = JSON.stringify(validResumeCustomize)
    currentModel = {
      invoke: structuredInvoke.mockResolvedValue({
        content: json,
        response_metadata: {
          tokenUsage: { prompt_tokens: 10, completion_tokens: 5 },
        },
      }),
    }

    const res = await runStructuredLlmTask(
      'deepseek-chat',
      'resume_customize',
      'en',
      { rag_context: 'tips', resume_text: '...', job_summary_json: '{}', match_analysis_json: '{}' },
      { userId: 'u_real', serviceId: 's_real' }
    )

    expect(res.ok).toBe(true)
    expect(res.data).toBeDefined()
    expect(res.usage?.inputTokens).toBe(10)
    expect(res.usage?.outputTokens).toBe(5)
    expect(res.usage?.totalTokens).toBe(15)
    expect(createDetailedLog).toHaveBeenCalled()
    const payload = createDetailedLog.mock.calls.pop()?.[0]
    expect(payload.userId).toBe('u_real')
    expect(payload.serviceId).toBe('s_real')
    expect(payload.isStream).toBe(false)
    expect(payload.isSuccess).toBe(true)
  })

  it('runStructuredLlmTask returns error on JSON parse failure and logs', async () => {
    currentModel = {
      invoke: structuredInvoke.mockResolvedValue({
        content: 'not a json string',
        response_metadata: { tokenUsage: { prompt_tokens: 3, completion_tokens: 2 } },
      }),
    }

    const res = await runStructuredLlmTask(
      'deepseek-chat',
      'resume_customize',
      'en',
      { rag_context: 'x', resume_text: 'y', job_summary_json: '{}', match_analysis_json: '{}' },
      { userId: 'u1', serviceId: 's1' }
    )

    expect(res.ok).toBe(false)
    expect(res.error).toBeDefined()
    const payload = createDetailedLog.mock.calls.pop()?.[0]
    expect(payload.isSuccess).toBe(false)
    expect(payload.errorMessage).toBeDefined()
  })

  it('runStructuredLlmTask returns error on Zod validation failure and logs', async () => {
    // Provide empty object which fails resume_customize schema (requires markdown)
    const json = JSON.stringify({})
    currentModel = {
      invoke: structuredInvoke.mockResolvedValue({
        content: json,
        response_metadata: { tokenUsage: { prompt_tokens: 2, completion_tokens: 1 } },
      }),
    }

    const res = await runStructuredLlmTask(
      'deepseek-chat',
      'resume_customize',
      'en',
      { rag_context: 'a', resume_text: 'b', job_summary_json: '{}', match_analysis_json: '{}' },
      { userId: 'u2', serviceId: 's2' }
    )

    expect(res.ok).toBe(false)
    expect(res.error).toContain('')
    const payload = createDetailedLog.mock.calls.pop()?.[0]
    expect(payload.isSuccess).toBe(false)
    expect(payload.errorMessage).toBeDefined()
  })

  it('runStreamingLlmTask streams tokens and logs usage', async () => {
    currentModel = {
      stream: streamingStream.mockResolvedValue((async function* () {
        yield { content: 'Hello ' }
        yield { content: 'World' }
      })()),
      lc_serializable: { tokenUsage: { promptTokens: 12, completionTokens: 7 } },
    }

    const res = await runStreamingLlmTask(
      'deepseek-chat',
      'job_match',
      'zh',
      { resume_summary_json: '{}', detailed_resume_summary_json: '{}', job_summary_json: '{}', rag_context: '...' },
      { userId: 'u3', serviceId: 's3' }
    )

    expect(res.ok).toBe(true)
    expect(res.raw).toBe('Hello World')
    expect(res.usage?.inputTokens).toBe(12)
    expect(res.usage?.outputTokens).toBe(7)
    const payload = createDetailedLog.mock.calls.pop()?.[0]
    expect(payload.isStream).toBe(true)
    expect(payload.isSuccess).toBe(true)
  })
})

describe('llm/service: runLlmTask integration with router', () => {
  it('uses streaming worker for job_match (paid) and structured for image tasks', async () => {
    // Use real router; set model to support both stream and invoke depending on worker
    // Streaming path
    currentModel = {
      stream: streamingStream.mockResolvedValue((async function* () {
        yield { content: 'A' }
        yield { content: 'B' }
      })()),
      lc_serializable: { tokenUsage: { promptTokens: 1, completionTokens: 2 } },
      invoke: structuredInvoke.mockResolvedValue({ content: JSON.stringify({ markdown: 'X' }) }),
    }

    const paidStream = await runLlmTask('job_match', 'en', { resume_summary_json: '{}', job_summary_json: '{}', rag_context: '...' }, { tier: 'paid' })
    expect(paidStream.ok).toBe(true)
    expect(paidStream.raw).toBe('AB')

    // Image triggers vision and structured
    const imgPath = '/Users/edisonmbli/Projects/CareerShaper/docs/llm_testing/IMG_3877.JPG'
    // We don’t load the image into memory; just pass a placeholder to trigger router condition
    const vision = await runLlmTask('job_summary', 'zh', { jobImage: imgPath }, { tier: 'paid', hasImage: true })
    expect(vision.ok).toBe(true)
    // structured path used invoke under the hood; our stub returns JSON, so raw is undefined
    // runStructuredLlmTask returns data, not raw only; we assert ok
  })

  it('respects free tier routing (glm flash)', async () => {
    const validResumeCustomize = {
      fact_check: {
        extracted_name: 'Test User',
        extracted_company: 'Test Company',
        verification_status: 'PASS',
      },
      optimizeSuggestion: '# Key Changes\n- Improved summary',
      resumeData: {
        basics: { name: 'Test User' },
        educations: [],
        workExperiences: [],
        projectExperiences: [],
        customSections: [],
      },
    }
    currentModel = {
      stream: streamingStream.mockResolvedValue((async function* () {
        yield { content: 'C' }
      })()),
      lc_serializable: { tokenUsage: { promptTokens: 2, completionTokens: 3 } },
      invoke: structuredInvoke.mockResolvedValue({ content: JSON.stringify(validResumeCustomize) }),
    }
    const freeRes = await runLlmTask('resume_customize', 'en', { rag_context: 'x', resume_text: 'y', job_summary_json: '{}', match_analysis_json: '{}' }, { tier: 'free' })
    expect(freeRes.ok).toBe(true)
  })
})