import { WorkerStrategy, StrategyContext, ExecutionResult } from './interface'
import { JobMatchVars } from '@/lib/worker/types'
import {
  getServiceSummariesReadOnly,
  txMarkMatchCompleted,
  txMarkMatchFailed,
} from '@/lib/dal/services'
import { markTimeline } from '@/lib/observability/timeline'
import { getChannel, publishEvent } from '@/lib/worker/common'
import {
  recordRefund,
  markDebitFailed,
} from '@/lib/dal/coinLedger'
import { logError } from '@/lib/logger'
import { FailureCode } from '@prisma/client'

import { retrieveMatchContext } from '@/lib/rag/retriever'
import { validateJson } from '@/lib/llm/json-validator'

// ============================================================================
// Types
// ============================================================================

interface ParsedMatch {
  ok: true
  data: any
}

interface ParseFailure {
  ok: false
  failureCode: FailureCode
  reason: string
}

type ParseResult = ParsedMatch | ParseFailure

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse and validate LLM output to JSON
 */
function parseAndValidate(
  execResult: ExecutionResult,
  requestId: string
): ParseResult {
  // Case 1: Stream returned nothing
  if (!execResult.ok && !execResult.raw) {
    return {
      ok: false,
      failureCode: FailureCode.STREAM_EMPTY,
      reason: execResult.error || 'Stream returned no content',
    }
  }

  // Case 2: Try to parse the raw content
  const validation = validateJson(execResult.raw || '', {
    enableFallback: true,
    strictMode: false,
    debug: { reqId: requestId, route: 'worker/match/parseAndValidate' },
  })

  if (validation.success && validation.data) {
    return { ok: true, data: validation.data }
  }

  // Case 3: Fallback to structured output if available
  if (execResult.data && typeof execResult.data === 'object') {
    return { ok: true, data: execResult.data }
  }

  // Case 4: Parse failed completely
  return {
    ok: false,
    failureCode: FailureCode.JSON_PARSE_FAILED,
    reason: validation.error || 'No JSON extracted',
  }
}

/**
 * Detect logic failures in LLM output (garbage, placeholder, leakage)
 */
function detectLogicFailure(matchJson: any): ParseFailure | null {
  const score = Number(matchJson.match_score ?? matchJson.score ?? 0)
  const assessment = String(matchJson.overall_assessment ?? '').toLowerCase()
  const strengths = Array.isArray(matchJson.strengths) ? matchJson.strengths : []

  // Check 1: Placeholder keywords (LLM refused)
  const failureKeywords = [
    'placeholder', 'missing input', '无法完成', '占位符',
    'input data', 'invalid', '请提供',
  ]
  if (failureKeywords.some((k) => assessment.includes(k))) {
    return {
      ok: false,
      failureCode: FailureCode.LLM_LOGIC_REFUSAL,
      reason: 'LLM returned placeholder response',
    }
  }

  // Check 2: Template variable leakage
  const rawStr = JSON.stringify(matchJson)
  if ((rawStr.includes('{{') && rawStr.includes('}}')) ||
    (rawStr.includes('{') && rawStr.includes('}'))) {
    // More specific check for actual template variables
    if (/\{\{[a-z_]+\}\}/i.test(rawStr) || /\{[a-z_]+\}/i.test(rawStr)) {
      return {
        ok: false,
        failureCode: FailureCode.TEMPLATE_LEAKAGE,
        reason: 'Unreplaced template variables in output',
      }
    }
  }

  // Check 3: Ghost/empty response
  const isEmpty = strengths.length === 0 && assessment.length < 5
  if (score === 0 && isEmpty) {
    return {
      ok: false,
      failureCode: FailureCode.EMPTY_RESPONSE,
      reason: 'Ghost response with no meaningful content',
    }
  }

  return null // No logic failure detected
}

/**
 * Publish failure event and mark task as failed
 */
async function publishFailure(
  channel: string,
  serviceId: string,
  taskId: string,
  requestId: string,
  traceId: string,
  failureCode: FailureCode,
  reason: string
): Promise<void> {
  try {
    await publishEvent(channel, {
      type: 'status',
      taskId,
      code: 'match_failed',
      status: 'MATCH_FAILED',
      errorMessage: `Analysis failed: ${reason}`,
      lastUpdatedAt: new Date().toISOString(),
      stage: 'finalize',
      requestId,
      traceId,
    })
  } catch {
    /* best effort */
  }
  await txMarkMatchFailed(serviceId, failureCode)
}

