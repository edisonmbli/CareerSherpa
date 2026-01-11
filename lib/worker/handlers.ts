import { ENV } from '@/lib/env'
import {
  parseWorkerBody,
  getUserHasQuota,
  getTtlSec,
  getChannel,
  publishEvent,
} from '@/lib/worker/common'
import { buildQueueCounterKey } from '@/lib/config/concurrency'
import { isServiceScoped } from '@/lib/llm/task-router'
import { withRequestSampling } from '@/lib/dev/redisSampler'
import { logEvent } from '@/lib/observability/logger'
import { publishStart, emitStreamIdle } from '@/lib/worker/pipeline'
import { guardUser, guardModel, guardQueue } from '@/lib/worker/steps/guards'
import { executeStreaming, executeStructured } from '@/lib/worker/steps/execute'
import { computeDecision } from '@/lib/worker/steps/decision'
import { getRequestMeta } from '@/lib/worker/steps/meta'
import { cleanupFinal } from '@/lib/worker/steps/cleanup'
import { getStrategy } from '@/lib/worker/strategies'
import { markTimeline } from '@/lib/observability/timeline'
import { logError } from '@/lib/logger'
import { getProvider } from '@/lib/llm/utils'
import { recordRefund, markDebitFailed } from '@/lib/dal/coinLedger'
import { pushTask } from '@/lib/queue/producer'
import type { DeferredTask } from '@/lib/worker/strategies/interface'

type Body = import('@/lib/worker/types').WorkerBody

// Helper to safely extract common billing fields from any variables union
type PaidTier = 'paid' | 'free' | undefined
interface BillingVars { tierOverride?: PaidTier; wasPaid?: boolean; cost?: number; debitId?: string }
function extractBillingVars(vars: Record<string, unknown>): BillingVars {
  return {
    tierOverride: (vars['tierOverride'] as PaidTier),
    wasPaid: Boolean(vars['wasPaid']),
    cost: Number(vars['cost'] || 0),
    debitId: String(vars['debitId'] || ''),
  }
}

/**
 * Centralized handler for guard failures (429 errors).
 * Handles refund, SSE error notification, and logging.
 * Reuses existing refund pattern from strategies.
 */
async function handleGuardFailure(params: {
  reason: string
  userId: string
  serviceId: string
  taskId: string
  templateId: string
  channel: string
  requestId: string
  traceId: string
  billing: BillingVars
  kind: 'stream' | 'batch'
}): Promise<Response> {
  const { reason, userId, serviceId, taskId, templateId, channel, requestId, traceId, billing, kind } = params
  const { wasPaid, cost = 0, debitId } = billing

  // 1. SSE error notification (so frontend can show error state)
  try {
    await publishEvent(channel, {
      type: 'error',
      taskId,
      code: reason,
      error: `Guard failed: ${reason}`,
      stage: 'guards',
      requestId,
      traceId,
    })
  } catch (e) {
    logError({
      reqId: requestId,
      route: `worker/${kind}`,
      error: String(e),
      phase: 'guard_failure_publish',
      serviceId,
    })
  }

  // 2. Refund for Paid tasks (reusing existing pattern)
  if (wasPaid && cost > 0 && debitId) {
    try {
      await recordRefund({
        userId,
        amount: cost,
        relatedId: debitId,
        ...(isServiceScoped(templateId as any) ? { serviceId } : {}),
        templateId,
        metadata: { reason, failedAt: 'guards' },
      })
      await markDebitFailed(debitId)
      // Note: Event tracking for guard failures - using logError for now
      // since GUARD_FAILURE_REFUNDED is not in AnalyticsEventName
    } catch (e) {
      logError({
        reqId: requestId,
        route: `worker/${kind}`,
        error: String(e),
        phase: 'guard_failure_refund',
        serviceId,
      })
    }
  }

  // 3. Log the guard failure
  logError({
    reqId: requestId,
    route: `worker/${kind}`,
    error: reason,
    phase: 'guard_blocked',
    serviceId,
    meta: { taskId, templateId, wasPaid, cost },
  })

  // 4. Return 429 response
  return Response.json(
    { ok: false, reason },
    { status: 429 }
  )
}

