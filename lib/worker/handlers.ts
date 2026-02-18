import {
  parseWorkerBody,
  getUserHasQuota,
  getTtlSec,
  getChannel,
  publishEvent,
  exitModelConcurrency,
  exitUserConcurrency,
} from '@/lib/worker/common'
import { buildQueueCounterKey, queueMaxSizeFor } from '@/lib/config/concurrency'
import { isServiceScoped } from '@/lib/llm/task-router'
import { getTaskConfig } from '@/lib/llm/config'
import { ENV } from '@/lib/env'
import { withRequestSampling } from '@/lib/dev/redisSampler'
import { logEvent } from '@/lib/observability/logger'
import { trackEvent, AnalyticsCategory } from '@/lib/analytics/index'
import { publishStart, emitStreamIdle } from '@/lib/worker/pipeline'
import { guardUser, guardModel, guardQueue } from '@/lib/worker/steps/guards'
import { executeStreaming, executeStructured } from '@/lib/worker/steps/execute'
import { computeDecision } from '@/lib/worker/steps/decision'
import { getRequestMeta } from '@/lib/worker/steps/meta'
import { cleanupFinal } from '@/lib/worker/steps/cleanup'
import { getStrategy } from '@/lib/worker/strategies'
import { markTimeline } from '@/lib/observability/timeline'
import { logDebug, logError } from '@/lib/logger'
import { getProvider } from '@/lib/llm/utils'
import {
  recordRefund,
  markDebitFailed,
  markDebitSuccess,
} from '@/lib/dal/coinLedger'
import { setInterviewTipsJson, setMatchSummaryJson } from '@/lib/dal/services'
import { pushTask } from '@/lib/queue/producer'
import type { DeferredTask } from '@/lib/worker/strategies/interface'
import { AsyncTaskStatus } from '@prisma/client'

type Body = import('@/lib/worker/types').WorkerBody

// Helper to safely extract common billing fields from any variables union
type PaidTier = 'paid' | 'free' | undefined
interface BillingVars {
  tierOverride?: PaidTier
  wasPaid?: boolean
  cost?: number
  debitId?: string
}
function extractBillingVars(vars: Record<string, unknown>): BillingVars {
  return {
    tierOverride: vars['tierOverride'] as PaidTier,
    wasPaid: Boolean(vars['wasPaid']),
    cost: Number(vars['cost'] || 0),
    debitId: String(vars['debitId'] || ''),
  }
}

function isTimeoutError(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('timeout') ||
    normalized.includes('timed out') ||
    normalized.includes('deadline') ||
    normalized.includes('abort')
  )
}

type RetryMeta = {
  retryCount?: number
  maxRetries?: number
  shouldRefund: boolean
}

function getHeaderNumber(req: Request, names: string[]): number | undefined {
  for (const name of names) {
    const value = req.headers.get(name)
    if (!value) continue
    const num = Number(value)
    if (Number.isFinite(num)) return num
  }
  return undefined
}

function getRetryMeta(req: Request, body: Body): RetryMeta {
  const retryCount =
    getHeaderNumber(req, [
      'Upstash-Retry-Count',
      'upstash-retry-count',
      'X-Upstash-Retry-Count',
      'x-upstash-retry-count',
    ]) ?? body.retryCount
  const maxRetries =
    getHeaderNumber(req, [
      'Upstash-Retries',
      'upstash-retries',
      'X-Upstash-Retries',
      'x-upstash-retries',
    ]) ?? body.qstashRetries
  const finalRetryCount = retryCount ?? 0
  const shouldRefund =
    maxRetries !== undefined ? finalRetryCount >= maxRetries : true
  const meta: RetryMeta = { shouldRefund }
  if (retryCount !== undefined) meta.retryCount = retryCount
  if (maxRetries !== undefined) meta.maxRetries = maxRetries
  return meta
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
  retryAfter?: number
  pending?: number
  maxSize?: number
  retryCount?: number
  maxRetries?: number
  shouldRefund?: boolean
}): Promise<Response> {
  const {
    reason,
    userId,
    serviceId,
    taskId,
    templateId,
    channel,
    requestId,
    traceId,
    billing,
    kind,
    retryAfter,
    pending,
    maxSize,
    retryCount,
    maxRetries,
    shouldRefund,
  } = params
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
  if (shouldRefund !== false && wasPaid && cost > 0 && debitId) {
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
    meta: {
      taskId,
      templateId,
      wasPaid,
      cost,
      ...(retryAfter !== undefined ? { retryAfter } : {}),
      ...(pending !== undefined ? { pending } : {}),
      ...(maxSize !== undefined ? { maxSize } : {}),
      ...(retryCount !== undefined ? { retryCount } : {}),
      ...(maxRetries !== undefined ? { maxRetries } : {}),
    },
  })

  // 4. Return 429 response
  return Response.json(
    {
      ok: false,
      reason,
      ...(retryAfter !== undefined ? { retryAfter } : {}),
      ...(pending !== undefined ? { pending } : {}),
      ...(maxSize !== undefined ? { maxSize } : {}),
      ...(retryCount !== undefined ? { retryCount } : {}),
      ...(maxRetries !== undefined ? { maxRetries } : {}),
    },
    {
      status: 429,
      headers: {
        ...(retryAfter !== undefined
          ? { 'Retry-After': String(retryAfter) }
          : {}),
        'X-Guard-Reason': reason,
      },
    },
  )
}

