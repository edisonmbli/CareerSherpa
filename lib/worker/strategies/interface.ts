import type { TaskTemplateId } from '@/lib/prompts/types'

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

  writeResults(
    execResult: ExecutionResult,
    variables: TVars,
    ctx: StrategyContext
  ): Promise<void>
}
