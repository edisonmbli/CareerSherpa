/**
 * Workbench Stage Derivation Utilities
 *
 * This module contains pure functions for deriving UI state from workbench status.
 * Extracted from ServiceDisplay.tsx to improve modularity and testability.
 */

import type { StepId } from '@/components/workbench/StepperProgress'
import type { WorkbenchStatusV2 } from '@/lib/stores/workbench-v2.store'
import {
  WORKBENCH_PROGRESS_CONFIG,
  WORKBENCH_PROGRESS_DEFAULT,
} from '@/lib/constants'

/**
 * CTA (Call to Action) button configuration
 */
export interface CtaConfig {
  show: boolean
  label: string
  action: 'customize' | 'interview' | 'retry_match' | 'none'
  disabled: boolean
}

/**
 * Derived stage information for the workbench UI
 */
export interface DerivedStage {
  currentStep: StepId
  maxUnlockedStep: StepId
  cta: CtaConfig | null
  statusMessage: string
  progressValue: number
}

/**
 * Dictionary type for i18n strings used in deriveStage
 */
export interface WorkbenchDict {
  workbench?: {
    statusText?: Record<string, string>
    statusConsole?: Record<string, string>
    customize?: { start?: string }
    interviewUi?: { start?: string }
  }
}

/**
 * Derives the current stage, CTA, and status information from workbench state.
 *
 * This function implements the step calculation, unlock logic, CTA determination,
 * and status message derivation based on the current execution status.
 *
 * @param status - Current workbench execution status
 * @param customizeStatus - Status of the customize step ('IDLE' | 'PENDING' | 'COMPLETED' | 'FAILED')
 * @param interviewStatus - Status of the interview step ('IDLE' | 'PENDING' | 'COMPLETED' | 'FAILED')
 * @param dict - i18n dictionary for status messages
 * @param isPending - Whether a transition is pending (disables CTA)
 * @param tabValue - Currently selected tab ('match' | 'customize' | 'interview')
 * @param statusDetail - Optional status detail code for message lookup
 * @param errorMessage - Optional error message (currently unused but reserved)
 * @param simulatedProgress - Current simulated progress (0-100) from time-based simulation
 * @returns Derived stage information for UI rendering
 */
export function deriveStage(
  status: WorkbenchStatusV2,
  dict: WorkbenchDict,
  isPending: boolean,
  statusDetail: string | null,
  _errorMessage: string | null, // Reserved for future use
  simulatedProgress: number = 0, // Time-based simulated progress
  isPaid: boolean = false,
): DerivedStage {
  let currentStep: StepId = 1
  let maxUnlockedStep: StepId = 1
  let cta: CtaConfig | null = null

  const isCustomizePending = status === 'CUSTOMIZE_PENDING'
  const isCustomizeDone =
    status === 'CUSTOMIZE_COMPLETED' || status.startsWith('INTERVIEW')
  const isCustomizeFailed = status === 'CUSTOMIZE_FAILED'
  const isCustomizeIdle =
    !isCustomizePending && !isCustomizeDone && !isCustomizeFailed

  const isInterviewPending =
    status === 'INTERVIEW_PENDING' || status === 'INTERVIEW_STREAMING'
  const isInterviewDone = status === 'INTERVIEW_COMPLETED'
  const isInterviewFailed = status === 'INTERVIEW_FAILED'
  const isInterviewIdle =
    !isInterviewPending && !isInterviewDone && !isInterviewFailed

  const isMatchDone =
    status === 'MATCH_COMPLETED' ||
    status.startsWith('CUSTOMIZE') ||
    status.startsWith('INTERVIEW')
  const isMatchFailed =
    status === 'MATCH_FAILED' ||
    status === 'OCR_FAILED' ||
    status === 'SUMMARY_FAILED' ||
    status === 'PREMATCH_FAILED' ||
    status === 'JOB_VISION_FAILED'

  if (status.startsWith('INTERVIEW')) currentStep = 3
  else if (status.startsWith('CUSTOMIZE')) currentStep = 2
  else currentStep = 1

  maxUnlockedStep = calculateMaxUnlockedStep({
    isInterviewPending,
    isInterviewDone,
    isInterviewFailed,
    isCustomizeDone,
    isCustomizePending,
    isCustomizeFailed,
    isInterviewIdle,
    isMatchDone,
  })

  cta = calculateCta({
    isMatchFailed,
    isMatchDone,
    isCustomizeIdle,
    isCustomizePending,
    isCustomizeFailed,
    isCustomizeDone,
    isInterviewIdle,
    isInterviewPending,
    isInterviewFailed,
    isInterviewDone,
    isPending,
    dict,
  })

  const { statusMessage, progressValue } = calculateStatusAndProgress({
    status,
    statusDetail,
    isCustomizePending,
    isCustomizeFailed,
    isCustomizeDone,
    isInterviewPending,
    isInterviewFailed,
    isInterviewDone,
    dict,
    simulatedProgress,
    isPaid,
  })

  return {
    currentStep,
    maxUnlockedStep,
    cta,
    statusMessage,
    progressValue,
  }
}

