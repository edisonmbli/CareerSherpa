import { ENV } from '@/lib/env'
import {
  parseWorkerBody,
  getUserHasQuota,
  hasImage,
  getTtlSec,
  getChannel,
  publishEvent,
} from '@/lib/worker/common'
import { buildQueueCounterKey } from '@/lib/config/concurrency'
import { getTaskRouting, getJobVisionTaskRouting } from '@/lib/llm/task-router'
import type { TaskTemplateId } from '@/lib/prompts/types'
import { runStreamingLlmTask, runStructuredLlmTask } from '@/lib/llm/service'
import { createLlmUsageLogDetailed } from '@/lib/dal/llmUsageLog'
import { getProvider, getCost } from '@/lib/llm/utils'
import { ENV as _ENV } from '@/lib/env'
import { withRequestSampling } from '@/lib/dev/redisSampler'
import { logEvent } from '@/lib/observability/logger'
import { addQuota } from '@/lib/dal/quotas'
import {
  publishStart,
  guardBlocked,
  emitStreamIdle,
} from '@/lib/worker/pipeline'
import { guardUser, guardModel, guardQueue } from '@/lib/worker/steps/guards'
import { executeStreaming, executeStructured } from '@/lib/worker/steps/execute'
import { computeDecision } from '@/lib/worker/steps/decision'
import { getRequestMeta } from '@/lib/worker/steps/meta'
import { cleanupFinal } from '@/lib/worker/steps/cleanup'
import {
  updateMatchStatus,
  updateInterviewStatus,
  updateJobStatus,
  updateCustomizedResumeStatus,
} from '@/lib/dal/services'

type Body = {
  taskId: string
  userId: string
  serviceId: string
  locale: any
  templateId: TaskTemplateId
  variables: Record<string, any>
}

