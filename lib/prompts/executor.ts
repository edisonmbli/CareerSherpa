/**
 * Prompt Executors
 * Thin wrappers over the LLM service that adapt outputs to the
 * BusinessLogicService expectations while keeping token usage info.
 * 
 * 这是“提示执行器”的薄封装，负责把模板调用统一为稳定的接口，供业务服务使用。主要职责：
  - 输入整形：把业务侧已有数据（简历摘要 JSON、职位摘要 JSON）按模板要求的变量组织好，走 runLlmTask 。
  - 输出对齐：把模型返回的结构化结果映射为业务层已有的字段形状（如 score/highlights/gaps/dm_script 等），便于现有逻辑直接消费。
  - 用量记录：把 runLlmTask 的 usage （token、模型名、成本等）按业务层期望的结构透传，方便后续写入 LLM 用量日志、配额结算。
  - 统一选项：封装 tier: 'free'|'paid' 、默认 locale （取 i18n.defaultLocale ），从而触发正确的队列/模型路由。
  - 错误归一：把上游错误归一成 success:false + error 的统一返回形状。
* 适用场景：
  - 在服务端的业务流程（Server Actions 或服务类，如 business-logic.ts ）里，调用 executeJobMatch 、 executeResumeEdit 、 executeInterviewPrep 来完成闭环的三步任务（匹配→定制→面试准备）。
  - 在需要记录用量与配额的地方，作为统一入口避免重复拼接模板与重复处理类型。
* 价值：它把“模板选择 + LLM 调用 + 业务字段映射 + 用量信息”收束在一个稳定层，业务代码更简单，也便于后续替换模型或调整模板而不影响上层逻辑。
 */
import { i18n, type Locale } from '@/i18n-config'
import { runLlmTask } from '@/lib/llm/service'
import { logError } from '@/lib/logger'

type Tier = 'free' | 'paid'

interface ExecOptions {
  tier?: Tier
}

interface UsagePayload {
  totalTokens?: number
  inputTokens?: number
  outputTokens?: number
  cost?: number
  model?: string
  provider?: string
}

interface UpstreamResult<T> {
  success: boolean
  data?: T
  error?: string
  // Map runLlmTask `usage` into the shape expected by business-logic.ts
  llmResult?: {
    response?: {
      usage?: UsagePayload
    }
  }
}

// Default to system locale; callers don’t provide one today.
const DEFAULT_LOCALE: Locale = i18n.defaultLocale

function toUsagePayload(u?: {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  cost?: number
  model?: string
  provider?: string
}): UsagePayload | undefined {
  if (!u) return undefined
  const payload: UsagePayload = {}
  if (u.totalTokens !== undefined) payload.totalTokens = u.totalTokens
  if (u.inputTokens !== undefined) payload.inputTokens = u.inputTokens
  if (u.outputTokens !== undefined) payload.outputTokens = u.outputTokens
  if (u.cost !== undefined) payload.cost = u.cost
  if (u.model !== undefined) payload.model = u.model
  if (u.provider !== undefined) payload.provider = u.provider
  return payload
}

// --- Job Match ---
export async function executeJobMatch(
  resumeSummaryJson: string,
  jobSummaryJson: string,
  userId: string,
  serviceId: string,
  options: ExecOptions = {}
): Promise<
  UpstreamResult<{
    score: number
    highlights: string[]
    gaps: string[]
    dm_script: string
  }>
