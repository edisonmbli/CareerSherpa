export const LEDGER_PAGE_SIZE = 10
export const LEDGER_TYPES = ['SIGNUP_BONUS', 'PURCHASE', 'SERVICE_DEBIT', 'FAILURE_REFUND', 'MANUAL_ADJUST'] as const
export const LEDGER_STATUS = ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'] as const

export const TASK_COSTS: Record<string, number> = {
  job_match: 2,
  resume_customize: 1,
  interview_prep: 1,
}

export function getTaskCost(taskKey: keyof typeof TASK_COSTS): number {
  return TASK_COSTS[taskKey] ?? 0
}
