import { exitModelConcurrency, exitUserConcurrency, exitGuards } from '@/lib/worker/common'
import { markTimeline } from '@/lib/observability/timeline'

export async function cleanupFinal(
  modelId: any,
  queueId: string,
  userId: string,
  kind: 'stream' | 'batch',
  counterKey: string,
  serviceId?: string,
  taskId?: string
) {
  // Parallelize cleanup to reduce total duration
  const tasks = [
    (async () => {
      if (serviceId) await markTimeline(serviceId, 'worker_cleanup_model_start', { taskId: String(taskId || '') })
      const t0 = Date.now()
      await exitModelConcurrency(modelId, queueId)
      const t1 = Date.now()
      if (serviceId) await markTimeline(serviceId, 'worker_cleanup_model_end', { taskId: String(taskId || ''), latencyMs: t1 - t0 })
    })(),
    (async () => {
      if (serviceId) await markTimeline(serviceId, 'worker_cleanup_user_start', { taskId: String(taskId || '') })
      const t0 = Date.now()
      await exitUserConcurrency(userId, kind)
      const t1 = Date.now()
      if (serviceId) await markTimeline(serviceId, 'worker_cleanup_user_end', { taskId: String(taskId || ''), latencyMs: t1 - t0 })
    })(),
    (async () => {
      if (serviceId) await markTimeline(serviceId, 'worker_cleanup_guards_start', { taskId: String(taskId || '') })
      const t0 = Date.now()
      await exitGuards(userId, kind, counterKey)
      const t1 = Date.now()
      if (serviceId) await markTimeline(serviceId, 'worker_cleanup_guards_end', { taskId: String(taskId || ''), latencyMs: t1 - t0 })
    })(),
  ]
  await Promise.allSettled(tasks)
}