// Token handler for SSE
export async function onToken(
  channel: string,
  taskId: string,
  text: string,
  requestId: string,
  traceId: string,
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

function safeParseJson(raw?: string) {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export async function streamWriteResults(
  templateId: string,
  serviceId: string,
  exec: { result?: { raw?: string } },
  _variables: Record<string, unknown>,
  _userId: string,
  _requestId: string,
) {
  const raw = exec.result?.raw
  const parsed = safeParseJson(raw)

  if (templateId === 'job_match') {
    if (parsed) {
      await setMatchSummaryJson(serviceId, parsed, AsyncTaskStatus.COMPLETED)
      return
    }
    await setMatchSummaryJson(
      serviceId,
      { markdown: raw || '' },
      AsyncTaskStatus.FAILED,
    )
    return
  }

  if (templateId === 'interview_prep') {
    if (parsed) {
      await setInterviewTipsJson(serviceId, parsed, AsyncTaskStatus.COMPLETED)
      return
    }
    await setInterviewTipsJson(
      serviceId,
      { markdown: raw || '' },
      AsyncTaskStatus.COMPLETED,
    )
  }
}

export async function streamHandleTransactions(
  templateId: string,
  exec: { result?: { raw?: string; usageLogId?: string } },
  variables: Record<string, unknown>,
  serviceId: string,
  userId: string,
  _requestId: string,
) {
  const wasPaid = Boolean(variables['wasPaid'])
  const cost = Number(variables['cost'] || 0)
  const debitId = String(variables['debitId'] || '')
  if (!wasPaid || cost <= 0 || !debitId) return

  const raw = exec.result?.raw
  const parsed = safeParseJson(raw)
  if (templateId === 'job_match' && !parsed) {
    await recordRefund({
      userId,
      amount: cost,
      relatedId: debitId,
      serviceId,
      templateId,
    })
    return
  }

  await markDebitSuccess(debitId, exec.result?.usageLogId)
}

export async function handleStream(
  req: Request,
  _params: { service: string },
): Promise<Response> {
  return withRequestSampling(
    '/api/worker/stream/[service]',
    'POST',
    async () => {
      const parsed = await parseWorkerBody(req)
      if (!parsed.ok) return parsed.response
      const body: Body = parsed.body

      const {
        taskId,
        userId,
        serviceId,
        locale,
        templateId,
        variables,
        enqueuedAt,
      } = body
      const retryMeta = getRetryMeta(req, body)
      const startTime = Date.now()
      const queueWaitTime = enqueuedAt ? startTime - enqueuedAt : 0
      trackEvent('WORKER_JOB_STARTED', {
        userId,
        serviceId,
        taskId,
        traceId: taskId,
        category: AnalyticsCategory.SYSTEM,
        payload: {
          templateId,
          queueWaitTime,
          enqueuedAt,
          startedAt: startTime,
        },
      })

      const strategy = getStrategy(templateId)
      if (!strategy) {
        return new Response(`Unknown templateId: ${templateId}`, {
          status: 400,
        })
      }

      const { requestId, traceId } = getRequestMeta(req, taskId)
      const ctxBase = {
        serviceId,
        userId,
        locale: locale as string,
        taskId,
        requestId,
        traceId,
        shouldRefund: retryMeta.shouldRefund,
      }

      // 1. Prepare Vars
      const preparedVars = await strategy.prepareVars(variables, ctxBase)

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
      const maxSize = queueMaxSizeFor(String(decision.queueId))
      const channel = getChannel(userId, serviceId, taskId)
      let userGuarded = false
      let modelGuarded = false
      const releaseGuardsOnFailure = async () => {
        const tasks: Promise<unknown>[] = []
        if (modelGuarded) {
          tasks.push(
            exitModelConcurrency(decision.modelId, String(decision.queueId)),
          )
        }
        if (userGuarded) {
          tasks.push(exitUserConcurrency(userId, 'stream'))
        }
        if (tasks.length > 0) await Promise.allSettled(tasks)
      }

      // 2. Guards & Start
      await publishStart(
        channel,
        taskId,
        decision.modelId,
        String(decision.queueId),
        'guards',
        requestId,
        traceId,
        'stream',
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
        traceId,
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
          ...(gUser.retryAfter !== undefined
            ? { retryAfter: gUser.retryAfter }
            : {}),
          ...(retryMeta.retryCount !== undefined
            ? { retryCount: retryMeta.retryCount }
            : {}),
          ...(retryMeta.maxRetries !== undefined
            ? { maxRetries: retryMeta.maxRetries }
            : {}),
          shouldRefund: retryMeta.shouldRefund,
        })
      userGuarded = true

      const gModel = await guardModel(
        decision.modelId,
        String(decision.queueId),
        ttlSec,
        channel,
        requestId,
        traceId,
      )
      if (!gModel.ok) {
        await releaseGuardsOnFailure()
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
          ...(gModel.retryAfter !== undefined
            ? { retryAfter: gModel.retryAfter }
            : {}),
          ...(retryMeta.retryCount !== undefined
            ? { retryCount: retryMeta.retryCount }
            : {}),
          ...(retryMeta.maxRetries !== undefined
            ? { maxRetries: retryMeta.maxRetries }
            : {}),
          shouldRefund: retryMeta.shouldRefund,
        })
      }
      modelGuarded = true

      const gQueue = await guardQueue(
        userId,
        'stream',
        counterKey,
        ttlSec,
        maxSize,
        channel,
        requestId,
        traceId,
        false,
      )
      if (!gQueue.ok) {
        if (gQueue.reason === 'backpressure') {
          logEvent(
            'TASK_BACKPRESSURED',
            {
              userId,
              serviceId,
              taskId,
            },
            {
              templateId,
              kind: 'stream',
              queueId: String(decision.queueId || ''),
              maxSize,
              ...(gQueue.pending !== undefined
                ? { pending: gQueue.pending }
                : {}),
              ...(gQueue.retryAfter !== undefined
                ? { retryAfter: gQueue.retryAfter }
                : {}),
            },
          )
        }
        await releaseGuardsOnFailure()
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
          ...(gQueue.retryAfter !== undefined
            ? { retryAfter: gQueue.retryAfter }
            : {}),
          ...(gQueue.pending !== undefined ? { pending: gQueue.pending } : {}),
          ...(gQueue.maxSize !== undefined ? { maxSize: gQueue.maxSize } : {}),
          ...(retryMeta.retryCount !== undefined
            ? { retryCount: retryMeta.retryCount }
            : {}),
          ...(retryMeta.maxRetries !== undefined
            ? { maxRetries: retryMeta.maxRetries }
            : {}),
          shouldRefund: retryMeta.shouldRefund,
        })
      }

      await markTimeline(serviceId, 'worker_stream_guards_done', { taskId })

      // Phase 4 Fix: Publish status event to trigger frontend progress simulation
      // Map templateId to the appropriate STREAMING status (worker is now active)
      // Free tier has two flows based on input type:
      // - Text JD: job_summary → SUMMARY_* → MATCH_*
      // - Image JD: job_vision_summary → JOB_VISION_* → MATCH_*
      const statusForTemplate: Record<string, string> = {
        job_summary: 'SUMMARY_STREAMING', // Free tier text JD
        job_vision_summary: 'JOB_VISION_STREAMING', // Free tier image JD
        pre_match_audit: 'PREMATCH_STREAMING',
        job_match: 'MATCH_STREAMING',
      }
      const streamingStatus = statusForTemplate[templateId] || 'PROCESSING'
      await publishEvent(channel, {
        type: 'status',
        taskId,
        status: streamingStatus,
        code: `${templateId}_started`, // Add code for frontend mapping
        lastUpdatedAt: new Date().toISOString(),
        stage: 'llm_start',
        requestId,
        traceId,
      })

      // 3. Strategy onStart
      if (strategy.onStart) {
        await strategy.onStart(preparedVars, ctxBase)
      }

      // Phase-based error handling to prevent duplicate writeResults calls
      type StreamPhase = 'LLM_EXECUTE' | 'WRITE_RESULTS' | 'CLEANUP'
      let phase: StreamPhase = 'LLM_EXECUTE'
      let execResult: Awaited<ReturnType<typeof executeStreaming>> | null = null

      try {
        // Phase 1: LLM Execution
        phase = 'LLM_EXECUTE'
        await markTimeline(serviceId, 'worker_stream_llm_start', { taskId })

        // Use centralized config for temperature
        const config = getTaskConfig(templateId)
        const options: any = {
          temperature: config.temperature,
          maxTokens: config.maxTokens,
          timeoutMs: config.timeoutMs ?? ENV.WORKER_TIMEOUT_MS,
          tier: userHasQuota ? 'paid' : 'free',
        }

        execResult = await executeStreaming(
          decision.modelId,
          templateId,
          locale,
          preparedVars,
          { userId, serviceId },
          options,
          (text) => onToken(channel, taskId, text, requestId, traceId),
        )
        await markTimeline(serviceId, 'worker_stream_done', {
          taskId,
          latencyMs: execResult.latencyMs,
        })

        // Debug: Log phase transition and raw content
        logDebug({
          reqId: requestId,
          route: 'worker/stream',
          phase: 'llm_execute_complete',
          serviceId,
          taskId,
          rawLength: execResult.result.raw?.length ?? 0,
        })

        // Phase 2: Write Results
        phase = 'WRITE_RESULTS'
        await markTimeline(serviceId, 'worker_stream_finalize_start', {
          taskId,
        })
        logDebug({
          reqId: requestId,
          route: 'worker/stream',
          phase: 'write_results_start',
          serviceId,
          taskId,
        })
        await strategy.writeResults(execResult.result, preparedVars, ctxBase)
        logDebug({
          reqId: requestId,
          route: 'worker/stream',
          phase: 'write_results_complete',
          serviceId,
          taskId,
        })

        // Phase 3: Cleanup (non-critical)
        phase = 'CLEANUP'
        logDebug({
          reqId: requestId,
          route: 'worker/stream',
          phase: 'cleanup_start',
          serviceId,
          taskId,
        })

        // Emit _COMPLETED status for this task before going idle
        // IMPORTANT: Only emit completion if execution was successful!
        // If writeResults set execResult.result.ok = false (e.g. parse failure),
        // the strategy already emitted a _FAILED status - don't overwrite it.
        // Free tier has two flows based on input type:
        // - Text JD: job_summary → SUMMARY_COMPLETED
        // - Image JD: job_vision_summary → JOB_VISION_COMPLETED
        const completedStatusMap: Record<string, string> = {
          job_summary: 'SUMMARY_COMPLETED', // Free tier text JD
          job_vision_summary: 'JOB_VISION_COMPLETED', // Free tier image JD
          pre_match_audit: 'PREMATCH_COMPLETED',
          job_match: 'MATCH_COMPLETED',
        }
        const completedStatus = completedStatusMap[templateId]
        const wasSuccessful = execResult?.result?.ok !== false
        logDebug({
          reqId: requestId,
          route: 'worker/stream',
          phase: 'cleanup_status',
          serviceId,
          taskId,
          templateId,
          wasSuccessful,
          completedStatus: completedStatus || 'NONE',
        })
        if (completedStatus && wasSuccessful) {
          await publishEvent(channel, {
            type: 'status',
            taskId,
            status: completedStatus,
            code: `${templateId}_completed`,
            lastUpdatedAt: new Date().toISOString(),
            stage: 'completed',
            requestId,
            traceId,
          })
        } else if (!wasSuccessful) {
          logDebug({
            reqId: requestId,
            route: 'worker/stream',
            phase: 'cleanup_skip_completion',
            serviceId,
            taskId,
            templateId,
          })
        }

        await emitStreamIdle(
          channel,
          taskId,
          decision.modelId,
          requestId,
          traceId,
        )
        await cleanupFinal(
          decision.modelId,
          String(decision.queueId),
          userId,
          'stream',
          counterKey,
          serviceId,
          taskId,
        )
        await markTimeline(serviceId, 'worker_stream_finalize_end', { taskId })
        logDebug({
          reqId: requestId,
          route: 'worker/stream',
          phase: 'cleanup_complete',
          serviceId,
          taskId,
        })

        const execDuration = Date.now() - startTime
        trackEvent('WORKER_JOB_COMPLETED', {
          userId,
          serviceId,
          taskId,
          traceId: taskId,
          category: AnalyticsCategory.SYSTEM,
          duration: execDuration,
          payload: { templateId, success: execResult.result.ok },
        })

        return Response.json({ ok: execResult.result.ok })
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error)
        logDebug({
          reqId: requestId,
          route: 'worker/stream',
          phase: 'stream_error',
          serviceId,
          taskId,
          error: errMsg,
        })

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
            const streamTimeout = isTimeoutError(errMsg)
            const streamErrorCode = streamTimeout
              ? 'retry_available'
              : 'llm_error'
            const streamUserError = streamTimeout ? 'retry_available' : errMsg
            await publishEvent(channel, {
              type: 'error',
              taskId,
              code: streamErrorCode,
              error: streamUserError,
              stage: 'invoke_or_stream',
              requestId,
              traceId,
            })
            await strategy.writeResults(
              { ok: false, error: streamUserError },
              preparedVars,
              {
                serviceId,
                userId,
                locale: locale as string,
                requestId,
                traceId,
                taskId,
              },
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

        try {
          await cleanupFinal(
            decision.modelId,
            String(decision.queueId),
            userId,
            'stream',
            counterKey,
            serviceId,
            taskId,
          )
        } catch (cleanupError) {
          logError({
            reqId: requestId,
            route: 'worker/stream',
            error: String(cleanupError),
            phase: 'cleanup_failed',
            serviceId,
          })
        }

        const execDuration = Date.now() - startTime
        trackEvent('WORKER_JOB_COMPLETED', {
          userId,
          serviceId,
          taskId,
          traceId: taskId,
          category: AnalyticsCategory.SYSTEM,
          duration: execDuration,
          payload: { templateId, success: false, error: errMsg },
        })

        return Response.json({ ok: false, error: errMsg }, { status: 500 })
      }
    },
  )
}

