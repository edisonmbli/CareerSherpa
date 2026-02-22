import {
  WorkerStrategy,
  StrategyContext,
  ExecutionResult,
  DeferredTask,
} from './interface'
import { OcrExtractVars } from '@/lib/worker/types'
import {
  updateJobOriginalText,
  updateServiceExecutionStatus,
  txMarkSummaryFailed,
  getServiceStatus,
  clearJobImageData,
} from '@/lib/dal/services'
import { markTimeline } from '@/lib/observability/timeline'
import { getChannel, publishEvent, buildMatchTaskId } from '@/lib/worker/common'
import { acquireLock } from '@/lib/redis/lock'
import { recordRefund, markDebitFailed } from '@/lib/dal/coinLedger'
import { ExecutionStatus, AsyncTaskStatus, FailureCode } from '@prisma/client'
import { ENV } from '@/lib/env'
import { logError, logInfo } from '@/lib/logger'
// Phase 1.5: Baidu OCR for Paid tier
import { extractTextFromBaidu, isBaiduOcrReady } from '@/lib/services/baidu-ocr'
import { compressIfNeeded } from '@/lib/utils/image-compress'
import { toDataUrlFromImageSource } from '@/lib/utils/image-compress'

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
    const image = vars['image']
    const normalizedImage = image
      ? await toDataUrlFromImageSource(
          String(image),
          ENV.NEXT_PUBLIC_APP_BASE_URL || undefined,
        )
      : image
    if (normalizedImage) {
      vars['image'] = normalizedImage
    }
    const isPaidTier = !!variables.wasPaid
    if (isPaidTier && isBaiduOcrReady() && normalizedImage) {
      try {
        await markTimeline(serviceId, 'baidu_ocr_start', { taskId })
        const t0Baidu = Date.now()
        const compressedBase64 = await compressIfNeeded(normalizedImage)
        const ocrResult = await extractTextFromBaidu(compressedBase64)
        const t1Baidu = Date.now()
        await markTimeline(serviceId, 'baidu_ocr_end', {
          taskId,
          latencyMs: t1Baidu - t0Baidu,
          ok: ocrResult.ok,
          wordsCount: ocrResult.wordsCount,
        })
        if (ocrResult.ok && ocrResult.text) {
          vars['_baidu_ocr_text'] = ocrResult.text
          vars['_baidu_ocr_used'] = true
          logInfo({
            reqId: taskId,
            route: 'worker/ocr',
            userKey: 'system',
            message: 'Using Baidu OCR for Paid tier',
            wordsCount: ocrResult.wordsCount,
          })
        } else {
          logError({
            reqId: taskId,
            route: 'worker/ocr',
            error: ocrResult.error || 'Unknown Baidu OCR error',
            phase: 'baidu_ocr_failed',
            serviceId,
          })
        }
      } catch (e) {
        logError({
          reqId: taskId,
          route: 'worker/ocr',
          error: String(e),
          phase: 'baidu_ocr_exception',
          serviceId,
        })
      }
    }
    return vars
  }

  /**
   * Publishes initial status event.
   */
  async onStart(variables: OcrExtractVars, ctx: StrategyContext) {
    const { serviceId, userId, requestId, traceId, taskId } = ctx
    // Use current task ID (job_...) for channel
    const channel = getChannel(userId, serviceId, taskId)
    try {
      await publishEvent(channel, {
        type: 'status',
        taskId: taskId, // Use current task ID
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
   * @returns DeferredTask array for handler to enqueue after cleanup, or undefined
   */
  async writeResults(
    execResult: ExecutionResult,
    variables: OcrExtractVars,
    ctx: StrategyContext,
  ): Promise<DeferredTask[] | void> {
    const { serviceId, userId, locale, requestId, traceId, taskId } = ctx

    // Phase 1.5: Check if Baidu OCR was used (pre-computed in prepareVars)
    const baiduOcrUsed = !!(variables as any)['_baidu_ocr_used']
    const baiduOcrText = String((variables as any)['_baidu_ocr_text'] || '')

    // Determine final text: Baidu OCR result takes precedence if available
    let text: string
    if (baiduOcrUsed && baiduOcrText) {
      text = baiduOcrText
    } else {
      const dataObj = execResult.ok ? execResult.data || {} : {}
      text = String(dataObj?.extracted_text || '')
    }

    // Handle Failure
    if ((!baiduOcrUsed && !execResult.ok) || !text) {
      try {
        await txMarkSummaryFailed(serviceId, FailureCode.PREVIOUS_OCR_FAILED)
        const channel = getChannel(userId, serviceId, taskId)
        try {
          await publishEvent(channel, {
            type: 'status',
            taskId: taskId,
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

      // Refund if OCR fails
      const wasPaid = !!variables.wasPaid
      const cost = Number(variables.cost || 0)
      const debitId = String(variables.debitId || '')
      if (ctx.shouldRefund !== false && wasPaid && cost > 0 && debitId) {
        try {
          await recordRefund({
            userId,
            serviceId,
            amount: cost,
            relatedId: debitId,
            templateId: 'ocr_extract',
            metadata: { reason: 'ocr_failed' },
          })
          await markDebitFailed(debitId)
        } catch (e) {
          logError({
            reqId: requestId,
            route: 'worker/ocr',
            error: String(e),
            phase: 'refund',
            serviceId,
          })
        }
      }

      return
    }

    const sessionId = String(variables.executionSessionId || '')

    // Handle Success: Parallelize DB update and Event Publishing
    try {
      await markTimeline(serviceId, 'worker_batch_write_ocr_db_start', {
        taskId,
      })

      // Define promises for parallel execution
      const dbUpdatePromise = updateJobOriginalText(serviceId, text)
        .then(() =>
          markTimeline(serviceId, 'worker_batch_write_ocr_db_end', { taskId }),
        )
        .catch((err) =>
          logError({
            reqId: requestId,
            route: 'worker/ocr',
            error: String(err),
            phase: 'write_ocr_db',
            serviceId,
          }),
        )

      const channel = getChannel(userId, serviceId, taskId)
      const cleanupPromise = clearJobImageData(serviceId).catch((err) =>
        logError({
          reqId: requestId,
          route: 'worker/ocr',
          error: String(err),
          phase: 'cleanup_job_image',
          serviceId,
        }),
      )

      const publishPromise = Promise.all([
        publishEvent(channel, {
          type: 'ocr_result',
          taskId: taskId,
          text,
          stage: 'ocr_done',
          requestId,
          traceId,
        }),
        publishEvent(channel, {
          type: 'status',
          taskId: taskId,
          code: 'ocr_completed',
          status: 'OCR_COMPLETED',
          nextTaskId: sessionId ? `job_${serviceId}_${sessionId}` : taskId,
          lastUpdatedAt: new Date().toISOString(),
          stage: 'ocr_done',
          requestId,
          traceId,
        }),
      ]).catch((err) =>
        logError({
          reqId: requestId,
          route: 'worker/ocr',
          error: String(err),
          phase: 'publish_ocr_result',
          serviceId,
        }),
      )

      // Run them in parallel
      await Promise.all([dbUpdatePromise, publishPromise, cleanupPromise])
    } catch (err) {
      // This catch might catch synchronous errors if any
      logError({
        reqId: requestId,
        route: 'worker/ocr',
        error: String(err),
        phase: 'write_ocr_parallel',
        serviceId,
      })
    }

    const wasPaid = !!variables.wasPaid
    // ... lock and enqueue logic ...
    const cost = Number(variables.cost || 0)
    const debitId = String(variables.debitId || '')

    const ttlSec = Math.max(
      1,
      Math.floor(ENV.CONCURRENCY_LOCK_TIMEOUT_MS / 1000),
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
          },
        )
      } else {
        await markTimeline(serviceId, 'worker_batch_enqueue_summary_start', {
          taskId: `job_${serviceId}_${sessionId}`,
        })

        // Return DeferredTask instead of pushing directly
        // Handler will enqueue AFTER cleanup completes, avoiding lock contention
        const deferredTask: DeferredTask<'job_summary'> = {
          kind: 'batch',
          serviceId,
          taskId: `job_${serviceId}_${sessionId}`,
          userId,
          locale: locale as 'en' | 'zh',
          templateId: 'job_summary',
          variables: {
            jobId: String(variables.jobId || ''),
            wasPaid,
            cost,
            ...(debitId ? { debitId } : {}),
            executionSessionId: sessionId,
          },
        }

        await markTimeline(serviceId, 'worker_batch_enqueue_summary_end', {
          taskId: `job_${serviceId}_${sessionId}`,
        })

        // Continue with status updates, then return deferred task at the end
        try {
          await updateServiceExecutionStatus(
            serviceId,
            ExecutionStatus.SUMMARY_PENDING,
            {
              executionSessionId: sessionId,
            },
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
          const channel = getChannel(userId, serviceId, taskId)
          await publishEvent(channel, {
            type: 'status',
            taskId: taskId,
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

        return [deferredTask]
      }
    } else {
      await markTimeline(
        serviceId,
        'worker_batch_enqueue_summary_skip_locked',
        {
          taskId: `job_${serviceId}_${sessionId}`,
        },
      )
    }
    // Return undefined (no deferred tasks) for all other code paths
  }
}
