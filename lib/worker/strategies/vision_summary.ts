import { WorkerStrategy, StrategyContext, ExecutionResult } from './interface'
import {
  setJobSummaryJson,
  txMarkSummaryCompleted,
  txMarkSummaryFailed,
  updateServiceExecutionStatus,
  getServiceIdsForMatch,
  getJobOriginalImageById,
} from '@/lib/dal/services'
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
 * Strategy for Free tier merged OCR + Job Summary (job_vision_summary).
 * Uses Gemini multimodal to extract job summary directly from image.
 * Output structure is same as job_summary.
 */
export class JobVisionSummaryStrategy implements WorkerStrategy<any> {
  templateId = 'job_vision_summary' as const

  /**
   * Fetches image if not provided in variables.
   */
  async prepareVars(variables: any, ctx: StrategyContext) {
    const vars = { ...variables }
    const { serviceId, taskId } = ctx
    const jobId = String(vars.jobId || '')

    // Fetch image for vision model
    if (jobId && !vars.image) {
      if (serviceId) {
        await markTimeline(serviceId, 'worker_batch_vars_fetch_image_start', {
          taskId,
        })
      }
      const t0 = Date.now()
      let imageOrUrl = await getJobOriginalImageById(jobId)

      // Local Development Fix: Convert local path to base64
      if (imageOrUrl && imageOrUrl.startsWith('/uploads/')) {
        try {
          const fs = await import('fs/promises')
          const path = await import('path')
          const filePath = path.join(process.cwd(), 'public', imageOrUrl)
          const buffer = await fs.readFile(filePath)
          const base64 = buffer.toString('base64')
          const ext = path.extname(filePath).slice(1) || 'png'
          const mimeType = ext === 'jpg' ? 'jpeg' : ext
          imageOrUrl = `data:image/${mimeType};base64,${base64}`
        } catch (e) {
          console.error('Failed to read local image for vision summary', e)
        }
      }

      const t1 = Date.now()
      if (serviceId) {
        await markTimeline(serviceId, 'worker_batch_vars_fetch_image_end', {
          taskId,
          latencyMs: t1 - t0,
          meta: imageOrUrl ? `len=${imageOrUrl.length}` : 'null',
        })
      }
      if (imageOrUrl) vars.image = imageOrUrl
    }
    return vars
  }

  /**
   * Writes job summary JSON to DB. Triggers Match task.
   */
  async writeResults(
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

      // Parallelize DB and Redis
      const dbUpdatePromise = txMarkSummaryCompleted(serviceId).catch((err) =>
        logError({
          reqId: requestId,
          route: 'worker/vision_summary',
          error: String(err),
          phase: 'mark_summary_completed',
          serviceId,
        }),
      )

      const publishPromise = (async () => {
        try {
          // STEP 1: First, prime the match_ channel with MATCH_PENDING event
          // This ensures the channel has content when frontend connects after task_switch
          await publishEvent(matchChannel, {
            type: 'status',
            taskId: matchTaskId,
            code: 'match_queued',
            status: 'MATCH_PENDING',
            lastUpdatedAt: new Date().toISOString(),
            stage: 'queue',
            requestId,
            traceId,
          })

          // STEP 2: Publish summary result to match channel
          await publishEvent(matchChannel, {
            type: 'summary_result',
            taskId: matchTaskId,
            json: execResult.data,
            stage: 'summary_done',
            requestId,
            traceId,
          })

          // STEP 3: Now notify frontend on job_ channel to switch to match_ channel
          // The match_ channel already has MATCH_PENDING waiting for it
          const currentChannel = getChannel(userId, serviceId, taskId)
          await publishEvent(currentChannel, {
            type: 'status',
            taskId: matchTaskId,
            code: 'task_switch',
            status: 'JOB_VISION_COMPLETED',
            nextTaskId: matchTaskId,
            lastUpdatedAt: new Date().toISOString(),
            stage: 'finalize',
            requestId,
            traceId,
          })
        } catch (err) {
          logError({
            reqId: requestId,
            route: 'worker/vision_summary',
            error: String(err),
            phase: 'publish_summary_success',
            serviceId,
          })
        }
      })()

      await Promise.all([dbUpdatePromise, publishPromise])

      // Enqueue Match Task
      await this.enqueueMatchTask(variables, ctx, matchTaskId)
    } else {
      // Failed
      let failureCode: any = 'llm_error'
      const errLower = execResult.error?.toLowerCase() || ''

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
        // Also publish to current task channel (for frontend feedback)
        if (taskId !== matchTaskId) {
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
        }
      } catch (err) {
        logError({
          reqId: requestId,
          route: 'worker/vision_summary',
          error: String(err),
          phase: 'publish_summary_failed',
          serviceId,
        })
      }
    }

    await this.handleRefunds(execResult, variables, serviceId, userId)
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
        route: 'worker/vision_summary',
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
        route: 'worker/vision_summary',
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
          serviceId,
          templateId: 'job_vision_summary',
        })
      } catch (err) {
        logError({
          reqId: 'system',
          route: 'worker/vision_summary',
          error: String(err),
          phase: 'refund_failed',
          serviceId,
        })
      }
      try {
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
