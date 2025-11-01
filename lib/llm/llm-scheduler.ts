/**
 * 统一LLM调度者 - 整合队列管理、LangChain编排和Prompt模板系统
 *
 * 这个模块整合了原来的三个组件：
 * 1. worker-pool.ts - 队列管理和并发控制
 * 2. langchain-orchestrator.ts - LangChain LCEL处理链和Prompt构建
 * 3. prompts/templates.ts - Prompt模板系统
 *
 * 目标：简化调用链路，提供统一的LLM能力接口
 */

import {
  RunnableSequence,
  RunnableParallel,
  RunnableLambda,
  RunnablePassthrough,
} from '@langchain/core/runnables'
import { PromptTemplate } from '@langchain/core/prompts'
import { StringOutputParser } from '@langchain/core/output_parsers'
import {
  LLMConfig,
  LLMProvider,
  LLMResponse,
  providerRegistry,
  getModelConfig,
} from './providers'
import { logTokenUsage, createTask, updateTaskStatus, updateSummaries, createTaskOutput } from '../dal'
import { getConcurrencyConfig, getPerformanceConfig } from '../env'
import {
  renderTemplate,
  type TemplateId,
  getEnhancedTemplate,
  getLightweightEnhancedTemplate,
  getTemplateConfig,
  PROMPT_TEMPLATES,
} from '../prompts/templates'
import { validateLLMResponse } from './json-validator'
import { logError, logInfo } from '../logger'
import { TaskKind, TaskStatus } from '@prisma/client'
import {
  withErrorBoundary,
  validateInput,
  SummaryTaskSchema,
  LLMErrorCategory,
  createLLMError,
  ErrorPatternMonitor,
} from './error-boundary'
import { withLlmLogging } from './logger'
import { LLMErrorMatcher } from './error-types'

// ===== 类型定义 =====

export type TaskType = 'vision' | 'text'
export type TaskStep = 'match' | 'resume' | 'interview' | 'extract' | 'job' | 'detailed' | 'customize' 

export interface LLMTask {
  id: string
  userId: string
  serviceId: string
  type: TaskType
  step: TaskStep
  prompt: string
  config?: Partial<LLMConfig>
  priority: number
  createdAt: Date
  retries: number
  maxRetries: number
  tier: 'free' | 'paid'
  provider?: string
  abortController?: AbortController
  timeout?: number
  // 视觉任务专用字段
  mediaBase64?: string
  lang?: string
}

export interface LLMTaskResult {
  taskId: string
  success: boolean
  response?: LLMResponse
  error?: string
  duration: number
  provider: string
  model: string
  queuePosition?: number
  waitTime?: number
  tier: 'free' | 'paid'
  type: TaskType
  cancelled?: boolean
  retryCount?: number
  fallbackUsed?: boolean
}

export interface QueueStatus {
  provider: string
  tier: 'free' | 'paid'
  type: TaskType
  pending: number
  active: number
  maxConcurrent: number
  avgWaitTime: number
  successRate: number
}

export interface WorkerPoolStatus {
  totalQueues: number
  totalPending: number
  totalActive: number
  queues: QueueStatus[]
  uptime: number
}

// Summary相关类型（来自langchain-orchestrator）
export interface SummaryTask {
  type: 'resume' | 'job' | 'detailed'
  id: string
  userId: string
  serviceId: string
  data: Record<string, any>
}

export interface SummaryResult {
  type: 'resume' | 'job' | 'detailed'
  id: string
  success: boolean
  summaryJson?: any
  summaryTokens?: number
  error?: string
  duration: number
}

export interface OrchestrationOptions {
  tier?: 'free' | 'paid'
  timeout?: number
  enableFallback?: boolean
}

// ===== 队列配置 =====

interface ProviderConfig {
  name: string
  maxWorkers: number
  priority: number
}

const QUEUE_CONFIGS = {
  text: {
    paid: [
      { name: 'deepseek', maxWorkers: 5, priority: 1 },
      { name: 'zhipu', maxWorkers: 5, priority: 2 },
    ] as ProviderConfig[],
    free: [{ name: 'zhipu', maxWorkers: 2, priority: 1 }] as ProviderConfig[],
  },
  vision: {
    paid: [{ name: 'zhipu', maxWorkers: 3, priority: 1 }] as ProviderConfig[],
    free: [{ name: 'zhipu', maxWorkers: 2, priority: 1 }] as ProviderConfig[],
  },
} as const

// ===== 统一LLM调度者 =====

export class LLMScheduler {
  // 队列管理（来自原worker-pool）
  private queues = new Map<string, LLMTask[]>()
  private queueProcessors = new Map<string, NodeJS.Timeout | null>()
  private activeTasks = new Map<string, Promise<LLMTaskResult>>()
  private taskMetadata = new Map<
    string,
    {
      type: TaskType
      provider: string
      tier: 'free' | 'paid'
      userId: string
      startTime: number
      queueTime: number
      abortController?: AbortController
      status: 'queued' | 'active' | 'completed' | 'cancelled'
    }
  >()

  // 并发控制和统计
  private activeCounts = new Map<string, number>()
  private providerActiveCounts = new Map<string, number>()
  private queueWaitTimes = new Map<string, number[]>()
  private taskCompletionCallbacks = new Map<
    string,
    (result: LLMTaskResult) => void
  >()

