import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LLMWorkerPool } from '@/lib/llm/worker-pool'

// Mock dependencies
vi.mock('@/lib/llm/providers', () => ({
  providerRegistry: new Map([
    ['deepseek', { name: 'deepseek', execute: vi.fn() }],
    ['zhipu', { name: 'zhipu', execute: vi.fn() }]
  ]),
  getModelConfig: vi.fn().mockReturnValue({
    provider: 'deepseek',
    model: 'deepseek-chat',
    maxTokens: 1000,
    temperature: 0.7
  })
}))

vi.mock('@/lib/dal', () => ({
  logTokenUsage: vi.fn()
}))

vi.mock('@/lib/env', () => ({
  getConcurrencyConfig: vi.fn().mockReturnValue({ 
    deepseekMaxWorkers: 2,  // 设置较低的并发限制用于测试
    glmMaxWorkers: 1 
  }),
  getPerformanceConfig: vi.fn().mockReturnValue({ queueTimeout: 30000 })
}))

describe('Concurrency Control', () => {
  let workerPool: LLMWorkerPool

  beforeEach(() => {
    vi.clearAllMocks()
    workerPool = new LLMWorkerPool()
  })

  it('should respect maximum concurrent workers per provider', () => {
    const status = workerPool.getStatus()
    
    // 验证每个provider的最大并发数设置正确
    const deepseekQueue = status.queues.find(q => q.provider === 'deepseek')
    const zhipuQueue = status.queues.find(q => q.provider === 'zhipu')
    
    expect(deepseekQueue?.maxConcurrent).toBe(2)
    expect(zhipuQueue?.maxConcurrent).toBe(1)
  })

  it('should queue tasks when max concurrency is reached', () => {
    // 直接操作内部队列来模拟并发控制
    const deepseekQueue = workerPool['queues'].get('deepseek')!
    const activeTasks = workerPool['activeTasks']
    const taskMetadata = workerPool['taskMetadata']
    
    // 模拟2个活跃任务（达到deepseek的最大并发数）
    activeTasks.set('task1', Promise.resolve({
      taskId: 'task1',
      success: true,
      duration: 1000,
      provider: 'deepseek',
      model: 'deepseek-chat'
    }))
    activeTasks.set('task2', Promise.resolve({
      taskId: 'task2',
      success: true,
      duration: 1000,
      provider: 'deepseek',
      model: 'deepseek-chat'
    }))
    
    // 添加对应的任务元数据
    taskMetadata.set('task1', {
      provider: 'deepseek',
      startTime: Date.now(),
      queueTime: Date.now()
    })
    taskMetadata.set('task2', {
      provider: 'deepseek',
      startTime: Date.now(),
      queueTime: Date.now()
    })
    
    // 添加第3个任务到队列（应该被排队等待）
    const task3 = {
      id: 'task3',
      userId: 'user1',
      serviceId: 'service1',
      step: 'match' as const,
      prompt: 'test prompt',
      priority: 1,
      createdAt: new Date(),
      retries: 0,
      maxRetries: 3
    }
    
    deepseekQueue.push(task3)
    
    // 记录任务元数据
    workerPool['taskMetadata'].set('task3', {
      provider: 'deepseek',
      startTime: Date.now(),
      queueTime: Date.now()
    })
    
    const status = workerPool.getStatus()
    const deepseekStatus = status.queues.find(q => q.provider === 'deepseek')
    
    expect(deepseekStatus?.active).toBe(2)  // 2个活跃任务
    expect(deepseekStatus?.pending).toBe(1) // 1个等待任务
    expect(deepseekStatus?.maxConcurrent).toBe(2)
  })

  it('should handle different providers independently', () => {
    const deepseekQueue = workerPool['queues'].get('deepseek')!
    const zhipuQueue = workerPool['queues'].get('zhipu')!
    const activeTasks = workerPool['activeTasks']
    const taskMetadata = workerPool['taskMetadata']
    
    // deepseek达到最大并发
    activeTasks.set('deepseek1', Promise.resolve({
      taskId: 'deepseek1',
      success: true,
      duration: 1000,
      provider: 'deepseek',
      model: 'deepseek-chat'
    }))
    activeTasks.set('deepseek2', Promise.resolve({
      taskId: 'deepseek2',
      success: true,
      duration: 1000,
      provider: 'deepseek',
      model: 'deepseek-chat'
    }))
    
    // zhipu达到最大并发
    activeTasks.set('zhipu1', Promise.resolve({
      taskId: 'zhipu1',
      success: true,
      duration: 1000,
      provider: 'zhipu',
      model: 'glm-4'
    }))
    
    // 添加对应的任务元数据
    taskMetadata.set('deepseek1', {
      provider: 'deepseek',
      startTime: Date.now(),
      queueTime: Date.now()
    })
    taskMetadata.set('deepseek2', {
      provider: 'deepseek',
      startTime: Date.now(),
      queueTime: Date.now()
    })
    taskMetadata.set('zhipu1', {
      provider: 'zhipu',
      startTime: Date.now(),
      queueTime: Date.now()
    })
    
    // 添加等待任务
    const deepseekTask = {
      id: 'deepseek3',
      userId: 'user1',
      serviceId: 'service1',
      step: 'match' as const,
      prompt: 'test prompt',
      priority: 1,
      createdAt: new Date(),
      retries: 0,
      maxRetries: 3
    }
    
    const zhipuTask = {
      id: 'zhipu2',
      userId: 'user1',
      serviceId: 'service1',
      step: 'match' as const,
      prompt: 'test prompt',
      priority: 1,
      createdAt: new Date(),
      retries: 0,
      maxRetries: 3
    }
    
    deepseekQueue.push(deepseekTask)
    zhipuQueue.push(zhipuTask)
    
    // 记录任务元数据
    workerPool['taskMetadata'].set('deepseek3', {
      provider: 'deepseek',
      startTime: Date.now(),
      queueTime: Date.now()
    })
    workerPool['taskMetadata'].set('zhipu2', {
      provider: 'zhipu',
      startTime: Date.now(),
      queueTime: Date.now()
    })
    
    const status = workerPool.getStatus()
    
    expect(status.totalActive).toBe(3)  // 总共3个活跃任务
    expect(status.totalPending).toBe(2) // 总共2个等待任务
    
    const deepseekStatus = status.queues.find(q => q.provider === 'deepseek')
    const zhipuStatus = status.queues.find(q => q.provider === 'zhipu')
    
    expect(deepseekStatus?.active).toBe(2)
    expect(deepseekStatus?.pending).toBe(1)
    expect(zhipuStatus?.active).toBe(1)
    expect(zhipuStatus?.pending).toBe(1)
  })

  it('should clear all queues and reset concurrency state', () => {
    // 设置一些活跃任务和队列任务
    const activeTasks = workerPool['activeTasks']
    const deepseekQueue = workerPool['queues'].get('deepseek')!
    
    activeTasks.set('task1', Promise.resolve({
      taskId: 'task1',
      success: true,
      duration: 1000,
      provider: 'deepseek',
      model: 'deepseek-chat'
    }))
    
    deepseekQueue.push({
      id: 'task2',
      userId: 'user1',
      serviceId: 'service1',
      step: 'match' as const,
      prompt: 'test prompt',
      priority: 1,
      createdAt: new Date(),
      retries: 0,
      maxRetries: 3
    })
    
    workerPool['taskMetadata'].set('task2', {
      provider: 'deepseek',
      startTime: Date.now(),
      queueTime: Date.now()
    })
    
    // 验证有任务存在
    let status = workerPool.getStatus()
    expect(status.totalActive).toBeGreaterThan(0)
    expect(status.totalPending).toBeGreaterThan(0)
    
    // 清空所有队列
    workerPool.clear()
    
    // 验证所有状态都被重置
    status = workerPool.getStatus()
    expect(status.totalActive).toBe(0)
    expect(status.totalPending).toBe(0)
    
    status.queues.forEach(queue => {
      expect(queue.active).toBe(0)
      expect(queue.pending).toBe(0)
    })
  })
})