> {
  const res = await runLlmTask(
    'job_match',
    DEFAULT_LOCALE,
    {
      rag_context: '',
      resume_summary_json: resumeSummaryJson,
      detailed_resume_summary_json: '',
      job_summary_json: jobSummaryJson,
    },
    options.tier !== undefined ? { tier: options.tier } : {}
  )

  if (!res.ok || !res.data) {
    return {
      success: false,
      error: res.error ?? 'upstream_error',
      ...(res.usage
        ? {
          llmResult: {
            response: toUsagePayload(res.usage)
              ? { usage: toUsagePayload(res.usage)! }
              : {},
          },
        }
        : {}),
    }
  }

  // Flexible mapping from SCHEMAS_V2.JOB_MATCH to legacy fields expected by business-logic
  const d: any = res.data
  const score: number = Number(d?.match_score ?? d?.score ?? 0)
  const dm_script: string = String(d?.cover_letter_script ?? d?.dm_script ?? '')
  const highlights: string[] = Array.isArray(d?.strengths)
    ? d.strengths.map((s: any) => String(s?.point ?? s?.evidence ?? s ?? ''))
    : Array.isArray(d?.highlights)
      ? d.highlights.map((h: any) => String(h))
      : []
  const gaps: string[] = Array.isArray(d?.weaknesses)
    ? d.weaknesses.map((w: any) =>
      String(w?.risk ?? w?.gap ?? w?.point ?? w ?? '')
    )
    : Array.isArray(d?.gaps)
      ? d.gaps.map((g: any) => String(g))
      : []

  return {
    success: true,
    data: { score, highlights, gaps, dm_script },
    ...(res.usage
      ? {
        llmResult: {
          response: toUsagePayload(res.usage)
            ? { usage: toUsagePayload(res.usage)! }
            : {},
        },
      }
      : {}),
  }
}

// --- Resume Edit (Customization) ---
export async function executeResumeEdit(
  resumeSummaryJson: string,
  jobSummaryJson: string,
  detailedSummaryJson: string,
  userId: string,
  serviceId: string,
  options: ExecOptions = {}
): Promise<
  UpstreamResult<{
    summary: string
    ops: Array<{
      type: 'edit' | 'add' | 'remove' | 'move'
      target: string
      content?: string
      reason: string
      from?: string
      to?: string
    }>
  }>
> {
  // Note: Templates expect raw resume text and prior match analysis.
  // For MVP, we pass the resume summary JSON and omit match analysis to minimize tokens.
  const res = await runLlmTask(
    'resume_customize',
    DEFAULT_LOCALE,
    {
      rag_context: '',
      resume_text: resumeSummaryJson, // Using summary JSON as source text for MVP
      job_summary_json: jobSummaryJson,
      match_analysis_json: '',
    },
    options.tier !== undefined ? { tier: options.tier } : {}
  )

  if (!res.ok || !res.data) {
    return {
      success: false,
      error: res.error ?? 'upstream_error',
      ...(res.usage
        ? {
          llmResult: {
            response: toUsagePayload(res.usage)
              ? { usage: toUsagePayload(res.usage)! }
              : {},
          },
        }
        : {}),
    }
  }

  const d: any = res.data
  const summary: string = Array.isArray(d?.customization_summary)
    ? d.customization_summary
      .map(
        (c: any) =>
          `Section: ${String(c?.section ?? '')} — ${String(
            c?.change_reason ?? ''
          )}`
      )
      .join('\n')
    : String(d?.summary ?? 'Customization completed.')

  const ops: Array<{
    type: 'edit' | 'add' | 'remove' | 'move'
    target: string
    content?: string
    reason: string
    from?: string
    to?: string
  }> = Array.isArray(d?.customization_summary)
      ? d.customization_summary.map((c: any) => ({
        type: 'edit',
        target: String(c?.section ?? ''),
        content: undefined,
        reason: String(c?.change_reason ?? ''),
      }))
      : []

  return {
    success: true,
    data: { summary, ops },
    ...(res.usage
      ? {
        llmResult: {
          response: toUsagePayload(res.usage)
            ? { usage: toUsagePayload(res.usage)! }
            : {},
        },
      }
      : {}),
  }
}