  // 性能监控
  private startTime = Date.now()
  private taskStats = {
    total: 0,
    success: 0,
    failed: 0,
    cancelled: 0,
  }

  // LangChain处理链超时配置（来自langchain-orchestrator）
  private timeouts = {
    resume: 180000, // 3分钟 - 延长以避免过早超时
    job: 180000, // 3分钟 - 延长以避免过早超时
    detailed: 600000, // 10分钟
    match: 120000, // 2分钟 - 延长以避免过早超时
    interview: 180000, // 3分钟
    extract: 180000, // 3分钟
    customize: 180000, // 3分钟
  }
  private fallbackTimeout = 30000 // 30秒 - 延长默认超时

  constructor() {
    this.initializeQueues()
  }

  // ===== 队列初始化 =====

  private initializeQueues() {
    // 为每个type+tier组合创建队列
    for (const [type, tierConfigs] of Object.entries(QUEUE_CONFIGS)) {
      for (const [tier, providers] of Object.entries(tierConfigs)) {
        const queueKey = `${type}-${tier}`
        this.queues.set(queueKey, [])
        this.activeCounts.set(queueKey, 0)
        this.queueWaitTimes.set(queueKey, [])

        // 为每个provider创建活跃计数
        for (const provider of providers) {
          const providerKey = `${queueKey}:${provider.name}`
          this.providerActiveCounts.set(providerKey, 0)
        }

        // 启动队列处理器
        this.startQueueProcessor(queueKey)
      }
    }
  }

  // ===== 核心任务提交接口 =====

  async submitTask(
    task: LLMTask,
    options: {
      tier?: 'free' | 'paid'
      timeout?: number
      priority?: number
    } = {}
  ): Promise<LLMTaskResult> {
    const { tier = 'free', timeout, priority = 1 } = options

    // 设置任务属性
    task.tier = tier
    task.priority = priority
    if (timeout) task.timeout = timeout
    
    // 确保重试配置
    if (task.retries === undefined) task.retries = 0
    if (task.maxRetries === undefined) {
      // 根据任务类型设置默认重试次数
      switch (task.step) {
        case 'detailed':
          task.maxRetries = 1 // 详细任务重试1次（因为耗时长）
          break
        case 'extract':
          task.maxRetries = 2 // 提取任务重试2次
          break
        default:
          task.maxRetries = 2 // 其他任务默认重试2次
      }
      
      // 对于视觉任务类型，也设置重试次数
      if (task.type === 'vision') {
        task.maxRetries = 2
      }
    }

    const queueKey = `${task.type}-${tier}`

    // Debug: 开始调度器debug会话

    // Debug: 记录任务提交详情

    // 检查队列是否存在
    if (!this.queues.has(queueKey)) {
      throw new Error(`Queue not found: ${queueKey}`)
    }

    // Debug: 记录队列状态
    const currentQueue = this.queues.get(queueKey)!
    const currentActiveCount = this.activeCounts.get(queueKey) || 0
    const maxConcurrent = this.getMaxConcurrent(queueKey)

    // 添加任务元数据
    const metadata: {
      type: TaskType
      provider: string
      tier: 'free' | 'paid'
      userId: string
      startTime: number
      queueTime: number
      abortController?: AbortController
      status: 'queued' | 'active' | 'completed' | 'cancelled'
    } = {
      type: task.type,
      provider: task.provider || 'auto',
      tier,
      userId: task.userId,
      startTime: Date.now(),
      queueTime: Date.now(),
      status: 'queued',
    }

    if (task.abortController) {
      metadata.abortController = task.abortController
    }

    this.taskMetadata.set(task.id, metadata)

    // 映射 TaskStep 到 TaskKind
    const mapTaskStepToKind = (step: TaskStep): TaskKind => {
      switch (step) {
        case 'match':
          return TaskKind.match
        case 'resume':
          return TaskKind.resume
        case 'job':
          return TaskKind.job
        case 'detailed':
          return TaskKind.detailed
        case 'customize':
          return TaskKind.customize
        case 'interview':
          return TaskKind.interview
        case 'extract':
          return TaskKind.extract
        default:
          throw new Error(`Unknown task step: ${step}`)
      }
    }

    // 在数据库中创建任务记录
    try {
      // Debug: 记录开始创建任务

      await createTask({
        id: task.id, // 传递LLM调度器生成的任务ID
        serviceId: task.serviceId,
        requestedBy: task.userId,
        kind: mapTaskStepToKind(task.step),
        meta: { priority: task.priority },
      })
      
      // Debug: 记录任务创建成功
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      // Debug: 记录任务创建失败

      logError({
        reqId: task.id,
        route: 'llm-scheduler',
        phase: 'create_task_failed',
        error: errorMessage,
      })
      
      console.error(`[LLM-Scheduler] Failed to create task ${task.id} in database:`, error)
      
      // 如果创建任务失败，则直接抛出错误
      throw new Error(`Failed to create task in DB: ${errorMessage}`)
    }

    // 将任务添加到队列
    this.addTaskToQueue(queueKey, task)

    // 返回Promise，等待任务完成
    return new Promise((resolve, reject) => {
      this.taskCompletionCallbacks.set(task.id, async (result: LLMTaskResult) => {
        // Debug: 保存调度器debug日志
        try {
        } catch (error) {
          console.warn('Failed to save scheduler debug log:', error)
        }

        if (result.success) {
          resolve(result)
        } else {
          reject(new Error(result.error || 'Task failed'))
        }
      })

      // 设置超时
      if (task.timeout) {
        setTimeout(async () => {
          if (this.taskCompletionCallbacks.has(task.id)) {
            this.taskCompletionCallbacks.delete(task.id)
            
            // Debug: 保存调度器debug日志（超时情况）
            try {
            } catch (error) {
              console.warn('Failed to save scheduler debug log on timeout:', error)
            }
            
            reject(new Error('Task timeout'))
          }
        }, task.timeout)
      }
    })
  }

