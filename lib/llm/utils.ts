import type { ModelId } from './providers'

export function getProvider(modelId: ModelId): 'deepseek' | 'zhipu' {
  return modelId.startsWith('deepseek') ? 'deepseek' : 'zhipu'
}

// Very rough cost estimator; replace with real prices in M7
const COST_PER_1K: Record<ModelId, { input: number; output: number }> = {
  'deepseek-reasoner': { input: 0.008, output: 0.012 },
  'deepseek-chat': { input: 0.002, output: 0.002 },
  'glm-4.5-flash': { input: 0.001, output: 0.001 },
  'glm-4.1v-thinking-flash': { input: 0.004, output: 0.004 },
  // Embeddings typically only charge on input tokens
  'glm-embedding-3': { input: 0.0005, output: 0 },
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