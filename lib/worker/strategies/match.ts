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
  markDebitSuccess,
  markDebitFailed,
} from '@/lib/dal/coinLedger'
import { logError } from '@/lib/logger'

import { retrieveMatchContext } from '@/lib/rag/retriever'
import { validateJson } from '@/lib/llm/json-validator'

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
    if (typeof vars['resume_summary_json'] !== 'string')
      vars['resume_summary_json'] = ''
    if (typeof vars['job_summary_json'] !== 'string')
      vars['job_summary_json'] = ''
    if (typeof vars['detailed_resume_summary_json'] !== 'string')
      vars['detailed_resume_summary_json'] = ''

    // Notify Frontend: MATCH_PENDING (Analyzing...)
    // This ensures the user sees "Analyzing match degree..." during the RAG phase
    // We can do this in parallel with context fetching/RAG to save time, but context fetch is needed for RAG.
    // Let's fire this off early.
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
      } catch (e) {
        /* non-fatal */
      }
    })()

    // Optimization: Fetch summaries and Perform RAG in parallel if possible?
    // RAG needs summaries (skills, job title). So RAG depends on Context.
    // BUT, we can parallelize "Fetch Context" and "Notify Pending".
    // And if context is already present in variables (e.g. passed from previous step? usually not full json), we could skip.
    // Current flow: Fetch Context -> RAG.

    let contextSvc: any = null

    const fetchContextPromise = (async () => {
      if (
        !vars['resume_summary_json'] ||
        !vars['detailed_resume_summary_json'] ||
        !vars['job_summary_json']
      ) {
        try {
          const tCtx0 = Date.now()
          contextSvc = await getServiceSummariesReadOnly(serviceId, userId)
          const tCtx1 = Date.now()
          await markTimeline(
            serviceId,
            'worker_stream_vars_fetch_context_db_latency',
            {
              taskId,
              latencyMs: tCtx1 - tCtx0,
            }
          )
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

    if (!vars['resume_summary_json']) {
      try {
        const obj = contextSvc?.resume?.resumeSummaryJson
        if (obj) vars['resume_summary_json'] = JSON.stringify(obj)
      } catch (e) {
        /* non-fatal */
      }
    }
    if (!vars['detailed_resume_summary_json']) {
      try {
        const obj = contextSvc?.detailedResume?.detailedSummaryJson
        if (obj) vars['detailed_resume_summary_json'] = JSON.stringify(obj)
      } catch (e) {
        /* non-fatal */
      }
    }
    if (!vars['job_summary_json']) {
      try {
        const obj = contextSvc?.job?.jobSummaryJson
        if (obj) vars['job_summary_json'] = JSON.stringify(obj)
      } catch (e) {
        /* non-fatal */
      }
    }

    await markTimeline(serviceId, 'worker_stream_vars_fetch_context_end', {
      taskId,
    })

    // RAG Logic - Refactored to use specialized retriever
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
        {
          jobTitle,
          mustHaves,
          niceToHaves,
          resumeSkills: resumeSkillsArr,
          topStrengths,
        },
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

    // If stream empty and failed
    if (!execResult.ok && !execResult.data?.raw) {
      try {
        await publishEvent(channel, {
          type: 'status',
          taskId,
          code: 'match_failed',
          status: 'MATCH_FAILED',
          errorMessage: execResult.error || 'Stream failed',
          lastUpdatedAt: new Date().toISOString(),
          stage: 'finalize',
          requestId,
          traceId,
        })
      } catch (e) {
        /* best effort */
      }
      await txMarkMatchFailed(serviceId, 'JSON_PARSE_FAILED' as any) // simplified code
      await handleRefunds(execResult, variables, serviceId, userId)
      return
    }

    // 1. Parse result
    let matchJson: any = null

    // Use the robust validator which handles markdown, full-width quotes, and repairs syntax
    const validation = validateJson(execResult.raw || '', {
      enableFallback: true, // Allow extract/repair strategies
      strictMode: false,
    })

    if (validation.success && validation.data) {
      matchJson = validation.data
    } else if (execResult.data && typeof execResult.data === 'object') {
      // Fallback to structured output if available and validation failed (unlikely if raw exists)
      matchJson = execResult.data
    }

    // Sanity Check: Detect logic failure (garbage output or placeholder complaint)
    let logicFailed = false
    let logicFailureReason = ''

    if (!matchJson) {
      logicFailed = true
      logicFailureReason = 'json_parse_failed'
    } else {
      // Check for failure indicators in content
      // 1. Score is 0 and assessment contains failure keywords
      const score = Number(matchJson.match_score ?? matchJson.score ?? 0)
      const assessment = String(
        matchJson.overall_assessment ?? ''
      ).toLowerCase()
      const strengths = Array.isArray(matchJson.strengths)
        ? matchJson.strengths
        : []

      const failureKeywords = [
        'placeholder',
        'missing input',
        '无法完成',
        '占位符',
        'input data',
        'invalid',
      ]
      const hasFailureKeyword = failureKeywords.some((k) =>
        assessment.includes(k)
      )

      // 2. Empty content (ghost response)
      const isEmpty = strengths.length === 0 && assessment.length < 5

      if (hasFailureKeyword || (score === 0 && isEmpty)) {
        logicFailed = true
        logicFailureReason = 'llm_logic_refusal'
      }

      // 3. Check for unreplaced variables in output (leakage)
      const rawStr = JSON.stringify(matchJson)
      if (rawStr.includes('{{') && rawStr.includes('}}')) {
        logicFailed = true
        logicFailureReason = 'template_leakage'
      }
    }

    if (logicFailed) {
      // Mark as failed to trigger refund
      execResult.ok = false
      execResult.error = logicFailureReason

      try {
        await publishEvent(channel, {
          type: 'status',
          taskId,
          code: 'match_failed',
          status: 'MATCH_FAILED',
          errorMessage: 'Analysis failed: ' + logicFailureReason,
          lastUpdatedAt: new Date().toISOString(),
          stage: 'finalize',
          requestId,
          traceId,
        })
      } catch (e) {
        /* best effort */
      }

      await txMarkMatchFailed(serviceId, 'JSON_PARSE_FAILED' as any)
      await handleRefunds(execResult, variables, serviceId, userId)
      return
    }

    // Success (even partial stream is considered success for match)
    // Pass matchJson to be saved in DB
    await txMarkMatchCompleted(serviceId, matchJson)

    try {
      if (matchJson) {
        await publishEvent(channel, {
          type: 'match_result',
          taskId,
          json: matchJson,
          stage: 'match_done',
          requestId,
          traceId,
        })
      }
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
    } catch (e) {
      /* best effort */
    }

    if (!execResult.ok && execResult.data?.raw) {
      // It was a partial success or parsing error but we have raw data
      // We considered it completed above, but log it
      logError({
        reqId: requestId,
        route: 'worker/match',
        error: execResult.error || 'Partial success',
        phase: 'match_partial',
        serviceId,
      })
    }

    await handleRefunds(execResult, variables, serviceId, userId)
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

async function handleRefunds(
  execResult: ExecutionResult,
  variables: JobMatchVars,
  serviceId: string,
  userId: string
) {
  if (
    !execResult.ok &&
    variables.wasPaid &&
    variables.cost &&
    variables.debitId
  ) {
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
    // Fix: Mark debit as FAILED when refunding
    try {
      await markDebitFailed(String(variables.debitId))
    } catch (e) {
      /* best effort */
    }
  }
}
