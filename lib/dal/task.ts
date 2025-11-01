import { prisma } from '@/lib/prisma'
import type { Task, TaskKind, TaskStatus, TaskOutput } from '@prisma/client'

export async function createTask(data: {
  serviceId: string
  requestedBy: string
  kind: TaskKind
  inputContextJson?: any
  contextRefs?: any
  meta?: any
}): Promise<Task> {
  return await prisma.task.create({ data })
}

export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus
): Promise<Task> {
  return await prisma.task.update({
    where: { id: taskId },
    data: { status },
  })
}

export async function createTaskOutput(data: {
  taskId: string
  version: number
  previousResponseId?: string
  outputJson?: any
  outputText?: string
  model?: string
  provider?: string
  inputTokens?: number
  outputTokens?: number
  cost?: number
}): Promise<TaskOutput> {
  return await prisma.taskOutput.create({ data })
}