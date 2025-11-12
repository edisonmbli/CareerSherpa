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
import { runStructuredLlmTask } from '@/lib/llm/service'
import { createLlmUsageLogDetailed } from '@/lib/dal/llmUsageLog'
import { getProvider, getCost } from '@/lib/llm/utils'
import type { TaskTemplateId } from '@/lib/prompts/types'
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
  return withRequestSampling('/api/worker/batch/[service]', 'POST', async () => {
  const { service } = await params
  const parsed = await parseWorkerBody(req)
  if (!parsed.ok) return parsed.response
  const body: Body = parsed.body as Body

  const { taskId, userId, serviceId, locale, templateId, variables } = body
  const ttlSec = getTtlSec()
  const counterKey = buildCounterKey(userId, serviceId)
  const channel = getChannel(userId, serviceId, taskId)
  // 提取/生成 requestId 与 traceId，串联到事件
  const headers = new Headers(req.headers)
  const requestId = headers.get('x-request-id') || headers.get('x-vercel-id') || (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`)
  const traceparent = headers.get('traceparent') || ''
  const traceId = (traceparent && traceparent.split('-')[1]) || headers.get('x-trace-id') || taskId
  // 预发布 start 事件，便于定位阶段与超时参数
  await publishEvent(channel, {
    type: 'start',
    taskId,
    stage: 'guards',
    timeoutSec: Math.ceil(ENV.WORKER_TIMEOUT_MS / 1000),
    requestId,
    traceId,
  })
  const guards = await enterGuards(userId, 'batch', counterKey, ttlSec, ENV.QUEUE_MAX_SIZE)
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
    return Response.json({ ok: false, reason }, { status: 200 })
  }

  try {
    const userHasQuota = await getUserHasQuota(userId)
    const decision = hasImage(variables)
      ? getJobVisionTaskRouting(userHasQuota)
      : getTaskRouting(templateId, userHasQuota)
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

    return Response.json({ ok: result.ok })
  } catch (error) {
    await publishEvent(channel, { type: 'error', taskId, code: (error as any)?.code || 'llm_error', error: error instanceof Error ? error.message : 'unknown_error', stage: 'invoke', requestId, traceId })
    return new Response('internal_error', { status: 500 })
  } finally {
    await exitGuards(userId, 'batch', counterKey)
  }
  })
}, {
  currentSigningKey: ENV.QSTASH_CURRENT_SIGNING_KEY,
  nextSigningKey: ENV.QSTASH_NEXT_SIGNING_KEY,
})

export { handler as POST }