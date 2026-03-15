import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fsp } from 'fs'
import path from 'path'

const nextDebugDir = path.join(process.cwd(), 'tmp', 'task-debug', 'nextjs')
const workerDebugDir = path.join(process.cwd(), 'worker', 'tmp', 'task-debug')

async function cleanupDebugDir() {
  await fsp.rm(nextDebugDir, { recursive: true, force: true })
  await fsp.rm(workerDebugDir, { recursive: true, force: true })
}

describe('task debug sink', () => {
  beforeEach(async () => {
    vi.resetModules()
    await cleanupDebugDir()
  })

  afterEach(async () => {
    vi.resetModules()
    await cleanupDebugDir()
  })

  it('writes a single task-level jsonl file when local debug files are enabled', async () => {
    vi.doMock('@/lib/env', () => ({
      ENV: { LOG_DEBUG: true, LLM_DEBUG: true, SSE_DEBUG: false },
      shouldWriteLocalTaskDebugFiles: () => true,
    }))

    const { appendTaskDebugEvent } = await import('@/lib/observability/task-debug')

    await appendTaskDebugEvent({
      scope: 'llm',
      phase: 'llm_start',
      serviceId: 'svc_debug',
      taskId: 'task_debug',
      templateId: 'job_match',
      meta: { hello: 'world' },
    })

    const filePath = path.join(nextDebugDir, 'svc_debug__task_debug.jsonl')
    const content = await fsp.readFile(filePath, 'utf8')
    expect(content.trim().split('\n')).toHaveLength(1)
    expect(JSON.parse(content.trim())).toMatchObject({
      runtime: 'nextjs',
      scope: 'llm',
      phase: 'llm_start',
      serviceId: 'svc_debug',
      taskId: 'task_debug',
      templateId: 'job_match',
    })
  })

  it('does not write files when debug is disabled', async () => {
    vi.doMock('@/lib/env', () => ({
      ENV: { LOG_DEBUG: false, LLM_DEBUG: true, SSE_DEBUG: false },
      shouldWriteLocalTaskDebugFiles: () => false,
    }))

    const { appendTaskDebugEvent } = await import('@/lib/observability/task-debug')

    await appendTaskDebugEvent({
      scope: 'timeline',
      phase: 'worker_start',
      serviceId: 'svc_disabled',
      taskId: 'task_disabled',
    })

    await expect(
      fsp.readFile(path.join(nextDebugDir, 'svc_disabled__task_disabled.jsonl'), 'utf8'),
    ).rejects.toThrow()
  })

  it('does not write files when production-like runtimes disallow local debug files', async () => {
    vi.doMock('@/lib/env', () => ({
      ENV: { LOG_DEBUG: true, LLM_DEBUG: true, SSE_DEBUG: true },
      shouldWriteLocalTaskDebugFiles: () => false,
    }))

    const { markTimeline } = await import('@/lib/observability/timeline')

    await markTimeline('svc_prod', 'worker_start', { taskId: 'task_prod' })

    await expect(
      fsp.readFile(path.join(nextDebugDir, 'svc_prod__task_prod.jsonl'), 'utf8'),
    ).rejects.toThrow()
  })
})