/**
 * Handle refunds for failed paid tasks
 */
async function handleRefunds(
  execResult: ExecutionResult,
  variables: JobMatchVars,
  serviceId: string,
  userId: string
): Promise<void> {
  if (!execResult.ok && variables.wasPaid && variables.cost && variables.debitId) {
    try {
      await recordRefund({
        userId,
        serviceId,
        amount: Number(variables.cost),
        metadata: { reason: 'match_failed' },
        relatedId: String(variables.debitId),
      })
    } catch (e) {
      logError({
        reqId: 'refund_error',
        route: 'worker/match',
        error: String(e),
        phase: 'refund',
        serviceId,
      })
    }
    try {
      await markDebitFailed(String(variables.debitId))
    } catch {
      /* best effort */
    }
  }
}

function safeParse(jsonStr: any) {
  if (typeof jsonStr !== 'string') return null
  try {
    return JSON.parse(jsonStr)
  } catch {
    return null
  }
}

function asStringArray(arr: any): string[] {
  if (Array.isArray(arr)) return arr.map(String)
  return []
}

// ============================================================================
// Strategy Implementation
// ============================================================================

export class MatchStrategy implements WorkerStrategy<JobMatchVars> {
  templateId = 'job_match' as const

  async prepareVars(variables: JobMatchVars, ctx: StrategyContext) {
    const vars: Record<string, any> = { ...variables }
    const { serviceId, userId, taskId, requestId } = ctx

    // Ensure IDs are present
    const resumeId = String(vars['resumeId'] || '')
    const detailedId = String(vars['detailedResumeId'] || '')
    const jobId = String(vars['jobId'] || '')

    if (serviceId) {
      await markTimeline(serviceId, 'worker_stream_vars_init_end', {
        taskId,
        meta: JSON.stringify({
          hasResume: !!resumeId,
          hasDetailed: !!detailedId,
          hasJob: !!jobId,
        }),
      })
    }

    // Initialize summary JSONs if missing
    if (typeof vars['resume_summary_json'] !== 'string') vars['resume_summary_json'] = ''
    if (typeof vars['job_summary_json'] !== 'string') vars['job_summary_json'] = ''
    if (typeof vars['detailed_resume_summary_json'] !== 'string') vars['detailed_resume_summary_json'] = ''

    // Parallel: Notify frontend + fetch context
    let contextSvc: any = null

    const notifyPendingPromise = (async () => {
      try {
        const channel = getChannel(userId, serviceId, taskId)
        await publishEvent(channel, {
          type: 'status',
          taskId,
          code: 'match_pending',
          status: 'MATCH_PENDING',
          lastUpdatedAt: new Date().toISOString(),
          stage: 'rag_start',
          requestId,
        })
      } catch { /* non-fatal */ }
    })()

    const fetchContextPromise = (async () => {
      if (!vars['resume_summary_json'] || !vars['detailed_resume_summary_json'] || !vars['job_summary_json']) {
        try {
          const tCtx0 = Date.now()
          contextSvc = await getServiceSummariesReadOnly(serviceId, userId)
          const tCtx1 = Date.now()
          await markTimeline(serviceId, 'worker_stream_vars_fetch_context_db_latency', {
            taskId,
            latencyMs: tCtx1 - tCtx0,
          })
        } catch (err) {
          logError({
            reqId: requestId,
            route: 'worker/match',
            error: String(err),
            phase: 'fetch_context',
            serviceId,
          })
        }
      }
    })()

    await Promise.all([notifyPendingPromise, fetchContextPromise])

    // Populate missing summaries from context
    if (!vars['resume_summary_json']) {
      try {
        const obj = contextSvc?.resume?.resumeSummaryJson
        if (obj) vars['resume_summary_json'] = JSON.stringify(obj)
      } catch { /* non-fatal */ }
    }
    if (!vars['detailed_resume_summary_json']) {
      try {
        const obj = contextSvc?.detailedResume?.detailedSummaryJson
        if (obj) vars['detailed_resume_summary_json'] = JSON.stringify(obj)
      } catch { /* non-fatal */ }
    }
    if (!vars['job_summary_json']) {
      try {
        const obj = contextSvc?.job?.jobSummaryJson
        if (obj) vars['job_summary_json'] = JSON.stringify(obj)
      } catch { /* non-fatal */ }
    }

    await markTimeline(serviceId, 'worker_stream_vars_fetch_context_end', { taskId })

    // RAG retrieval
    await markTimeline(serviceId, 'worker_stream_vars_logic_start', { taskId })
    try {
      const resumeObj = safeParse(vars['resume_summary_json'])
      const jobObj = safeParse(vars['job_summary_json'])

      const jobTitle = String(jobObj?.jobTitle || '')
      const mustHaves = asStringArray(jobObj?.mustHaves)
      const niceToHaves = asStringArray(jobObj?.niceToHaves)

      const resumeSkillsArr = [
        ...asStringArray(resumeObj?.skills),
        ...asStringArray(resumeObj?.skills?.technical),
        ...asStringArray(resumeObj?.skills?.soft),
        ...asStringArray(resumeObj?.skills?.tools),
      ]

      const normalizedSkills = resumeSkillsArr.map((s) => s.toLowerCase())
      const strengthKeywords = mustHaves.filter((m) =>
        normalizedSkills.some((s) => s.includes(String(m).toLowerCase()))
      )
      const topStrengths = strengthKeywords.slice(0, 2)

      const rag = await retrieveMatchContext(
        { jobTitle, mustHaves, niceToHaves, resumeSkills: resumeSkillsArr, topStrengths },
        ctx.locale || 'en',
        'job_match'
      )

      vars['rag_context'] = rag
    } catch (err) {
      logError({
        reqId: requestId,
        route: 'worker/match',
        error: String(err),
        phase: 'rag_retrieval',
        serviceId,
      })
      vars['rag_context'] = String(vars['rag_context'] || '')
    } finally {
      await markTimeline(serviceId, 'worker_stream_vars_logic_end', { taskId })
    }

    return vars
  }

