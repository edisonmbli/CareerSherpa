import { getConcurrencyConfig } from '@/lib/env'
import { getProvider } from '@/lib/llm/utils'
import type { ModelId as ModelIdType } from '@/lib/llm/providers'

export function queueMaxSizeFor(queueId: string): number {
  const cfg = getConcurrencyConfig()
  const id = queueId.toLowerCase()
  if (id.includes('paid') && id.includes('stream')) return cfg.queueLimits.paidStream
  if (id.includes('free') && id.includes('stream')) return cfg.queueLimits.freeStream
  if (id.includes('paid') && id.includes('batch')) return cfg.queueLimits.paidBatch
  if (id.includes('free') && id.includes('batch')) return cfg.queueLimits.freeBatch
  if (id.includes('paid') && id.includes('vision')) return cfg.queueLimits.paidVision
  if (id.includes('free') && id.includes('vision')) return cfg.queueLimits.freeVision
  return cfg.queueMaxSize
}

export function buildModelActiveKey(
  modelId: ModelIdType,
  tier: 'paid' | 'free'
): string {
  return `active:model:${modelId}:${tier}`
}

export function getMaxWorkersForModel(
  modelId: ModelIdType,
  tier: 'paid' | 'free'
): number {
  const cfg = getConcurrencyConfig()
  const id = String(modelId).toLowerCase()
  if (id === 'deepseek-reasoner' && tier === 'paid') return cfg.modelTierLimits.dsReasonerPaid
  if (id === 'deepseek-chat' && tier === 'paid') return cfg.modelTierLimits.dsChatPaid
  if (id === 'glm-4.5-flash' && tier === 'free') return cfg.modelTierLimits.glmFlashFree
  if (id === 'glm-4.1v-thinking-flash' && tier === 'paid') return cfg.modelTierLimits.glmVisionPaid
  if (id === 'glm-4.1v-thinking-flash' && tier === 'free') return cfg.modelTierLimits.glmVisionFree
  const provider = getProvider(modelId as any)
  return provider === 'deepseek' ? cfg.deepseekMaxWorkers : cfg.glmMaxWorkers
}

export function buildUserActiveKey(userId: string, kind: 'stream' | 'batch'): string {
  return `active:user:${userId}:${kind}`
}

export function buildQueueCounterKey(queueId: string): string {
  return `bp:queue:${queueId}`
}
