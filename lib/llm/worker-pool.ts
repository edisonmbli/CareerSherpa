import { LLMConfig, LLMProvider, LLMResponse, providerRegistry, getModelConfig } from './providers'
import { logTokenUsage } from '@/lib/dal'
import { getConcurrencyConfig, getPerformanceConfig } from '@/lib/env'

export interface LLMTask {
  id: string
  userId: string
  serviceId: string
  step: 'match' | 'resume' | 'interview'
  prompt: string
  config?: Partial<LLMConfig>
  priority: number
  createdAt: Date
  retries: number
  maxRetries: number
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
}

export interface QueueStatus {
  provider: string
  pending: number
  active: number
  maxConcurrent: number
  avgWaitTime: number
}

export interface WorkerPoolStatus {
  queues: QueueStatus[]
  totalActive: number
  totalPending: number
}

/**
 * LLM Worker Pool with provider-specific queue system
 */
export class LLMWorkerPool {
  private queues = new Map<string, LLMTask[]>() // provider -> queue
  private activeTasks = new Map<string, Promise<LLMTaskResult>>()
  private taskMetadata = new Map<string, { provider: string; startTime: number; queueTime: number }>()
  private maxConcurrentByProvider = new Map<string, number>()
  private queueWaitTimes = new Map<string, number[]>() // provider -> wait times for avg calculation

  constructor() {
    const config = getConcurrencyConfig()
    
    // Initialize provider-specific configurations
    this.maxConcurrentByProvider.set('deepseek', config.deepseekMaxWorkers)
    this.maxConcurrentByProvider.set('zhipu', config.glmMaxWorkers)
    
    // Initialize queues for each provider
    this.queues.set('deepseek', [])
    this.queues.set('zhipu', [])
    
    // Initialize wait time tracking
    this.queueWaitTimes.set('deepseek', [])
    this.queueWaitTimes.set('zhipu', [])
  }

  /**
   * Submit a task to the appropriate provider queue
   */
  async submitTask(task: LLMTask, tier: 'free' | 'paid' = 'free'): Promise<LLMTaskResult> {
    // Determine provider based on task configuration
    const modelConfig = this.getTaskModelConfig(task, tier)
    const provider = modelConfig.provider
    
    const queue = this.queues.get(provider)
    if (!queue) {
      throw new Error(`Unknown provider: ${provider}`)
    }
    
    // Record queue entry time
    const queueTime = Date.now()
    this.taskMetadata.set(task.id, { provider, startTime: 0, queueTime })
    
    // Add to queue with priority sorting
    queue.push(task)
    queue.sort((a: LLMTask, b: LLMTask) => b.priority - a.priority)

    // Start processing if capacity allows
    this.processQueue(provider)

    // Return promise that resolves when task completes
    return this.waitForTask(task.id)
  }

  /**
   * Process tasks from the specified provider queue
   */
  private async processQueue(provider: string) {
    const queue = this.queues.get(provider)
    const maxConcurrent = this.maxConcurrentByProvider.get(provider)
    
    if (!queue || !maxConcurrent) {
      return
    }
    
    // Count active tasks for this provider
    const activeProviderTasks = Array.from(this.activeTasks.keys())
      .filter(id => {
        const metadata = this.taskMetadata.get(id)
        return metadata && metadata.provider === provider
      }).length

    // Process tasks up to concurrency limit
    while (queue.length > 0 && activeProviderTasks < maxConcurrent) {
      const task = queue.shift()!
      
      // Update task metadata with start time
      const metadata = this.taskMetadata.get(task.id)
      if (metadata) {
        metadata.startTime = Date.now()
        const waitTime = metadata.startTime - metadata.queueTime
        
        // Track wait times for average calculation
        const waitTimes = this.queueWaitTimes.get(provider) || []
        waitTimes.push(waitTime)
        // Keep only last 100 wait times for rolling average
        if (waitTimes.length > 100) {
          waitTimes.shift()
        }
        this.queueWaitTimes.set(provider, waitTimes)
      }
      
      const taskPromise = this.executeTask(task, provider)
      this.activeTasks.set(task.id, taskPromise)

      // Clean up when task completes
      taskPromise.finally(() => {
        this.activeTasks.delete(task.id)
        this.taskMetadata.delete(task.id)
        // Continue processing queue
        this.processQueue(provider)
      })
    }
  }

  /**
   * Execute a single LLM task
   */
  private async executeTask(task: LLMTask, provider: string): Promise<LLMTaskResult> {
    const startTime = Date.now()
    
    try {
      // Get model configuration - determine tier based on task priority
      const tier = this.getTierForTask(task)
      const modelConfig = this.getTaskModelConfig(task, tier)
      
      // Get provider instance
      const providerInstance = providerRegistry.get(provider)
      if (!providerInstance || !providerInstance.isReady()) {
        throw new Error(`Provider ${provider} not available`)
      }

      // Create model instance
      const model = providerInstance.createModel(modelConfig)
      
      // Execute with retry logic
      const response = await this.executeWithRetry(model, task, providerInstance)
      
      const duration = Date.now() - startTime
      
      // Log token usage
      if (response.usage) {
        await logTokenUsage({
          userId: task.userId,
          serviceId: task.serviceId,
          taskId: task.id,
          model: modelConfig.model,
          provider: modelConfig.provider,
          inputTokens: response.usage.inputTokens || 0,
          outputTokens: response.usage.outputTokens || 0,
        })
      }

      return {
        taskId: task.id,
        success: true,
        response,
        duration,
        provider: provider,
        model: modelConfig.model,
      }
    } catch (error) {
      const duration = Date.now() - startTime
      
      return {
        taskId: task.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration,
        provider: 'unknown',
        model: 'unknown',
      }
    }
  }