// Token handler for SSE
export async function onToken(
  channel: string,
  taskId: string,
  text: string,
  requestId: string,
  traceId: string
) {
  await publishEvent(channel, {
    type: 'token',
    taskId,
    text,
    stage: 'stream',
    requestId,
    traceId,
  })
}

export async function handleStream(
  req: Request,
  _params: { service: string }
): Promise<Response> {
  return withRequestSampling(
    '/api/worker/stream/[service]',
    'POST',
    async () => {
      const parsed = await parseWorkerBody(req)
      if (!parsed.ok) return parsed.response
      const body: Body = parsed.body

      const { taskId, userId, serviceId, locale, templateId, variables } = body

      const strategy = getStrategy(templateId)
      if (!strategy) {
        return new Response(`Unknown templateId: ${templateId}`, {
          status: 400,
        })
      }

      const { requestId, traceId } = getRequestMeta(req, taskId)

      // 1. Prepare Vars
      const preparedVars = await strategy.prepareVars(variables, {
        serviceId,
        userId,
        locale: locale as string,
        taskId,
        requestId,
        traceId,
      })

      const billing = extractBillingVars(variables as Record<string, unknown>)
      const { tierOverride, wasPaid } = billing
      const userHasQuota =
        tierOverride === 'paid'
          ? true
          : tierOverride === 'free'
            ? false
            : wasPaid
              ? true
              : await getUserHasQuota(userId)
      const decision = computeDecision(templateId, preparedVars, userHasQuota)

      logEvent(
        'TASK_ROUTED',
        { userId, serviceId, taskId },
        {
          templateId,
          modelId: decision.modelId,
          isStream: true,
          queueId: String(decision.queueId),
        }
      )

      const ttlSec = getTtlSec()
      const counterKey = buildQueueCounterKey(String(decision.queueId))
      const channel = getChannel(userId, serviceId, taskId)

      // 2. Guards & Start
      await publishStart(
        channel,
        taskId,
        decision.modelId,
        String(decision.queueId),
        'guards',
        requestId,
        traceId,
        'stream'
      )
      await markTimeline(serviceId, 'worker_stream_start', {
        taskId,
        modelId: decision.modelId,
      })

      // Check Guards
      const gUser = await guardUser(
        userId,
        'stream',
        ttlSec,
        channel,
        requestId,
        traceId
      )
      if (!gUser.ok)
        return handleGuardFailure({
          reason: gUser.reason,
          userId,
          serviceId,
          taskId,
          templateId,
          channel,
          requestId,
          traceId,
          billing,
          kind: 'stream',
        })

      const gModel = await guardModel(
        decision.modelId,
        String(decision.queueId),
        ttlSec,
        channel,
        requestId,
        traceId
      )
      if (!gModel.ok)
        return handleGuardFailure({
          reason: gModel.reason,
          userId,
          serviceId,
          taskId,
          templateId,
          channel,
          requestId,
          traceId,
          billing,
          kind: 'stream',
        })

      const gQueue = await guardQueue(
        userId,
        'stream',
        counterKey,
        ttlSec,
        ENV.QUEUE_MAX_SIZE,
        channel,
        requestId,
        traceId
      )
      if (!gQueue.ok)
        return handleGuardFailure({
          reason: gQueue.reason,
          userId,
          serviceId,
          taskId,
          templateId,
          channel,
          requestId,
          traceId,
          billing,
          kind: 'stream',
        })

      await markTimeline(serviceId, 'worker_stream_guards_done', { taskId })

      // 3. Strategy onStart
      if (strategy.onStart) {
        await strategy.onStart(preparedVars, {
          serviceId,
          userId,
          locale: locale as string,
          taskId,
          requestId,
          traceId,
        })
      }

      // Phase-based error handling to prevent duplicate writeResults calls
      type StreamPhase = 'LLM_EXECUTE' | 'WRITE_RESULTS' | 'CLEANUP'
      let phase: StreamPhase = 'LLM_EXECUTE'
      let execResult: Awaited<ReturnType<typeof executeStreaming>> | null = null

      try {
        // Phase 1: LLM Execution
        phase = 'LLM_EXECUTE'
        await markTimeline(serviceId, 'worker_stream_llm_start', { taskId })
        execResult = await executeStreaming(
          decision.modelId,
          templateId,
          locale,
          preparedVars,
          { userId, serviceId },
          (text) => onToken(channel, taskId, text, requestId, traceId)
        )
        await markTimeline(serviceId, 'worker_stream_done', {
          taskId,
          latencyMs: execResult.latencyMs,
        })

        // Debug: Log phase transition and raw content
        console.log(`[Stream] Phase: LLM_EXECUTE complete, raw length: ${execResult.result.raw?.length ?? 0}`)

        // Phase 2: Write Results
        phase = 'WRITE_RESULTS'
        await markTimeline(serviceId, 'worker_stream_finalize_start', { taskId })
        console.log(`[Stream] Phase: WRITE_RESULTS starting`)
        await strategy.writeResults(execResult.result, preparedVars, {
          serviceId,
          userId,
          locale: locale as string,
          requestId,
          traceId,
          taskId,
        })
        console.log(`[Stream] Phase: WRITE_RESULTS complete`)

        // Phase 3: Cleanup (non-critical)
        phase = 'CLEANUP'
        console.log(`[Stream] Phase: CLEANUP starting`)
        await emitStreamIdle(
          channel,
          taskId,
          decision.modelId,
          requestId,
          traceId
        )
        await cleanupFinal(
          decision.modelId,
          String(decision.queueId),
          userId,
          'stream',
          counterKey,
          serviceId,
          taskId
        )
        await markTimeline(serviceId, 'worker_stream_finalize_end', { taskId })
        console.log(`[Stream] Phase: CLEANUP complete`)

        return Response.json({ ok: execResult.result.ok })
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error)
        console.log(`[Stream] Error in phase: ${phase}, error: ${errMsg}`)

        // Handle based on which phase failed
        switch (phase) {
          case 'LLM_EXECUTE':
            // LLM failed, writeResults not yet called → call it with error
            logError({
              reqId: requestId,
              route: 'worker/stream',
              error: errMsg,
              phase: 'llm_execute_failed',
              serviceId,
            })
            await publishEvent(channel, {
              type: 'error',
              taskId,
              code: 'llm_error',
              error: errMsg,
              stage: 'invoke_or_stream',
              requestId,
              traceId,
            })
            await strategy.writeResults(
              { ok: false, error: errMsg },
              preparedVars,
              { serviceId, userId, locale: locale as string, requestId, traceId, taskId }
            )
            break

          case 'WRITE_RESULTS':
            // writeResults failed → just log, don't re-call (data already attempted)
            logError({
              reqId: requestId,
              route: 'worker/stream',
              error: errMsg,
              phase: 'writeResults_failed',
              serviceId,
              rawLength: execResult?.result?.raw?.length ?? 0,
            })
            await publishEvent(channel, {
              type: 'error',
              taskId,
              code: 'finalize_error',
              error: errMsg,
              stage: 'finalize',
              requestId,
              traceId,
            })
            break

          case 'CLEANUP':
            // Cleanup failed → non-critical, data already persisted
            logError({
              reqId: requestId,
              route: 'worker/stream',
              error: errMsg,
              phase: 'cleanup_failed',
              serviceId,
            })
            // Still return success since data was persisted
            return Response.json({ ok: true, warning: 'cleanup_failed' })
        }

        return Response.json({ ok: false, error: errMsg }, { status: 500 })
      }
    }
  )
}

