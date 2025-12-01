import { WorkerStrategy, StrategyContext, ExecutionResult } from './interface'
import { JobMatchVars } from '@/lib/worker/types'
import {
  getServiceSummariesReadOnly,
  txMarkMatchCompleted,
  txMarkMatchFailed,
} from '@/lib/dal/services'
import { markTimeline } from '@/lib/observability/timeline'
import { getChannel, publishEvent } from '@/lib/worker/common'
import { recordRefund, markDebitSuccess } from '@/lib/dal/coinLedger'
import { logError } from '@/lib/logger'
import { retrieveMatchContext } from '@/lib/rag/retriever'

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

    await markTimeline(serviceId, 'worker_stream_vars_fetch_context_start', {
      taskId,
    })

    let contextSvc: any = null
    // Optimization: If summaries are missing, fetch them.
    // Ideally this fetch should happen in parallel with RAG if possible, but we need summaries to construct RAG queries.
    // So fetch -> then RAG is logical dependency.
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

    // Notify Frontend: MATCH_PENDING (Analyzing...)
    // This ensures the user sees "Analyzing match degree..." during the RAG phase
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
        serviceId,
        taskId
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
      await txMarkMatchFailed(serviceId, 'llm_error' as any) // simplified code
      await handleRefunds(execResult, variables, serviceId, userId)
      return
    }

    // Parse JSON result if available (from raw stream or structured data)
    let matchJson: any = null
    if (execResult.data && typeof execResult.data === 'object') {
      matchJson = execResult.data
    } else if (execResult.raw) {
      try {
        // Attempt to extract JSON from raw string (which might be markdown wrapped)
        const clean = execResult.raw.replace(/```json\n?|\n?```/g, '').trim()
        // Support JSON starting with { or [
        if (clean.startsWith('{') || clean.startsWith('[')) {
          matchJson = JSON.parse(clean)
        }
      } catch (e) {
        /* best effort parse */
      }
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

    // Confirm payment
    const wasPaid = !!variables.wasPaid
    const cost = Number(variables.cost || 0)
    const debitId = String(variables.debitId || '')
    if (wasPaid && cost > 0 && debitId) {
      try {
        await markDebitSuccess(debitId, execResult.usageLogId)
      } catch (e) {
        /* best effort */
      }
    }
  }
}

function safeParse(jsonStr: any): any {
  try {
    return JSON.parse(String(jsonStr || ''))
  } catch {
    return {}
  }
}

function asStringArray(val: any): string[] {
  if (Array.isArray(val)) return val.map(String)
  return []
}

async function handleRefunds(
  execResult: ExecutionResult,
  variables: any,
  serviceId: string,
  userId: string
) {
  const wasPaid = !!variables?.wasPaid
  const cost = Number(variables?.cost || 0)
  const debitId = String(variables?.debitId || '')

  if (wasPaid && cost > 0 && debitId) {
    try {
      await recordRefund({
        userId,
        amount: cost,
        relatedId: debitId,
        serviceId,
        templateId: 'job_match',
      })
    } catch (e) {
      /* log? */
    }
    try {
      await markDebitSuccess(debitId, execResult.usageLogId)
    } catch (e) {
      /* best effort */
    }
  }
}