// --- Interview Prep ---
export async function executeInterviewPrep(
  resumeSummaryJson: string,
  jobSummaryJson: string,
  detailedSummaryJson: string,
  matchAnalysisJson: string,
  customizedResumeJson: string,
  userId: string,
  serviceId: string,
  options: ExecOptions = {}
): Promise<
  UpstreamResult<{
    // V2 schema fields
    radar?: any
    hook?: any
    evidence?: any[]
    defense?: any[]
    reverse_questions?: any[]
    knowledge_refresh?: any[]
    // Legacy fields for backward compatibility
    intro?: string
    qa_items?: Array<{ question: string; framework: string; hints: string[] }>
  }>
> {
  // Extract jobTitle for RAG retrieval
  let jobTitle = 'unknown position'
  try {
    const jobData = JSON.parse(jobSummaryJson)
    jobTitle = jobData?.jobTitle || jobData?.title || 'unknown position'
  } catch (e) {
    // Fallback to default if parsing fails
  }

  // Retrieve RAG context for interview strategies and self introduction
  let ragContext = ''
  try {
    const { retrieveInterviewContext } = await import('@/lib/rag/retriever')
    ragContext = await retrieveInterviewContext(jobTitle, DEFAULT_LOCALE)
  } catch (e) {
    // RAG retrieval failed, proceed with empty context
    logError({
      reqId: 'interview-prep',
      route: 'prompts/executor',
      phase: 'rag_retrieval_failed',
      error: e instanceof Error ? e : String(e),
    })
  }

  const res = await runLlmTask(
    'interview_prep',
    DEFAULT_LOCALE,
    {
      job_summary_json: jobSummaryJson,
      match_analysis_json: matchAnalysisJson,
      customized_resume_json: customizedResumeJson,
      resume_summary_json: resumeSummaryJson,
      detailed_resume_summary_json: detailedSummaryJson,
      rag_context: ragContext,
    },
    options.tier !== undefined ? { tier: options.tier } : {}
  )

  if (!res.ok || !res.data) {
    return {
      success: false,
      error: res.error ?? 'upstream_error',
      ...(res.usage
        ? {
          llmResult: {
            response: toUsagePayload(res.usage)
              ? { usage: toUsagePayload(res.usage)! }
              : {},
          },
        }
        : {}),
    }
  }

  const d: any = res.data

  // Support both V2 and legacy schema
  if (d?.radar || d?.hook || d?.evidence) {
    // V2 schema response
    return {
      success: true,
      data: {
        radar: d.radar,
        hook: d.hook,
        evidence: d.evidence || [],
        defense: d.defense || [],
        reverse_questions: d.reverse_questions || [],
        knowledge_refresh: d.knowledge_refresh,
      },
      ...(res.usage
        ? {
          llmResult: {
            response: toUsagePayload(res.usage)
              ? { usage: toUsagePayload(res.usage)! }
              : {},
          },
        }
        : {}),
    }
  }

  // Legacy schema response
  const intro: string = String(d?.self_introduction_script ?? d?.intro ?? '')
  const qa_items: Array<{
    question: string
    framework: string
    hints: string[]
  }> = Array.isArray(d?.potential_questions)
      ? d.potential_questions.map((q: any) => ({
        question: String(q?.question ?? ''),
        framework: q?.star_example_suggestion ? 'STAR' : 'Guideline',
        hints: [
          ...(q?.answer_guideline ? [String(q.answer_guideline)] : []),
          ...(q?.star_example_suggestion
            ? [String(q.star_example_suggestion)]
            : []),
        ],
      }))
      : Array.isArray(d?.qa_items)
        ? d.qa_items.map((q: any) => ({
          question: String(q?.question ?? ''),
          framework: String(q?.framework ?? ''),
          hints: Array.isArray(q?.hints)
            ? q.hints.map((h: any) => String(h))
            : [],
        }))
        : []

  return {
    success: true,
    data: { intro, qa_items },
    ...(res.usage
      ? {
        llmResult: {
          response: toUsagePayload(res.usage)
            ? { usage: toUsagePayload(res.usage)! }
            : {},
        },
      }
      : {}),
  }
}
