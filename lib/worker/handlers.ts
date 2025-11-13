import { ENV } from '@/lib/env'
import {
  parseWorkerBody,
  getUserHasQuota,
  hasImage,
  getTtlSec,
  buildQueueCounterKey,
  getChannel,
  enterGuards,
  exitGuards,
  publishEvent,
  enterModelConcurrency,
  exitModelConcurrency,
  enterUserConcurrency,
  exitUserConcurrency,
  requeueWithDelay,
  getMaxTotalWaitMs,
} from '@/lib/worker/common'
import { getTaskRouting, getJobVisionTaskRouting } from '@/lib/llm/task-router'
import type { TaskTemplateId } from '@/lib/prompts/types'
import { runStreamingLlmTask, runStructuredLlmTask } from '@/lib/llm/service'
import { createLlmUsageLogDetailed } from '@/lib/dal/llmUsageLog'
import { getProvider, getCost } from '@/lib/llm/utils'
import { ENV as _ENV } from '@/lib/env'
import { withRequestSampling } from '@/lib/dev/redisSampler'
import { trackEvent } from '@/lib/analytics/index'
import { addQuota } from '@/lib/dal/quotas'
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

export async function handleStream(req: Request, params: { service: string }): Promise<Response> {
  return withRequestSampling('/api/worker/stream/[service]', 'POST', async () => {
    const { service } = params
    const parsed = await parseWorkerBody(req)
    if (!parsed.ok) return parsed.response
    const body: Body = parsed.body as Body

    const { taskId, userId, serviceId, locale, templateId, variables } = body
    const tierOverride = (variables as any)?.tierOverride
    const userHasQuota = tierOverride === 'paid'
      ? true
      : tierOverride === 'free'
      ? false
      : typeof (variables as any)?.wasPaid === 'boolean'
      ? Boolean((variables as any)?.wasPaid)
      : await getUserHasQuota(userId)
    const decision = hasImage(variables)
      ? getJobVisionTaskRouting(userHasQuota)
      : getTaskRouting(templateId, userHasQuota)

    trackEvent('TASK_ROUTED', {
      userId,
      serviceId,
      taskId,
      payload: { templateId, modelId: decision.modelId, isStream: true, queueId: String(decision.queueId || '') },
    })

    const ttlSec = getTtlSec()
    const counterKey = buildQueueCounterKey(String(decision.queueId))
    const channel = getChannel(userId, serviceId, taskId)
    const headers = new Headers(req.headers)
    const requestId = headers.get('x-request-id') || headers.get('x-vercel-id') || (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`)
    const traceparent = headers.get('traceparent') || ''
    const traceId = (traceparent && traceparent.split('-')[1]) || headers.get('x-trace-id') || taskId

    await publishEvent(channel, {
      type: 'start',
      taskId,
      provider: getProvider(decision.modelId),
      modelId: decision.modelId,
      queueId: String(decision.queueId || ''),
      stage: 'guards',
      timeoutSec: Math.ceil(ENV.WORKER_TIMEOUT_MS / 1000),
      requestId,
      traceId,
    })

    const userGate = await enterUserConcurrency(userId, 'stream', ttlSec)
    if (!userGate.ok) {
      const retryAfter = userGate.response.headers.get('Retry-After')
      const enq = Number((body as any).enqueuedAt || Date.now())
      const maxWait = getMaxTotalWaitMs('stream')
      await publishEvent(channel, {
        type: 'error',
        taskId,
        code: 'user_concurrency',
        error: 'user_concurrency',
        stage: 'guards',
        ...(retryAfter ? { retryAfter: Number(retryAfter) } : {}),
        requestId,
        traceId,
      })
      trackEvent('WORKER_GUARDS_BLOCKED', {
        userId,
        serviceId,
        taskId,
        payload: { reason: 'user_concurrency', retryAfter: retryAfter ? Number(retryAfter) : undefined, kind: 'stream' },
      })
      if (Date.now() - enq >= maxWait) {
        await publishEvent(channel, { type: 'error', taskId, code: 'wait_timeout', error: 'wait_timeout', stage: 'guards', requestId, traceId })
        return Response.json({ ok: false, reason: 'wait_timeout' })
      }
      await requeueWithDelay('stream', service, body as any, Number(retryAfter || ttlSec))
      return Response.json({ ok: false, requeued: true })
    }

    const modelGate = await enterModelConcurrency(decision.modelId, String(decision.queueId), ttlSec)
    if (!modelGate.ok) {
      const retryAfter = modelGate.response.headers.get('Retry-After')
      const enq = Number((body as any).enqueuedAt || Date.now())
      const maxWait = getMaxTotalWaitMs('stream')
      await publishEvent(channel, {
        type: 'error',
        taskId,
        code: 'model_concurrency',
        error: 'model_concurrency',
        stage: 'guards',
        ...(retryAfter ? { retryAfter: Number(retryAfter) } : {}),
        requestId,
        traceId,
      })
      trackEvent('WORKER_GUARDS_BLOCKED', {
        userId,
        serviceId,
        taskId,
        payload: { reason: 'model_concurrency', retryAfter: retryAfter ? Number(retryAfter) : undefined, kind: 'stream' },
      })
      if (Date.now() - enq >= maxWait) {
        await publishEvent(channel, { type: 'error', taskId, code: 'wait_timeout', error: 'wait_timeout', stage: 'guards', requestId, traceId })
        return Response.json({ ok: false, reason: 'wait_timeout' })
      }
      await requeueWithDelay('stream', service, body as any, Number(retryAfter || ttlSec))
      return Response.json({ ok: false, requeued: true })
    }

    const guards = await enterGuards(userId, 'stream', counterKey, ttlSec, ENV.QUEUE_MAX_SIZE, false)
    if (!guards.ok) {
      let reason = 'guard_failed'
      try { reason = await guards.response.text() } catch {}
      const retryAfter = guards.response.headers.get('Retry-After')
      const enq = Number((body as any).enqueuedAt || Date.now())
      const maxWait = getMaxTotalWaitMs('stream')
      await publishEvent(channel, {
        type: 'error',
        taskId,
        code: reason === 'concurrency_locked' ? 'concurrency_locked' : reason === 'backpressure' ? 'backpressure' : 'guards_failed',
        error: reason,
        stage: 'guards',
        ...(retryAfter ? { retryAfter: Number(retryAfter) } : {}),
        requestId,
        traceId,
      })
      trackEvent('WORKER_GUARDS_BLOCKED', {
        userId,
        serviceId,
        taskId,
        payload: { reason, retryAfter: retryAfter ? Number(retryAfter) : undefined, kind: 'stream' },
      })
      if (Date.now() - enq >= maxWait) {
        await publishEvent(channel, { type: 'error', taskId, code: 'wait_timeout', error: 'wait_timeout', stage: 'guards', requestId, traceId })
        return Response.json({ ok: false, reason: 'wait_timeout' })
      }
      await requeueWithDelay('stream', service, body as any, Number(retryAfter || ttlSec))
      return Response.json({ ok: false, requeued: true })
    }

    try {
      const provider = getProvider(decision.modelId)
      const providerReady = provider === 'zhipu' ? !!_ENV.ZHIPUAI_API_KEY : !!_ENV.DEEPSEEK_API_KEY
      if (!providerReady) {
        await publishEvent(channel, { type: 'error', taskId, error: provider === 'zhipu' ? 'Zhipu API key not configured' : 'DeepSeek API key not configured', code: 'provider_not_configured', requestId, traceId })
        const wasPaid = !!(variables as any)?.wasPaid
        const cost = Number((variables as any)?.cost || 0)
        if (wasPaid && cost > 0) {
          try { await addQuota(userId, cost) } catch {}
        }
        trackEvent('WORKER_PROVIDER_NOT_CONFIGURED', {
          userId,
          serviceId,
          taskId,
          payload: { provider, modelId: decision.modelId, kind: 'stream' },
        })
        return Response.json({ ok: false, reason: 'provider_not_configured' })
      }

      const start = Date.now()
      const result = await runStreamingLlmTask(decision.modelId, templateId, locale as any, variables, { userId, serviceId }, async (text) => {
        await publishEvent(channel, { type: 'token', taskId, text, stage: 'stream', requestId, traceId })
      })
      const end = Date.now()
      await publishEvent(channel, { type: 'done', taskId, text: String((result as any)?.raw || ''), usage: { inputTokens: Number((result as any)?.usage?.inputTokens || 0), outputTokens: Number((result as any)?.usage?.outputTokens || 0) }, latencyMs: end - start, stage: 'finalize', requestId, traceId })
      trackEvent('TASK_COMPLETED', { userId, serviceId, taskId, payload: { templateId, provider: getProvider(decision.modelId), modelId: decision.modelId, inputTokens: Number((result as any)?.usage?.inputTokens || 0), outputTokens: Number((result as any)?.usage?.outputTokens || 0), latencyMs: end - start, isStream: true } })
      return Response.json({ ok: true })
    } catch (error) {
      if (ENV.LLM_DEBUG) {
        const err = error as any
        console.debug('[LLM_DEBUG][worker.stream] error caught', { name: err?.name, message: err?.message, code: err?.code })
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
      trackEvent('TASK_FAILED', {
        userId,
        serviceId,
        taskId,
        payload: {
          templateId,
          provider: getProvider(decision.modelId),
          modelId: decision.modelId,
          isStream: true,
          error: error instanceof Error ? error.message : String(error),
          code: (error as any)?.code || 'llm_error',
        },
      })
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
        try { await addQuota(userId, cost) } catch {}
      }
      return new Response('internal_error', { status: 500 })
    } finally {
      await exitModelConcurrency(decision.modelId, String(decision.queueId))
      await exitUserConcurrency(userId, 'stream')
      await exitGuards(userId, 'stream', counterKey)
    }
  })
}

export async function handleBatch(req: Request, params: { service: string }): Promise<Response> {
  return withRequestSampling('/api/worker/batch/[service]', 'POST', async () => {
    const { service } = params
    const parsed = await parseWorkerBody(req)
    if (!parsed.ok) return parsed.response
    const body: Body = parsed.body as Body

    const { taskId, userId, serviceId, locale, templateId, variables } = body
    const tierOverride = (variables as any)?.tierOverride
    const userHasQuota = tierOverride === 'paid'
      ? true
      : tierOverride === 'free'
      ? false
      : typeof (variables as any)?.wasPaid === 'boolean'
      ? Boolean((variables as any)?.wasPaid)
      : await getUserHasQuota(userId)
    const decision = hasImage(variables)
      ? getJobVisionTaskRouting(userHasQuota)
      : getTaskRouting(templateId, userHasQuota)
    const ttlSec = getTtlSec()
    const counterKey = buildQueueCounterKey(String(decision.queueId))
    const channel = getChannel(userId, serviceId, taskId)
    const headers = new Headers(req.headers)
    const requestId = headers.get('x-request-id') || headers.get('x-vercel-id') || (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`)
    const traceparent = headers.get('traceparent') || ''
    const traceId = (traceparent && traceparent.split('-')[1]) || headers.get('x-trace-id') || taskId

    await publishEvent(channel, {
      type: 'start',
      taskId,
      provider: getProvider(decision.modelId),
      modelId: decision.modelId,
      queueId: String(decision.queueId || ''),
      stage: 'guards',
      timeoutSec: Math.ceil(ENV.WORKER_TIMEOUT_MS / 1000),
      requestId,
      traceId,
    })
    const userGate = await enterUserConcurrency(userId, 'batch', ttlSec)
    if (!userGate.ok) {
      const retryAfter = userGate.response.headers.get('Retry-After')
      const enq = Number((body as any).enqueuedAt || Date.now())
      const maxWait = getMaxTotalWaitMs('batch')
      await publishEvent(channel, {
        type: 'error',
        taskId,
        code: 'user_concurrency',
        error: 'user_concurrency',
        stage: 'guards',
        ...(retryAfter ? { retryAfter: Number(retryAfter) } : {}),
        requestId,
        traceId,
      })
      trackEvent('WORKER_GUARDS_BLOCKED', {
        userId,
        serviceId,
        taskId,
        payload: { reason: 'user_concurrency', retryAfter: retryAfter ? Number(retryAfter) : undefined, kind: 'batch' },
      })
      if (Date.now() - enq >= maxWait) {
        await publishEvent(channel, { type: 'error', taskId, code: 'wait_timeout', error: 'wait_timeout', stage: 'guards', requestId, traceId })
        return Response.json({ ok: false, reason: 'wait_timeout' })
      }
      await requeueWithDelay('batch', service, body as any, Number(retryAfter || ttlSec))
      return Response.json({ ok: false, requeued: true })
    }

    const modelGate = await enterModelConcurrency(decision.modelId, String(decision.queueId), ttlSec)
    if (!modelGate.ok) {
      const retryAfter = modelGate.response.headers.get('Retry-After')
      const enq = Number((body as any).enqueuedAt || Date.now())
      const maxWait = getMaxTotalWaitMs('batch')
      await publishEvent(channel, {
        type: 'error',
        taskId,
        code: 'model_concurrency',
        error: 'model_concurrency',
        stage: 'guards',
        ...(retryAfter ? { retryAfter: Number(retryAfter) } : {}),
        requestId,
        traceId,
      })
      trackEvent('WORKER_GUARDS_BLOCKED', {
        userId,
        serviceId,
        taskId,
        payload: { reason: 'model_concurrency', retryAfter: retryAfter ? Number(retryAfter) : undefined, kind: 'batch' },
      })
      if (Date.now() - enq >= maxWait) {
        await publishEvent(channel, { type: 'error', taskId, code: 'wait_timeout', error: 'wait_timeout', stage: 'guards', requestId, traceId })
        return Response.json({ ok: false, reason: 'wait_timeout' })
      }
      await requeueWithDelay('batch', service, body as any, Number(retryAfter || ttlSec))
      return Response.json({ ok: false, requeued: true })
    }

    const guards = await enterGuards(userId, 'batch', counterKey, ttlSec, ENV.QUEUE_MAX_SIZE, false)
    if (!guards.ok) {
      let reason = 'guard_failed'
      try { reason = await guards.response.text() } catch {}
      const retryAfter = guards.response.headers.get('Retry-After')
      const enq = Number((body as any).enqueuedAt || Date.now())
      const maxWait = getMaxTotalWaitMs('batch')
      await publishEvent(channel, {
        type: 'error',
        taskId,
        code: reason === 'concurrency_locked' ? 'concurrency_locked' : reason === 'backpressure' ? 'backpressure' : 'guards_failed',
        error: reason,
        stage: 'guards',
        ...(retryAfter ? { retryAfter: Number(retryAfter) } : {}),
        requestId,
        traceId,
      })
      trackEvent('WORKER_GUARDS_BLOCKED', {
        userId,
        serviceId,
        taskId,
        payload: { reason, retryAfter: retryAfter ? Number(retryAfter) : undefined, kind: 'batch' },
      })
      if (Date.now() - enq >= maxWait) {
        await publishEvent(channel, { type: 'error', taskId, code: 'wait_timeout', error: 'wait_timeout', stage: 'guards', requestId, traceId })
        return Response.json({ ok: false, reason: 'wait_timeout' })
      }
      await requeueWithDelay('batch', service, body as any, Number(retryAfter || ttlSec))
      return Response.json({ ok: false, requeued: true })
    }

    try {
      trackEvent('TASK_ROUTED', {
        userId,
        serviceId,
        taskId,
        payload: { templateId, modelId: decision.modelId, isStream: false, queueId: String(decision.queueId || '') },
      })
      const start = Date.now()
      const result = await runStructuredLlmTask(decision.modelId, templateId, locale, variables, { userId, serviceId })
      const end = Date.now()
      const inputTokens = Number(result.usage?.inputTokens ?? 0)
      const outputTokens = Number(result.usage?.outputTokens ?? 0)
      await publishEvent(channel, { type: 'done', taskId, data: result, stage: 'finalize', requestId, traceId })
      await createLlmUsageLogDetailed({
        taskTemplateId: templateId,
        provider: getProvider(decision.modelId),
        modelId: decision.modelId,
        inputTokens,
        outputTokens,
        latencyMs: end - start,
        cost: getCost(decision.modelId, inputTokens, outputTokens),
        isStream: false,
        isSuccess: !!result.ok,
        userId,
        serviceId,
        ...(result.ok ? {} : { errorMessage: result.error ?? 'unknown_error' }),
      })
      trackEvent(result.ok ? 'TASK_COMPLETED' : 'TASK_FAILED', {
        userId,
        serviceId,
        taskId,
        payload: {
          templateId,
          provider: getProvider(decision.modelId),
          modelId: decision.modelId,
          inputTokens,
          outputTokens,
          latencyMs: end - start,
          isStream: false,
          ...(result.ok ? {} : { error: result.error ?? 'unknown_error', code: 'structured_error' }),
        },
      })
      return Response.json({ ok: result.ok })
    } catch (error) {
      await publishEvent(channel, { type: 'error', taskId, code: (error as any)?.code || 'llm_error', error: error instanceof Error ? error.message : 'unknown_error', stage: 'invoke', requestId, traceId })
      trackEvent('TASK_FAILED', {
        userId,
        serviceId,
        taskId,
        payload: {
          templateId,
          isStream: false,
          error: error instanceof Error ? error.message : String(error),
          code: (error as any)?.code || 'llm_error',
        },
      })
      try {
        if (String(templateId) === 'job_summary') {
          await updateJobStatus(serviceId, 'FAILED' as any)
          await updateMatchStatus(serviceId, 'FAILED' as any)
        } else if (String(templateId) === 'resume_customize') {
          await updateCustomizedResumeStatus(serviceId, 'FAILED' as any)
        }
      } catch {}
      const wasPaid = !!(variables as any)?.wasPaid
      const cost = Number((variables as any)?.cost || 0)
      if (wasPaid && cost > 0) {
        try { await addQuota(userId, cost) } catch {}
      }
      return new Response('internal_error', { status: 500 })
    } finally {
      await exitModelConcurrency(decision.modelId, String(decision.queueId))
      await exitUserConcurrency(userId, 'batch')
      await exitGuards(userId, 'batch', counterKey)
    }
  })
}