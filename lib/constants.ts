export const LEDGER_PAGE_SIZE = 10
export const LEDGER_TYPES = [
  'SIGNUP_BONUS',
  'PURCHASE',
  'SERVICE_DEBIT',
  'FAILURE_REFUND',
  'MANUAL_ADJUST',
] as const
export const LEDGER_STATUS = [
  'PENDING',
  'SUCCESS',
  'FAILED',
  'REFUNDED',
] as const

/**
 * Job Match Score Thresholds (V5.1 Design Standard)
 * @see docs/56.Job_Match_Result_Design.md
 */
export const MATCH_SCORE_THRESHOLDS = {
  HIGHLY_MATCHED: 85, // Tier 1: Emerald
  GOOD_FIT: 60, // Tier 2: Amber
} as const

export const TASK_COSTS: Record<string, number> = {
  job_match: 1,
  resume_customize: 1,
  interview_prep: 1,
  resume_summary: 1,
  detailed_resume_summary: 1,
}

export const JOB_IMAGE_MAX_BYTES = 600 * 1024
export const AVATAR_MAX_BYTES = 300 * 1024

export const RATE_LIMIT_FAIL_CLOSED_RETRY_AFTER_SEC = 60
export const CONCURRENCY_PERSISTENT_TTL_SECONDS = 30 * 24 * 60 * 60
export const SSE_IDLE_WARNING_MS = 20000
export const SSE_DEBUG_STATUS_INTERVAL_MS = 10000
export const QSTASH_WORKER_RETRIES = 3
export const QSTASH_RETRY_BACKOFF_BASE_MS = 1000
export const WORKBENCH_RECENT_COMPLETION_WINDOW_MS = 15000
export const WORKBENCH_CUSTOMIZE_REFRESH_DELAY_MS = 500
export const WORKBENCH_CUSTOMIZE_REFRESH_RETRY_MS = 2000
export const WORKBENCH_CUSTOMIZE_REFRESH_RETRY_MAX = 3
export const WORKBENCH_CREATE_PENDING_PROGRESS = 12
export const WORKBENCH_REFRESH_GUARD_MS = 2500
export const WORKBENCH_QUOTA_CACHE_SECONDS = 15
export const WORKBENCH_LEDGER_CACHE_SECONDS = 15

export const UI_LOCALE_LABELS = {
  zh: '中文',
  en: 'English',
} as const

export const DEFAULT_SECTION_ORDER = [
  'basics',
  'summary',
  'workExperiences',
  'projectExperiences',
  'educations',
  'skills',
  'certificates',
  'hobbies',
  'customSections',
] as const

export const RESUME_INTERACTIVE_PADDING_X_RATIO = 0.6
export const RESUME_INTERACTIVE_PADDING_Y_RATIO = 0.45
export const RESUME_SCREEN_BASE_WIDTH_PX = 794
export const RESUME_SCREEN_DESKTOP_SCALE = 0.85
export const RESUME_SCREEN_MIN_SCALE = 0.25
export const RESUME_SCREEN_MOBILE_BREAKPOINT_PX = 768
export const RESUME_SCREEN_MOBILE_PADDING_PX = 16
export const RESUME_SCREEN_DESKTOP_PADDING_PX = 40

export const WORKBENCH_PROGRESS_CONFIG = {
  free: {
    JOB_VISION_PENDING: [0, 10, 10000],
    JOB_VISION_STREAMING: [10, 40, 30000],
    JOB_VISION_COMPLETED: [40, 40, 0],
    SUMMARY_PENDING: [0, 10, 10000],
    SUMMARY_STREAMING: [10, 40, 30000],
    SUMMARY_COMPLETED: [40, 40, 0],
    MATCH_PENDING: [40, 50, 10000],
    MATCH_STREAMING: [50, 99, 60000],
    MATCH_COMPLETED: [100, 100, 0],
    INTERVIEW_PENDING: [0, 20, 10000],
    INTERVIEW_STREAMING: [20, 95, 60000],
    INTERVIEW_COMPLETED: [100, 100, 0],
  },
  paid: {
    OCR_PENDING: [0, 10, 15000],
    OCR_STREAMING: [10, 20, 30000],
    OCR_COMPLETED: [20, 20, 0],
    SUMMARY_PENDING: [20, 25, 10000],
    SUMMARY_STREAMING: [25, 45, 30000],
    SUMMARY_COMPLETED: [45, 45, 0],
    PREMATCH_PENDING: [45, 50, 10000],
    PREMATCH_STREAMING: [50, 65, 30000],
    PREMATCH_COMPLETED: [65, 65, 0],
    MATCH_PENDING: [65, 70, 10000],
    MATCH_STREAMING: [70, 99, 90000],
    MATCH_COMPLETED: [100, 100, 0],
    INTERVIEW_PENDING: [0, 20, 10000],
    INTERVIEW_STREAMING: [20, 95, 60000],
    INTERVIEW_COMPLETED: [100, 100, 0],
  },
} as const

export const WORKBENCH_PROGRESS_DEFAULT = [0, 0, 60000] as const

export function getTaskCost(taskKey: keyof typeof TASK_COSTS): number {
  return TASK_COSTS[taskKey] ?? 0
}
