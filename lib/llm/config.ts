export type TaskLimits = {
  maxTokens: number
}

export const TASK_LIMITS: Record<string, TaskLimits> = {
  resume_summary: { maxTokens: 8000 },
  detailed_resume_summary: { maxTokens: 15000 },
  job_summary: { maxTokens: 8000 },
  job_match: { maxTokens: 15000 },
  resume_customize: { maxTokens: 15000 },
  interview_prep: { maxTokens: 8000 },
}

export function getTaskLimits(taskId: string): TaskLimits {
  return TASK_LIMITS[taskId] ?? { maxTokens: 8000 }
}

export function estimateEtaMinutes(taskId: string, isFree: boolean): number {
  const t = String(taskId)
  if (t === 'resume_summary') {
    return isFree ? 3 : 2
  }
  if (t === 'detailed_resume_summary') {
    return isFree ? 4 : 3
  }
  return isFree ? 3 : 2
}