export async function handleBatch(
  req: Request,
  _params: { service: string },
): Promise<Response> {
  return withRequestSampling(
    '/api/worker/batch/[service]',
    'POST',
    async () => {
      const parsed = await parseWorkerBody(req)
      if (!parsed.ok) return parsed.response
      const body: Body = parsed.body

      const {
        taskId,
        userId,
        serviceId,
        locale,
        templateId,
        variables,
        enqueuedAt,
      } = body
      const retryMeta = getRetryMeta(req, body)
      const startTime = Date.now()
      const queueWaitTime = enqueuedAt ? startTime - enqueuedAt : 0
      trackEvent('WORKER_JOB_STARTED', {
        userId,
        serviceId,
        taskId,
        traceId: taskId,
        category: AnalyticsCategory.SYSTEM,
        payload: {
          templateId,
          queueWaitTime,
          enqueuedAt,
          startedAt: startTime,
        },
      })

      const strategy = getStrategy(templateId)
      if (!strategy) {
        return new Response(`Unknown templateId: ${templateId}`, {
          status: 400,
        })
      }

      const { requestId, traceId } = getRequestMeta(req, taskId)
      const ctxBase = {
        serviceId,
        userId,
        locale: locale as string,
        taskId,
        requestId,
        traceId,
        shouldRefund: retryMeta.shouldRefund,
      }

      // 1. Prepare Vars
      const preparedVars = await strategy.prepareVars(variables, ctxBase)

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
      const maxSize = queueMaxSizeFor(String(decision.queueId))
      const channel = getChannel(userId, serviceId, taskId)
      let userGuarded = false
      let modelGuarded = false
      const releaseGuardsOnFailure = async () => {
        const tasks: Promise<unknown>[] = []
        if (modelGuarded) {
          tasks.push(
            exitModelConcurrency(decision.modelId, String(decision.queueId)),
          )
        }
        if (userGuarded) {
          tasks.push(exitUserConcurrency(userId, 'batch'))
        }
        if (tasks.length > 0) await Promise.allSettled(tasks)
      }

      // 2. Guards & Start
      await publishStart(
        channel,
        taskId,
        decision.modelId,
        String(decision.queueId),
        'guards',
        requestId,
        traceId,
        'batch',
      )
      const baiduOcrUsed =
        templateId === 'ocr_extract' &&
        !!(preparedVars as any)['_baidu_ocr_used']
      await markTimeline(serviceId, 'worker_batch_start', {
        taskId,
        modelId: baiduOcrUsed ? 'baidu_ocr' : decision.modelId,
        ...(baiduOcrUsed ? { ocrProvider: 'baidu' } : {}),
      })

      // Check Guards
      const gUser = await guardUser(
        userId,
        'batch',
        ttlSec,
        channel,
        requestId,
        traceId,
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
          ...(gUser.retryAfter !== undefined
            ? { retryAfter: gUser.retryAfter }
            : {}),
          ...(retryMeta.retryCount !== undefined
            ? { retryCount: retryMeta.retryCount }
            : {}),
          ...(retryMeta.maxRetries !== undefined
            ? { maxRetries: retryMeta.maxRetries }
            : {}),
          shouldRefund: retryMeta.shouldRefund,
        })
      userGuarded = true

      const gModel = await guardModel(
        decision.modelId,
        String(decision.queueId),
        ttlSec,
        channel,
        requestId,
        traceId,
      )
      if (!gModel.ok) {
        await releaseGuardsOnFailure()
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
          ...(gModel.retryAfter !== undefined
            ? { retryAfter: gModel.retryAfter }
            : {}),
          ...(retryMeta.retryCount !== undefined
            ? { retryCount: retryMeta.retryCount }
            : {}),
          ...(retryMeta.maxRetries !== undefined
            ? { maxRetries: retryMeta.maxRetries }
            : {}),
          shouldRefund: retryMeta.shouldRefund,
        })
      }
      modelGuarded = true

      const gQueue = await guardQueue(
        userId,
        'batch',
        counterKey,
        ttlSec,
        maxSize,
        channel,
        requestId,
        traceId,
        false,
      )
      if (!gQueue.ok) {
        if (gQueue.reason === 'backpressure') {
          logEvent(
            'TASK_BACKPRESSURED',
            {
              userId,
              serviceId,
              taskId,
            },
            {
              templateId,
              kind: 'batch',
              queueId: String(decision.queueId || ''),
              maxSize,
              ...(gQueue.pending !== undefined
                ? { pending: gQueue.pending }
                : {}),
              ...(gQueue.retryAfter !== undefined
                ? { retryAfter: gQueue.retryAfter }
                : {}),
            },
          )
        }
        await releaseGuardsOnFailure()
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
          ...(gQueue.retryAfter !== undefined
            ? { retryAfter: gQueue.retryAfter }
            : {}),
          ...(gQueue.pending !== undefined ? { pending: gQueue.pending } : {}),
          ...(gQueue.maxSize !== undefined ? { maxSize: gQueue.maxSize } : {}),
          ...(retryMeta.retryCount !== undefined
            ? { retryCount: retryMeta.retryCount }
            : {}),
          ...(retryMeta.maxRetries !== undefined
            ? { maxRetries: retryMeta.maxRetries }
            : {}),
          shouldRefund: retryMeta.shouldRefund,
        })
      }

      await markTimeline(serviceId, 'worker_batch_guards_done', { taskId })

      // 3. Strategy onStart
      if (strategy.onStart) {
        await strategy.onStart(preparedVars, ctxBase)
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
        const baiduOcrText = String(
          (preparedVars as any)['_baidu_ocr_text'] || '',
        )

        let execResult: {
          result: import('./strategies/interface').ExecutionResult
          latencyMs: number
        }

        if (baiduOcrUsed && baiduOcrText && templateId === 'ocr_extract') {
          // Skip LLM - use Baidu OCR result directly
          await markTimeline(serviceId, 'worker_batch_llm_skipped_baidu_ocr', {
            taskId,
          })
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
          const config = getTaskConfig(templateId)
          const options: any = {
            temperature: config.temperature,
            maxTokens: config.maxTokens,
            timeoutMs: config.timeoutMs ?? ENV.WORKER_TIMEOUT_MS,
            tier: userHasQuota ? 'paid' : 'free',
          }

          execResult = await executeStructured(
            decision.modelId,
            templateId,
            locale,
            preparedVars,
            { userId, serviceId },
            options,
          )
        }

        await markTimeline(serviceId, 'worker_batch_done', {
          taskId,
          latencyMs: execResult.latencyMs,
        })

        logDebug({
          reqId: requestId,
          route: 'worker/batch',
          phase: 'llm_execute_complete',
          serviceId,
          taskId,
        })

        // Phase 2: Write Results
        phase = 'WRITE_RESULTS'
        await markTimeline(serviceId, 'worker_batch_finalize_start', { taskId })
        logDebug({
          reqId: requestId,
          route: 'worker/batch',
          phase: 'write_results_start',
          serviceId,
          taskId,
        })
        // Capture deferred tasks for enqueue after cleanup
        const deferredTasks = await strategy.writeResults(
          execResult.result,
          preparedVars,
          ctxBase,
        )
        logDebug({
          reqId: requestId,
          route: 'worker/batch',
          phase: 'write_results_complete',
          serviceId,
          taskId,
        })

        // Phase 3: Cleanup (releases lock)
        phase = 'CLEANUP'
        logDebug({
          reqId: requestId,
          route: 'worker/batch',
          phase: 'cleanup_start',
          serviceId,
          taskId,
        })
        await cleanupFinal(
          decision.modelId,
          String(decision.queueId),
          userId,
          'batch',
          counterKey,
          serviceId,
          taskId,
        )
        await markTimeline(serviceId, 'worker_batch_finalize_end', { taskId })
        logDebug({
          reqId: requestId,
          route: 'worker/batch',
          phase: 'cleanup_complete',
          serviceId,
          taskId,
        })

        // Phase 4: Enqueue deferred tasks (AFTER cleanup to avoid lock contention)
        if (deferredTasks && deferredTasks.length > 0) {
          logDebug({
            reqId: requestId,
            route: 'worker/batch',
            phase: 'deferred_enqueue_start',
            serviceId,
            taskId,
            count: deferredTasks.length,
          })
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
          logDebug({
            reqId: requestId,
            route: 'worker/batch',
            phase: 'deferred_enqueue_complete',
            serviceId,
            taskId,
          })
        }

        const execDuration = Date.now() - startTime
        trackEvent('WORKER_JOB_COMPLETED', {
          userId,
          serviceId,
          taskId,
          traceId: taskId,
          category: AnalyticsCategory.SYSTEM,
          duration: execDuration,
          payload: { templateId, success: execResult.result.ok },
        })

        return Response.json({ ok: execResult.result.ok })
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error)
        logDebug({
          reqId: requestId,
          route: 'worker/batch',
          phase: 'batch_error',
          serviceId,
          taskId,
          error: errMsg,
        })

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
            const batchTimeout = isTimeoutError(errMsg)
            const batchErrorCode = batchTimeout
              ? 'retry_available'
              : 'llm_error'
            const batchUserError = batchTimeout ? 'retry_available' : errMsg
            await publishEvent(channel, {
              type: 'error',
              taskId,
              code: batchErrorCode,
              error: batchUserError,
              stage: 'invoke_or_stream',
              requestId,
              traceId,
            })
            await strategy.writeResults(
              { ok: false, error: batchUserError },
              preparedVars,
              {
                serviceId,
                userId,
                locale: locale as string,
                requestId,
                traceId,
                taskId,
              },
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

        try {
          await cleanupFinal(
            decision.modelId,
            String(decision.queueId),
            userId,
            'batch',
            counterKey,
            serviceId,
            taskId,
          )
        } catch (cleanupError) {
          logError({
            reqId: requestId,
            route: 'worker/batch',
            error: String(cleanupError),
            phase: 'cleanup_failed',
            serviceId,
          })
        }

        const execDuration = Date.now() - startTime
        trackEvent('WORKER_JOB_COMPLETED', {
          userId,
          serviceId,
          taskId,
          traceId: taskId,
          category: AnalyticsCategory.SYSTEM,
          duration: execDuration,
          payload: { templateId, success: false, error: errMsg },
        })

        return new Response('internal_error', { status: 500 })
      }
    },
  )
}
