import { ENV } from '@/lib/env'
import { logDebug, logError } from '@/lib/logger'
import {
  appendTaskDebugEvent,
  summarizeDebugPayload,
  summarizeDebugText,
} from '@/lib/observability/task-debug'

export async function logDebugData(
  phase: string,
  data: {
    input?: string
    output?: string
    meta?: any
    latencyMs?: number
  }
) {
  if (!ENV.LOG_DEBUG || !ENV.LLM_DEBUG) return

  try {
    const reqId = String(data.meta?.requestId || data.meta?.traceId || 'system')
    const serviceId = String(data.meta?.serviceId || '')
    const taskId = String(data.meta?.taskId || '')

    logDebug({
      reqId,
      route: 'llm/debug',
      phase,
      latencyMs: data.latencyMs,
      inputSize: data.input?.length ?? 0,
      outputSize: data.output?.length ?? 0,
      meta: summarizeDebugPayload(data.meta),
    })

    await appendTaskDebugEvent({
      scope: 'llm',
      phase,
      stage: 'llm',
      ...(serviceId ? { serviceId } : {}),
      ...(taskId ? { taskId } : {}),
      ...(reqId ? { requestId: reqId } : {}),
      ...(data.meta?.traceId ? { traceId: String(data.meta.traceId) } : {}),
      ...(data.meta?.templateId ? { templateId: String(data.meta.templateId) } : {}),
      ...(typeof data.latencyMs === 'number' ? { elapsedMs: data.latencyMs } : {}),
      meta: {
        inputSize: data.input?.length ?? 0,
        outputSize: data.output?.length ?? 0,
        ...(data.input ? { inputPreview: summarizeDebugText(data.input) } : {}),
        ...(data.output ? { outputPreview: summarizeDebugText(data.output) } : {}),
        ...(data.meta ? { details: summarizeDebugPayload(data.meta) as Record<string, unknown> } : {}),
      },
    })
  } catch (e) {
    logError({
      reqId: String(data.meta?.requestId || data.meta?.traceId || 'system'),
      route: 'llm/debug',
      error: e instanceof Error ? e : String(e),
      phase: 'write_debug_file',
    })
  }
}