  // ===== 批量摘要处理（替代executeQueuedSummariesWithLangChain）=====

  async executeSummaries(
    tasks: SummaryTask[],
    options: OrchestrationOptions = {}
  ): Promise<SummaryResult[]> {
    const { tier = 'free', timeout = 300000, enableFallback = true } = options
    const startTime = Date.now()

    logInfo({
      reqId: 'llm-scheduler',
      route: 'llm/llm-scheduler',
      phase: 'execute_summaries_start',
      message: `Starting summary execution with ${tasks.length} tasks`,
      tasksCount: tasks.length,
      taskTypes: tasks.map((t) => t.type),
      options: { tier, timeout, enableFallback },
    })

    const results: SummaryResult[] = []

    // 并行处理所有任务
    const taskPromises = tasks.map(async (summaryTask) => {
      const taskStartTime = Date.now()

      try {
        // 获取模板配置
        const templateId = this.getTemplateId(summaryTask.type)
        const templateConfig = getTemplateConfig(templateId)
        
        // 构建LLM任务
        const llmTask: LLMTask = {
          id: `${summaryTask.type}-${summaryTask.id}-${Date.now()}`,
          userId: summaryTask.userId,
          serviceId: summaryTask.serviceId,
          type: 'text',
          step: summaryTask.type as any,
          prompt: await this.buildSummaryPrompt(summaryTask),
          config: {
            maxTokens: templateConfig.maxTokens,
            temperature: templateConfig.temperature,
          },
          priority: 1,
          createdAt: new Date(),
          retries: 0,
          maxRetries: 3,
          tier,
          // 移除硬编码的provider，让调度器动态选择可用的提供商
          abortController: new AbortController(),
          timeout: this.timeouts[summaryTask.type] || timeout,
        }

        // 提交任务到队列
        const submitOptions: {
          tier?: 'free' | 'paid'
          timeout?: number
          priority?: number
        } = {
          tier,
          priority: 1,
        }

        if (llmTask.timeout) {
          submitOptions.timeout = llmTask.timeout
        }

        const llmResult = await this.submitTask(llmTask, submitOptions)

        const taskDuration = Date.now() - taskStartTime

        if (llmResult.success && llmResult.response?.content) {
          // LLM响应获取成功，开始解析

          // 解析和验证LLM响应
          const parseResult = await this.parseSummaryResponse(
            llmResult.response.content,
            summaryTask.type,
            summaryTask.id
          )

          // 检查解析结果

          if (parseResult.success && parseResult.data) {
            const result: SummaryResult = {
              type: summaryTask.type,
              id: summaryTask.id,
              success: true,
              summaryJson: parseResult.data,
              duration: taskDuration,
            }

            if (llmResult.response.usage?.totalTokens !== undefined) {
              result.summaryTokens = llmResult.response.usage.totalTokens
            }

            return result
          } else {
            // JSON解析失败，记录详细错误信息
            logError({
              reqId: summaryTask.id,
              route: 'llm-scheduler',
              userKey: summaryTask.userId,
              phase: 'json_parse_failed',
              taskType: summaryTask.type,
              error: parseResult.error || 'Unknown parsing error',
              contentLength: llmResult.response.content.length,
              contentSample: llmResult.response.content.slice(0, 200),
              fallbackEnabled: enableFallback,
            })

            // JSON解析失败，尝试fallback
            if (enableFallback) {
              return await this.executeFallbackSummary(
                summaryTask,
                taskDuration
              )
            } else {
              return {
                type: summaryTask.type,
                id: summaryTask.id,
                success: false,
                error: `JSON parsing failed: ${parseResult.error}`,
                duration: taskDuration,
              }
            }
          }
        } else {
          // LLM执行失败，尝试fallback
          if (enableFallback) {
            return await this.executeFallbackSummary(summaryTask, taskDuration)
          } else {
            return {
              type: summaryTask.type,
              id: summaryTask.id,
              success: false,
              error: llmResult.error || 'LLM execution failed',
              duration: taskDuration,
            }
          }
        }
      } catch (error) {
        const taskDuration = Date.now() - taskStartTime
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error'

        if (enableFallback) {
          return await this.executeFallbackSummary(summaryTask, taskDuration)
        } else {
          return {
            type: summaryTask.type,
            id: summaryTask.id,
            success: false,
            error: errorMessage,
            duration: taskDuration,
          }
        }
      }
    })

    // 等待所有任务完成
    const taskResults = await Promise.all(taskPromises)
    results.push(...taskResults)

    const totalDuration = Date.now() - startTime
    const successCount = results.filter((r) => r.success).length

    logInfo({
      reqId: 'llm-scheduler',
      route: 'llm/llm-scheduler',
      phase: 'execute_summaries_complete',
      message: `Summary execution completed`,
      tasksCount: tasks.length,
      successCount,
      totalDuration,
    })

    return results
  }