  async writeResults(
    execResult: ExecutionResult,
    variables: JobMatchVars,
    ctx: StrategyContext
  ) {
    const { serviceId, userId, requestId, traceId, taskId } = ctx
    const channel = getChannel(userId, serviceId, taskId)

    // Step 1: Parse and validate
    const parseResult = parseAndValidate(execResult, requestId)

    if (!parseResult.ok) {
      const failure = parseResult as ParseFailure
      logError({
        reqId: requestId,
        route: 'worker/match',
        error: failure.reason,
        phase: 'parse_validate',
        serviceId,
        failureCode: failure.failureCode,
        rawLength: (execResult.raw || '').length,
        rawPreview: (execResult.raw || '').slice(0, 500),
      })
      await publishFailure(channel, serviceId, taskId, requestId, traceId, failure.failureCode, failure.reason)
      execResult.ok = false
      execResult.error = failure.reason
      await handleRefunds(execResult, variables, serviceId, userId)
      return
    }

    const matchJson = parseResult.data

    // Step 2: Detect logic failures (placeholder, leakage, empty)
    const logicFailure = detectLogicFailure(matchJson)

    if (logicFailure) {
      logError({
        reqId: requestId,
        route: 'worker/match',
        error: logicFailure.reason,
        phase: 'logic_check',
        serviceId,
        failureCode: logicFailure.failureCode,
      })
      await publishFailure(channel, serviceId, taskId, requestId, traceId, logicFailure.failureCode, logicFailure.reason)
      execResult.ok = false
      execResult.error = logicFailure.reason
      await handleRefunds(execResult, variables, serviceId, userId)
      return
    }

    // Step 3: Success - save and notify
    await txMarkMatchCompleted(serviceId, matchJson)

    try {
      await publishEvent(channel, {
        type: 'match_result',
        taskId,
        json: matchJson,
        stage: 'match_done',
        requestId,
        traceId,
      })
      await publishEvent(channel, {
        type: 'status',
        taskId,
        code: 'match_completed',
        status: 'MATCH_COMPLETED',
        lastUpdatedAt: new Date().toISOString(),
        stage: 'finalize',
        requestId,
        traceId,
      })
    } catch { /* best effort */ }

    await handleRefunds(execResult, variables, serviceId, userId)
  }
}
