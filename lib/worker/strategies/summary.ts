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
import { getChannel, publishEvent, buildMatchTaskId } from '@/lib/worker/common'
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
      | 'detailed_resume_summary'
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
            { taskId }
          )
        const text = await getJobOriginalTextById(jobId)
        if (serviceId)
          await markTimeline(
            serviceId,
            'worker_batch_vars_fetch_job_text_end',
            { taskId, meta: text ? `len=${text.length}` : 'null' }
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
            { taskId }
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
            { taskId }
          )
        const text = await getDetailedResumeOriginalTextById(detailedId)
        if (serviceId)
          await markTimeline(
            serviceId,
            'worker_batch_vars_fetch_detailed_end',
            { taskId, meta: text ? `len=${text.length}` : 'null' }
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
    ctx: StrategyContext
  ) {
    const { serviceId, userId, requestId } = ctx

    try {
      if (this.templateId === 'resume_summary') {
        const resumeId = String(variables.resumeId || '')
        if (resumeId) {
          await setResumeSummaryJson(
            resumeId,
            execResult.ok ? execResult.data : undefined,
            execResult.ok ? AsyncTaskStatus.COMPLETED : AsyncTaskStatus.FAILED
          )
        }
      } else if (this.templateId === 'detailed_resume_summary') {
        const detailedId = String(variables.detailedResumeId || '')
        if (detailedId) {
          await setDetailedResumeSummaryJson(
            detailedId,
            execResult.ok ? execResult.data : undefined,
            execResult.ok ? AsyncTaskStatus.COMPLETED : AsyncTaskStatus.FAILED
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
    ctx: StrategyContext
  ) {
    const { serviceId, userId, requestId, traceId, taskId } = ctx

    await markTimeline(serviceId, 'worker_batch_write_summary_db_start', {
      taskId,
    })
    await setJobSummaryJson(
      serviceId,
      execResult.ok ? execResult.data : undefined,
      execResult.ok ? AsyncTaskStatus.COMPLETED : AsyncTaskStatus.FAILED
    )
    await markTimeline(serviceId, 'worker_batch_write_summary_db_end', {
      taskId,
    })

    if (execResult.ok) {
      // Parallelize Finalization: DB Update, Redis Publish, QStash Enqueue
      // Note: QStash enqueue depends on successful completion conceptually, but technically can be initiated
      // if we assume success. However, for strict correctness, we usually wait for DB update.
      // But we can parallelize DB and Redis.
      // And we can also parallelize QStash if we are confident, but let's stick to:
      // 1. Parallel(DB Update, Redis Publish Success)
      // 2. Then Enqueue Match

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
        })
      )

      const publishPromise = (async () => {
        try {
          await publishEvent(matchChannel, {
            type: 'summary_result',
            taskId: matchTaskId,
            json: execResult.data,
            stage: 'summary_done',
            requestId,
            traceId,
          })
          await publishEvent(matchChannel, {
            type: 'status',
            taskId: matchTaskId,
            code: 'summary_completed',
            status: 'SUMMARY_COMPLETED',
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
            phase: 'publish_summary_success',
            serviceId,
          })
        }
      })()

      // Run DB and Redis in parallel
      await Promise.all([dbUpdatePromise, publishPromise])

      // Enqueue Match Task (Dependent on Summary Completion logic)
      // We can start this as soon as DB mark is done.
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
    }
  }

  private async enqueueMatchTask(
    variables: any,
    ctx: StrategyContext,
    matchTaskId: string
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
        ExecutionStatus.MATCH_PENDING
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
    userId: string
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
