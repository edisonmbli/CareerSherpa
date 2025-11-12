import { verifySignatureAppRouter } from '@upstash/qstash/nextjs'
import { ENV } from '@/lib/env'
import {
  parseWorkerBody,
  getUserHasQuota,
  hasImage,
  getTtlSec,
  buildCounterKey,
  getChannel,
  enterGuards,
  exitGuards,
  publishEvent,
} from '@/lib/worker/common'
import { getTaskRouting, getJobVisionTaskRouting } from '@/lib/llm/task-router'
import { getTemplate } from '@/lib/prompts/index'
import type { TaskTemplateId } from '@/lib/prompts/types'
import { ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate } from '@langchain/core/prompts'
import { getModel } from '@/lib/llm/providers'
import { createLlmUsageLogDetailed } from '@/lib/dal/llmUsageLog'
import { getProvider, getCost } from '@/lib/llm/utils'
import { ENV as _ENV } from '@/lib/env'
import { withRequestSampling } from '@/lib/dev/redisSampler'

type Body = {
  taskId: string
  userId: string
  serviceId: string
  locale: any
  templateId: TaskTemplateId
  variables: Record<string, any>
}

const handler = verifySignatureAppRouter(async (req: Request, { params }: { params: Promise<{ service: string }> }) => {
  return withRequestSampling('/api/worker/stream/[service]', 'POST', async () => {
  const { service } = await params
  const parsed = await parseWorkerBody(req)
  if (!parsed.ok) return parsed.response
  const body: Body = parsed.body as Body

  const { taskId, userId, serviceId, locale, templateId, variables } = body
  // 决策模型：接入真实配额判定
  const userHasQuota = await getUserHasQuota(userId)
  const decision = hasImage(variables)
    ? getJobVisionTaskRouting(userHasQuota)
    : getTaskRouting(templateId, userHasQuota)

  const ttlSec = getTtlSec()
  const counterKey = buildCounterKey(userId, serviceId)
  const channel = getChannel(userId, serviceId, taskId)
  // 提取/生成 requestId 与 traceId，串联到事件，便于日志联动
  const headers = new Headers(req.headers)
  const requestId = headers.get('x-request-id') || headers.get('x-vercel-id') || (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`)
  const traceparent = headers.get('traceparent') || ''
  const traceId = (traceparent && traceparent.split('-')[1]) || headers.get('x-trace-id') || taskId
  // 预发布 start 事件，便于定位阶段与超时参数
  await publishEvent(channel, {
    type: 'start',
    taskId,
    provider: getProvider(decision.modelId),
    modelId: decision.modelId,
    stage: 'guards',
    timeoutSec: Math.ceil(ENV.WORKER_TIMEOUT_MS / 1000),
    requestId,
    traceId,
  })
  const guards = await enterGuards(userId, 'stream', counterKey, ttlSec, ENV.QUEUE_MAX_SIZE)
  if (!guards.ok) {
    let reason = 'guard_failed'
    try { reason = await guards.response.text() } catch {}
    const retryAfter = guards.response.headers.get('Retry-After')
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
    // 返回 200，避免 QStash 重试导致重复错误
    return Response.json({ ok: false, reason }, { status: 200 })
  }

  try {
    // Provider readiness pre-check to avoid repeated retries when API keys are missing
    const provider = getProvider(decision.modelId)
    const providerReady = provider === 'zhipu' ? !!_ENV.ZHIPUAI_API_KEY : !!_ENV.DEEPSEEK_API_KEY
    if (!providerReady) {
      await publishEvent(channel, { type: 'error', taskId, error: provider === 'zhipu' ? 'Zhipu API key not configured' : 'DeepSeek API key not configured', code: 'provider_not_configured', requestId, traceId })
      // Return 200 to prevent QStash from retrying and spamming duplicate errors
      return Response.json({ ok: false, reason: 'provider_not_configured' })
    }

    const template = getTemplate(locale, templateId)
    const prompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(template.systemPrompt),
      HumanMessagePromptTemplate.fromTemplate(template.userPrompt),
    ])
    const providerForDebug = getProvider(decision.modelId)
    const timeoutForDebug = ENV.WORKER_TIMEOUT_MS
    if (ENV.LLM_DEBUG) {
      // 在事件通道和服务器日志中输出一次详细的调用上下文（不包含敏感信息）
      const varsPreview = (() => {
        try { return JSON.stringify(variables).slice(0, 512) } catch { return '[unserializable]' }
      })()
      console.debug('[LLM_DEBUG][worker.stream] preparing model', {
        modelId: decision.modelId,
        provider: providerForDebug,
        timeoutMs: timeoutForDebug,
        variablesKeys: Object.keys(variables ?? {}),
        variablesPreview: varsPreview,
      })
      await publishEvent(channel, {
        type: 'debug',
        taskId,
        stage: 'invoke_or_stream_start',
        provider: providerForDebug,
        modelId: decision.modelId,
        timeoutMs: timeoutForDebug,
        varsPreview,
        requestId,
        traceId,
      } as any)
    }
    const model = getModel(decision.modelId, { temperature: 0.3, timeoutMs: timeoutForDebug })
    const chain = prompt.pipe(model)

    const start = Date.now()
    let stream
    try {
      stream = await chain.stream(variables)
    } catch (e) {
      // 早期 invoke 错误（如网络/认证/超时）在此捕获并抛给上层
      if (ENV.LLM_DEBUG) {
        const err = e as any
        console.debug('[LLM_DEBUG][worker.stream] invoke failed', { name: err?.name, message: err?.message, code: err?.code })
        await publishEvent(channel, {
          type: 'debug',
          taskId,
          stage: 'invoke_failed',
          provider: providerForDebug,
          modelId: decision.modelId,
          errorName: err?.name,
          errorMessage: err?.message,
          errorCode: err?.code,
          requestId,
          traceId,
        } as any)
      }
      throw e
    }
    let full = ''
    for await (const chunk of stream) {
      const text = (chunk as any)?.content ?? (chunk as any)?.text ?? ''
      if (text) {
        full += text
        await publishEvent(channel, { type: 'token', taskId, text, stage: 'stream', requestId, traceId })
      }
    }
    const end = Date.now()

    // 提交完成事件与用量日志（尽力而为）
    let inputTokens = 0
    let outputTokens = 0
    try {
      const u = (model as any)?.lc_serializable?.tokenUsage || (model as any)?.tokenUsage
      inputTokens = Number(u?.promptTokens ?? u?.prompt_tokens ?? u?.input_tokens ?? 0) || 0
      outputTokens = Number(u?.completionTokens ?? u?.completion_tokens ?? u?.output_tokens ?? 0) || 0
    } catch {}

    await publishEvent(channel, { type: 'done', taskId, text: full, usage: { inputTokens, outputTokens }, latencyMs: end - start, stage: 'finalize', requestId, traceId })
    if (ENV.LLM_DEBUG) {
      await publishEvent(channel, {
        type: 'debug',
        taskId,
        stage: 'finalize_debug',
        provider: providerForDebug,
        modelId: decision.modelId,
        latencyMs: end - start,
        inputTokens,
        outputTokens,
        requestId,
        traceId,
      } as any)
      console.debug('[LLM_DEBUG][worker.stream] finalize', { latencyMs: end - start, inputTokens, outputTokens })
    }

    await createLlmUsageLogDetailed({
      taskTemplateId: templateId,
      provider: getProvider(decision.modelId),
      modelId: decision.modelId,
      inputTokens,
      outputTokens,
      latencyMs: end - start,
      cost: getCost(decision.modelId, inputTokens, outputTokens),
      isStream: true,
      isSuccess: true,
      userId,
      serviceId,
    })

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
    return new Response('internal_error', { status: 500 })
  } finally {
    await exitGuards(userId, 'stream', counterKey)
  }
  })
}, {
  currentSigningKey: ENV.QSTASH_CURRENT_SIGNING_KEY,
  nextSigningKey: ENV.QSTASH_NEXT_SIGNING_KEY,
})

export { handler as POST }