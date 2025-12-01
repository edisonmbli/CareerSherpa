import { WorkerStrategy, StrategyContext, ExecutionResult } from './interface'
import { OcrExtractVars } from '@/lib/worker/types'
import {
  getJobOriginalImageById,
  updateJobOriginalText,
  updateServiceExecutionStatus,
  txMarkSummaryFailed,
  getServiceStatus,
} from '@/lib/dal/services'
import { markTimeline } from '@/lib/observability/timeline'
import { getChannel, publishEvent, buildMatchTaskId } from '@/lib/worker/common'
import { acquireLock } from '@/lib/redis/lock'
import { pushTask } from '@/lib/queue/producer'
import { ExecutionStatus, AsyncTaskStatus } from '@prisma/client'
import { ENV } from '@/lib/env'
import { logError } from '@/lib/logger'

/**
 * Strategy for OCR Extraction tasks.
 * Handles fetching image, updating extracted text, and enqueuing subsequent summary task.
 */
export class OcrExtractStrategy implements WorkerStrategy<OcrExtractVars> {
  templateId = 'ocr_extract' as const

  /**
   * Fetches the original image if not provided in variables.
   */
  async prepareVars(variables: OcrExtractVars, ctx: StrategyContext) {
    const vars: Record<string, any> = { ...variables }
    const { serviceId, taskId } = ctx
    const jobId = String(variables.jobId || '')

    if (jobId && !vars['image']) {
      if (serviceId) {
        await markTimeline(serviceId, 'worker_batch_vars_fetch_image_start', {
          taskId,
        })
      }
      const t0 = Date.now()
      const image = await getJobOriginalImageById(jobId)
      const t1 = Date.now()
      if (serviceId) {
        await markTimeline(serviceId, 'worker_batch_vars_fetch_image_end', {
          taskId,
          latencyMs: t1 - t0,
          meta: image ? `len=${image.length}` : 'null',
        })
      }
      if (image) vars['image'] = image
    }
    return vars
  }

  /**
   * Publishes initial status event.
   */
  async onStart(variables: OcrExtractVars, ctx: StrategyContext) {
    const { serviceId, userId, requestId, traceId } = ctx
    const sessionId = String(variables.executionSessionId || '')
    const matchTaskId = buildMatchTaskId(serviceId, sessionId)
    const matchChannel = getChannel(userId, serviceId, matchTaskId)
    try {
      await publishEvent(matchChannel, {
        type: 'status',
        taskId: matchTaskId,
        code: 'ocr_pending',
        status: 'OCR_PENDING',
        lastUpdatedAt: new Date().toISOString(),
        requestId,
        traceId,
      })
    } catch (err) {
      logError({
        reqId: requestId,
        route: 'worker/ocr',
        error: String(err),
        phase: 'onStart_publish',
        serviceId,
      })
    }
  }

