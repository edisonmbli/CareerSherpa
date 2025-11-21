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
import { getTaskRouting, getJobVisionTaskRouting, isServiceScoped } from '@/lib/llm/task-router'
import type { TaskTemplateId } from '@/lib/prompts/types'
import { runStreamingLlmTask, runStructuredLlmTask } from '@/lib/llm/service'
import { createLlmUsageLogDetailed } from '@/lib/dal/llmUsageLog'
import { getProvider, getCost } from '@/lib/llm/utils'
import { ENV as _ENV } from '@/lib/env'
import { withRequestSampling } from '@/lib/dev/redisSampler'
import { logEvent } from '@/lib/observability/logger'
import { recordRefund, markDebitSuccess } from '@/lib/dal/coinLedger'
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

type Body = import('@/lib/worker/types').WorkerBody

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
      const body: Body = parsed.body

      const { taskId, userId, serviceId, locale, templateId, variables } = body
      const ledgerServiceId = isServiceScoped(templateId) ? serviceId : undefined
      const tierOverride = variables.tierOverride
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
          const wasPaid = !!variables.wasPaid
          const cost = Number(variables.cost || 0)
          const debitId = String((variables as any)?.debitId || '')
          if (wasPaid && cost > 0 && debitId) {
            try {
              await recordRefund({
                userId,
                amount: cost,
                relatedId: debitId,
                ...(ledgerServiceId ? { serviceId: ledgerServiceId } : {}),
                templateId,
              })
            } catch {}
            try { await markDebitSuccess(debitId) } catch {}
          }
          console.error('Provider not configured', { taskId, provider })
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
        try {
          if (String(templateId) === 'job_match') {
            const raw = String((exec.result as any)?.raw || '')
            let parsed: any = null
            try { parsed = JSON.parse(raw) } catch {}
            await (await import('@/lib/prisma')).prisma.match.update({
              where: { serviceId },
              data: {
                matchSummaryJson: parsed || { markdown: raw },
                status: 'COMPLETED' as any,
              },
            })
          } else if (String(templateId) === 'interview_prep') {
            const raw = String((exec.result as any)?.raw || '')
            let parsed: any = null
            try { parsed = JSON.parse(raw) } catch {}
            await (await import('@/lib/prisma')).prisma.interview.update({
              where: { serviceId },
              data: {
                interviewTipsJson: parsed || { markdown: raw },
                status: 'COMPLETED' as any,
              },
            })
          }
        } catch {}
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
        {
          const wasPaid = !!(variables as any)?.wasPaid
          const cost = Number((variables as any)?.cost || 0)
          const debitId = String((variables as any)?.debitId || '')
          if (wasPaid && cost > 0 && debitId) {
            try { await markDebitSuccess(debitId, (exec.result as any)?.usageLogId) } catch {}
          }
        }
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
          const wasPaid = !!variables.wasPaid
          const cost = Number(variables.cost || 0)
          const debitId = String((variables as any)?.debitId || '')
        if (wasPaid && cost > 0 && debitId) {
          try {
            await recordRefund({
              userId,
              amount: cost,
              relatedId: debitId,
              ...(ledgerServiceId ? { serviceId: ledgerServiceId } : {}),
              templateId: templateId as any,
            })
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
      const ledgerServiceId = isServiceScoped(templateId) ? serviceId : undefined
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
        const vars: Record<string, any> = { ...variables }
        if (String(templateId) === 'resume_summary') {
          const resumeId = String((variables as any)?.resumeId || '')
          if (resumeId) {
            const rec = await (await import('@/lib/prisma')).prisma.resume.findUnique({
              where: { id: resumeId },
              select: { originalText: true },
            })
            if (rec?.originalText) {
              vars['resume_text'] = rec.originalText
            }
          }
        } else if (String(templateId) === 'detailed_resume_summary') {
          const detailedId = String((variables as any)?.detailedResumeId || '')
          if (detailedId) {
            const rec = await (await import('@/lib/prisma')).prisma.detailedResume.findUnique({
              where: { id: detailedId },
              select: { originalText: true },
            })
            if (rec?.originalText) {
              vars['detailed_resume_text'] = rec.originalText
            }
          }
        }
        const exec = await executeStructured(
          decision.modelId,
          templateId,
          locale,
          vars,
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
          } else if (String(templateId) === 'resume_customize') {
            const dataObj = exec.result.ok ? ((exec.result as any).data || {}) : {}
            const md = dataObj?.markdown || dataObj?.customized_resume_markdown || ''
            const ops = dataObj?.ops || null
            await (await import('@/lib/prisma')).prisma.customizedResume.update({
              where: { serviceId },
              data: {
                markdownText: md || undefined,
                ...(ops ? { opsJson: ops as any } : {}),
                status: exec.result.ok ? ('COMPLETED' as any) : ('FAILED' as any),
              },
            })
          } else if (String(templateId) === 'job_summary') {
            await (await import('@/lib/prisma')).prisma.job.update({
              where: { serviceId },
              data: {
                jobSummaryJson: exec.result.ok ? (exec.result as any).data : undefined,
                status: exec.result.ok ? ('COMPLETED' as any) : ('FAILED' as any),
              },
            })
            if (exec.result.ok) {
              await (await import('@/lib/prisma')).prisma.match.update({
                where: { serviceId },
                data: { status: 'MATCH_PENDING' as any },
              })
            }
          }
        } catch {}
        
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
        {
          const wasPaid = !!variables.wasPaid
          const cost = Number(variables.cost || 0)
          const debitId = String((variables as any)?.debitId || '')
          const data = (exec.result as any)?.data
          const invalid =
            String(templateId) === 'resume_summary'
              ? !data || (
                  (!data.summary || data.summary === '') &&
                  (!data.experience || data.experience.length === 0) &&
                  (!data.projects || data.projects.length === 0) &&
                  (!data.education || data.education.length === 0) &&
                  (!data.skills || (Array.isArray(data.skills) ? data.skills.length === 0 : (!data.skills?.technical && !data.skills?.soft && !data.skills?.tools)))
                )
              : String(templateId) === 'detailed_resume_summary'
              ? !data || (
                  (!Array.isArray(data.experiences) || data.experiences.length === 0) &&
                  (!Array.isArray(data.capabilities) || data.capabilities.length === 0) &&
                  (!Array.isArray(data.education) || data.education.length === 0) &&
                  (!data.skills || (Array.isArray(data.skills) ? data.skills.length === 0 : (!data.skills?.technical && !data.skills?.soft && !data.skills?.tools)))
                )
              : false
          const shouldFail = !exec.result.ok || invalid
          const shouldRefund = shouldFail && wasPaid && cost > 0 && !!debitId
          if (shouldFail) {
            try {
              if (templateId === 'resume_summary') {
                const resumeId = variables.resumeId
                if (resumeId) {
                  await (await import('@/lib/prisma')).prisma.resume.update({
                    where: { id: resumeId },
                    data: { status: 'FAILED' as any },
                  })
                }
              } else if (templateId === 'detailed_resume_summary') {
                const detailedId = variables.detailedResumeId
                if (detailedId) {
                  await (await import('@/lib/prisma')).prisma.detailedResume.update({
                    where: { id: detailedId },
                    data: { status: 'FAILED' as any },
                  })
                }
              }
            } catch {}
            console.error('Structured task failed or invalid output', { taskId, templateId, ok: exec.result.ok })
          }
          if (shouldRefund) {
            try {
              const usageLogId = (exec.result as any)?.usageLogId
              await recordRefund({
                userId,
                amount: cost,
                relatedId: debitId,
                ...(ledgerServiceId ? { serviceId: ledgerServiceId } : {}),
                ...(usageLogId ? { taskId: usageLogId } : {}),
                templateId,
              })
            } catch {}
            try { await markDebitSuccess(debitId, (exec.result as any)?.usageLogId) } catch {}
          }
          if (exec.result.ok && wasPaid && cost > 0 && debitId) {
            try { await markDebitSuccess(debitId, (exec.result as any)?.usageLogId) } catch {}
          }
        }
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
          if (templateId === 'job_summary') {
            await updateJobStatus(serviceId, 'FAILED' as any)
            await updateMatchStatus(serviceId, 'FAILED' as any)
          } else if (String(templateId) === 'resume_customize') {
            await updateCustomizedResumeStatus(serviceId, 'FAILED' as any)
          } else if (templateId === 'resume_summary') {
            const resumeId = variables.resumeId
            if (resumeId) {
              await (await import('@/lib/prisma')).prisma.resume.update({
                where: { id: resumeId },
                data: { status: 'FAILED' as any },
              })
            }
          } else if (templateId === 'detailed_resume_summary') {
            const detailedId = variables.detailedResumeId
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
        const debitId = String((variables as any)?.debitId || '')
        if (wasPaid && cost > 0 && debitId) {
          try {
            await recordRefund({
              userId,
              amount: cost,
              relatedId: debitId,
              ...(ledgerServiceId ? { serviceId: ledgerServiceId } : {}),
              templateId,
            })
          } catch {}
          try { await markDebitSuccess(debitId) } catch {}
        }
        console.error('Batch task failed', { taskId, error: error instanceof Error ? error.message : String(error) })
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
