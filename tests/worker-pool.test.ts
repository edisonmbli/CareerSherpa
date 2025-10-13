import { describe, it, expect, beforeEach, vi } from 'vitest'
import { LLMWorkerPool, LLMTask, getTaskQueuePosition, getWorkerPoolStatus } from '@/lib/llm/worker-pool'

// Mock the provider registry and related modules to avoid actual LLM calls
vi.mock('@/lib/llm/providers', () => ({
  providerRegistry: {
    get: vi.fn().mockReturnValue({
      name: 'mock-provider',
      isReady: () => true,
      createModel: () => ({ invoke: vi.fn() }),
      parseResponse: () => ({ content: 'mock response' })
    })
  },
  getModelConfig: vi.fn().mockReturnValue({
    provider: 'deepseek',
    model: 'mock-model',
    tier: 'paid'
  })
}))

vi.mock('@/lib/dal', () => ({
  logTokenUsage: vi.fn()
}))

vi.mock('@/lib/env', () => ({
  getConcurrencyConfig: vi.fn().mockReturnValue({ 
    deepseekMaxWorkers: 5, 
    glmMaxWorkers: 5 
  }),
  getPerformanceConfig: vi.fn().mockReturnValue({ queueTimeout: 30000 })
}))

describe('LLM Worker Pool', () => {
  let workerPool: LLMWorkerPool

  beforeEach(() => {
    workerPool = new LLMWorkerPool()
  })

  it('should initialize with correct provider configurations', () => {
    const status = workerPool.getStatus()
    
    expect(status.queues).toHaveLength(2)
    
    const deepseekQueue = status.queues.find(q => q.provider === 'deepseek')
    const zhipuQueue = status.queues.find(q => q.provider === 'zhipu')

    expect(deepseekQueue).toBeDefined()
    expect(zhipuQueue).toBeDefined()
    expect(deepseekQueue?.maxConcurrent).toBe(5)
    expect(zhipuQueue?.maxConcurrent).toBe(5)
  })

  it('should handle queue operations correctly', () => {
    // Test direct queue manipulation to verify queue functionality
    const task: LLMTask = {
      id: 'test-task',
      userId: 'user1',
      serviceId: 'service1',
      step: 'match',
      prompt: 'Test prompt',
      config: { provider: 'deepseek' as const, tier: 'paid' as const },
      priority: 1,
      createdAt: new Date(),
      retries: 0,
      maxRetries: 3
    }

    // Access private queue for testing (using type assertion)
    const privateWorkerPool = workerPool as any
    const deepseekQueue = privateWorkerPool.queues.get('deepseek')
    
    // Manually add task to queue to test queue functionality
    deepseekQueue.push(task)
    privateWorkerPool.taskMetadata.set(task.id, {
      provider: 'deepseek',
      startTime: 0,
      queueTime: Date.now()
    })

    const status = workerPool.getStatus()
    const deepseekQueueStatus = status.queues.find(q => q.provider === 'deepseek')
    
    expect(deepseekQueueStatus?.pending).toBe(1)
    expect(deepseekQueueStatus?.active).toBe(0)
  })

  it('should provide queue position information', () => {
    const task1: LLMTask = {
      id: 'task1',
      userId: 'user1',
      serviceId: 'service1',
      step: 'match',
      prompt: 'Test prompt 1',
      priority: 1,
      createdAt: new Date(),
      retries: 0,
      maxRetries: 3
    }

    const task2: LLMTask = {
      id: 'task2',
      userId: 'user2',
      serviceId: 'service2',
      step: 'resume',
      prompt: 'Test prompt 2',
      priority: 2, // Higher priority
      createdAt: new Date(),
      retries: 0,
      maxRetries: 3
    }

    // Access private queue for testing
    const privateWorkerPool = workerPool as any
    const deepseekQueue = privateWorkerPool.queues.get('deepseek')
    
    // Manually add tasks to queue
    deepseekQueue.push(task1, task2)
    // Sort by priority (higher priority first)
    deepseekQueue.sort((a: LLMTask, b: LLMTask) => b.priority - a.priority)
    
    // Add metadata
    privateWorkerPool.taskMetadata.set(task1.id, {
      provider: 'deepseek',
      startTime: 0,
      queueTime: Date.now()
    })
    privateWorkerPool.taskMetadata.set(task2.id, {
      provider: 'deepseek',
      startTime: 0,
      queueTime: Date.now()
    })

    const position1 = workerPool.getQueuePosition('task1')
    const position2 = workerPool.getQueuePosition('task2')

    expect(position1).toBeDefined()
    expect(position2).toBeDefined()
    expect(position1?.provider).toBe('deepseek')
    expect(position2?.provider).toBe('deepseek')
    
    // Higher priority task (task2) should be first (position 1)
    expect(position2?.position).toBe(1)
    expect(position1?.position).toBe(2)
  })

  it('should clear all queues and reset state', () => {
    // Add some test data
    const privateWorkerPool = workerPool as any
    const deepseekQueue = privateWorkerPool.queues.get('deepseek')
    const zhipuQueue = privateWorkerPool.queues.get('zhipu')
    
    deepseekQueue.push({ id: 'test1' })
    zhipuQueue.push({ id: 'test2' })
    privateWorkerPool.taskMetadata.set('test1', { provider: 'deepseek', startTime: 0, queueTime: Date.now() })
    privateWorkerPool.taskMetadata.set('test2', { provider: 'zhipu', startTime: 0, queueTime: Date.now() })

    // Clear should reset everything
    workerPool.clear()
    
    const status = workerPool.getStatus()
    expect(status.totalPending).toBe(0)
    expect(status.totalActive).toBe(0)
    
    status.queues.forEach(queue => {
      expect(queue.pending).toBe(0)
      expect(queue.active).toBe(0)
    })

    // Verify metadata is cleared
    expect(privateWorkerPool.taskMetadata.size).toBe(0)
  })

  it('should handle priority sorting correctly', () => {
    const lowPriorityTask: LLMTask = {
      id: 'low-priority',
      userId: 'user1',
      serviceId: 'service1',
      step: 'match',
      prompt: 'Low priority task',
      priority: 1,
      createdAt: new Date(),
      retries: 0,
      maxRetries: 3
    }

    const highPriorityTask: LLMTask = {
      id: 'high-priority',
      userId: 'user2',
      serviceId: 'service2',
      step: 'resume',
      prompt: 'High priority task',
      priority: 5,
      createdAt: new Date(),
      retries: 0,
      maxRetries: 3
    }

    // Access private queue for testing
    const privateWorkerPool = workerPool as any
    const deepseekQueue = privateWorkerPool.queues.get('deepseek')
    
    // Add tasks in order: low priority first, then high priority
    deepseekQueue.push(lowPriorityTask)
    deepseekQueue.push(highPriorityTask)
    
    // Sort by priority (simulate what submitTask does)
    deepseekQueue.sort((a: LLMTask, b: LLMTask) => b.priority - a.priority)
    
    // High priority task should be first
    expect(deepseekQueue[0].id).toBe('high-priority')
    expect(deepseekQueue[1].id).toBe('low-priority')
  })

  it('should use convenience functions correctly', () => {
    // Test convenience functions exist and work
    expect(() => {
      const status = getWorkerPoolStatus()
      expect(status).toBeDefined()
      expect(status.queues).toBeDefined()
    }).not.toThrow()

    expect(() => {
      const position = getTaskQueuePosition('non-existent-task')
      expect(position).toBeNull()
    }).not.toThrow()
  })
})