  /**
   * Writes extracted text to DB and enqueues the next step (Job Summary).
   */
  async writeResults(
    execResult: ExecutionResult,
    variables: OcrExtractVars,
    ctx: StrategyContext
  ) {
    const { serviceId, userId, locale, requestId, traceId, taskId } = ctx
    const dataObj = execResult.ok ? execResult.data || {} : {}
    const text = String(dataObj?.extracted_text || '')

    // Handle Failure
    if (!execResult.ok || !text) {
      try {
        await txMarkSummaryFailed(serviceId, 'PREVIOUS_OCR_FAILED' as any)
        const sessionId = String(variables.executionSessionId || '')
        const matchTaskId = buildMatchTaskId(serviceId, sessionId)
        const matchChannel = getChannel(userId, serviceId, matchTaskId)
        try {
          await publishEvent(matchChannel, {
            type: 'status',
            taskId: matchTaskId,
            code: 'summary_failed',
            status: 'SUMMARY_FAILED',
            failureCode: 'PREVIOUS_OCR_FAILED',
            errorMessage: String(execResult.error || ''),
            lastUpdatedAt: new Date().toISOString(),
            stage: 'finalize',
            requestId,
            traceId,
          })
        } catch (e) {
          /* best effort */
        }
      } catch (err) {
        logError({
          reqId: requestId,
          route: 'worker/ocr',
          error: String(err),
          phase: 'mark_summary_failed',
          serviceId,
        })
      }
      return
    }

    // Handle Success
    try {
      await markTimeline(serviceId, 'worker_batch_write_ocr_db_start', {
        taskId,
      })
      await updateJobOriginalText(serviceId, text)
      await markTimeline(serviceId, 'worker_batch_write_ocr_db_end', {
        taskId,
      })
    } catch (err) {
      logError({
        reqId: requestId,
        route: 'worker/ocr',
        error: String(err),
        phase: 'write_ocr_db',
        serviceId,
      })
    }

    const sessionId = String(variables.executionSessionId || '')
    const matchTaskId = buildMatchTaskId(serviceId, sessionId)
    const matchChannel = getChannel(userId, serviceId, matchTaskId)

    try {
      await publishEvent(matchChannel, {
        type: 'ocr_result',
        taskId: matchTaskId,
        text,
        stage: 'ocr_done',
        requestId,
        traceId,
      })
    } catch (err) {
      logError({
        reqId: requestId,
        route: 'worker/ocr',
        error: String(err),
        phase: 'publish_ocr_result',
        serviceId,
      })
    }

    const wasPaid = !!variables.wasPaid
    const cost = Number(variables.cost || 0)
    const debitId = String(variables.debitId || '')

    const ttlSec = Math.max(
      1,
      Math.floor(ENV.CONCURRENCY_LOCK_TIMEOUT_MS / 1000)
    )
    const locked = await acquireLock(serviceId, 'summary', ttlSec)

    if (locked) {
      const svcCheck = await getServiceStatus(serviceId)
      const s = svcCheck?.currentStatus
      const isDup =
        s === ExecutionStatus.SUMMARY_PENDING ||
        s === ExecutionStatus.SUMMARY_COMPLETED ||
        s === ExecutionStatus.MATCH_PENDING ||
        s === ExecutionStatus.MATCH_STREAMING ||
        s === ExecutionStatus.MATCH_COMPLETED ||
        s === ExecutionStatus.MATCH_FAILED ||
        s === ExecutionStatus.SUMMARY_FAILED ||
        s === undefined

      if (isDup) {
        await markTimeline(
          serviceId,
          'worker_batch_enqueue_summary_skip_duplicate',
          {
            taskId: `job_${serviceId}_${sessionId}`,
            status: s || 'unknown',
          }
        )
      } else {
        await markTimeline(serviceId, 'worker_batch_enqueue_summary_start', {
          taskId: `job_${serviceId}_${sessionId}`,
        })

        // Enqueue Job Summary Task
        const pushRes = await pushTask({
          kind: 'batch',
          serviceId,
          taskId: `job_${serviceId}_${sessionId}`,
          userId,
          locale: locale as any,
          templateId: 'job_summary',
          variables: {
            jobId: String(variables.jobId || ''),
            wasPaid,
            cost,
            ...(debitId ? { debitId } : {}),
            executionSessionId: sessionId,
          },
        })

        if (pushRes.error) {
          logError({
            reqId: requestId,
            route: 'worker/ocr',
            error: pushRes.error,
            phase: 'enqueue_summary_failed',
            serviceId,
          })
        }

        await markTimeline(serviceId, 'worker_batch_enqueue_summary_end', {
          taskId: `job_${serviceId}_${sessionId}`,
        })
      }
    } else {
      await markTimeline(
        serviceId,
        'worker_batch_enqueue_summary_skip_locked',
        {
          taskId: `job_${serviceId}_${sessionId}`,
        }
      )
    }

    try {
      await updateServiceExecutionStatus(
        serviceId,
        ExecutionStatus.SUMMARY_PENDING,
        {
          executionSessionId: sessionId,
        }
      )
    } catch (err) {
      logError({
        reqId: requestId,
        route: 'worker/ocr',
        error: String(err),
        phase: 'update_status_summary_pending',
        serviceId,
      })
    }

    try {
      await publishEvent(matchChannel, {
        type: 'status',
        taskId: matchTaskId,
        code: 'summary_pending',
        status: 'SUMMARY_PENDING',
        lastUpdatedAt: new Date().toISOString(),
        stage: 'enqueue',
        requestId,
        traceId,
      })
    } catch (err) {
      logError({
        reqId: requestId,
        route: 'worker/ocr',
        error: String(err),
        phase: 'publish_summary_pending',
        serviceId,
      })
    }
  }
}
