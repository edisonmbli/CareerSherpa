import { exitModelConcurrency, exitUserConcurrency, exitGuards } from '@/lib/worker/common'

export async function cleanupFinal(
  modelId: any,
  queueId: string,
  userId: string,
  kind: 'stream' | 'batch',
  counterKey: string
) {
  await exitModelConcurrency(modelId, queueId)
  await exitUserConcurrency(userId, kind)
  await exitGuards(userId, kind, counterKey)
}

