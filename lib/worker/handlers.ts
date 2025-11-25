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
import {
  getTaskRouting,
  getJobVisionTaskRouting,
  isServiceScoped,
} from '@/lib/llm/task-router'
import type { TaskTemplateId } from '@/lib/prompts/types'
import { runStreamingLlmTask, runStructuredLlmTask } from '@/lib/llm/service'
import { createLlmUsageLogDetailed } from '@/lib/dal/llmUsageLog'
import { pushTask } from '@/lib/queue/producer'
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
  setJobSummaryJson,
  setMatchSummaryJson,
  setResumeSummaryJson,
  setDetailedResumeSummaryJson,
  setCustomizedResumeResult,
  updateResumeStatus,
  updateDetailedResumeStatus,
  setInterviewTipsJson,
  updateServiceExecutionStatus,
  txMarkSummaryCompleted,
  txMarkSummaryFailed,
  txMarkMatchStreaming,
  txMarkMatchCompleted,
  txMarkMatchFailed,
} from '@/lib/dal/services'
import { logError } from '@/lib/logger'
import { validateJson } from '@/lib/llm/json-validator'
import { prisma } from '@/lib/prisma'
import { getServiceWithContextReadOnly } from '@/lib/dal'
import {
  getJobOriginalTextById,
  updateJobOriginalText,
  getJobOriginalImageById,
} from '@/lib/dal/services'
import {
  getResumeOriginalTextById,
  getDetailedResumeOriginalTextById,
} from '@/lib/dal/resume'
import { AsyncTaskStatus, ExecutionStatus } from '@prisma/client'
import { getTemplate } from '@/lib/prompts/index'
import { getTaskSchema } from '@/lib/llm/zod-schemas'
import { getVectorStore } from '@/lib/rag/vectorStore'
import fs from 'fs'
import path from 'path'

type Body = import('@/lib/worker/types').WorkerBody

function __cap(s: string, n: number) {
  if (typeof s !== 'string') return ''
  return s.length > n ? s.slice(0, n) : s
}

function __render(
  template: string,
  variables: Record<string, string>,
  limit: number
) {
  let rendered = template
  for (const [key, val] of Object.entries(variables)) {
    const v = __cap(String(val ?? ''), limit)
    const pattern = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
    rendered = rendered.replace(pattern, v)
  }
  return rendered
}

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
  try {
    if (process.env.NODE_ENV !== 'production') {
      console.info('publish_event_token', {
        channel,
        taskId,
        len: typeof text === 'string' ? text.length : 0,
      })
      try {
        const { promises: fsp } = await import('fs')
        const path = await import('path')
        const debugDir = path.join(process.cwd(), 'tmp', 'llm-debug')
        await fsp.mkdir(debugDir, { recursive: true })
        const file = path.join(debugDir, `token_${taskId || 'unknown'}.log`)
        const snippet = typeof text === 'string' ? text.slice(0, 120) : ''
        await fsp.appendFile(
          file,
          JSON.stringify({
            channel,
            len: typeof text === 'string' ? text.length : 0,
            snippet,
          }) + '\n'
        )
      } catch {}
    }
  } catch {}
}

