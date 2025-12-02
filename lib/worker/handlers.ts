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

type Body = import('@/lib/worker/types').WorkerBody

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

      const tierOverride = (variables as any)?.tierOverride
      const wasPaid = (variables as any)?.wasPaid === true
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
        return Response.json(
          { ok: false, reason: gUser.reason },
          { status: 429 }
        )

      const gModel = await guardModel(
        decision.modelId,
        String(decision.queueId),
        ttlSec,
        channel,
        requestId,
        traceId
      )
      if (!gModel.ok)
        return Response.json(
          { ok: false, reason: gModel.reason },
          { status: 429 }
        )

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
        return Response.json(
          { ok: false, reason: gQueue.reason },
          { status: 429 }
        )

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

      try {
        // 4. Execute
        await markTimeline(serviceId, 'worker_stream_llm_start', { taskId })
        const execResult = await executeStreaming(
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

        // 5. Write Results
        await markTimeline(serviceId, 'worker_stream_finalize_start', {
          taskId,
        })
        await strategy.writeResults(execResult.result, preparedVars, {
          serviceId,
          userId,
          locale: locale as string,
          requestId,
          traceId,
          taskId,
        })
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

        return Response.json({ ok: execResult.result.ok })
      } catch (error) {
        await publishEvent(channel, {
          type: 'error',
          taskId,
          code: 'llm_error',
          error: error instanceof Error ? error.message : String(error),
          provider: getProvider(decision.modelId),
          modelId: decision.modelId,
          stage: 'invoke_or_stream',
          requestId,
          traceId,
        })
        // Strategy writeResults might handle partial failure if needed, or we assume cleanup is enough
        // We should probably call writeResults with error result
        await strategy.writeResults(
          { ok: false, error: String(error) },
          preparedVars,
          {
            serviceId,
            userId,
            locale: locale as string,
            requestId,
            traceId,
            taskId,
          }
        )
        return Response.json(
          { ok: false, error: String(error) },
          { status: 500 }
        )
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

      const tierOverride = (variables as any)?.tierOverride
      const wasPaid = (variables as any)?.wasPaid === true
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
        return Response.json(
          { ok: false, reason: gUser.reason },
          { status: 429 }
        )

      const gModel = await guardModel(
        decision.modelId,
        String(decision.queueId),
        ttlSec,
        channel,
        requestId,
        traceId
      )
      if (!gModel.ok)
        return Response.json(
          { ok: false, reason: gModel.reason },
          { status: 429 }
        )

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
        return Response.json(
          { ok: false, reason: gQueue.reason },
          { status: 429 }
        )

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

      try {
        // 4. Execute
        await markTimeline(serviceId, 'worker_batch_llm_start', { taskId })
        const execResult = await executeStructured(
          decision.modelId,
          templateId,
          locale,
          preparedVars,
          { userId, serviceId }
        )
        await markTimeline(serviceId, 'worker_batch_done', {
          taskId,
          latencyMs: execResult.latencyMs,
        })

        // 5. Write Results
        await markTimeline(serviceId, 'worker_batch_finalize_start', { taskId })
        await strategy.writeResults(execResult.result, preparedVars, {
          serviceId,
          userId,
          locale: locale as string,
          requestId,
          traceId,
          taskId,
        })

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

        return Response.json({ ok: execResult.result.ok })
      } catch (error) {
        logError({
          reqId: requestId,
          route: 'worker/batch',
          error: String(error),
          phase: 'execute_failed',
          serviceId,
          templateId,
        })
        await strategy.writeResults(
          { ok: false, error: String(error) },
          preparedVars,
          {
            serviceId,
            userId,
            locale: locale as string,
            requestId,
            traceId,
            taskId,
          }
        )
        return new Response('internal_error', { status: 500 })
      }
    }
  )
}