export async function handleBatch(
  req: Request,
  _params: { service: string }
): Promise<Response> {
  return withRequestSampling(
    '/api/worker/batch/[service]',
    'POST',
    async () => {
      const parsed = await parseWorkerBody(req)
      if (!parsed.ok) return parsed.response
      const body: Body = parsed.body

      const { taskId, userId, serviceId, locale, templateId, variables } = body

      const strategy = getStrategy(templateId)
      if (!strategy) {
        return new Response(`Unknown templateId: ${templateId}`, {
          status: 400,
        })
      }

      const { requestId, traceId } = getRequestMeta(req, taskId)

      // 1. Prepare Vars
      const preparedVars = await strategy.prepareVars(variables, {
        serviceId,
        userId,
        locale: locale as string,
        taskId,
        requestId,
        traceId,
      })

      const billing = extractBillingVars(variables as Record<string, unknown>)
      const { tierOverride, wasPaid } = billing
      const userHasQuota =
        tierOverride === 'paid'
          ? true
          : tierOverride === 'free'
            ? false
            : wasPaid
              ? true
              : await getUserHasQuota(userId)
      const decision = computeDecision(templateId, preparedVars, userHasQuota)

      const ttlSec = getTtlSec()
      const counterKey = buildQueueCounterKey(String(decision.queueId))
      const channel = getChannel(userId, serviceId, taskId)

      // 2. Guards & Start
      await publishStart(
        channel,
        taskId,
        decision.modelId,
        String(decision.queueId),
        'guards',
        requestId,
        traceId,
        'batch'
      )
      await markTimeline(serviceId, 'worker_batch_start', {
        taskId,
        modelId: decision.modelId,
      })

      // Check Guards
      const gUser = await guardUser(
        userId,
        'batch',
        ttlSec,
        channel,
        requestId,
        traceId
      )
      if (!gUser.ok)
        return handleGuardFailure({
          reason: gUser.reason,
          userId,
          serviceId,
          taskId,
          templateId,
          channel,
          requestId,
          traceId,
          billing,
          kind: 'batch',
        })

      const gModel = await guardModel(
        decision.modelId,
        String(decision.queueId),
        ttlSec,
        channel,
        requestId,
        traceId
      )
      if (!gModel.ok)
        return handleGuardFailure({
          reason: gModel.reason,
          userId,
          serviceId,
          taskId,
          templateId,
          channel,
          requestId,
          traceId,
          billing,
          kind: 'batch',
        })

      const gQueue = await guardQueue(
        userId,
        'batch',
        counterKey,
        ttlSec,
        ENV.QUEUE_MAX_SIZE,
        channel,
        requestId,
        traceId
      )
      if (!gQueue.ok)
        return handleGuardFailure({
          reason: gQueue.reason,
          userId,
          serviceId,
          taskId,
          templateId,
          channel,
          requestId,
          traceId,
          billing,
          kind: 'batch',
        })

      await markTimeline(serviceId, 'worker_batch_guards_done', { taskId })

      // 3. Strategy onStart
      if (strategy.onStart) {
        await strategy.onStart(preparedVars, {
          serviceId,
          userId,
          locale: locale as string,
          taskId,
          requestId,
          traceId,
        })
      }

      // Phase-based error handling (same pattern as handleStream)
      type BatchPhase = 'LLM_EXECUTE' | 'WRITE_RESULTS' | 'CLEANUP'
      let phase: BatchPhase = 'LLM_EXECUTE'

      try {
        // Phase 1: Execute
        phase = 'LLM_EXECUTE'
        await markTimeline(serviceId, 'worker_batch_llm_start', { taskId })

        // Phase 1.5: Skip LLM if Baidu OCR was already used (Paid tier OCR bypass)
        const baiduOcrUsed = !!(preparedVars as any)['_baidu_ocr_used']
        const baiduOcrText = String((preparedVars as any)['_baidu_ocr_text'] || '')

        let execResult: { result: import('./strategies/interface').ExecutionResult; latencyMs: number }

        if (baiduOcrUsed && baiduOcrText && templateId === 'ocr_extract') {
          // Skip LLM - use Baidu OCR result directly
          await markTimeline(serviceId, 'worker_batch_llm_skipped_baidu_ocr', { taskId })
          execResult = {
            result: {
              ok: true,
              data: { extracted_text: baiduOcrText },
              raw: baiduOcrText,
            },
            latencyMs: 0,
          }
        } else {
          // Normal LLM execution
          const options: any = {}
          if (templateId === 'resume_customize') {
            options.temperature = 0.1
          }
          execResult = await executeStructured(
            decision.modelId,
            templateId,
            locale,
            preparedVars,
            { userId, serviceId },
            options
          )
        }

        await markTimeline(serviceId, 'worker_batch_done', {
          taskId,
          latencyMs: execResult.latencyMs,
        })

        console.log(`[Batch] Phase: LLM_EXECUTE complete`)

        // Phase 2: Write Results
        phase = 'WRITE_RESULTS'
        await markTimeline(serviceId, 'worker_batch_finalize_start', { taskId })
        console.log(`[Batch] Phase: WRITE_RESULTS starting`)
        // Capture deferred tasks for enqueue after cleanup
        const deferredTasks = await strategy.writeResults(execResult.result, preparedVars, {
          serviceId,
          userId,
          locale: locale as string,
          requestId,
          traceId,
          taskId,
        })
        console.log(`[Batch] Phase: WRITE_RESULTS complete`)

        // Phase 3: Cleanup (releases lock)
        phase = 'CLEANUP'
        console.log(`[Batch] Phase: CLEANUP starting`)
        await cleanupFinal(
          decision.modelId,
          String(decision.queueId),
          userId,
          'batch',
          counterKey,
          serviceId,
          taskId
        )
        await markTimeline(serviceId, 'worker_batch_finalize_end', { taskId })
        console.log(`[Batch] Phase: CLEANUP complete`)

        // Phase 4: Enqueue deferred tasks (AFTER cleanup to avoid lock contention)
        if (deferredTasks && deferredTasks.length > 0) {
          console.log(`[Batch] Phase: DEFERRED_ENQUEUE starting, count=${deferredTasks.length}`)
          for (const task of deferredTasks) {
            try {
              const pushRes = await pushTask(task as any)
              if (pushRes.error) {
                logError({
                  reqId: requestId,
                  route: 'worker/batch',
                  error: pushRes.error,
                  phase: 'deferred_enqueue_failed',
                  serviceId,
                  meta: { deferredTemplateId: task.templateId },
                })
              }
            } catch (e) {
              logError({
                reqId: requestId,
                route: 'worker/batch',
                error: String(e),
                phase: 'deferred_enqueue_error',
                serviceId,
                meta: { deferredTemplateId: task.templateId },
              })
            }
          }
          console.log(`[Batch] Phase: DEFERRED_ENQUEUE complete`)
        }

        return Response.json({ ok: execResult.result.ok })
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error)
        console.log(`[Batch] Error in phase: ${phase}, error: ${errMsg}`)

        switch (phase) {
          case 'LLM_EXECUTE':
            // LLM failed, call writeResults with error
            logError({
              reqId: requestId,
              route: 'worker/batch',
              error: errMsg,
              phase: 'llm_execute_failed',
              serviceId,
              templateId,
            })
            await strategy.writeResults(
              { ok: false, error: errMsg },
              preparedVars,
              { serviceId, userId, locale: locale as string, requestId, traceId, taskId }
            )
            break

          case 'WRITE_RESULTS':
            // writeResults failed → just log
            logError({
              reqId: requestId,
              route: 'worker/batch',
              error: errMsg,
              phase: 'writeResults_failed',
              serviceId,
              templateId,
            })
            break

          case 'CLEANUP':
            // Cleanup failed → non-critical
            logError({
              reqId: requestId,
              route: 'worker/batch',
              error: errMsg,
              phase: 'cleanup_failed',
              serviceId,
            })
            return Response.json({ ok: true, warning: 'cleanup_failed' })
        }

        return new Response('internal_error', { status: 500 })
      }
    }
  )
}
