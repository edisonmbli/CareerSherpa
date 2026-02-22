import type { ModelId } from './providers'

export function getProvider(modelId: ModelId): 'deepseek' | 'zhipu' | 'gemini' | 'baidu' {
  if (modelId.startsWith('deepseek')) return 'deepseek'
  if (modelId.startsWith('gemini')) return 'gemini'
  if (modelId.startsWith('baidu')) return 'baidu'
  return 'zhipu'
}

// Very rough cost estimator; replace with real prices in M7
const COST_PER_1K: Record<ModelId, { input: number; output: number }> = {
  'deepseek-reasoner': { input: 0.008, output: 0.012 },
  'deepseek-chat': { input: 0.002, output: 0.002 },
  'glm-4.5-flash': { input: 0.001, output: 0.001 },
  'glm-4.1v-thinking-flash': { input: 0.004, output: 0.004 },
  // Embeddings typically only charge on input tokens
  'glm-embedding-3': { input: 0.0005, output: 0 },
  // Gemini Free tier (within daily limit, effectively free)
  'gemini-3-flash-preview': { input: 0.00015, output: 0.00060 },
  'baidu-ocr-api': { input: 0.000, output: 0.000 }, // Managed via Baidu directly, handled differently
}

export function getCost(
  modelId: ModelId,
  inputTokens: number,
  outputTokens: number
): number {
  const price = COST_PER_1K[modelId]
  if (!price) return 0
  return (
    (inputTokens / 1000) * price.input + (outputTokens / 1000) * price.output
  )
}