// --- Helper Functions ---

interface UnlockParams {
  isInterviewPending: boolean
  isInterviewDone: boolean
  isInterviewFailed: boolean
  isCustomizeDone: boolean
  isCustomizePending: boolean
  isCustomizeFailed: boolean
  isInterviewIdle: boolean
  isMatchDone: boolean
}

function calculateMaxUnlockedStep(params: UnlockParams): StepId {
  const {
    isInterviewPending,
    isInterviewDone,
    isInterviewFailed,
    isCustomizeDone,
    isCustomizePending,
    isCustomizeFailed,
    isInterviewIdle,
    // isMatchDone is intentionally not used for unlocking Step 2
    // Users must click the CTA button to start customization
  } = params

  if (isInterviewPending || isInterviewDone || isInterviewFailed) {
    return 3
  }
  if (isCustomizeDone && isInterviewIdle) {
    return 2
  }
  // Only unlock Step 2 if customize has actually been started
  // Match being done does NOT unlock Step 2 - users must use the CTA button
  if (isCustomizePending || isCustomizeDone || isCustomizeFailed) {
    return 2
  }
  return 1
}

interface CtaParams {
  isMatchFailed: boolean
  isMatchDone: boolean
  isCustomizeIdle: boolean
  isCustomizePending: boolean
  isCustomizeFailed: boolean
  isCustomizeDone: boolean
  isInterviewIdle: boolean
  isInterviewPending: boolean
  isInterviewFailed: boolean
  isInterviewDone: boolean
  isPending: boolean
  dict: WorkbenchDict
}

function calculateCta(params: CtaParams): CtaConfig | null {
  const {
    isMatchFailed,
    isMatchDone,
    isCustomizeIdle,
    isCustomizePending,
    isCustomizeFailed,
    isCustomizeDone,
    isInterviewIdle,
    isInterviewPending,
    isInterviewFailed,
    isInterviewDone,
    isPending,
    dict,
  } = params

  if (isMatchFailed) {
    return {
      show: true,
      label: dict.workbench?.statusText?.['retryMatch'] || 'Retry Match',
      action: 'retry_match',
      disabled: isPending,
    }
  }

  if (isMatchDone && isCustomizeIdle) {
    return {
      show: true,
      label: dict.workbench?.customize?.start || 'Start Customization',
      action: 'customize',
      disabled: isPending,
    }
  }

  if (isCustomizePending) {
    return {
      show: true,
      label: dict.workbench?.customize?.start || 'Customize Resume',
      action: 'none',
      disabled: true,
    }
  }

  if (isCustomizeFailed) {
    return {
      show: true,
      label: dict.workbench?.customize?.start || 'Retry Customization',
      action: 'customize',
      disabled: isPending,
    }
  }

  if (isCustomizeDone && isInterviewIdle) {
    return {
      show: true,
      label: dict.workbench?.interviewUi?.start || 'Generate Interview Tips',
      action: 'interview',
      disabled: isPending,
    }
  }

  if (isInterviewPending) {
    return {
      show: true,
      label: dict.workbench?.interviewUi?.start || 'Generate Interview Tips',
      action: 'none',
      disabled: true,
    }
  }

  if (isInterviewFailed) {
    return {
      show: true,
      label: dict.workbench?.interviewUi?.start || 'Retry Generation',
      action: 'interview',
      disabled: isPending,
    }
  }

  if (isInterviewDone) {
    return null
  }

  return null
}

interface StatusParams {
  status: WorkbenchStatusV2
  statusDetail: string | null
  isCustomizePending: boolean
  isCustomizeFailed: boolean
  isCustomizeDone: boolean
  isInterviewPending: boolean
  isInterviewFailed: boolean
  isInterviewDone: boolean
  dict: WorkbenchDict
  simulatedProgress: number // Time-based simulated progress (0-100)
  isPaid: boolean
}