export async function handleStream(
  req: Request,
  params: { service: string }
): Promise<Response> {
  return withRequestSampling(
    '/api/worker/stream/[service]',
    'POST',
    async () => {
      const { service } = params
      const parsed = await parseWorkerBody(req)
      if (!parsed.ok) return parsed.response
      const body: Body = parsed.body as Body

      const { taskId, userId, serviceId, locale, templateId, variables } = body
      const tierOverride = (variables as any)?.tierOverride
      const userHasQuota =
        tierOverride === 'paid'
          ? true
          : tierOverride === 'free'
          ? false
          : typeof (variables as any)?.wasPaid === 'boolean'
          ? Boolean((variables as any)?.wasPaid)
          : await getUserHasQuota(userId)
      const decision = computeDecision(templateId, variables, userHasQuota)

      logEvent(
        'TASK_ROUTED',
        { userId, serviceId, taskId },
        {
          templateId,
          modelId: decision.modelId,
          isStream: true,
          queueId: String(decision.queueId || ''),
        }
      )

      const ttlSec = getTtlSec()
      const counterKey = buildQueueCounterKey(String(decision.queueId))
      const channel = getChannel(userId, serviceId, taskId)
      const { requestId, traceId } = getRequestMeta(req, taskId)

      await publishStart(
        channel,
        taskId,
        decision.modelId,
        String(decision.queueId || ''),
        'guards',
        requestId,
        traceId,
        'stream'
      )

      {
        const g = await guardUser(
          userId,
          'stream',
          ttlSec,
          channel,
          requestId,
          traceId
        )
        if (!g.ok) {
          logEvent(
            'WORKER_GUARDS_BLOCKED',
            { userId, serviceId, taskId },
            { reason: g.reason, retryAfter: g.retryAfter, kind: 'stream' }
          )
          return Response.json({ ok: false, reason: g.reason }, { status: 429 })
        }
      }

      {
        const g = await guardModel(
          decision.modelId,
          String(decision.queueId),
          ttlSec,
          channel,
          requestId,
          traceId
        )
        if (!g.ok) {
          logEvent(
            'WORKER_GUARDS_BLOCKED',
            { userId, serviceId, taskId },
            { reason: g.reason, retryAfter: g.retryAfter, kind: 'stream' }
          )
          return Response.json({ ok: false, reason: g.reason }, { status: 429 })
        }
      }

      {
        const g = await guardQueue(
          userId,
          'stream',
          counterKey,
          ttlSec,
          ENV.QUEUE_MAX_SIZE,
          channel,
          requestId,
          traceId
        )
        if (!g.ok) {
          logEvent(
            'WORKER_GUARDS_BLOCKED',
            { userId, serviceId, taskId },
            { reason: g.reason, retryAfter: g.retryAfter, kind: 'stream' }
          )
          return Response.json({ ok: false, reason: g.reason }, { status: 429 })
        }
      }

      try {
        const provider = getProvider(decision.modelId)
        const providerReady =
          provider === 'zhipu'
            ? !!_ENV.ZHIPUAI_API_KEY
            : !!_ENV.DEEPSEEK_API_KEY
        if (!providerReady) {
          await publishEvent(channel, {
            type: 'error',
            taskId,
            error:
              provider === 'zhipu'
                ? 'Zhipu API key not configured'
                : 'DeepSeek API key not configured',
            code: 'provider_not_configured',
            requestId,
            traceId,
          })
          const wasPaid = !!(variables as any)?.wasPaid
          const cost = Number((variables as any)?.cost || 0)
          if (wasPaid && cost > 0) {
            try {
              await addQuota(userId, cost)
            } catch {}
          }
          logEvent(
            'WORKER_PROVIDER_NOT_CONFIGURED',
            { userId, serviceId, taskId },
            { provider, modelId: decision.modelId, kind: 'stream' }
          )
          return Response.json({ ok: false, reason: 'provider_not_configured' })
        }

        const exec = await executeStreaming(
          decision.modelId,
          templateId,
          locale as any,
          variables,
          { userId, serviceId },
          async (text) => {
            await publishEvent(channel, {
              type: 'token',
              taskId,
              text,
              stage: 'stream',
              requestId,
              traceId,
            })
          }
        )
        if (
          exec.tokenCount === 0 &&
          exec.latencyMs >= Math.min(ENV.WORKER_TIMEOUT_MS, 30000)
        ) {
          await emitStreamIdle(
            channel,
            taskId,
            decision.modelId,
            requestId,
            traceId
          )
        }
        await publishEvent(channel, {
          type: 'done',
          taskId,
          text: String((exec.result as any)?.raw || ''),
          usage: {
            inputTokens: Number((exec.result as any)?.usage?.inputTokens || 0),
            outputTokens: Number(
              (exec.result as any)?.usage?.outputTokens || 0
            ),
          },
          latencyMs: exec.latencyMs,
          stage: 'finalize',
          requestId,
          traceId,
        })
        logEvent(
          'TASK_COMPLETED',
          { userId, serviceId, taskId },
          {
            templateId,
            provider: getProvider(decision.modelId),
            modelId: decision.modelId,
            inputTokens: Number((exec.result as any)?.usage?.inputTokens || 0),
            outputTokens: Number(
              (exec.result as any)?.usage?.outputTokens || 0
            ),
            latencyMs: exec.latencyMs,
            isStream: true,
          }
        )
        return Response.json({ ok: true })
      } catch (error) {
        if (ENV.LLM_DEBUG) {
          const err = error as any
          console.debug('[LLM_DEBUG][worker.stream] error caught', {
            name: err?.name,
            message: err?.message,
            code: err?.code,
          })
          await publishEvent(channel, {
            type: 'debug',
            taskId,
            stage: 'invoke_or_stream_error',
            provider: getProvider(decision.modelId),
            modelId: decision.modelId,
            errorName: err?.name,
            errorMessage: err?.message,
            errorCode: err?.code,
            requestId,
            traceId,
          } as any)
        }
        await publishEvent(channel, {
          type: 'error',
          taskId,
          code: (error as any)?.code || 'llm_error',
          error: error instanceof Error ? error.message : 'unknown_error',
          provider: getProvider(decision.modelId),
          modelId: decision.modelId,
          stage: 'invoke_or_stream',
          requestId,
          traceId,
        })
        logEvent(
          'TASK_FAILED',
          { userId, serviceId, taskId },
          {
            templateId,
            provider: getProvider(decision.modelId),
            modelId: decision.modelId,
            isStream: true,
            error: error instanceof Error ? error.message : String(error),
            code: (error as any)?.code || 'llm_error',
          }
        )
        try {
          if (String(templateId) === 'job_match') {
            await updateMatchStatus(serviceId, 'FAILED' as any)
          } else if (String(templateId) === 'interview_prep') {
            await updateInterviewStatus(serviceId, 'FAILED' as any)
          }
        } catch {}
        const wasPaid = !!(variables as any)?.wasPaid
        const cost = Number((variables as any)?.cost || 0)
        if (wasPaid && cost > 0) {
          try {
            await addQuota(userId, cost)
          } catch {}
        }
        return new Response('internal_error', { status: 500 })
      } finally {
        await cleanupFinal(
          decision.modelId,
          String(decision.queueId),
          userId,
          'stream',
          counterKey
        )
      }
    }
  )
}

