export type TaskConfig = {
  maxTokens: number
  temperature?: number
  timeoutMs?: number // Add timeout configuration
}

// Centralized configuration for all LLM tasks
// Temperature: 0.3 for extraction (default), 1.0 for analysis/creation
export const TASK_CONFIG: Record<string, TaskConfig> = {
  resume_summary: { maxTokens: 8000, temperature: 0.3, timeoutMs: 180000 },
  job_summary: { maxTokens: 8000, temperature: 0.3, timeoutMs: 180000 },
  job_match: { maxTokens: 15000, temperature: 1.0, timeoutMs: 180000 },
  resume_customize: { maxTokens: 15000, temperature: 1.0, timeoutMs: 180000 },
  interview_prep: { maxTokens: 8000, temperature: 1.0, timeoutMs: 180000 },
  ocr_extract: { maxTokens: 4000, temperature: 0.1, timeoutMs: 180000 },
  detailed_resume_summary: {
    maxTokens: 15000,
    temperature: 0.3,
    timeoutMs: 180000,
  },
  pre_match_audit: {
    maxTokens: 4000,
    temperature: 0.8, // Slightly creative for risk finding
    timeoutMs: 180000,
  },
}

export function getTaskConfig(taskId: string): TaskConfig {
  return (
    TASK_CONFIG[taskId] ?? {
      maxTokens: 8000,
      temperature: 0.3,
      timeoutMs: 180000,
    }
  )
}

// Deprecated alias for backward compatibility (transition)
export function getTaskLimits(taskId: string): { maxTokens: number } {
  return getTaskConfig(taskId)
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
