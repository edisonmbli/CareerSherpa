/**
 * Workbench Stage Derivation Utilities
 *
 * This module contains pure functions for deriving UI state from workbench status.
 * Extracted from ServiceDisplay.tsx to improve modularity and testability.
 */

import type { StepId } from '@/components/workbench/StepperProgress'
import type { WorkbenchStatusV2 } from '@/lib/stores/workbench-v2.store'

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
  customizeStatus: string,
  interviewStatus: string,
  dict: WorkbenchDict,
  isPending: boolean,
  tabValue: string,
  statusDetail: string | null,
  _errorMessage: string | null, // Reserved for future use
  simulatedProgress: number = 0, // Time-based simulated progress
  isPaid: boolean = false,
): DerivedStage {
  let currentStep: StepId = 1
  let maxUnlockedStep: StepId = 1
  let cta: CtaConfig | null = null

  // 1. Status Normalization
  const isMatchDone = status === 'MATCH_COMPLETED'
  const isMatchFailed =
    status === 'MATCH_FAILED' ||
    status === 'OCR_FAILED' ||
    status === 'SUMMARY_FAILED' ||
    status === 'PREMATCH_FAILED' ||
    status === 'JOB_VISION_FAILED'

  const isCustomizePending = customizeStatus === 'PENDING'
  const isCustomizeDone = customizeStatus === 'COMPLETED'
  const isCustomizeFailed = customizeStatus === 'FAILED'
  const isCustomizeIdle = customizeStatus === 'IDLE'

  const isInterviewPending = interviewStatus === 'PENDING'
  const isInterviewDone = interviewStatus === 'COMPLETED'
  const isInterviewFailed = interviewStatus === 'FAILED'
  const isInterviewIdle = interviewStatus === 'IDLE'

  // 2. Step Calculation (Tab-driven for visual consistency)
  if (tabValue === 'interview') currentStep = 3
  else if (tabValue === 'customize') currentStep = 2
  else currentStep = 1

  // 3. Max Unlocked Calculation (Status-driven unlock logic)
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

  // 4. CTA Calculation
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

  // 5. Status Message & Progress
  const { statusMessage, progressValue } = calculateStatusAndProgress({
    tabValue,
    status,
    statusDetail,
    isCustomizePending,
    isCustomizeFailed,
    isCustomizeDone,
    isInterviewPending,
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
      label: dict.workbench?.statusConsole?.['customizing'] || 'Customizing...',
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
      label: 'Generating Tips...',
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
  tabValue: string
  status: WorkbenchStatusV2
  statusDetail: string | null
  isCustomizePending: boolean
  isCustomizeFailed: boolean
  isCustomizeDone: boolean
  isInterviewPending: boolean
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
    tabValue,
    status,
    statusDetail,
    isCustomizePending,
    isCustomizeFailed,
    isCustomizeDone,
    isInterviewPending,
    isInterviewDone,
    dict,
    simulatedProgress,
    isPaid,
  } = params

  let statusMessage = ''
  let progressValue = 0

  // Tab-specific messages
  if (tabValue === 'customize') {
    if (isCustomizePending) {
      statusMessage =
        dict.workbench?.statusConsole?.['customizing'] || 'AI is customizing...'
      // Use time-based simulated progress (updated every 5s by timer)
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
  } else if (tabValue === 'interview') {
    if (isInterviewPending) {
      statusMessage = 'Generating Interview Tips...'
      // Use time-based simulated progress
      progressValue = simulatedProgress || 10
    } else if (isInterviewDone) {
      statusMessage = 'Interview Tips Generated'
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

  // M9 status progress configuration - defines dynamic stages and their fallback values
  // Range: [start, end]
  const M9_STATUS_CONFIG_PAID: Record<string, { range: [number, number] }> = {
    OCR_PENDING: { range: [0, 10] },
    SUMMARY_PENDING: { range: [10, 35] },
    PREMATCH_PENDING: { range: [35, 60] },
    MATCH_PENDING: { range: [60, 90] }, // Pending analysis
    MATCH_STREAMING: { range: [90, 99] }, // Streaming results
    // Completed states
    OCR_COMPLETED: { range: [10, 10] },
    SUMMARY_COMPLETED: { range: [35, 35] },
    PREMATCH_COMPLETED: { range: [60, 60] },
    MATCH_COMPLETED: { range: [100, 100] },
    COMPLETED: { range: [100, 100] },
  }

  const M9_STATUS_CONFIG_FREE: Record<string, { range: [number, number] }> = {
    JOB_VISION_PENDING: { range: [0, 40] },
    JOB_VISION_STREAMING: { range: [0, 40] },
    SUMMARY_PENDING: { range: [0, 40] }, // Fallback for text input
    MATCH_PENDING: { range: [40, 90] },
    MATCH_STREAMING: { range: [90, 99] },
    // Completed states
    JOB_VISION_COMPLETED: { range: [40, 40] },
    SUMMARY_COMPLETED: { range: [40, 40] },
    MATCH_COMPLETED: { range: [100, 100] },
    COMPLETED: { range: [100, 100] },
  }

  const config = isPaid ? M9_STATUS_CONFIG_PAID : M9_STATUS_CONFIG_FREE
  const statusConfig = config[status]

  // Calculate progress
  if (statusConfig) {
    const [start, end] = statusConfig.range
    if (start === end) {
      progress = start
    } else {
      // Map simulated progress (0-100) to range [start, end]
      progress = start + ((end - start) * simulatedProgress) / 100
    }
  } else {
    // Fallback for failed or unknown states
    if (status.includes('FAILED')) progress = 0
    else if (status.includes('COMPLETED')) progress = 100
  }

  // Try statusDetail first for message
  // Try statusDetail first for message
  if (statusDetail) {
    if (statusDetail === 'queued' || statusDetail.endsWith('_queued')) {
      // Handle specific queued states with fallback to generic
      if (statusDetail.includes('ocr')) {
        message = dict.workbench?.statusConsole?.['ocrQueued'] || 'OCR Task Queued...'
      } else if (statusDetail.includes('summary')) {
        message = dict.workbench?.statusConsole?.['summaryQueued'] || 'Job Analysis Queued...'
      } else if (statusDetail.includes('prematch')) {
        message = dict.workbench?.statusConsole?.['prematchQueued'] || 'Audit Task Queued...'
      } else if (statusDetail.includes('match')) {
        message = dict.workbench?.statusConsole?.['matchQueued'] || 'Match Analysis Queued...'
      } else {
        message = dict.workbench?.statusConsole?.['queued'] || 'Task is queued...'
      }
    } else {
      const mapped = stext[statusDetail]
      if (mapped) message = String(mapped)
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
      OCR_STREAMING: statusConsole['ocrPending'] || 'Extracting text from image...',
      SUMMARY_STREAMING: statusConsole['summaryPending'] || 'Extracting job details...',
      PREMATCH_STREAMING: statusConsole['prematchPending'] || 'Auditing requirements...',

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
  const DEFAULT = 60000
  if (isPaid) {
    switch (status) {
      case 'OCR_PENDING':
        return 30000
      case 'SUMMARY_PENDING':
        return 60000
      case 'PREMATCH_PENDING':
        return 60000
      case 'MATCH_PENDING':
        return 120000
      case 'MATCH_STREAMING':
        return 120000
      default:
        return DEFAULT
    }
  } else {
    switch (status) {
      case 'JOB_VISION_PENDING':
        return 60000
      case 'JOB_VISION_STREAMING':
        return 60000
      case 'SUMMARY_PENDING':
        return 60000
      case 'MATCH_PENDING':
        return 90000
      case 'MATCH_STREAMING':
        return 90000
      default:
        return DEFAULT
    }
  }
}