export async function handleBatch(
  req: Request,
  params: { service: string }
): Promise<Response> {
  return withRequestSampling(
    '/api/worker/batch/[service]',
    'POST',
    async () => {
      const { service } = params
      const parsed = await parseWorkerBody(req)
      if (!parsed.ok) return parsed.response
      const body: Body = parsed.body as Body

      const { taskId, userId, serviceId, locale, templateId, variables } = body
      const tierOverride = (variables as any)?.tierOverride
      const userHasQuota =
        tierOverride === 'paid'
          ? true
          : tierOverride === 'free'
          ? false
          : typeof (variables as any)?.wasPaid === 'boolean'
          ? Boolean((variables as any)?.wasPaid)
          : await getUserHasQuota(userId)
      const decision = computeDecision(templateId, variables, userHasQuota)
      const ttlSec = getTtlSec()
      const counterKey = buildQueueCounterKey(String(decision.queueId))
      const channel = getChannel(userId, serviceId, taskId)
      const { requestId, traceId } = getRequestMeta(req, taskId)

      await publishStart(
        channel,
        taskId,
        decision.modelId,
        String(decision.queueId || ''),
        'guards',
        requestId,
        traceId,
        'batch'
      )
      {
        const g = await guardUser(
          userId,
          'batch',
          ttlSec,
          channel,
          requestId,
          traceId
        )
        if (!g.ok) {
          logEvent(
            'WORKER_GUARDS_BLOCKED',
            { userId, serviceId, taskId },
            { reason: g.reason, retryAfter: g.retryAfter, kind: 'batch' }
          )
          return Response.json({ ok: false, reason: g.reason }, { status: 429 })
        }
      }

      {
        const g = await guardModel(
          decision.modelId,
          String(decision.queueId),
          ttlSec,
          channel,
          requestId,
          traceId
        )
        if (!g.ok) {
          logEvent(
            'WORKER_GUARDS_BLOCKED',
            { userId, serviceId, taskId },
            { reason: g.reason, retryAfter: g.retryAfter, kind: 'batch' }
          )
          return Response.json({ ok: false, reason: g.reason }, { status: 429 })
        }
      }

      {
        const g = await guardQueue(
          userId,
          'batch',
          counterKey,
          ttlSec,
          ENV.QUEUE_MAX_SIZE,
          channel,
          requestId,
          traceId
        )
        if (!g.ok) {
          logEvent(
            'WORKER_GUARDS_BLOCKED',
            { userId, serviceId, taskId },
            { reason: g.reason, retryAfter: g.retryAfter, kind: 'batch' }
          )
          return Response.json({ ok: false, reason: g.reason }, { status: 429 })
        }
      }

      try {
        logEvent(
          'TASK_ROUTED',
          { userId, serviceId, taskId },
          {
            templateId,
            modelId: decision.modelId,
            isStream: false,
            queueId: String(decision.queueId || ''),
          }
        )
        const exec = await executeStructured(
          decision.modelId,
          templateId,
          locale,
          variables,
          { userId, serviceId }
        )
        await publishEvent(channel, {
          type: 'done',
          taskId,
          data: exec.result,
          stage: 'finalize',
          requestId,
          traceId,
        })
        // 写回资产流结果（resume/detailed_resume）
        try {
          if (String(templateId) === 'resume_summary') {
            const resumeId = String((variables as any)?.resumeId || '')
            if (resumeId) {
              await (await import('@/lib/prisma')).prisma.resume.update({
                where: { id: resumeId },
                data: {
                  resumeSummaryJson: exec.result.ok ? (exec.result as any).data : undefined,
                  status: exec.result.ok ? ('COMPLETED' as any) : ('FAILED' as any),
                },
              })
            }
          } else if (String(templateId) === 'detailed_resume_summary') {
            const detailedId = String((variables as any)?.detailedResumeId || '')
            if (detailedId) {
              await (await import('@/lib/prisma')).prisma.detailedResume.update({
                where: { id: detailedId },
                data: {
                  detailedSummaryJson: exec.result.ok ? (exec.result as any).data : undefined,
                  status: exec.result.ok ? ('COMPLETED' as any) : ('FAILED' as any),
                },
              })
            }
          }
        } catch {}
        await createLlmUsageLogDetailed({
          taskTemplateId: templateId,
          provider: getProvider(decision.modelId),
          modelId: decision.modelId,
          inputTokens: exec.inputTokens,
          outputTokens: exec.outputTokens,
          latencyMs: exec.latencyMs,
          cost: getCost(decision.modelId, exec.inputTokens, exec.outputTokens),
          isStream: false,
          isSuccess: !!exec.result.ok,
          userId,
          serviceId,
          ...(exec.result.ok
            ? {}
            : { errorMessage: exec.result.error ?? 'unknown_error' }),
        })
        logEvent(
          exec.result.ok ? 'TASK_COMPLETED' : 'TASK_FAILED',
          { userId, serviceId, taskId },
          {
            templateId,
            provider: getProvider(decision.modelId),
            modelId: decision.modelId,
            inputTokens: exec.inputTokens,
            outputTokens: exec.outputTokens,
            latencyMs: exec.latencyMs,
            isStream: false,
            ...(exec.result.ok
              ? {}
              : {
                  error: exec.result.error ?? 'unknown_error',
                  code: 'structured_error',
                }),
          }
        )
        return Response.json({ ok: exec.result.ok })
      } catch (error) {
        await publishEvent(channel, {
          type: 'error',
          taskId,
          code: (error as any)?.code || 'llm_error',
          error: error instanceof Error ? error.message : 'unknown_error',
          stage: 'invoke',
          requestId,
          traceId,
        })
        logEvent(
          'TASK_FAILED',
          { userId, serviceId, taskId },
          {
            templateId,
            isStream: false,
            error: error instanceof Error ? error.message : String(error),
            code: (error as any)?.code || 'llm_error',
          }
        )
        try {
          if (String(templateId) === 'job_summary') {
            await updateJobStatus(serviceId, 'FAILED' as any)
            await updateMatchStatus(serviceId, 'FAILED' as any)
          } else if (String(templateId) === 'resume_customize') {
            await updateCustomizedResumeStatus(serviceId, 'FAILED' as any)
          } else if (String(templateId) === 'resume_summary') {
            const resumeId = String((variables as any)?.resumeId || '')
            if (resumeId) {
              await (await import('@/lib/prisma')).prisma.resume.update({
                where: { id: resumeId },
                data: { status: 'FAILED' as any },
              })
            }
          } else if (String(templateId) === 'detailed_resume_summary') {
            const detailedId = String((variables as any)?.detailedResumeId || '')
            if (detailedId) {
              await (await import('@/lib/prisma')).prisma.detailedResume.update({
                where: { id: detailedId },
                data: { status: 'FAILED' as any },
              })
            }
          }
        } catch {}
        const wasPaid = !!(variables as any)?.wasPaid
        const cost = Number((variables as any)?.cost || 0)
        if (wasPaid && cost > 0) {
          try {
            await addQuota(userId, cost)
          } catch {}
        }
        return new Response('internal_error', { status: 500 })
      } finally {
        await cleanupFinal(
          decision.modelId,
          String(decision.queueId),
          userId,
          'batch',
          counterKey
        )
      }
    }
  )
}