  // ===== Prompt构建（来自原langchain-orchestrator）=====

  private async buildSummaryPrompt(task: SummaryTask): Promise<string> {
    const templateId = this.getTemplateId(task.type)

    // 构建模板变量 - 根据任务类型映射到正确的变量名
    let variables: Record<string, string>
    
    switch (task.type) {
      case 'resume':
        variables = { resumeText: String(task.data['text'] || '') }
        break
      case 'job':
        variables = { jobText: String(task.data['text'] || '') }
        break
      case 'detailed':
        variables = { resumeText: String(task.data['text'] || '') }
        break
      default:
        // 默认情况下，直接使用task.data中的所有字段
        variables = Object.keys(task.data).reduce((acc, key) => {
          acc[key] = String(task.data[key] || '')
          return acc
        }, {} as Record<string, string>)
    }

    // 使用增强模板进行渲染
    const renderedTemplate = renderTemplate(templateId, variables)

    // 获取渲染后的模板内容
    const systemPrompt = renderedTemplate.systemPrompt
    const userPrompt = renderedTemplate.userPrompt

    return `${systemPrompt}\n\n${userPrompt}`
  }

  private getTemplateId(taskType: string): TemplateId {
    const templateMap: Record<string, TemplateId> = {
      resume: 'resume_summary',
      job: 'job_summary',
      detailed: 'detailed_resume',
    }

    return templateMap[taskType] || 'resume_summary'
  }

  // ===== 响应解析（来自原langchain-orchestrator）=====

