import { WorkerStrategy, StrategyContext, ExecutionResult } from './interface'
import {
  getJobOriginalTextById,
  setJobSummaryJson,
  txMarkSummaryCompleted,
  txMarkSummaryFailed,
  updateServiceExecutionStatus,
  setResumeSummaryJson,
  setDetailedResumeSummaryJson,
  getServiceIdsForMatch,
} from '@/lib/dal/services'
import {
  getResumeOriginalTextById,
  getDetailedResumeOriginalTextById,
} from '@/lib/dal/resume'
import { markTimeline } from '@/lib/observability/timeline'
import {
  getChannel,
  publishEvent,
  buildMatchTaskId,
  getUserHasQuota,
} from '@/lib/worker/common'
import { pushTask } from '@/lib/queue/producer'
import {
  recordRefund,
  markDebitSuccess,
  markDebitFailed,
} from '@/lib/dal/coinLedger'
import { AsyncTaskStatus, ExecutionStatus } from '@prisma/client'
import { logError } from '@/lib/logger'

/**
 * Strategy for Summary tasks (Job, Resume, Detailed Resume).
 * Handles fetching original text, saving summary JSON, and enqueuing subsequent Match task (for Job Summary).
 */
export class SummaryStrategy implements WorkerStrategy<any> {
  constructor(
    public templateId:
      | 'job_summary'
      | 'resume_summary'
      | 'detailed_resume_summary',
  ) { }

  /**
   * Fetches original text if not provided in variables.
   */
  async prepareVars(variables: any, ctx: StrategyContext) {
    const vars = { ...variables }
    const { serviceId, taskId } = ctx

    if (this.templateId === 'job_summary') {
      const jobId = String(vars.jobId || '')
      if (jobId && !vars.job_text) {
        if (serviceId)
          await markTimeline(
            serviceId,
            'worker_batch_vars_fetch_job_text_start',
            { taskId },
          )
        const text = await getJobOriginalTextById(jobId)
        if (serviceId)
          await markTimeline(
            serviceId,
            'worker_batch_vars_fetch_job_text_end',
            { taskId, meta: text ? `len=${text.length}` : 'null' },
          )
        if (text) vars.job_text = text
      }
    } else if (this.templateId === 'resume_summary') {
      const resumeId = String(vars.resumeId || '')
      if (resumeId) {
        if (serviceId)
          await markTimeline(
            serviceId,
            'worker_batch_vars_fetch_resume_start',
            { taskId },
          )
        const text = await getResumeOriginalTextById(resumeId)
        if (serviceId)
          await markTimeline(serviceId, 'worker_batch_vars_fetch_resume_end', {
            taskId,
            meta: text ? `len=${text.length}` : 'null',
          })
        if (text) vars.resume_text = text
      }
    } else if (this.templateId === 'detailed_resume_summary') {
      const detailedId = String(vars.detailedResumeId || '')
      if (detailedId) {
        if (serviceId)
          await markTimeline(
            serviceId,
            'worker_batch_vars_fetch_detailed_start',
            { taskId },
          )
        const text = await getDetailedResumeOriginalTextById(detailedId)
        if (serviceId)
          await markTimeline(
            serviceId,
            'worker_batch_vars_fetch_detailed_end',
            { taskId, meta: text ? `len=${text.length}` : 'null' },
          )
        if (text) vars.detailed_resume_text = text
      }
    }
    return vars
  }

  /**
   * Writes summary JSON to DB. For Job Summary, triggers Match task.
   */
  async writeResults(
    execResult: ExecutionResult,
    variables: any,
    ctx: StrategyContext,
  ) {
    const { serviceId, userId, requestId } = ctx

    try {
      if (this.templateId === 'resume_summary') {
        const resumeId = String(variables.resumeId || '')
        if (resumeId) {
          await setResumeSummaryJson(
            resumeId,
            execResult.ok ? execResult.data : undefined,
            execResult.ok ? AsyncTaskStatus.COMPLETED : AsyncTaskStatus.FAILED,
          )
        }
      } else if (this.templateId === 'detailed_resume_summary') {
        const detailedId = String(variables.detailedResumeId || '')
        if (detailedId) {
          await setDetailedResumeSummaryJson(
            detailedId,
            execResult.ok ? execResult.data : undefined,
            execResult.ok ? AsyncTaskStatus.COMPLETED : AsyncTaskStatus.FAILED,
          )
        }
      } else if (this.templateId === 'job_summary') {
        await this.handleJobSummaryWrite(execResult, variables, ctx)
      }
    } catch (err) {
      logError({
        reqId: requestId,
        route: 'worker/summary',
        error: String(err),
        phase: 'write_summary_result',
        serviceId,
        templateId: this.templateId,
      })
    }

    await this.handleRefunds(execResult, variables, serviceId, userId)
  }

