import { runStreamingLlmTask, runStructuredLlmTask } from '@/lib/llm/service'
import { getProvider } from '@/lib/llm/utils'

export async function executeStreaming(
  modelId: any,
  templateId: any,
  locale: any,
  variables: Record<string, any>,
  meta: { userId: string; serviceId: string },
  onToken: (text: string) => Promise<void>
) {
  const start = Date.now()
  let tokenCount = 0
  const result = await runStreamingLlmTask(modelId, templateId, locale, variables, meta, async (text) => {
    tokenCount += text ? 1 : 0
    await onToken(text)
  })
  const end = Date.now()
  return { result, latencyMs: end - start, tokenCount }
}

export async function executeStructured(
  modelId: any,
  templateId: any,
  locale: any,
  variables: Record<string, any>,
  meta: { userId: string; serviceId: string }
) {
  const start = Date.now()
  const result = await runStructuredLlmTask(modelId, templateId, locale, variables, meta)
  const end = Date.now()
  const inputTokens = Number(result.usage?.inputTokens ?? 0)
  const outputTokens = Number(result.usage?.outputTokens ?? 0)
  return { result, latencyMs: end - start, inputTokens, outputTokens }
}