// 处理流式任务：用于 job_match 与 interview_prep（实时 token 事件 + 最终写回/退款/日志）
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
      const usesIds =
        typeof (variables as any)?.resumeId === 'string' ||
        typeof (variables as any)?.jobId === 'string'
      const sessionIdForMatch = String(
        (variables as any)?.executionSessionId || ''
      )
      const normalizedTaskId =
        String(templateId) === 'job_match'
          ? buildMatchTaskId(serviceId, sessionIdForMatch)
          : taskId
      if (normalizedTaskId !== taskId && String(templateId) === 'job_match') {
        try {
          console.warn('task_id_normalized', {
            received: taskId,
            normalized: normalizedTaskId,
            serviceId,
            sessionId: sessionIdForMatch,
          })
        } catch {}
      }
      logEvent(
        'TASK_ROUTED',
        { userId, serviceId, taskId: normalizedTaskId },
        { templateId, usesIds, kind: 'stream' }
      )
      const ledgerServiceId = isServiceScoped(templateId)
        ? serviceId
        : undefined
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
      const channel = getChannel(userId, serviceId, normalizedTaskId)
      const { requestId, traceId } = getRequestMeta(req, normalizedTaskId)

      try {
        console.info('worker.stream.received', {
          route: '/api/worker/stream',
          templateId,
          taskId,
          userId,
          serviceId,
          channel,
          usesIds,
        })
      } catch {}

      await publishStart(
        channel,
        normalizedTaskId,
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
            try {
              await markDebitSuccess(debitId)
            } catch {}
          }
          console.error('Provider not configured', { taskId, provider })
          logEvent(
            'WORKER_PROVIDER_NOT_CONFIGURED',
            { userId, serviceId, taskId },
            { provider, modelId: decision.modelId, kind: 'stream' }
          )
          return Response.json({ ok: false, reason: 'provider_not_configured' })
        }

        await publishEvent(channel, {
          type: 'status',
          taskId: normalizedTaskId,
          code: 'match_streaming',
          status: 'MATCH_STREAMING',
          lastUpdatedAt: new Date().toISOString(),
          stage: 'stream',
          requestId,
          traceId,
        })
        try {
          await updateServiceExecutionStatus(
            serviceId,
            ExecutionStatus.MATCH_STREAMING
          )
        } catch {}
        const varsPrepared = await prepareStreamVars(
          templateId,
          variables,
          serviceId,
          userId
        )
        let __debugBase: string | null = null
        if (
          String(templateId) === 'job_match' &&
          process.env.NODE_ENV !== 'production'
        ) {
          try {
            const tmpl = getTemplate(locale as any, templateId as any)
            const cap = 500
            const dir = path.join(process.cwd(), 'tmp')
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
            const ts = new Date().toISOString().replace(/[:.]/g, '-')
            __debugBase = path.join(
              dir,
              `jobmatch_${serviceId}_${sessionIdForMatch || ''}_${ts}`
            )
            const varsForRender: Record<string, string> = {}
            for (const k of (tmpl as any)?.variables || []) {
              varsForRender[k] = __cap(
                String((varsPrepared as any)[k] ?? ''),
                cap
              )
            }
            const system = String((tmpl as any)?.systemPrompt || '')
            const userRendered = __render(
              String((tmpl as any)?.userPrompt || ''),
              varsForRender,
              cap
            )
            const payload = [
              `model=${String(decision.modelId)}`,
              `provider=${getProvider(decision.modelId)}`,
              `serviceId=${serviceId}`,
              `taskId=${normalizedTaskId}`,
              `requestId=${requestId}`,
              `systemPrompt:\n${system}`,
              `userPromptRendered:\n${userRendered}`,
              `variables:\n${JSON.stringify(varsForRender, null, 2)}`,
            ].join('\n\n')
            fs.writeFileSync(`${__debugBase}.inputs.txt`, payload, 'utf-8')
          } catch {}
        }
        const exec = await executeStreaming(
          decision.modelId,
          templateId,
          locale as any,
          varsPrepared,
          { userId, serviceId },
          async (text) => {
            await onToken(channel, normalizedTaskId, text, requestId, traceId)
          }
        )
        if (
          String(templateId) === 'job_match' &&
          process.env.NODE_ENV !== 'production'
        ) {
          try {
            const dir = path.join(process.cwd(), 'tmp')
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
            let base = __debugBase
            if (!base) {
              const ts = new Date().toISOString().replace(/[:.]/g, '-')
              base = path.join(
                dir,
                `jobmatch_${serviceId}_${sessionIdForMatch || ''}_${ts}`
              )
            }
            const raw = String((exec.result as any)?.raw || '')
            fs.writeFileSync(`${base}.output.raw.txt`, raw, 'utf-8')
          } catch {}
        }
        try {
          console.info('worker.stream.varsPrepared', {
            keys: Object.keys(varsPrepared || {}),
            resume_summary_json:
              typeof (varsPrepared as any)?.resume_summary_json === 'string',
            job_summary_json:
              typeof (varsPrepared as any)?.job_summary_json === 'string',
            detailed_resume_summary_json:
              typeof (varsPrepared as any)?.detailed_resume_summary_json ===
              'string',
          })
        } catch {}
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
        try {
          await streamWriteResults(
            templateId,
            serviceId,
            exec,
            varsPrepared,
            userId,
            requestId
          )
          await streamHandleTransactions(
            templateId,
            exec,
            variables,
            ledgerServiceId,
            userId,
            requestId
          )
          try {
            const raw = String((exec.result as any)?.raw || '')
            if (String(templateId) !== 'job_match') {
              const v = validateJson<any>(raw, {
                debug: { reqId: requestId, route: 'worker/stream' },
              })
              const parsed = v.success ? v.data : null
              await publishEvent(channel, {
                type: 'status',
                taskId,
                code:
                  parsed && typeof parsed === 'object' ? 'completed' : 'failed',
                status:
                  parsed && typeof parsed === 'object' ? 'COMPLETED' : 'FAILED',
                lastUpdatedAt: new Date().toISOString(),
                stage: 'finalize',
                requestId,
                traceId,
              })
            }
            await publishEvent(channel, {
              type: 'done',
              taskId,
              text: raw,
              usage: {
                inputTokens: Number(
                  (exec.result as any)?.usage?.inputTokens || 0
                ),
                outputTokens: Number(
                  (exec.result as any)?.usage?.outputTokens || 0
                ),
              },
              latencyMs: exec.latencyMs,
              stage: 'finalize',
              requestId,
              traceId,
            })
          } catch {}
        } catch (err) {
          logCtxError(
            requestId,
            'worker/stream',
            err,
            'finalize_stream_failed',
            serviceId,
            templateId
          )
        }
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
        try {
          const rawCode = String((error as any)?.code || '').toLowerCase()
          let failureCode: any = null
          if (
            rawCode.includes('max_tokens') ||
            rawCode.includes('invalid max_tokens') ||
            rawCode.includes('context') ||
            rawCode.includes('length') ||
            rawCode.includes('exceed')
          )
            failureCode = 'PREVIOUS_MODEL_LIMIT'
          else if (rawCode.includes('json_parse_failed'))
            failureCode = 'JSON_PARSE_FAILED'
          else if (rawCode.includes('zod_validation_failed'))
            failureCode = 'ZOD_VALIDATION_FAILED'
          else if (rawCode.includes('provider_not_configured'))
            failureCode = 'PROVIDER_NOT_CONFIGURED'
          await createLlmUsageLogDetailed({
            taskTemplateId: templateId as any,
            provider: getProvider(decision.modelId),
            modelId: decision.modelId,
            inputTokens: 0,
            outputTokens: 0,
            latencyMs: 0,
            isStream: true,
            isSuccess: false,
            errorMessage:
              (error instanceof Error ? error.message : String(error)) ||
              String((error as any)?.code || 'llm_error'),
            errorCode: failureCode,
            userId,
            serviceId,
          })
        } catch {}
        logCtxError(
          requestId,
          'worker/stream',
          error,
          'invoke_or_stream',
          serviceId,
          templateId
        )
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
            const rawCode = String((error as any)?.code || '').toLowerCase()
            let failureCode: any = null
            if (
              rawCode.includes('max_tokens') ||
              rawCode.includes('context') ||
              rawCode.includes('length') ||
              rawCode.includes('exceed')
            )
              failureCode = 'PREVIOUS_MODEL_LIMIT'
            else if (rawCode.includes('provider_not_configured'))
              failureCode = 'PROVIDER_NOT_CONFIGURED'
            await txMarkMatchFailed(serviceId, failureCode)
          } else if (String(templateId) === 'interview_prep') {
            await updateInterviewStatus(serviceId, 'FAILED' as any)
          }
        } catch {}
        {
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
                templateId: templateId as any,
              })
            } catch {}
          }
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
      const ledgerServiceId = isServiceScoped(templateId)
        ? serviceId
        : undefined
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
        const vars = await prepareVarsForTemplate(templateId, variables)
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
        try {
          await writeResults(templateId, serviceId, exec, {
            userId,
            locale,
            variables,
            requestId,
            traceId,
          })
        } catch (err) {
          logCtxError(
            requestId,
            'worker/batch',
            err,
            'finalize_batch_failed',
            serviceId,
            templateId
          )
        }

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
              ? !data ||
                ((!data.summary || data.summary === '') &&
                  (!data.experience || data.experience.length === 0) &&
                  (!data.projects || data.projects.length === 0) &&
                  (!data.education || data.education.length === 0) &&
                  (!data.skills ||
                    (Array.isArray(data.skills)
                      ? data.skills.length === 0
                      : !data.skills?.technical &&
                        !data.skills?.soft &&
                        !data.skills?.tools)))
              : String(templateId) === 'detailed_resume_summary'
              ? !data ||
                ((!Array.isArray(data.experiences) ||
                  data.experiences.length === 0) &&
                  (!Array.isArray(data.capabilities) ||
                    data.capabilities.length === 0) &&
                  (!Array.isArray(data.education) ||
                    data.education.length === 0) &&
                  (!data.skills ||
                    (Array.isArray(data.skills)
                      ? data.skills.length === 0
                      : !data.skills?.technical &&
                        !data.skills?.soft &&
                        !data.skills?.tools)))
              : false
          const shouldFail = !exec.result.ok || invalid
          const shouldRefund = shouldFail && wasPaid && cost > 0 && !!debitId
          if (shouldFail) {
            try {
              await markAssetFailedIfNeeded(templateId, variables, serviceId)
            } catch {}
            logCtxError(
              requestId,
              'worker/batch',
              'structured_failed',
              'structured_failed',
              serviceId,
              templateId
            )
            try {
              const usageLogId = (exec.result as any)?.usageLogId
              if (usageLogId) {
                await standardizeLogCode(
                  String(usageLogId),
                  String(exec.result.error || 'structured_error')
                )
              }
            } catch {}
          }
          await handleRefunds(
            exec,
            variables,
            ledgerServiceId,
            templateId,
            userId
          )
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
        logCtxError(
          requestId,
          'worker/batch',
          error,
          'invoke',
          serviceId,
          templateId
        )
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
          await markAssetFailedIfNeeded(templateId, variables, serviceId)
        } catch {}
        try {
          if (String(templateId) === 'job_summary') {
            const rawCode = String((error as any)?.code || '').toLowerCase()
            let failureCode: any = null
            if (
              rawCode.includes('max_tokens') ||
              rawCode.includes('context') ||
              rawCode.includes('length') ||
              rawCode.includes('exceed')
            )
              failureCode = 'PREVIOUS_MODEL_LIMIT'
            else if (rawCode.includes('provider_not_configured'))
              failureCode = 'PROVIDER_NOT_CONFIGURED'
            await txMarkSummaryFailed(serviceId, failureCode)
            const sessionId = String(
              (variables as any)?.executionSessionId || ''
            )
            const matchTaskId = buildMatchTaskId(serviceId, sessionId)
            const matchChannel = getChannel(userId, serviceId, matchTaskId)
            try {
              await publishEvent(matchChannel, {
                type: 'status',
                taskId: matchTaskId,
                code: 'summary_failed',
                status: 'SUMMARY_FAILED',
                failureCode,
                lastUpdatedAt: new Date().toISOString(),
                stage: 'finalize',
                requestId,
                traceId,
              })
            } catch {}
          } else if (String(templateId) === 'ocr_extract') {
            await txMarkSummaryFailed(serviceId, 'PREVIOUS_OCR_FAILED' as any)
            const sessionId = String(
              (variables as any)?.executionSessionId || ''
            )
            const matchTaskId = buildMatchTaskId(serviceId, sessionId)
            const matchChannel = getChannel(userId, serviceId, matchTaskId)
            try {
              await publishEvent(matchChannel, {
                type: 'status',
                taskId: matchTaskId,
                code: 'summary_failed',
                status: 'SUMMARY_FAILED',
                failureCode: 'PREVIOUS_OCR_FAILED',
                lastUpdatedAt: new Date().toISOString(),
                stage: 'finalize',
                requestId,
                traceId,
              })
            } catch {}
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
          try {
            await markDebitSuccess(debitId)
          } catch {}
        }
        console.error('Batch task failed', {
          taskId,
          error: error instanceof Error ? error.message : String(error),
        })
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

async function prepareVarsForTemplate(
  templateId: TaskTemplateId,
  variables: Record<string, any>
) {
  const vars: Record<string, any> = { ...variables }
  if (String(templateId) === 'resume_summary') {
    const resumeId = String((variables as any)?.resumeId || '')
    if (resumeId) {
      const text = await getResumeOriginalTextById(resumeId)
      if (text) vars['resume_text'] = text
    }
  } else if (String(templateId) === 'detailed_resume_summary') {
    const detailedId = String((variables as any)?.detailedResumeId || '')
    if (detailedId) {
      const text = await getDetailedResumeOriginalTextById(detailedId)
      if (text) vars['detailed_resume_text'] = text
    }
  } else if (String(templateId) === 'job_summary') {
    // 优先使用数据库中的原始文本，以减少队列传参体积
    const jobId = String((variables as any)?.jobId || '')
    if (jobId && !vars['job_text']) {
      const text = await getJobOriginalTextById(jobId)
      if (text) vars['job_text'] = text
    }
  } else if (String(templateId) === 'ocr_extract') {
    const jobId = String((variables as any)?.jobId || '')
    if (jobId && !vars['image']) {
      const image = await getJobOriginalImageById(jobId)
      if (image) vars['image'] = image
    }
  }
  return vars
}

async function prepareStreamVars(
  templateId: TaskTemplateId,
  variables: Record<string, any>,
  serviceId: string,
  userId?: string
) {
  if (String(templateId) !== 'job_match') return variables
  const vars: Record<string, any> = { ...variables }
  const resumeId = String(vars['resumeId'] || '')
  const detailedId = String(vars['detailedResumeId'] || '')
  const jobId = String(vars['jobId'] || '')
  if (typeof vars['resume_summary_json'] !== 'string') {
    vars['resume_summary_json'] = ''
  }
  if (typeof vars['job_summary_json'] !== 'string') {
    vars['job_summary_json'] = ''
  }
  if (typeof vars['detailed_resume_summary_json'] !== 'string') {
    vars['detailed_resume_summary_json'] = ''
  }
  if (!vars['resume_summary_json']) {
    try {
      const svc = await getServiceWithContextReadOnly(serviceId, userId)
      const obj = svc?.resume?.resumeSummaryJson
      if (obj) vars['resume_summary_json'] = JSON.stringify(obj)
    } catch {}
  }
  if (!vars['detailed_resume_summary_json']) {
    try {
      const svc = await getServiceWithContextReadOnly(serviceId, userId)
      const obj = svc?.detailedResume?.detailedSummaryJson
      if (obj) vars['detailed_resume_summary_json'] = JSON.stringify(obj)
    } catch {}
  }
  if (!vars['job_summary_json']) {
    try {
      const svc = await getServiceWithContextReadOnly(serviceId, userId)
      const obj = svc?.job?.jobSummaryJson
      if (obj) vars['job_summary_json'] = JSON.stringify(obj)
    } catch {}
  }
  try {
    const resumeObj: any = (() => {
      try {
        return JSON.parse(String(vars['resume_summary_json'] || ''))
      } catch {
        return {}
      }
    })()
    const detailedObj: any = (() => {
      try {
        return JSON.parse(String(vars['detailed_resume_summary_json'] || ''))
      } catch {
        return {}
      }
    })()
    const jobObj: any = (() => {
      try {
        return JSON.parse(String(vars['job_summary_json'] || ''))
      } catch {
        return {}
      }
    })()
    const jobTitle: string = String(jobObj?.jobTitle || '')
    const mustHaves: string[] = Array.isArray(jobObj?.mustHaves)
      ? jobObj.mustHaves.map((s: any) => String(s))
      : []
    const niceToHaves: string[] = Array.isArray(jobObj?.niceToHaves)
      ? jobObj.niceToHaves.map((s: any) => String(s))
      : []
    const resumeSkillsArr: string[] = Array.isArray(resumeObj?.skills)
      ? (resumeObj.skills as string[]).map((s) => String(s))
      : [
          ...(Array.isArray(resumeObj?.skills?.technical)
            ? resumeObj.skills.technical.map((s: any) => String(s))
            : []),
          ...(Array.isArray(resumeObj?.skills?.soft)
            ? resumeObj.skills.soft.map((s: any) => String(s))
            : []),
          ...(Array.isArray(resumeObj?.skills?.tools)
            ? resumeObj.skills.tools.map((s: any) => String(s))
            : []),
        ]
    const normalizedSkills = resumeSkillsArr.map((s) => s.toLowerCase())
    const strengthKeywords = mustHaves.filter((m) =>
      normalizedSkills.some((s) => s.includes(String(m).toLowerCase()))
    )
    const topStrengths = strengthKeywords.slice(0, 2)
    const queryA = [
      '岗位匹配度分析方法',
      jobTitle ? `岗位 ${jobTitle}` : '',
      mustHaves.length ? `必须技能 ${mustHaves.join(', ')}` : '',
      niceToHaves.length ? `加分项 ${niceToHaves.join(', ')}` : '',
      resumeSkillsArr.length ? `简历技能 ${resumeSkillsArr.join(', ')}` : '',
      '优势识别 劣势规避 简历定制 面试准备 专业评估框架',
    ]
      .filter(Boolean)
      .join('；')
    const queryB = [
      'HR私聊话术 模板',
      jobTitle ? `岗位 ${jobTitle}` : '',
      topStrengths.length ? `亮点 ${topStrengths.join(', ')}` : '',
      '简洁 有力 精准 高匹配 DM script 开场与收尾',
    ]
      .filter(Boolean)
      .join('；')
    const store = getVectorStore()
    const resA = await store.retrieve({ query: queryA, similarityTopK: 6 })
    const resB = await store.retrieve({ query: queryB, similarityTopK: 4 })
    const texts: string[] = [...resA, ...resB]
      .map((r: any) => {
        const t =
          typeof r?.node?.getContent === 'function'
            ? r.node.getContent()
            : String(r?.node?.text || '')
        return String(t || '')
      })
      .filter((t) => t.length > 0)
    const rag = texts
      .map((t) => t.slice(0, 1000))
      .join('\n\n')
      .slice(0, 4000)
    vars['rag_context'] = rag
  } catch {
    vars['rag_context'] = String(vars['rag_context'] || '')
  }
  return vars
}

async function writeResults(
  templateId: TaskTemplateId,
  serviceId: string,
  exec: any,
  ctx: {
    userId: string
    locale: any
    variables: Record<string, any>
    requestId: string
    traceId: string
  }
) {
  if (String(templateId) === 'resume_summary') {
    const resumeId = String((ctx.variables as any)?.resumeId || '')
    if (resumeId) {
      await setResumeSummaryJson(
        resumeId,
        exec.result.ok ? (exec.result as any).data : undefined,
        exec.result.ok ? ('COMPLETED' as any) : ('FAILED' as any)
      )
    }
    return
  }
  if (String(templateId) === 'detailed_resume_summary') {
    const detailedId = String((ctx.variables as any)?.detailedResumeId || '')
    if (detailedId) {
      await setDetailedResumeSummaryJson(
        detailedId,
        exec.result.ok ? (exec.result as any).data : undefined,
        exec.result.ok ? ('COMPLETED' as any) : ('FAILED' as any)
      )
    }
    return
  }
  if (String(templateId) === 'resume_customize') {
    const dataObj = exec.result.ok ? (exec.result as any).data || {} : {}
    const md = dataObj?.markdown || dataObj?.customized_resume_markdown || ''
    const ops = dataObj?.ops || null
    await setCustomizedResumeResult(
      serviceId,
      md || undefined,
      ops || undefined,
      exec.result.ok ? AsyncTaskStatus.COMPLETED : AsyncTaskStatus.FAILED
    )
    return
  }
  if (String(templateId) === 'ocr_extract') {
    const dataObj = exec.result.ok ? (exec.result as any).data || {} : {}
    const text = String(dataObj?.extracted_text || '')
    if (exec.result.ok && text) {
      try {
        await updateJobOriginalText(serviceId, text)
      } catch {}
      try {
        const sessionId = String(
          (ctx.variables as any)?.executionSessionId || ''
        )
        const wasPaid = !!(ctx.variables as any)?.wasPaid
        const cost = Number((ctx.variables as any)?.cost || 0)
        const debitId = String((ctx.variables as any)?.debitId || '')
        await pushTask({
          kind: 'batch',
          serviceId,
          taskId: `job_${serviceId}_${sessionId}`,
          userId: ctx.userId,
          locale: ctx.locale,
          templateId: 'job_summary' as any,
          variables: {
            jobId: String((ctx.variables as any)?.jobId || ''),
            wasPaid,
            cost,
            ...(debitId ? { debitId } : {}),
            executionSessionId: sessionId,
          },
        })
        try {
          await updateServiceExecutionStatus(
            serviceId,
            ExecutionStatus.SUMMARY_PENDING,
            {
              executionSessionId: String(
                (ctx.variables as any)?.executionSessionId || ''
              ),
            }
          )
        } catch {}
        try {
          const sessionId = String(
            (ctx.variables as any)?.executionSessionId || ''
          )
          const matchTaskId = buildMatchTaskId(serviceId, sessionId)
          const matchChannel = getChannel(ctx.userId, serviceId, matchTaskId)
          await publishEvent(matchChannel, {
            type: 'status',
            taskId: matchTaskId,
            code: 'summary_pending',
            status: 'SUMMARY_PENDING',
            lastUpdatedAt: new Date().toISOString(),
            stage: 'enqueue',
            requestId: ctx.requestId,
            traceId: ctx.traceId,
          })
        } catch {}
      } catch {}
    } else {
      try {
        await txMarkSummaryFailed(serviceId, 'PREVIOUS_OCR_FAILED' as any)
        const sessionId = String(
          (ctx.variables as any)?.executionSessionId || ''
        )
        const matchTaskId = buildMatchTaskId(serviceId, sessionId)
        const matchChannel = getChannel(ctx.userId, serviceId, matchTaskId)
        try {
          await publishEvent(matchChannel, {
            type: 'status',
            taskId: matchTaskId,
            code: 'summary_failed',
            status: 'SUMMARY_FAILED',
            failureCode: 'PREVIOUS_OCR_FAILED',
            lastUpdatedAt: new Date().toISOString(),
            stage: 'finalize',
            requestId: ctx.requestId,
            traceId: ctx.traceId,
          })
        } catch {}
      } catch {}
    }
    return
  }
  if (String(templateId) === 'job_summary') {
    await setJobSummaryJson(
      serviceId,
      exec.result.ok ? (exec.result as any).data : undefined,
      exec.result.ok ? AsyncTaskStatus.COMPLETED : AsyncTaskStatus.FAILED
    )
    try {
      const rawErr = String((exec.result as any)?.error || '').toLowerCase()
      let failureCode: any = null
      if (!exec.result.ok) {
        if (
          rawErr.includes('max_tokens') ||
          rawErr.includes('context') ||
          rawErr.includes('length') ||
          rawErr.includes('exceed')
        )
          failureCode = 'PREVIOUS_MODEL_LIMIT'
        else if (rawErr.includes('provider_not_configured'))
          failureCode = 'PROVIDER_NOT_CONFIGURED'
        else if (rawErr.includes('zod')) failureCode = 'ZOD_VALIDATION_FAILED'
        else failureCode = 'JSON_PARSE_FAILED'
      }
      if (exec.result.ok) {
        await txMarkSummaryCompleted(serviceId)
      } else {
        await txMarkSummaryFailed(serviceId, failureCode)
        try {
          const sessionId = String(
            (ctx.variables as any)?.executionSessionId || ''
          )
          const matchTaskId = buildMatchTaskId(serviceId, sessionId)
          const matchChannel = getChannel(ctx.userId, serviceId, matchTaskId)
          await publishEvent(matchChannel, {
            type: 'status',
            taskId: matchTaskId,
            code: 'summary_failed',
            status: 'SUMMARY_FAILED',
            failureCode: failureCode ?? null,
            lastUpdatedAt: new Date().toISOString(),
            stage: 'finalize',
            requestId: ctx.requestId,
            traceId: ctx.traceId,
          })
        } catch {}
      }
    } catch {}
    if (exec.result.ok) {
      await updateMatchStatus(serviceId, AsyncTaskStatus.PENDING)
      const sessionId = String((ctx.variables as any)?.executionSessionId || '')
      const matchTaskId = buildMatchTaskId(serviceId, sessionId)
      const matchChannel = getChannel(ctx.userId, serviceId, matchTaskId)
      try {
        await publishEvent(matchChannel, {
          type: 'status',
          taskId: matchTaskId,
          code: 'summary_completed',
          status: 'SUMMARY_COMPLETED',
          lastUpdatedAt: new Date().toISOString(),
          stage: 'finalize',
          requestId: ctx.requestId,
          traceId: ctx.traceId,
        })
      } catch (err) {
        logCtxError(
          ctx.requestId,
          'worker/batch',
          err,
          'publish_summary_completed_failed',
          serviceId,
          templateId
        )
      }
      try {
        const svc = await getServiceWithContextReadOnly(serviceId)
        const wasPaid = !!(ctx.variables as any)?.wasPaid
        const cost = Number((ctx.variables as any)?.cost || 0)
        const debitId = String((ctx.variables as any)?.debitId || '')
        const idemNonce = `${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 8)}`
        await pushTask({
          kind: 'stream',
          serviceId,
          taskId: matchTaskId,
          userId: ctx.userId,
          locale: ctx.locale,
          templateId: 'job_match' as any,
          variables: {
            rag_context: '',
            resumeId: svc?.resume?.id || '',
            ...(svc?.detailedResume?.id
              ? { detailedResumeId: svc?.detailedResume?.id }
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
        try {
          await updateServiceExecutionStatus(
            serviceId,
            ExecutionStatus.MATCH_PENDING
          )
        } catch {}
      } catch (err) {
        logCtxError(
          ctx.requestId,
          'worker/batch',
          err,
          'enqueue_match_failed',
          serviceId,
          templateId
        )
      }
    }
    return
  }
}

async function markAssetFailedIfNeeded(
  templateId: TaskTemplateId,
  variables: Record<string, any>,
  serviceId: string
) {
  if (String(templateId) === 'job_summary') {
    await updateJobStatus(serviceId, AsyncTaskStatus.FAILED)
    return
  }
  if (String(templateId) === 'resume_customize') return
  if (String(templateId) === 'resume_summary') {
    const resumeId = (variables as any)['resumeId']
    if (resumeId) {
      await updateResumeStatus(String(resumeId), AsyncTaskStatus.FAILED)
    }
    return
  }
  if (String(templateId) === 'detailed_resume_summary') {
    const detailedId = (variables as any)['detailedResumeId']
    if (detailedId) {
      await updateDetailedResumeStatus(
        String(detailedId),
        AsyncTaskStatus.FAILED
      )
    }
    return
  }
  if (String(templateId) === 'job_match') {
    return
  }
}

async function handleRefunds(
  exec: any,
  variables: Record<string, any>,
  ledgerServiceId: string | undefined,
  templateId: TaskTemplateId,
  userId: string
) {
  const wasPaid = !!(variables as any)?.wasPaid
  const cost = Number((variables as any)?.cost || 0)
  const debitId = String((variables as any)?.debitId || '')
  const usageLogId = (exec.result as any)?.usageLogId
  const shouldRefund = !exec.result.ok && wasPaid && cost > 0 && !!debitId
  if (shouldRefund) {
    try {
      await recordRefund({
        userId,
        amount: cost,
        relatedId: debitId,
        ...(ledgerServiceId ? { serviceId: ledgerServiceId } : {}),
        ...(usageLogId ? { taskId: usageLogId } : {}),
        templateId,
      })
    } catch {}
    try {
      await markDebitSuccess(debitId, usageLogId)
    } catch {}
    return
  }
  if (exec.result.ok && wasPaid && cost > 0 && debitId) {
    try {
      await markDebitSuccess(debitId, usageLogId)
    } catch {}
  }
}

function logCtxError(
  requestId: string,
  route: string,
  error: any,
  phase: string,
  serviceId: string,
  templateId: any
) {
  logError({
    reqId: requestId,
    route,
    error: String(error),
    phase,
    serviceId,
    templateId,
  })
}

async function standardizeLogCode(usageLogId: string, rawMsg: string) {
  const msg = String(rawMsg || '').toLowerCase()
  let code = 'llm_error'
  if (
    msg.includes('max_tokens') ||
    msg.includes('invalid max_tokens') ||
    msg.includes('context') ||
    msg.includes('length') ||
    msg.includes('exceed')
  )
    code = 'previous_model_limit'
  else if (msg.includes('json_parse_failed')) code = 'json_parse_failed'
  else if (msg.includes('zod_validation_failed')) code = 'zod_validation_failed'
  else if (msg.includes('provider_not_configured'))
    code = 'provider_not_configured'
  try {
    await prisma.llmUsageLog.update({
      where: { id: usageLogId },
      data: {
        errorMessage: code,
        errorCode:
          code === 'previous_model_limit'
            ? ('PREVIOUS_MODEL_LIMIT' as any)
            : code === 'json_parse_failed'
            ? ('JSON_PARSE_FAILED' as any)
            : code === 'zod_validation_failed'
            ? ('ZOD_VALIDATION_FAILED' as any)
            : code === 'provider_not_configured'
            ? ('PROVIDER_NOT_CONFIGURED' as any)
            : null,
        isSuccess: false,
      },
    })
  } catch {}
}

// 解析并写回流式任务结果（job_match / interview_prep）
export async function streamWriteResults(
  templateId: TaskTemplateId,
  serviceId: string,
  exec: any,
  variables: Record<string, any>,
  userId: string,
  requestId: string
) {
  if (String(templateId) === 'job_match') {
    const raw = String((exec.result as any)?.raw || '')
    let parsed: any = null
    const validated = validateJson<any>(raw, {
      debug: { reqId: requestId, route: 'worker/stream' },
      enableFallback: true,
      maxAttempts: 4,
    })
    if (validated.success) parsed = validated.data
    else {
      logCtxError(
        requestId,
        'worker/stream',
        new Error(String(validated.error || 'json_parse_failed')),
        'parse_match_json_failed',
        serviceId,
        templateId
      )
    }
    if (parsed && typeof parsed === 'object') {
      try {
        const schema = getTaskSchema('job_match' as any)
        const safe = schema.safeParse(parsed)
        if (!safe.success) {
          await setMatchSummaryJson(
            serviceId,
            { markdown: raw },
            AsyncTaskStatus.FAILED
          )
          try {
            await txMarkMatchFailed(serviceId, 'ZOD_VALIDATION_FAILED' as any)
            try {
              const issues: any[] =
                ((safe as any)?.error?.issues as any[]) || []
              const sessionId = String(
                (variables as any)?.executionSessionId || ''
              )
              const matchTaskId = buildMatchTaskId(serviceId, sessionId)
              const matchChannel = getChannel(userId, serviceId, matchTaskId)
              await publishEvent(matchChannel, {
                type: 'info',
                taskId: matchTaskId,
                code: 'zod_failed',
                message: JSON.stringify(issues),
                stage: 'finalize',
                requestId,
                traceId: String((exec.result as any)?.usageLogId || ''),
              } as any)
              logError({
                reqId: requestId,
                route: 'worker/stream',
                userKey: userId,
                error: 'ZOD_VALIDATION_FAILED',
                details: JSON.stringify({ issues, raw }),
                serviceId,
                templateId: 'job_match',
              })
            } catch {}
            try {
              const sessionId = String(
                (variables as any)?.executionSessionId || ''
              )
              const matchTaskId = buildMatchTaskId(serviceId, sessionId)
              const matchChannel = getChannel(userId, serviceId, matchTaskId)
              await publishEvent(matchChannel, {
                type: 'status',
                taskId: matchTaskId,
                code: 'match_failed',
                status: 'MATCH_FAILED',
                lastUpdatedAt: new Date().toISOString(),
                stage: 'finalize',
                requestId,
                traceId: String((exec.result as any)?.usageLogId || ''),
              })
            } catch {}
          } catch {}
          return
        }
        parsed = safe.data
      } catch {}
      await setMatchSummaryJson(serviceId, parsed, AsyncTaskStatus.COMPLETED)
      try {
        await txMarkMatchCompleted(serviceId)
        try {
          const sessionId = String((variables as any)?.executionSessionId || '')
          const matchTaskId = buildMatchTaskId(serviceId, sessionId)
          const matchChannel = getChannel(userId, serviceId, matchTaskId)
          await publishEvent(matchChannel, {
            type: 'status',
            taskId: matchTaskId,
            code: 'match_completed',
            status: 'MATCH_COMPLETED',
            lastUpdatedAt: new Date().toISOString(),
            stage: 'finalize',
            requestId,
            traceId: String((exec.result as any)?.usageLogId || ''),
          })
        } catch {}
      } catch {}
    } else {
      await setMatchSummaryJson(
        serviceId,
        { markdown: raw },
        AsyncTaskStatus.FAILED
      )
      try {
        await txMarkMatchFailed(serviceId, 'JSON_PARSE_FAILED' as any)
        try {
          const sessionId = String((variables as any)?.executionSessionId || '')
          const matchTaskId = buildMatchTaskId(serviceId, sessionId)
          const matchChannel = getChannel(userId, serviceId, matchTaskId)
          await publishEvent(matchChannel, {
            type: 'status',
            taskId: matchTaskId,
            code: 'match_failed',
            status: 'MATCH_FAILED',
            lastUpdatedAt: new Date().toISOString(),
            stage: 'finalize',
            requestId,
            traceId: String((exec.result as any)?.usageLogId || ''),
          })
        } catch {}
      } catch {}
    }
    return
  }
  if (String(templateId) === 'interview_prep') {
    const raw = String((exec.result as any)?.raw || '')
    let parsed: any = null
    try {
      parsed = JSON.parse(raw)
    } catch (err) {
      logCtxError(
        requestId,
        'worker/stream',
        err,
        'parse_interview_json_failed',
        serviceId,
        templateId
      )
    }
    await setInterviewTipsJson(
      serviceId,
      parsed || { markdown: raw },
      'COMPLETED' as any
    )
    return
  }
}

function buildMatchTaskId(serviceId: string, sessionId?: string) {
  return sessionId ? `match_${serviceId}_${sessionId}` : `match_${serviceId}`
}

// 成功/失败的交易处理（退款或成功标记），仅针对流式任务
export async function streamHandleTransactions(
  templateId: TaskTemplateId,
  exec: any,
  variables: Record<string, any>,
  ledgerServiceId: string | undefined,
  userId: string,
  requestId: string
) {
  if (String(templateId) !== 'job_match') {
    const wasPaid = !!(variables as any)?.wasPaid
    const cost = Number((variables as any)?.cost || 0)
    const debitId = String((variables as any)?.debitId || '')
    if (wasPaid && cost > 0 && debitId) {
      try {
        await markDebitSuccess(debitId, (exec.result as any)?.usageLogId)
      } catch {}
    }
    return
  }
  // job_match：若写回为失败（JSON 解析失败），需退款；否则标记成功
  const raw = String((exec.result as any)?.raw || '')
  let parsed: any = null
  try {
    parsed = JSON.parse(raw)
  } catch {}
  const wasPaid = !!(variables as any)?.wasPaid
  const cost = Number((variables as any)?.cost || 0)
  const debitId = String((variables as any)?.debitId || '')
  if (!parsed || typeof parsed !== 'object') {
    if (wasPaid && cost > 0 && debitId) {
      try {
        await recordRefund({
          userId,
          amount: cost,
          relatedId: debitId,
          ...(ledgerServiceId ? { serviceId: ledgerServiceId } : {}),
          templateId: templateId as any,
        })
      } catch (err) {
        logCtxError(
          requestId,
          'worker/stream',
          err,
          'refund_failed',
          String((variables as any)?.serviceId || ''),
          templateId
        )
      }
    }
    return
  }
  if (wasPaid && cost > 0 && debitId) {
    try {
      await markDebitSuccess(debitId, (exec.result as any)?.usageLogId)
    } catch {}
  }
}