  private async handleJobSummaryWrite(
    execResult: ExecutionResult,
    variables: any,
    ctx: StrategyContext,
  ) {
    const { serviceId, userId, requestId, traceId, taskId } = ctx

    await markTimeline(serviceId, 'worker_batch_write_summary_db_start', {
      taskId,
    })
    await setJobSummaryJson(
      serviceId,
      execResult.ok ? execResult.data : undefined,
      execResult.ok ? AsyncTaskStatus.COMPLETED : AsyncTaskStatus.FAILED,
    )
    await markTimeline(serviceId, 'worker_batch_write_summary_db_end', {
      taskId,
    })

    if (execResult.ok) {
      const sessionId = String(variables.executionSessionId || '')
      const matchTaskId = buildMatchTaskId(serviceId, sessionId)
      const matchChannel = getChannel(userId, serviceId, matchTaskId)

      const dbUpdatePromise = txMarkSummaryCompleted(serviceId).catch((err) =>
        logError({
          reqId: requestId,
          route: 'worker/summary',
          error: String(err),
          phase: 'mark_summary_completed',
          serviceId,
        }),
      )

      // Determine Next Step: PreMatch (Paid) or Match (Free)
      const isPaid =
        variables.tierOverride === 'paid' ||
        variables.wasPaid ||
        (await getUserHasQuota(userId))

      const status = 'SUMMARY_COMPLETED'
      const code = 'summary_completed'

      const publishPromise = (async () => {
        try {
          // STEP 1: Prime the match channel with PENDING status
          const nextPendingStatus = isPaid ? 'PREMATCH_PENDING' : 'MATCH_PENDING'
          const nextPendingCode = isPaid ? 'prematch_queued' : 'match_queued'
          await publishEvent(matchChannel, {
            type: 'status',
            taskId: matchTaskId,
            code: nextPendingCode,
            status: nextPendingStatus,
            lastUpdatedAt: new Date().toISOString(),
            stage: 'queue',
            requestId,
            traceId,
          })

          // STEP 2: Send task_switch on current job_ channel
          const currentChannel = getChannel(userId, serviceId, taskId)
          await publishEvent(currentChannel, {
            type: 'status',
            taskId: matchTaskId,
            code: 'task_switch',
            status,
            nextTaskId: matchTaskId,
            lastUpdatedAt: new Date().toISOString(),
            stage: 'finalize',
            requestId,
            traceId,
          })

          // STEP 3: Publish summary result to match channel
          await publishEvent(matchChannel, {
            type: 'summary_result',
            taskId: matchTaskId,
            json: execResult.data,
            stage: 'summary_done',
            requestId,
            traceId,
          })
        } catch (err) {
          logError({
            reqId: requestId,
            route: 'worker/summary',
            error: String(err),
            phase: 'publish_summary_success',
            serviceId,
          })
        }
      })()

      await Promise.all([dbUpdatePromise, publishPromise])

      await this.enqueueMatchTask(variables, ctx, matchTaskId)
    } else {
      // Failed
      let failureCode: any = 'llm_error'
      const errLower = execResult.error?.toLowerCase() || ''

      // Simplified failure code mapping
      if (errLower.includes('json')) {
        failureCode = 'JSON_PARSE_FAILED'
      } else if (
        errLower.includes('rate limit') ||
        errLower.includes('too many requests') ||
        errLower.includes('busy') ||
        errLower.includes('请求过多')
      ) {
        failureCode = 'MODEL_TOO_BUSY'
      }

      await txMarkSummaryFailed(serviceId, failureCode)

      const sessionId = String(variables.executionSessionId || '')
      const matchTaskId = buildMatchTaskId(serviceId, sessionId)
      const matchChannel = getChannel(userId, serviceId, matchTaskId)

      try {
        await publishEvent(matchChannel, {
          type: 'status',
          taskId: matchTaskId,
          code: 'summary_failed',
          status: 'SUMMARY_FAILED',
          failureCode,
          errorMessage: execResult.error || '',
          lastUpdatedAt: new Date().toISOString(),
          stage: 'finalize',
          requestId,
          traceId,
        })
      } catch (err) {
        logError({
          reqId: requestId,
          route: 'worker/summary',
          error: String(err),
          phase: 'publish_summary_failed',
          serviceId,
        })
      }

      // Also publish to the current task channel (for frontend listening to job_*)
      if (taskId !== matchTaskId) {
        try {
          const currentChannel = getChannel(userId, serviceId, taskId)
          await publishEvent(currentChannel, {
            type: 'status',
            taskId: taskId,
            code: 'summary_failed',
            status: 'SUMMARY_FAILED',
            failureCode,
            errorMessage: execResult.error || '',
            lastUpdatedAt: new Date().toISOString(),
            stage: 'finalize',
            requestId,
            traceId,
          })
        } catch (err) {
          // ignore
        }
      }
    }
  }

