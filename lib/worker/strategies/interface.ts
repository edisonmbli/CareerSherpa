import type { TaskTemplateId, VariablesFor } from '@/lib/prompts/types'
import type { Locale } from '@/i18n-config'

export interface StrategyContext {
  serviceId: string
  userId: string
  locale: string
  taskId: string
  requestId: string
  traceId: string
}

export interface ExecutionResult {
  ok: boolean
  data?: any
  raw?: string
  error?: string
  usageLogId?: string
}

/**
 * Task to be enqueued after cleanup completes.
 * This ensures the next task doesn't start until the current worker releases its lock.
 */
export interface DeferredTask<T extends TaskTemplateId = TaskTemplateId> {
  kind: 'stream' | 'batch'
  serviceId: string
  taskId: string
  userId: string
  locale: Locale
  templateId: T
  variables: VariablesFor<T>
}

export interface WorkerStrategy<TVars = any> {
  templateId: TaskTemplateId

  prepareVars(
    variables: TVars,
    ctx: StrategyContext
  ): Promise<Record<string, any>>

  onStart?(
    variables: TVars,
    ctx: StrategyContext
  ): Promise<void>

  /**
   * Write results to DB and publish events.
   * @returns Optional array of tasks to be enqueued AFTER cleanup completes.
   */
  writeResults(
    execResult: ExecutionResult,
    variables: TVars,
    ctx: StrategyContext
  ): Promise<DeferredTask[] | void>
}