  private async parseSummaryResponse(
    content: string,
    taskType: 'resume' | 'job' | 'detailed',
    taskId: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {

    // Define expected fields based on task type
    const expectedFields: Record<
      string,
      'string' | 'string[]' | 'object' | 'object[]'
    > = {}

    if (taskType === 'resume') {
      expectedFields['summary'] = 'string'
      expectedFields['strengths'] = 'string[]'
      expectedFields['improvements'] = 'string[]'
      expectedFields['keywords'] = 'string[]'
    } else if (taskType === 'job') {
      expectedFields['title'] = 'string'
      expectedFields['company'] = 'string'
      expectedFields['requirements'] = 'string[]'
      expectedFields['responsibilities'] = 'string[]'
      expectedFields['skills'] = 'string[]'
      expectedFields['benefits'] = 'string[]'
      expectedFields['level'] = 'string'
      expectedFields['industry'] = 'string'
      expectedFields['location'] = 'string'
    } else if (taskType === 'detailed') {
      expectedFields['matchScore'] = 'string'
      expectedFields['keyPoints'] = 'string[]'
      expectedFields['suggestions'] = 'string[]'
      expectedFields['interviewTips'] = 'string[]'
    }

    try {
      // Use validateLLMResponse with debug options
      const result = validateLLMResponse(content, expectedFields, {
        debug: {
          reqId: taskId,
          route: 'llm-scheduler',
          userKey: 'parsing-summary',
        },
        enableFallback: true,
        maxAttempts: 4, // 使用修复后的maxAttempts值
        strictMode: false,
      })

      if (result.success && result.data) {
        return { success: true, data: result.data }
      } else {
        return { success: false, error: result.error || 'Validation failed' }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  }

  // ===== Fallback处理 =====

  private async executeFallbackSummary(
    task: SummaryTask,
    duration: number
  ): Promise<SummaryResult> {
    // 记录fallback执行
    logError({
      reqId: 'llm-scheduler',
      route: 'executeFallbackSummary',
      phase: 'fallback_execution',
      error: `LLM parsing failed for task type: ${task.type}`,
      taskId: task.id,
      userId: task.userId,
      serviceId: task.serviceId,
      duration
    })

    // 返回失败状态，不保存fallback数据到数据库
    return {
      type: task.type,
      id: task.id,
      success: false, // 修复：改为false，因为这是解析失败
      error: `LLM parsing failed for ${task.type} task. Please try again or check the input data.`,
      duration,
    }
  }

  // ===== 队列处理逻辑（来自worker-pool）=====

  private addTaskToQueue(queueKey: string, task: LLMTask) {
    const queue = this.queues.get(queueKey)!

    // Debug: 记录队列添加前状态

    // 按优先级插入任务
    const insertIndex = queue.findIndex((t) => t.priority > task.priority)
    if (insertIndex === -1) {
      queue.push(task)
    } else {
      queue.splice(insertIndex, 0, task)
    }

    // Debug: 记录队列添加后状态

    logInfo({
      reqId: 'llm-scheduler',
      route: 'llm/llm-scheduler',
      phase: 'task_queued',
      queueKey,
      taskId: task.id,
      queueLength: queue.length,
      priority: task.priority,
    })
  }

  private startQueueProcessor(queueKey: string) {
    const processor = setInterval(() => {
      this.processQueue(queueKey)
    }, 100) // 每100ms检查一次队列

    this.queueProcessors.set(queueKey, processor)
  }

  private async processQueue(queueKey: string) {
    const queue = this.queues.get(queueKey)!
    const activeCount = this.activeCounts.get(queueKey) || 0
    const maxConcurrent = this.getMaxConcurrent(queueKey)

    // 只在队列有任务时才处理
    if (queue.length === 0) {
      return
    }

    // Debug: 记录队列处理开始（只在有实际任务处理时）

    const task = queue.shift()!
    const metadata = this.taskMetadata.get(task.id)

    if (!metadata || metadata.status === 'cancelled') {
      return
    }

    // 关键修复：在选择provider之前先检查队列级别的并发限制
    if (activeCount >= maxConcurrent) {
      // 队列级别已达到并发限制，将任务重新放回队列头部
      queue.unshift(task)
      
      return
    }

    // 预检查 provider 可用性，避免无效任务占用槽位
    const providerSelection = this.selectProviderForTask(task, queueKey)
    if (!providerSelection) {
      // Provider 不可用，将任务重新放回队列头部
      queue.unshift(task)
      
      return
    }

    // 双重检查：确保provider级别的并发限制也没有被违反
    const { providerKey } = providerSelection
    const providerActiveCount = this.providerActiveCounts.get(providerKey) || 0
    const [type, tier] = queueKey.split('-') as [TaskType, 'free' | 'paid']
    const configs = QUEUE_CONFIGS[type][tier]
    const providerConfig = configs.find(c => providerKey.endsWith(`:${c.name}`))
    
    if (providerConfig && providerActiveCount >= providerConfig.maxWorkers) {
      // Provider级别已达到并发限制，将任务重新放回队列头部
      queue.unshift(task)
      
      return
    }

    // 只有在通过所有并发检查后才更新状态和计数
    metadata.status = 'active';
    this.activeCounts.set(queueKey, activeCount + 1);
    
    // 统一管理provider计数
    const currentProviderCount = this.providerActiveCounts.get(providerKey) || 0;
    this.providerActiveCounts.set(providerKey, currentProviderCount + 1);

    // Update task status in DB to 'running'
    try {
      // Debug: 记录开始更新任务状态为运行中

      await updateTaskStatus(task.id, TaskStatus.running)
      
      // Debug: 记录任务状态更新成功
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      
      // Debug: 记录数据库操作失败

      logError({
        reqId: task.id,
        route: 'llm-scheduler',
        phase: 'db_update_status_error',
        error: errorMessage,
      });
      
      console.error(`[LLM-Scheduler] Failed to update task status to running for task ${task.id}:`, err)
    }

    // Debug: 记录任务开始执行

    // 执行任务，传递已选择的 provider
    const taskPromise = this.executeTask(task, queueKey, providerSelection)
    this.activeTasks.set(task.id, taskPromise)

    // 处理任务完成
    taskPromise.finally(() => {
      this.activeTasks.delete(task.id)
      const newActiveCount = Math.max(0, (this.activeCounts.get(queueKey) || 0) - 1)
      this.activeCounts.set(queueKey, newActiveCount)
      
      // 统一释放provider计数
      const currentProviderCount = this.providerActiveCounts.get(providerKey) || 0;
      const newProviderCount = Math.max(0, currentProviderCount - 1);
      this.providerActiveCounts.set(providerKey, newProviderCount);
      
      this.taskMetadata.delete(task.id)

      // Debug: 记录任务执行完成
    })
  }

  private async executeTask(
    task: LLMTask,
    queueKey: string,
    preselectedProvider?: { provider: LLMProvider; providerKey: string }
  ): Promise<LLMTaskResult> {
    const startTime = Date.now()
    const metadata = this.taskMetadata.get(task.id)!
    let providerSelection: { provider: LLMProvider; providerKey: string } | null = null

    // 在重试循环外部进行provider选择
    providerSelection = preselectedProvider || this.selectProviderForTask(task, queueKey)
    
    if (!providerSelection) {
      throw new Error(`No available provider for task type: ${task.type}, tier: ${task.tier}`)
    }

    // 重试逻辑
    let lastError: Error | null = null
    const maxRetries = task.maxRetries || 2 // 默认最多重试2次
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Debug: 记录重试尝试
        if (attempt > 0) {
        }

        // 调用executeTaskAttempt，计数已在processQueue中统一管理
        const result = await this.executeTaskAttempt(task, queueKey, providerSelection, attempt)
        
        // 成功则返回结果
        if (result.success) {
          return result
        }
        
        // 如果失败但不是最后一次尝试，分析错误并决定是否重试
        if (attempt < maxRetries) {
          lastError = new Error(result.error || 'Unknown error')
          
          // 分析错误类型，决定是否应该重试
          const errorType = LLMErrorMatcher.matchError(providerSelection.providerKey, lastError)
          
          // 如果错误不可重试，直接返回失败结果
          if (errorType && !errorType.isRetryable) {
            
            return { ...result, retryCount: attempt }
          }
          
          // 计算重试延迟
          let retryDelay = Math.min(1000 * Math.pow(2, attempt), 5000) // 默认指数退避，最大5秒
          
          // 如果错误类型指定了重试延迟，使用该值
          if (errorType?.retryAfterMs) {
            retryDelay = errorType.retryAfterMs
          }
          
          // Debug: 记录重试前的等待
          
          await new Promise(resolve => setTimeout(resolve, retryDelay))
          continue
        }
        
        // 最后一次尝试失败，返回失败结果
        return { ...result, retryCount: attempt }
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
        
        // 如果不是最后一次尝试，分析错误并决定是否重试
        if (attempt < maxRetries) {
          // 分析错误类型，决定是否应该重试
          const errorType = LLMErrorMatcher.matchError(providerSelection.providerKey, lastError)
          
          // 如果错误不可重试，直接抛出错误
          if (errorType && !errorType.isRetryable) {
            
            throw lastError
          }
          
          // 计算重试延迟
          let retryDelay = Math.min(1000 * Math.pow(2, attempt), 5000) // 默认指数退避，最大5秒
          
          // 如果错误类型指定了重试延迟，使用该值
          if (errorType?.retryAfterMs) {
            retryDelay = errorType.retryAfterMs
          }

          await new Promise(resolve => setTimeout(resolve, retryDelay))
          continue
        }
        
        // 最后一次尝试失败，抛出错误
        throw lastError
      }
    }
    
    // 这里不应该到达，但为了类型安全
    throw lastError || new Error('All retry attempts failed')
  }

  private async executeTaskAttempt(
    task: LLMTask,
    queueKey: string,
    preselectedProvider?: { provider: LLMProvider; providerKey: string },
    attempt: number = 0
  ): Promise<LLMTaskResult> {
    const startTime = Date.now()
    const metadata = this.taskMetadata.get(task.id)!
    let selectedProviderKey: string | null = null

    try {
      // Debug: 记录任务执行开始

      // 使用预选择的提供商或重新选择
      let providerSelection: { provider: LLMProvider; providerKey: string } | null = preselectedProvider || null
      
      if (!providerSelection) {
        providerSelection = this.selectProviderForTask(task, queueKey)
        
        // Debug: 记录提供商选择结果
      } else {
        // Debug: 记录使用预选择的提供商
      }
      
      if (!providerSelection) {
        throw new Error(`No available provider for task type: ${task.type}, tier: ${task.tier}`)
      }

      const { provider, providerKey } = providerSelection
      selectedProviderKey = providerKey
      
      // Provider计数管理已在processQueue中统一处理

      // 获取模型配置 - 根据任务类型智能选择模型类型
      let modelType: 'text' | 'vision' | 'reasoning' | 'text_fallback' = 'text'
      if (task.type === 'vision') {
        modelType = 'vision'
      } else if (task.step === 'detailed' && task.tier === 'paid') {
        // detailed任务使用reasoning模型（仅付费用户）
        modelType = 'reasoning'
      }
      
      const modelConfig = getModelConfig(task.tier, modelType)

      // Debug: 记录LLM调用开始

      // 执行LLM调用 - 使用日志记录包装器
      const response = await withLlmLogging(
        {
          provider: provider.name,
          model: modelConfig.model,
          userId: task.userId,
          requestId: task.id,
          route: `llm-scheduler/${task.step}`,
        },
        async () => {
          return await this.callLLM(task, provider)
        }
      ) as LLMResponse

      // Debug: 记录LLM调用成功

      const duration = Date.now() - startTime
      const waitTime = startTime - metadata.queueTime

      const result: LLMTaskResult = {
        taskId: task.id,
        success: true,
        response,
        duration,
        provider: provider.name,
        model: modelConfig.model,
        waitTime,
        tier: task.tier,
        type: task.type,
      }

      // 记录token使用到旧系统（保持兼容性）
      if (response.usage) {
        await logTokenUsage({
          userId: task.userId,
          serviceId: task.serviceId,
          provider: provider.name,
          model: modelConfig.model,
          inputTokens: response.usage.inputTokens || 0,
          outputTokens: response.usage.outputTokens || 0,
          cost: 0, // TODO: 计算实际成本
        })
      }

      // 记录详细的debug日志（如果启用）
      if (process.env['LLM_DEBUG_LOGGING'] === 'true') {
      }

      // Debug: 记录任务执行成功

      // Update task status in DB to 'done' and create output
      try {
        // Debug: 记录开始更新任务状态

        await updateTaskStatus(task.id, TaskStatus.done)
        
        // Debug: 记录任务状态更新成功

        if (response) {
          const outputData: any = {
            taskId: task.id,
            version: 1, // TODO: implement versioning
            outputJson: response as any, //TODO: fix this
          };
          
          // Only add optional fields if they have values
          if (response.usage?.inputTokens !== undefined) {
            outputData.inputTokens = response.usage.inputTokens;
          }
          if (response.usage?.outputTokens !== undefined) {
            outputData.outputTokens = response.usage.outputTokens;
          }
          if (response.usage?.cost !== undefined) {
            outputData.cost = response.usage.cost;
          }
          if (response.modelConfig?.model !== undefined) {
            outputData.model = response.modelConfig.model;
          }
          if (response.modelConfig?.provider !== undefined) {
            outputData.provider = response.modelConfig.provider;
          }
          
          // Debug: 记录开始创建任务输出

          await createTaskOutput(outputData)
          
          // Debug: 记录任务输出创建成功
        }
      } catch (dbError) {
        const dbErrorMessage = dbError instanceof Error ? dbError.message : 'Unknown database error'
        
        // Debug: 记录数据库操作失败

        logError({
          reqId: task.id,
          route: 'llm-scheduler',
          phase: 'db_operation_error',
          error: `Database operation failed: ${dbErrorMessage}`,
        });
        
        // 即使数据库操作失败，也不应该影响LLM任务的成功状态
        // 但我们需要记录这个错误以便调试
        console.error(`[LLM-Scheduler] Database operation failed for task ${task.id}:`, dbError)
      }

      // 调用完成回调
      const callback = this.taskCompletionCallbacks.get(task.id)
      if (callback) {
        callback(result)
        this.taskCompletionCallbacks.delete(task.id)
      }

      this.taskStats.success++
      return result
    } catch (error) {
      const duration = Date.now() - startTime
      const waitTime = startTime - metadata.queueTime
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      // Debug: 记录任务执行失败

      // 记录详细的debug日志（如果启用）
      if (process.env['LLM_DEBUG_LOGGING'] === 'true') {
      }

      const result: LLMTaskResult = {
        taskId: task.id,
        success: false,
        error: errorMessage,
        duration,
        provider: task.provider || 'unknown',
        model: 'unknown',
        waitTime,
        tier: task.tier,
        type: task.type,
      }

      // Update task status in DB to 'error'
      try {
        // Debug: 记录开始更新任务状态为错误

        await updateTaskStatus(task.id, TaskStatus.error, { error: errorMessage })
        
        // Debug: 记录任务状态更新成功
      } catch (dbError) {
        const dbErrorMessage = dbError instanceof Error ? dbError.message : 'Unknown database error'
        
        // Debug: 记录数据库操作失败

        logError({
          reqId: task.id,
          route: 'llm-scheduler',
          phase: 'db_update_status_failed_error',
          error: `Failed to update task status to error: ${dbErrorMessage}`,
        });
        
        console.error(`[LLM-Scheduler] Failed to update task status to error for task ${task.id}:`, dbError)
      }

      // 调用完成回调
      const callback = this.taskCompletionCallbacks.get(task.id)
      if (callback) {
        callback(result)
        this.taskCompletionCallbacks.delete(task.id)
      }

      this.taskStats.failed++
      return result
    } finally {
      // Provider计数释放已在processQueue中统一处理
    }
  }

  private getAvailableProviders(taskType: string, tier: string): string[] {
    if (taskType === 'text' || taskType === 'vision') {
      const tierConfig = QUEUE_CONFIGS[taskType as keyof typeof QUEUE_CONFIGS]
      if (tierConfig && (tier === 'paid' || tier === 'free')) {
        const providers = tierConfig[tier as keyof typeof tierConfig]
        return providers.map((p: ProviderConfig) => p.name)
      }
    }
    return []
  }

  private selectProviderForTask(
    task: LLMTask,
    queueKey: string
  ): { provider: LLMProvider; providerKey: string } | null {
    const [type, tier] = queueKey.split('-') as [TaskType, 'free' | 'paid']
    const configs = QUEUE_CONFIGS[type][tier]

    logInfo({
      reqId: task.id,
      route: 'llm-scheduler',
      phase: 'provider_selection',
      message: `Selecting provider for ${queueKey}`,
      availableProviders: configs.map(c => c.name),
    })

    // 按优先级选择可用的provider
    for (const config of configs) {
      const provider = providerRegistry.get(config.name)
      
      if (!provider) {
        logError({
          reqId: task.id,
          route: 'llm-scheduler',
          phase: 'provider_selection_error',
          message: `Provider ${config.name} not found in registry`,
          providerName: config.name,
        })
        continue
      }

      const isReady = provider.isReady()
      if (!isReady) {
        logError({
          reqId: task.id,
          route: 'llm-scheduler',
          phase: 'provider_not_ready',
          message: `Provider ${config.name} is not ready (API key missing or invalid)`,
          providerName: config.name,
        })
        continue
      }

      // 使用queueKey:providerName格式，与initializeQueues保持一致
      const providerKey = `${queueKey}:${config.name}`
      
      // 注意：并发检查已经在processQueue中进行，这里只需要选择第一个可用的provider
      logInfo({
        reqId: task.id,
        route: 'llm-scheduler',
        phase: 'provider_selected',
        message: `Selected provider: ${config.name} for ${queueKey}`,
        providerName: config.name,
        providerKey,
      })
      return { provider, providerKey }
    }

    logError({
      reqId: task.id,
      route: 'llm-scheduler',
      phase: 'no_provider_available',
      message: `No available provider found for ${queueKey}`,
      queueKey,
      checkedProviders: configs.map(c => c.name),
    })
    return null
  }

  private async callLLM(
    task: LLMTask,
    provider: LLMProvider
  ): Promise<LLMResponse> {
    // 根据任务步骤确定模型类型
    let modelType: 'vision' | 'text' | 'reasoning' | 'text_fallback'
    if (task.type === 'vision') {
      modelType = 'vision'
    } else if (task.step === 'match' || task.step === 'interview' || task.step === 'detailed') {
      modelType = 'reasoning' // 复杂推理任务使用 reasoning 类型
    } else {
      modelType = 'text' // 其他文本任务使用 text 类型
    }
    
    const config = getModelConfig(provider.tier, modelType)

    // 确定超时时间（毫秒），确保有兜底值
    const timeout = task.timeout || this.timeouts[task.step] || this.fallbackTimeout

    const modelConfig = {
      ...config,
      ...task.config,
      timeout, // 传递超时给模型配置
    }

    // 创建模型实例（超时已通过modelConfig传递给Provider）
    const model = provider.createModel(modelConfig)

    try {
      // 调用模型并获取响应（依赖服务端超时，无客户端超时控制）
      let response: any
      if (task.type === 'vision' && task.mediaBase64) {
        // 对于vision任务，构造包含图片的消息格式
        const visionMessage = {
          role: 'user',
          content: [
            {
              type: 'text',
              text: task.prompt,
            },
            {
              type: 'image_url',
              image_url: {
                url: task.mediaBase64,
              },
            },
          ],
        }
        response = await model.invoke([visionMessage])
      } else {
        // 对于text任务，直接传递prompt
        response = await model.invoke(task.prompt)
      }

      // 解析响应
      const parsedResponse = provider.parseResponse(response)

      // 扩展响应，添加调试信息
      return {
        ...parsedResponse,
        prompt: task.prompt,
        modelConfig: {
          model: modelConfig.model || 'unknown',
          provider: provider.name,
          ...(modelConfig.maxTokens !== undefined && { maxTokens: modelConfig.maxTokens }),
          ...(modelConfig.temperature !== undefined && { temperature: modelConfig.temperature }),
          ...(timeout !== undefined && { timeout }),
        }
      }
    } catch (error) {
      // 使用错误匹配器分析错误类型
      const errorType = LLMErrorMatcher.matchError(provider.name.toLowerCase(), error)
      
      // 增强错误信息，包含错误类型信息
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const enhancedError = new Error(
        `LLM call failed for ${provider.name}/${modelConfig.model || 'unknown'} on task ${task.step}: ${errorMessage} (Error Category: ${errorType?.category || 'unknown'})`
      )
      
      // 保留原始错误的堆栈信息和错误类型
      if (error instanceof Error && error.stack) {
        enhancedError.stack = error.stack
      }
      
      // 添加错误类型到错误对象，供重试逻辑使用
      ;(enhancedError as any).errorType = errorType
      
      throw enhancedError
    }
  }

  private getMaxConcurrent(queueKey: string): number {
    const [type, tier] = queueKey.split('-') as [TaskType, 'free' | 'paid']
    const configs = QUEUE_CONFIGS[type][tier]
    return configs.reduce((sum, config) => sum + config.maxWorkers, 0)
  }

  // ===== 状态查询接口 =====

  getWorkerPoolStatus(): WorkerPoolStatus {
    const queues: QueueStatus[] = []
    let totalPending = 0
    let totalActive = 0

    for (const [queueKey, queue] of Array.from(this.queues.entries())) {
      const [type, tier] = queueKey.split('-') as [TaskType, 'free' | 'paid']
      const configs = QUEUE_CONFIGS[type][tier]
      const activeCount = this.activeCounts.get(queueKey) || 0
      const waitTimes = this.queueWaitTimes.get(queueKey) || []

      for (const config of configs) {
        queues.push({
          provider: config.name,
          tier: tier as 'free' | 'paid',
          type: type as TaskType,
          pending: queue.length,
          active: activeCount,
          maxConcurrent: config.maxWorkers,
          avgWaitTime:
            waitTimes.length > 0
              ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length
              : 0,
          successRate:
            this.taskStats.total > 0
              ? this.taskStats.success / this.taskStats.total
              : 0,
        })
      }

      totalPending += queue.length
      totalActive += activeCount
    }

    return {
      totalQueues: this.queues.size,
      totalPending,
      totalActive,
      queues,
      uptime: Date.now() - this.startTime,
    }
  }

  // ===== 清理方法 =====

  destroy() {
    // 停止所有队列处理器
    for (const [queueKey, processor] of Array.from(
      this.queueProcessors.entries()
    )) {
      if (processor) {
        clearInterval(processor)
      }
    }

    // 取消所有活跃任务
    for (const [taskId, taskPromise] of Array.from(
      this.activeTasks.entries()
    )) {
      const metadata = this.taskMetadata.get(taskId)
      if (metadata?.abortController) {
        metadata.abortController.abort()
      }
    }

    // 清理所有数据
    this.queues.clear()
    this.queueProcessors.clear()
    this.activeTasks.clear()
    this.taskMetadata.clear()
    this.activeCounts.clear()
    this.providerActiveCounts.clear()
    this.queueWaitTimes.clear()
    this.taskCompletionCallbacks.clear()
  }
}

// ===== 全局实例 =====

export const llmScheduler = new LLMScheduler()

// ===== 向后兼容的导出函数 =====

/**
 * 向后兼容：替代原来的executeQueuedSummariesWithLangChain函数
 */
export async function executeQueuedSummariesWithLangChain(
  tasks: SummaryTask[],
  options: OrchestrationOptions = {}
): Promise<SummaryResult[]> {
  return llmScheduler.executeSummaries(tasks, options)
}

/**
 * 向后兼容：替代原来的executeLLMTask函数
 */
export async function executeLLMTask(
  task: LLMTask,
  options: { tier?: 'free' | 'paid'; timeout?: number; priority?: number } = {}
): Promise<LLMTaskResult> {
  return llmScheduler.submitTask(task, options)
}

/**
 * 向后兼容：替代原来的getWorkerPoolStatus函数
 */
export function getWorkerPoolStatus(): WorkerPoolStatus {
  return llmScheduler.getWorkerPoolStatus()
}