function calculateStatusAndProgress(params: StatusParams): {
  statusMessage: string
  progressValue: number
} {
  const {
    status,
    statusDetail,
    isCustomizePending,
    isCustomizeFailed,
    isCustomizeDone,
    isInterviewPending,
    isInterviewFailed,
    isInterviewDone,
    dict,
    simulatedProgress,
    isPaid,
  } = params

  let statusMessage = ''
  let progressValue = 0

  if (status.startsWith('CUSTOMIZE')) {
    if (isCustomizePending) {
      statusMessage =
        dict.workbench?.statusConsole?.['customizing'] || 'AI is customizing...'
      progressValue = simulatedProgress || 10 // Fallback to 10% if not started
    } else if (isCustomizeFailed) {
      statusMessage =
        dict.workbench?.statusConsole?.['customizeFailed'] ||
        'Customization Failed'
      progressValue = 0
    } else if (isCustomizeDone) {
      statusMessage =
        dict.workbench?.statusConsole?.['customizeCompleted'] ||
        'Customization Completed'
      progressValue = 100
    }
  } else if (status.startsWith('INTERVIEW')) {
    if (isInterviewPending) {
      statusMessage =
        dict.workbench?.statusConsole?.['interviewing'] ||
        dict.workbench?.statusConsole?.['interviewPending'] ||
        dict.workbench?.statusText?.['INTERVIEW_PENDING'] ||
        'Generating Interview Tips...'
      progressValue = simulatedProgress || 10
    } else if (isInterviewFailed) {
      statusMessage =
        dict.workbench?.statusText?.['INTERVIEW_FAILED'] ||
        'Interview Tips Generation Failed'
      progressValue = 0
    } else if (isInterviewDone) {
      statusMessage =
        dict.workbench?.statusText?.['INTERVIEW_COMPLETED'] ||
        'Interview Tips Generated'
      progressValue = 100
    }
  }

  // Fallback to global status (for match tab M9 stages)
  if (!statusMessage) {
    const result = deriveGlobalStatusMessage(
      status,
      statusDetail,
      dict,
      simulatedProgress,
      isPaid,
    )
    statusMessage = result.message
    // Use simulatedProgress for M9 pending/streaming stages if available
    progressValue = result.progress
  }

  return { statusMessage, progressValue }
}

