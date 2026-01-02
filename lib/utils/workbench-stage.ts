/**
 * Workbench Stage Derivation Utilities
 *
 * This module contains pure functions for deriving UI state from workbench status.
 * Extracted from ServiceDisplay.tsx to improve modularity and testability.
 */

import type { StepId } from '@/components/workbench/StepperProgress'
import type { WorkbenchStatus } from '@/lib/stores/workbench.store'

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
 * @returns Derived stage information for UI rendering
 */
export function deriveStage(
    status: WorkbenchStatus,
    customizeStatus: string,
    interviewStatus: string,
    dict: WorkbenchDict,
    isPending: boolean,
    tabValue: string,
    statusDetail: string | null,
    _errorMessage: string | null  // Reserved for future use
): DerivedStage {
    let currentStep: StepId = 1
    let maxUnlockedStep: StepId = 1
    let cta: CtaConfig | null = null

    // 1. Status Normalization
    const isMatchDone = status === 'COMPLETED' || status === 'MATCH_COMPLETED'
    const isMatchFailed =
        status === 'FAILED' ||
        status === 'MATCH_FAILED' ||
        status === 'OCR_FAILED' ||
        status === 'SUMMARY_FAILED'

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
        isMatchDone,
    } = params

    if (isInterviewPending || isInterviewDone || isInterviewFailed) {
        return 3
    }
    if (isCustomizeDone && isInterviewIdle) {
        return 2
    }
    if (isCustomizePending || isCustomizeDone || isCustomizeFailed || isMatchDone) {
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
    status: WorkbenchStatus
    statusDetail: string | null
    isCustomizePending: boolean
    isCustomizeFailed: boolean
    isCustomizeDone: boolean
    isInterviewPending: boolean
    isInterviewDone: boolean
    dict: WorkbenchDict
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
    } = params

    let statusMessage = ''
    let progressValue = 0

    // Tab-specific messages
    if (tabValue === 'customize') {
        if (isCustomizePending) {
            statusMessage =
                dict.workbench?.statusConsole?.['customizing'] || 'AI is customizing...'
            progressValue = 66
        } else if (isCustomizeFailed) {
            statusMessage =
                dict.workbench?.statusConsole?.['customizeFailed'] || 'Customization Failed'
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
            progressValue = 66
        } else if (isInterviewDone) {
            statusMessage = 'Interview Tips Generated'
            progressValue = 100
        }
    }

    // Fallback to global status
    if (!statusMessage) {
        const result = deriveGlobalStatusMessage(status, statusDetail, dict)
        statusMessage = result.message
        progressValue = result.progress
    }

    return { statusMessage, progressValue }
}

function deriveGlobalStatusMessage(
    status: WorkbenchStatus,
    statusDetail: string | null,
    dict: WorkbenchDict
): { message: string; progress: number } {
    const stext = dict.workbench?.statusText || {}
    const statusConsole = dict.workbench?.statusConsole || {}
    let message = ''
    let progress = 0

    // Try statusDetail first
    if (statusDetail) {
        const mapped = stext[statusDetail]
        if (mapped) message = String(mapped)
    }

    // Try camelCase status key
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

    // Hardcoded fallbacks
    if (!message) {
        const fallbacks: Record<string, { msg: string; prog: number }> = {
            MATCH_PENDING: {
                msg: statusConsole['matchPending'] || 'Analyzing match degree...',
                prog: 80,
            },
            MATCH_STREAMING: {
                msg: statusConsole['matchStreaming'] || 'Streaming analysis results...',
                prog: 80,
            },
            SUMMARY_PENDING: {
                msg: statusConsole['summaryPending'] || 'Extracting job details...',
                prog: 66,
            },
            SUMMARY_COMPLETED: {
                msg: statusConsole['summaryCompleted'] || 'Job Details Extracted',
                prog: 66,
            },
            OCR_PENDING: {
                msg: statusConsole['ocrPending'] || 'Extracting text from image...',
                prog: 33,
            },
            OCR_COMPLETED: {
                msg: statusConsole['ocrCompleted'] || 'OCR Extraction Completed',
                prog: 33,
            },
            COMPLETED: {
                msg: statusConsole['matchCompleted'] || 'Match Analysis Completed',
                prog: 100,
            },
            MATCH_COMPLETED: {
                msg: statusConsole['matchCompleted'] || 'Match Analysis Completed',
                prog: 100,
            },
            OCR_FAILED: {
                msg: statusConsole['ocrFailed'] || 'OCR Extraction Failed',
                prog: 0,
            },
            SUMMARY_FAILED: {
                msg: statusConsole['summaryFailed'] || 'Job Summary Extraction Failed',
                prog: 0,
            },
            MATCH_FAILED: {
                msg: statusConsole['matchFailed'] || 'Match Analysis Failed',
                prog: 0,
            },
            FAILED: { msg: stext['failed'] || 'Failed', prog: 0 },
        }

        const fb = fallbacks[status]
        if (fb) {
            message = fb.msg
            progress = fb.prog
        } else {
            message = stext['idle'] || 'Ready'
        }
    }

    // Progress for match statuses if not set
    if (progress === 0 && message) {
        if (status === 'OCR_PENDING' || status === 'OCR_COMPLETED') progress = 33
        else if (status === 'SUMMARY_PENDING' || status === 'SUMMARY_COMPLETED')
            progress = 66
        else if (status === 'MATCH_PENDING' || status === 'MATCH_STREAMING')
            progress = 80
        else if (status === 'COMPLETED' || status === 'MATCH_COMPLETED') progress = 100
    }

    return { message, progress }
}