  private async enqueueMatchTask(
    variables: any,
    ctx: StrategyContext,
    matchTaskId: string,
  ) {
    const { serviceId, userId, locale, requestId } = ctx
    await markTimeline(serviceId, 'worker_batch_enqueue_match_start', {
      taskId: matchTaskId,
    })

    const svc = await getServiceIdsForMatch(serviceId)
    const wasPaid = !!variables.wasPaid
    const cost = Number(variables.cost || 0)
    const debitId = String(variables.debitId || '')
    const sessionId = String(variables.executionSessionId || '')
    const idemNonce = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    // Phase 2: Enhanced Reasoning Pipeline (Bad Cop / Good Cop)
    // Paid users go through Pre-Match Audit; Free users go directly to Match.
    if (wasPaid) {
      // --- Paid Tier: Pre-Match Audit (Stream) ---
      // Streaming mode: Provides real-time PreMatch analysis output
      const pushRes = await pushTask({
        kind: 'stream', // Phase 2: Converted to streaming for real-time feedback
        serviceId,
        taskId: `pre_${matchTaskId}`, // Distinct task ID for audit
        userId,
        locale: locale as 'en' | 'zh',
        templateId: 'pre_match_audit',
        variables: {
          serviceId,
          resumeId: svc?.resumeId || '',
          ...(svc?.detailedResumeId
            ? { detailedResumeId: svc?.detailedResumeId }
            : {}),
          jobId: svc?.job?.id || '',
          resume_summary_json: '', // Worker will fetch from DB
          job_summary_json: '', // Worker will fetch from DB
          executionSessionId: sessionId,
          wasPaid,
          cost,
          ...(debitId ? { debitId } : {}),
          nextTaskId: matchTaskId, // Pass original match task ID for chaining
        },
      })

      if (pushRes.error) {
        logError({
          reqId: requestId,
          route: 'worker/summary',
          error: pushRes.error,
          phase: 'enqueue_pre_match_failed',
          serviceId,
        })
        // If audit fails to enqueue, should we fallback to direct match?
        // Yes, for high availability.
        console.warn('Pre-match enqueue failed, falling back to direct match.')
        // Fallthrough to direct match logic below...
        // But we need to structure this if/else carefully.
      } else {
        // Success: Update status and return
        try {
          await updateServiceExecutionStatus(
            serviceId,
            'PREMATCH_PENDING' as ExecutionStatus,
          )
        } catch (err) {
          /* ignore */
        }

        await markTimeline(serviceId, 'worker_batch_enqueue_match_end', {
          taskId: matchTaskId,
          route: 'pre_match_audit',
        })
        return // Stop here, PreMatchStrategy will enqueue job_match
      }
    }

    // --- Free Tier (or Fallback): Direct Job Match (Stream) ---
    const pushRes = await pushTask({
      kind: 'stream',
      serviceId,
      taskId: matchTaskId,
      userId,
      locale: locale as 'en' | 'zh',
      templateId: 'job_match',
      variables: {
        rag_context: '',
        resumeId: svc?.resumeId || '',
        ...(svc?.detailedResumeId
          ? { detailedResumeId: svc?.detailedResumeId }
          : {}),
        jobId: svc?.job?.id || '',
        resume_summary_json: '',
        job_summary_json: '',
        executionSessionId: sessionId,
        wasPaid,
        cost,
        ...(debitId ? { debitId } : {}),
        prompt: idemNonce,
      },
    })

    if (pushRes.error) {
      logError({
        reqId: requestId,
        route: 'worker/summary',
        error: pushRes.error,
        phase: 'enqueue_match_failed',
        serviceId,
      })
    }

    try {
      await updateServiceExecutionStatus(
        serviceId,
        ExecutionStatus.MATCH_PENDING,
      )
    } catch (err) {
      logError({
        reqId: requestId,
        route: 'worker/summary',
        error: String(err),
        phase: 'update_match_pending',
        serviceId,
      })
    }

    await markTimeline(serviceId, 'worker_batch_enqueue_match_end', {
      taskId: matchTaskId,
    })
  }

  private async handleRefunds(
    execResult: ExecutionResult,
    variables: any,
    serviceId: string,
    userId: string,
  ) {
    const wasPaid = !!variables?.wasPaid
    const cost = Number(variables?.cost || 0)
    const debitId = String(variables?.debitId || '')

    const shouldRefund = !execResult.ok && wasPaid && cost > 0 && !!debitId
    if (shouldRefund) {
      try {
        await recordRefund({
          userId,
          amount: cost,
          relatedId: debitId,
          ...(this.templateId === 'job_summary' ? { serviceId } : {}),
          templateId: this.templateId,
        })
      } catch (err) {
        logError({
          reqId: 'system',
          route: 'worker/summary',
          error: String(err),
          phase: 'refund_failed',
          serviceId,
        })
      }
      try {
        // Fix: Mark debit as FAILED when refunding
        await markDebitFailed(debitId)
      } catch (e) {
        /* best effort */
      }
    } else if (execResult.ok && wasPaid && cost > 0 && debitId) {
      try {
        await markDebitSuccess(debitId, execResult.usageLogId)
      } catch (e) {
        /* best effort */
      }
    }
  }
}