function deriveGlobalStatusMessage(
  status: WorkbenchStatusV2,
  statusDetail: string | null,
  dict: WorkbenchDict,
  simulatedProgress: number = 0,
  isPaid: boolean = false,
): { message: string; progress: number } {
  const stext = dict.workbench?.statusText || {}
  const statusConsole = dict.workbench?.statusConsole || {}
  let message = ''
  let progress = 0

  const tierKey = isPaid ? 'paid' : 'free'
  const config = WORKBENCH_PROGRESS_CONFIG as Record<
    'free' | 'paid',
    Partial<Record<WorkbenchStatusV2, [number, number, number]>>
  >
  const statusConfig = config[tierKey]?.[status]

  // Calculate progress
  if (simulatedProgress > 0) {
    progress = Math.min(100, Math.max(0, simulatedProgress))
  } else if (statusConfig) {
    const [start, end] = statusConfig
    if (start === end) {
      progress = start
    } else {
      progress = start
    }
  } else {
    if (status.includes('FAILED')) progress = 0
    else if (status.includes('COMPLETED')) progress = 100
  }

  // Try statusDetail first for message
  // Try statusDetail first for message
  if (statusDetail) {
    const detailLower = statusDetail.toLowerCase()
    const isGenericQueued =
      detailLower === 'queued' ||
      detailLower === 'queue' ||
      detailLower === 'enqueue' ||
      detailLower.endsWith('_queued')

    if (isGenericQueued) {
      const queuedKey =
        detailLower === 'queued' ||
        detailLower === 'queue' ||
        detailLower === 'enqueue'
          ? status.toLowerCase()
          : detailLower
      if (queuedKey.includes('job_vision') || status === 'JOB_VISION_PENDING') {
        message =
          dict.workbench?.statusConsole?.['jobVisionQueued'] ||
          dict.workbench?.statusConsole?.['queued'] ||
          'Task is queued...'
      } else if (queuedKey.includes('ocr') || status === 'OCR_PENDING') {
        message =
          dict.workbench?.statusConsole?.['ocrQueued'] ||
          dict.workbench?.statusConsole?.['queued'] ||
          'Task is queued...'
      } else if (
        queuedKey.includes('summary') ||
        status === 'SUMMARY_PENDING'
      ) {
        message =
          dict.workbench?.statusConsole?.['summaryQueued'] ||
          dict.workbench?.statusConsole?.['queued'] ||
          'Task is queued...'
      } else if (
        queuedKey.includes('prematch') ||
        status === 'PREMATCH_PENDING'
      ) {
        message =
          dict.workbench?.statusConsole?.['prematchQueued'] ||
          dict.workbench?.statusConsole?.['queued'] ||
          'Task is queued...'
      } else if (queuedKey.includes('match') || status === 'MATCH_PENDING') {
        message =
          dict.workbench?.statusConsole?.['matchQueued'] ||
          dict.workbench?.statusConsole?.['queued'] ||
          'Task is queued...'
      } else {
        message =
          dict.workbench?.statusConsole?.['queued'] || 'Task is queued...'
      }
    } else {
      const mapped = stext[statusDetail]
      if (mapped) message = String(mapped)
    }
  }

  const summaryInitDetails = new Set([
    null,
    'SUMMARY_PENDING',
    'summary_pending',
    'PENDING_SUMMARY',
    'pending_summary',
  ])

  if (!message && status === 'SUMMARY_PENDING' && !isPaid) {
    if (summaryInitDetails.has(statusDetail)) {
      message =
        statusConsole['summaryInit'] ||
        statusConsole['summaryPending'] ||
        'Preparing job summary...'
    }
  }

  // Handle JOB_VISION_PENDING specifically if no other message
  if (!message && status === 'JOB_VISION_PENDING') {
    message = statusConsole['jobVisionPending'] || '正在分析岗位描述...'
  }

  if (!message && status === 'JOB_VISION_STREAMING') {
    message = statusConsole['jobVisionStreaming'] || '正在提取岗位详情...'
  }

  // Try camelCase status key for message
  if (!message) {
    const camelKey = (status || '')
      .toLowerCase()
      .replace(/_([a-z])/g, (g) => (g[1] || '').toUpperCase())
      .replace(/_/, '')

    const consoleMsg = statusConsole[camelKey]
    if (consoleMsg) message = String(consoleMsg)

    if (!message) {
      const textMsg = stext[camelKey]
      if (textMsg) message = String(textMsg)
    }
  }

  // Fallback messages for known statuses
  if (!message) {
    const fallbackMessages: Record<string, string> = {
      OCR_PENDING:
        statusConsole['ocrPending'] || 'Extracting text from image...',
      SUMMARY_PENDING:
        statusConsole['summaryPending'] || 'Extracting job details...',
      JOB_VISION_PENDING:
        statusConsole['jobVisionPending'] || 'Analyzing job description...',
      PREMATCH_PENDING:
        statusConsole['prematchPending'] || 'Auditing requirements...',
      MATCH_PENDING:
        statusConsole['matchPending'] || 'Analyzing match degree...',
      MATCH_STREAMING:
        statusConsole['matchStreaming'] || 'Streaming analysis results...',

      INTERVIEW_PENDING:
        stext['INTERVIEW_PENDING'] || 'Generating Interview Tips...',
      INTERVIEW_STREAMING:
        stext['INTERVIEW_STREAMING'] || 'Generating Interview Tips...',
      INTERVIEW_COMPLETED:
        stext['INTERVIEW_COMPLETED'] || 'Interview Tips Generated',
      INTERVIEW_FAILED:
        stext['INTERVIEW_FAILED'] || 'Interview Tips Generation Failed',

      OCR_COMPLETED:
        statusConsole['ocrCompleted'] || 'OCR Extraction Completed',
      SUMMARY_COMPLETED:
        statusConsole['summaryCompleted'] || 'Job Details Extracted',
      JOB_VISION_COMPLETED:
        statusConsole['jobVisionCompleted'] || 'Job Analysis Completed',
      PREMATCH_COMPLETED:
        statusConsole['prematchCompleted'] || 'Pre-match Audit Completed',

      COMPLETED: statusConsole['matchCompleted'] || 'Match Analysis Completed',
      MATCH_COMPLETED:
        statusConsole['matchCompleted'] || 'Match Analysis Completed',

      OCR_FAILED: statusConsole['ocrFailed'] || 'OCR Extraction Failed',
      SUMMARY_FAILED:
        statusConsole['summaryFailed'] || 'Job Summary Extraction Failed',
      JOB_VISION_FAILED:
        statusConsole['jobVisionFailed'] || 'Job Analysis Failed',
      PREMATCH_FAILED:
        statusConsole['prematchFailed'] || 'Pre-match Audit Failed',
      MATCH_FAILED: statusConsole['matchFailed'] || 'Match Analysis Failed',

      // Streaming states (Paid tier)
      OCR_STREAMING:
        statusConsole['ocrPending'] || 'Extracting text from image...',
      SUMMARY_STREAMING:
        statusConsole['summaryPending'] || 'Extracting job details...',
      PREMATCH_STREAMING:
        statusConsole['prematchPending'] || 'Auditing requirements...',

      FAILED: stext['failed'] || 'Failed',
    }
    message = fallbackMessages[status] || stext['idle'] || 'Ready'
  }

  return { message, progress }
}

/**
 * Helper to get estimated duration for a stage
 */
export function getEstimatedDuration(
  status: WorkbenchStatusV2,
  isPaid: boolean,
): number {
  const tierKey = isPaid ? 'paid' : 'free'
  const config = WORKBENCH_PROGRESS_CONFIG as Record<
    'free' | 'paid',
    Partial<Record<WorkbenchStatusV2, [number, number, number]>>
  >
  const defaultDuration = WORKBENCH_PROGRESS_DEFAULT[2]
  const statusConfig = config[tierKey]?.[status]
  return statusConfig?.[2] ?? defaultDuration
}