  /**
   * Execute LLM call with exponential backoff retry
   */
  private async executeWithRetry(
    model: any,
    task: LLMTask,
    provider: LLMProvider,
    attempt = 1
  ): Promise<LLMResponse> {
    try {
      const response = await model.invoke([{ role: 'user', content: task.prompt }])
      return provider.parseResponse(response)
    } catch (error) {
      if (attempt >= task.maxRetries) {
        throw error
      }

      // Exponential backoff: 1s, 2s, 4s, 8s...
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000)
      await new Promise(resolve => setTimeout(resolve, delay))
      
      return this.executeWithRetry(model, task, provider, attempt + 1)
    }
  }

  /**
   * Get model configuration for a task
   */
  private getTaskModelConfig(task: LLMTask, tier: 'free' | 'paid'): LLMConfig {
    const baseConfig = getModelConfig(tier, this.getModelTypeForStep(task.step))
    
    // Apply task-specific overrides
    return {
      ...baseConfig,
      ...task.config,
    }
  }

  /**
   * Get model type based on task step
   */
  private getModelTypeForStep(step: string): 'text' | 'vision' | 'reasoning' {
    switch (step) {
      case 'match':
        return 'reasoning' // Use reasoning model for job matching
      case 'resume':
        return 'text' // Use text model for resume editing
      case 'interview':
        return 'text' // Use text model for interview prep
      default:
        return 'text'
    }
  }

  /**
   * Determine tier for a task (for queue management)
   */
  private getTierForTask(task: LLMTask): 'free' | 'paid' {
    // This could be determined by user subscription, task complexity, etc.
    // For now, use a simple heuristic
    return task.priority > 5 ? 'paid' : 'free'
  }

  /**
   * Wait for a specific task to complete
   */
  private async waitForTask(taskId: string): Promise<LLMTaskResult> {
    // Check if task is already active
    const activeTask = this.activeTasks.get(taskId)
    if (activeTask) {
      return activeTask
    }

    // Poll for task completion (fallback)
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        const task = this.activeTasks.get(taskId)
        if (task) {
          clearInterval(checkInterval)
          task.then(resolve).catch(reject)
        }
      }, 100)

      // Timeout after 60 seconds
      setTimeout(() => {
        clearInterval(checkInterval)
        reject(new Error(`Task ${taskId} timed out`))
      }, 60000)
    })
  }

  /**
   * Get queue status
   */
  getStatus(): WorkerPoolStatus {
    const queues: QueueStatus[] = []
    let totalPending = 0
    
    for (const [provider, queue] of Array.from(this.queues.entries())) {
      const pending = queue.length
      const active = Array.from(this.activeTasks.keys())
        .filter(id => {
          const metadata = this.taskMetadata.get(id)
          return metadata && metadata.provider === provider
        }).length
      
      const waitTimes = this.queueWaitTimes.get(provider) || []
      const avgWaitTime = waitTimes.length > 0 
        ? waitTimes.reduce((sum, time) => sum + time, 0) / waitTimes.length 
        : 0
      
      queues.push({
        provider,
        pending,
        active,
        maxConcurrent: this.maxConcurrentByProvider.get(provider) || 0,
        avgWaitTime
      })
      
      totalPending += pending
    }
    
    return {
      queues,
      totalActive: this.activeTasks.size,
      totalPending
    }
  }

  /**
   * Get queue position for a specific task
   */
  getQueuePosition(taskId: string): { position: number; provider: string; estimatedWaitTime: number } | null {
    const metadata = this.taskMetadata.get(taskId)
    if (!metadata) {
      return null
    }
    
    const queue = this.queues.get(metadata.provider)
    if (!queue) {
      return null
    }
    
    const position = queue.findIndex(task => task.id === taskId)
    if (position === -1) {
      return null // Task not in queue (might be active)
    }
    
    const waitTimes = this.queueWaitTimes.get(metadata.provider) || []
    const avgWaitTime = waitTimes.length > 0 
      ? waitTimes.reduce((sum, time) => sum + time, 0) / waitTimes.length 
      : 30000 // Default 30 seconds if no history
    
    const estimatedWaitTime = position * avgWaitTime
    
    return {
      position: position + 1, // 1-based position
      provider: metadata.provider,
      estimatedWaitTime
    }
  }

  /**
   * Clear all queues (for testing/cleanup)
   */
  clear() {
    for (const queue of Array.from(this.queues.values())) {
      queue.length = 0
    }
    this.activeTasks.clear()
    this.taskMetadata.clear()
    for (const waitTimes of Array.from(this.queueWaitTimes.values())) {
      waitTimes.length = 0
    }
  }
}

// Global worker pool instance
export const llmWorkerPool = new LLMWorkerPool()

/**
 * Get queue position for a task (convenience function)
 */
export function getTaskQueuePosition(taskId: string) {
  return llmWorkerPool.getQueuePosition(taskId)
}

/**
 * Get worker pool status (convenience function)
 */
export function getWorkerPoolStatus() {
  return llmWorkerPool.getStatus()
}

/**
 * High-level function to execute LLM tasks
 */
export async function executeLLMTask(
  userId: string,
  serviceId: string,
  step: 'match' | 'resume' | 'interview',
  prompt: string,
  options: {
    tier?: 'free' | 'paid'
    priority?: number
    config?: Partial<LLMConfig>
    maxRetries?: number
  } = {}
): Promise<LLMTaskResult> {
  const task: LLMTask = {
    id: `${serviceId}-${step}-${Date.now()}`,
    userId,
    serviceId,
    step,
    prompt,
    config: options.config,
    priority: options.priority ?? 1,
    createdAt: new Date(),
    retries: 0,
    maxRetries: options.maxRetries ?? 3,
  }

  return llmWorkerPool.submitTask(task, options.tier ?? 'free')
}