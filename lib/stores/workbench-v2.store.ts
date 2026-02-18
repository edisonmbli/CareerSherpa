/**
 * Workbench V2 Store - Clean SSE State Machine
 *
 * A clean rewrite of the workbench state management with:
 * - Explicit state machine with clear transitions
 * - Unified handling for both Free and Paid tiers
 * - Separate content buffers for vision and match phases
 * - Time-based progress simulation with stage-aware ranges
 *
 * State Flow (Free Tier - Image Input):
 *   IDLE → JOB_VISION_PENDING → JOB_VISION_STREAMING → JOB_VISION_COMPLETED
 *        → MATCH_PENDING → MATCH_STREAMING → MATCH_COMPLETED
 *
 * State Flow (Paid Tier - Image Input):
 *   IDLE → OCR_PENDING → OCR_COMPLETED
 *        → SUMMARY_PENDING → SUMMARY_COMPLETED
 *        → PREMATCH_PENDING → PREMATCH_COMPLETED
 *        → MATCH_PENDING → MATCH_STREAMING → MATCH_COMPLETED
 */

import { create } from 'zustand'
import { sseLog } from '@/lib/ui/sse-debug-logger'
import {
  WORKBENCH_PROGRESS_CONFIG,
  WORKBENCH_PROGRESS_DEFAULT,
} from '@/lib/constants'

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * All possible workbench states - explicit and flat for clarity
 */
export type WorkbenchStatusV2 =
  // Initial state
  | 'IDLE'
  // Free Tier: Vision Summary (combined OCR + Summary via vision model)
  | 'JOB_VISION_PENDING'
  | 'JOB_VISION_STREAMING'
  | 'JOB_VISION_COMPLETED'
  | 'JOB_VISION_FAILED'
  // Paid Tier: OCR Phase
  | 'OCR_PENDING'
  | 'OCR_STREAMING'
  | 'OCR_COMPLETED'
  | 'OCR_FAILED'
  // Summary Phase (Paid tier + Free tier text JD)
  | 'SUMMARY_PENDING'
  | 'SUMMARY_STREAMING' // Free tier text JD uses this
  | 'SUMMARY_COMPLETED'
  | 'SUMMARY_FAILED'
  // Paid Tier: Pre-match Audit Phase
  | 'PREMATCH_PENDING'
  | 'PREMATCH_STREAMING'
  | 'PREMATCH_COMPLETED'
  | 'PREMATCH_FAILED'
  // Match Phase (both tiers)
  | 'MATCH_PENDING'
  | 'MATCH_STREAMING'
  | 'MATCH_COMPLETED'
  | 'MATCH_FAILED'
  // Customize Phase
  | 'CUSTOMIZE_PENDING'
  | 'CUSTOMIZE_COMPLETED'
  | 'CUSTOMIZE_FAILED'
  // Interview Phase
  | 'INTERVIEW_PENDING'
  | 'INTERVIEW_STREAMING'
  | 'INTERVIEW_COMPLETED'
  | 'INTERVIEW_FAILED'

/**
 * Tier detection for progress calculation
 */
export type ExecutionTier = 'free' | 'paid'

/**
 * Content buffers for different phases
 */
export interface ContentBuffers {
  // Free tier - Vision phase output
  visionContent: string
  visionJson: Record<string, unknown> | null

  // Paid tier - OCR phase output
  ocrContent: string
  ocrJson: Record<string, unknown> | null

  // Paid tier - Summary phase output
  summaryContent: string
  summaryJson: Record<string, unknown> | null

  // Paid tier - PreMatch phase output
  preMatchContent: string
  preMatchJson: Record<string, unknown> | null

  // Both tiers - Match phase streaming output
  matchContent: string
  matchJson: Record<string, unknown> | null

  interviewContent: string
  interviewJson: Record<string, unknown> | null
}

/**
 * Progress simulation state
 */
export interface ProgressState {
  isActive: boolean
  startedAt: number | null
  estimatedDurationMs: number
  baseProgress: number // Starting progress for current stage
  targetProgress: number // Target progress for current stage
}

/**
 * SSE connection state
 */
export interface ConnectionState {
  isConnected: boolean
  currentTaskId: string | null
  reconnectCount: number
  lastEventAt: number | null
}

/**
 * Complete store state
 */
export interface WorkbenchV2State {
  // Identity
  serviceId: string | null
  tier: ExecutionTier

  // Status
  status: WorkbenchStatusV2
  statusDetail: string | null
  errorMessage: string | null
  lastStatusTimestamp: number // Timestamp when status last changed (for stuck state detection)

  // Content
  content: ContentBuffers

  // Progress
  progress: ProgressState

  // Connection
  connection: ConnectionState

  // Actions
  initialize: (serviceId: string, tier: ExecutionTier) => void
  setStatus: (status: WorkbenchStatusV2, detail?: string) => void
  setStatusDetail: (detail: string | null) => void
  setError: (message: string) => void
  // Free tier content
  appendVisionContent: (chunk: string) => void
  setVisionResult: (json: Record<string, unknown>) => void
  // Paid tier content
  appendOcrContent: (chunk: string) => void
  setOcrResult: (json: Record<string, unknown>) => void
  appendSummaryContent: (chunk: string) => void
  setSummaryResult: (json: Record<string, unknown>) => void
  appendPreMatchContent: (chunk: string) => void
  setPreMatchResult: (json: Record<string, unknown>) => void
  // Both tiers
  appendMatchContent: (chunk: string) => void
  setMatchResult: (json: Record<string, unknown>) => void
  appendInterviewContent: (chunk: string) => void
  setInterviewResult: (json: Record<string, unknown>) => void
  // Connection
  setConnected: (connected: boolean, taskId?: string) => void
  recordEvent: () => void
  reset: () => void

  // Progress simulation
  startProgressSimulation: (estimatedMs?: number) => void
  updateProgress: () => number
  stopProgress: (finalValue: number) => void

  // Derived getters (for UI)
  getDisplayProgress: () => number
  getStageLabel: () => string
}

const PROGRESS_CONFIG = WORKBENCH_PROGRESS_CONFIG as Record<
  ExecutionTier,
  Partial<Record<WorkbenchStatusV2, [number, number, number]>>
>

const DEFAULT_PROGRESS = WORKBENCH_PROGRESS_DEFAULT as [number, number, number]

// =============================================================================
// Initial State
// =============================================================================

function createInitialContent(): ContentBuffers {
  return {
    // Free tier
    visionContent: '',
    visionJson: null,
    // Paid tier
    ocrContent: '',
    ocrJson: null,
    summaryContent: '',
    summaryJson: null,
    preMatchContent: '',
    preMatchJson: null,
    // Both tiers
    matchContent: '',
    matchJson: null,

    interviewContent: '',
    interviewJson: null,
  }
}

function createInitialProgress(): ProgressState {
  return {
    isActive: false,
    startedAt: null,
    estimatedDurationMs: 60000,
    baseProgress: 0,
    targetProgress: 0,
  }
}

function createInitialConnection(): ConnectionState {
  return {
    isConnected: false,
    currentTaskId: null,
    reconnectCount: 0,
    lastEventAt: null,
  }
}

// Helper to check terminal status
function isTerminal(status: string): boolean {
  return (
    status === 'MATCH_COMPLETED' ||
    status === 'MATCH_FAILED' ||
    status === 'CUSTOMIZE_COMPLETED' ||
    status === 'CUSTOMIZE_FAILED' ||
    status === 'INTERVIEW_COMPLETED' ||
    status === 'INTERVIEW_FAILED' ||
    status.endsWith('FAILED') ||
    status === 'COMPLETED' ||
    status === 'FAILED'
  )
}

function getStatusStage(status: string): number {
  const text = String(status || '')
  if (text.startsWith('INTERVIEW')) return 3
  if (text.startsWith('CUSTOMIZE')) return 2
  if (
    text.startsWith('MATCH') ||
    text.startsWith('PREMATCH') ||
    text.startsWith('SUMMARY') ||
    text.startsWith('OCR') ||
    text.startsWith('JOB_VISION')
  )
    return 1
  return 0
}

function mergeContent(current: string, chunk: string): string {
  if (!chunk) return current
  if (!current) return chunk
  if (chunk === current) return current
  if (chunk.startsWith(current) && chunk.length > current.length) return chunk
  if (chunk.length < current.length && current.startsWith(chunk)) return current
  if (chunk.includes(current) && chunk.length > current.length) return chunk
  if (current.endsWith(chunk)) return current

  let overlap = 0
  const max = Math.min(current.length, chunk.length)
  for (let i = max; i > 0; i -= 1) {
    if (current.endsWith(chunk.slice(0, i))) {
      overlap = i
      break
    }
  }
  return overlap > 0 ? current + chunk.slice(overlap) : current + chunk
}

// =============================================================================
// Store Implementation
// =============================================================================

export const useWorkbenchV2Store = create<WorkbenchV2State>((set, get) => ({
  // Initial state
  serviceId: null,
  tier: 'free',
  status: 'IDLE',
  statusDetail: null,
  errorMessage: null,
  lastStatusTimestamp: Date.now(),
  content: createInitialContent(),
  progress: createInitialProgress(),
  connection: createInitialConnection(),

  // Initialize for a new service
  initialize: (serviceId, tier) => {
    sseLog.stateChange('*', 'IDLE', `initialize(${serviceId}, ${tier})`)
    set({
      serviceId,
      tier,
      status: 'IDLE',
      statusDetail: null,
      errorMessage: null,
      lastStatusTimestamp: Date.now(),
      content: createInitialContent(),
      progress: createInitialProgress(),
      connection: createInitialConnection(),
    })
  },

  // Set status with automatic progress initialization
  setStatus: (status, detail) => {
    const state = get()
    const prevStatus = state.status

    // Skip if same status (idempotent)
    if (prevStatus === status && state.statusDetail === detail) {
      return
    }

    const prevStage = getStatusStage(prevStatus)
    const nextStage = getStatusStage(status)
    if (prevStage > 0 && nextStage > 0 && nextStage < prevStage) {
      sseLog.warn('status_regression_blocked', {
        prev: prevStatus,
        next: status,
        reason: 'stage_regression',
      })
      return
    }

    if (isTerminal(prevStatus) && !isTerminal(status)) {
      // Allow PENDING (Retry)
      if (status.includes('PENDING')) {
        // Allowed regression for Retry
      } else {
        sseLog.warn('status_regression_blocked', {
          prev: prevStatus,
          next: status,
          reason: 'Potential race condition from delayed SSE packet',
        })
        return
      }
    }

    sseLog.stateChange(prevStatus, status, detail)

    // Get progress config for new status
    const config = PROGRESS_CONFIG[state.tier][status] || DEFAULT_PROGRESS
    const [configBase, targetProgress, estimatedMs] = config

    // Calculate current actual progress to prevent regression
    // When duplicate/late PENDING events arrive, don't reset to lower values
    const currentProgress =
      state.progress.isActive && state.progress.startedAt
        ? Math.min(
            state.progress.targetProgress,
            Math.floor(
              state.progress.baseProgress +
                (state.progress.targetProgress - state.progress.baseProgress) *
                  (1 -
                    Math.pow(
                      1 -
                        Math.min(
                          1,
                          (Date.now() - state.progress.startedAt) /
                            state.progress.estimatedDurationMs,
                        ),
                      2,
                    )),
            ),
          )
        : state.progress.baseProgress

    // Use MAX of current progress and config base to prevent backwards jumps
    const baseProgress = Math.max(configBase, currentProgress)

    // Determine if we should start progress simulation
    const shouldSimulate = estimatedMs > 0 && baseProgress < targetProgress

    set({
      status,
      statusDetail: detail || null,
      errorMessage: null,
      lastStatusTimestamp: Date.now(),
      progress: shouldSimulate
        ? {
            isActive: true,
            startedAt: Date.now(),
            estimatedDurationMs: estimatedMs,
            baseProgress,
            targetProgress,
          }
        : {
            isActive: false,
            startedAt: null,
            estimatedDurationMs: 0,
            baseProgress: Math.max(baseProgress, targetProgress),
            targetProgress,
          },
    })
  },

  setStatusDetail: (detail) => {
    const state = get()
    const normalized = detail || null

    if (state.statusDetail === normalized) {
      return
    }

    set({
      statusDetail: normalized,
    })
  },

  // Set error state
  setError: (message) => {
    const state = get()
    if (state.status.endsWith('COMPLETED')) {
      return
    }
    sseLog.error('Task failed', { status: state.status, message })

    // Map current status to failed variant
    let failedStatus: WorkbenchStatusV2 = 'MATCH_FAILED'
    if (state.status.startsWith('JOB_VISION'))
      failedStatus = 'JOB_VISION_FAILED'
    else if (state.status.startsWith('OCR')) failedStatus = 'OCR_FAILED'
    else if (state.status.startsWith('SUMMARY')) failedStatus = 'SUMMARY_FAILED'
    else if (state.status.startsWith('PREMATCH'))
      failedStatus = 'PREMATCH_FAILED'
    else if (state.status.startsWith('CUSTOMIZE'))
      failedStatus = 'CUSTOMIZE_FAILED'
    else if (state.status.startsWith('INTERVIEW'))
      failedStatus = 'INTERVIEW_FAILED'

    set({
      status: failedStatus,
      errorMessage: message,
      lastStatusTimestamp: Date.now(),
      progress: { ...state.progress, isActive: false },
    })
  },

  // Content management
  appendVisionContent: (chunk) => {
    set((s) => {
      const current = s.content.visionContent
      const newContent = mergeContent(current, chunk)
      sseLog.content('vision', newContent.length)
      return {
        content: { ...s.content, visionContent: newContent },
      }
    })
  },

  setVisionResult: (json) => {
    sseLog.event('vision_result', { keys: Object.keys(json) })
    set((s) => ({
      content: {
        ...s.content,
        visionJson: json,
        visionContent: JSON.stringify(json, null, 2),
      },
    }))
  },

  appendMatchContent: (chunk) => {
    set((s) => {
      const current = s.content.matchContent
      const newContent = mergeContent(current, chunk)
      sseLog.content('match', newContent.length)
      return {
        content: { ...s.content, matchContent: newContent },
      }
    })
  },

  setMatchResult: (json) => {
    sseLog.event('match_result', { keys: Object.keys(json) })
    set((s) => ({
      content: {
        ...s.content,
        matchJson: json,
        matchContent: JSON.stringify(json, null, 2),
      },
      status: 'MATCH_COMPLETED',
      progress: {
        ...s.progress,
        isActive: false,
        baseProgress: 100,
        targetProgress: 100,
      },
    }))
  },

  appendInterviewContent: (chunk) => {
    set((s) => {
      const current = s.content.interviewContent
      const newContent = mergeContent(current, chunk)
      sseLog.content('interview', newContent.length)
      return {
        content: { ...s.content, interviewContent: newContent },
      }
    })
  },

  setInterviewResult: (json) => {
    sseLog.event('interview_result', { keys: Object.keys(json) })
    set((s) => ({
      content: {
        ...s.content,
        interviewJson: json,
        interviewContent: JSON.stringify(json, null, 2),
      },
    }))
  },

  // Paid tier - OCR
  appendOcrContent: (chunk: string) => {
    set((s) => {
      const current = s.content.ocrContent
      const newContent = mergeContent(current, chunk)
      sseLog.content('ocr', newContent.length)
      return {
        content: { ...s.content, ocrContent: newContent },
      }
    })
  },

  setOcrResult: (json) => {
    sseLog.event('ocr_result', { keys: Object.keys(json) })
    set((s) => ({
      content: {
        ...s.content,
        ocrJson: json,
        ocrContent: JSON.stringify(json, null, 2),
      },
    }))
  },

  // Paid tier - Summary
  appendSummaryContent: (chunk: string) => {
    set((s) => {
      const current = s.content.summaryContent
      const newContent = mergeContent(current, chunk)
      sseLog.content('summary', newContent.length)
      return {
        content: { ...s.content, summaryContent: newContent },
      }
    })
  },

  setSummaryResult: (json) => {
    sseLog.event('summary_result', { keys: Object.keys(json) })
    set((s) => ({
      content: {
        ...s.content,
        summaryJson: json,
        summaryContent: JSON.stringify(json, null, 2),
      },
    }))
  },

  // Paid tier - PreMatch
  appendPreMatchContent: (chunk: string) => {
    set((s) => {
      const current = s.content.preMatchContent
      const newContent = mergeContent(current, chunk)
      sseLog.content('preMatch', newContent.length)
      return {
        content: { ...s.content, preMatchContent: newContent },
      }
    })
  },

  setPreMatchResult: (json) => {
    sseLog.event('preMatch_result', { keys: Object.keys(json) })
    set((s) => ({
      content: {
        ...s.content,
        preMatchJson: json,
        preMatchContent: JSON.stringify(json, null, 2),
      },
    }))
  },

  // Connection state
  setConnected: (connected, taskId) => {
    const state = get()
    sseLog.connection(connected ? 'connected' : 'disconnected', {
      taskId,
      prev: state.connection.currentTaskId,
    })

    set((s) => ({
      connection: {
        ...s.connection,
        isConnected: connected,
        currentTaskId: taskId || s.connection.currentTaskId,
        reconnectCount: connected ? 0 : s.connection.reconnectCount + 1,
        lastEventAt: connected ? Date.now() : s.connection.lastEventAt,
      },
    }))
  },

  recordEvent: () => {
    set((s) => ({
      connection: { ...s.connection, lastEventAt: Date.now() },
    }))
  },

  reset: () => {
    sseLog.stateChange(get().status, 'IDLE', 'reset()')
    set({
      serviceId: null,
      tier: 'free',
      status: 'IDLE',
      statusDetail: null,
      errorMessage: null,
      content: createInitialContent(),
      progress: createInitialProgress(),
      connection: createInitialConnection(),
    })
  },

  // Progress simulation
  startProgressSimulation: (estimatedMs) => {
    const state = get()
    if (state.progress.isActive) return // Already running

    const ms = estimatedMs || 60000
    sseLog.progress(state.progress.baseProgress, `starting ${ms}ms simulation`)

    set((s) => ({
      progress: {
        ...s.progress,
        isActive: true,
        startedAt: Date.now(),
        estimatedDurationMs: ms,
      },
    }))
  },

  updateProgress: () => {
    const state = get()
    const { progress } = state

    if (!progress.isActive || !progress.startedAt) {
      return progress.baseProgress
    }

    const elapsed = Date.now() - progress.startedAt
    const ratio = Math.min(1, elapsed / progress.estimatedDurationMs)

    // Ease-out curve for natural feel
    const eased = 1 - Math.pow(1 - ratio, 2)

    const currentProgress =
      progress.baseProgress +
      (progress.targetProgress - progress.baseProgress) * eased

    return Math.floor(currentProgress)
  },

  stopProgress: (finalValue) => {
    sseLog.progress(finalValue, 'stopped')
    set((s) => ({
      progress: {
        ...s.progress,
        isActive: false,
        baseProgress: finalValue,
        targetProgress: finalValue,
      },
    }))
  },

  // Derived getters
  getDisplayProgress: () => {
    return get().updateProgress()
  },

  getStageLabel: () => {
    const { status, tier } = get()

    const labels: Partial<Record<WorkbenchStatusV2, string>> = {
      IDLE: '',
      JOB_VISION_PENDING: 'Job Analysis Queued',
      JOB_VISION_STREAMING: 'Extracting Job Details...',
      JOB_VISION_COMPLETED: 'Job Extraction Completed',
      JOB_VISION_FAILED: 'Job Extraction Failed',
      OCR_PENDING: 'OCR Task Queued',
      OCR_COMPLETED: 'OCR Completed',
      OCR_FAILED: 'OCR Failed',
      SUMMARY_PENDING: 'Summary Task Queued',
      SUMMARY_STREAMING: 'Extracting Key Points...',
      SUMMARY_COMPLETED: 'Summary Completed',
      SUMMARY_FAILED: 'Summary Failed',
      PREMATCH_PENDING: 'HR Review Queued',
      PREMATCH_COMPLETED: 'HR Review Completed',
      PREMATCH_FAILED: 'HR Review Failed',
      MATCH_PENDING: 'Match Analysis Queued',
      MATCH_STREAMING: 'Analyzing Match Degree...',
      MATCH_COMPLETED: 'Match Analysis Completed',
      MATCH_FAILED: 'Match Analysis Failed',
      CUSTOMIZE_PENDING: 'Customizing Resume...',
      CUSTOMIZE_COMPLETED: 'Customization Completed',
      CUSTOMIZE_FAILED: 'Customization Failed',
      INTERVIEW_PENDING: 'Generating Interview Tips...',
      INTERVIEW_STREAMING: 'Generating Interview Tips...',
      INTERVIEW_COMPLETED: 'Interview Tips Generated',
      INTERVIEW_FAILED: 'Interview Tips Failed',
    }

    return labels[status] || ''
  },
}))

// =============================================================================
// Selectors (for optimized subscriptions)
// =============================================================================

export const selectStatus = (s: WorkbenchV2State) => s.status
export const selectProgress = (s: WorkbenchV2State) => s.progress
export const selectContent = (s: WorkbenchV2State) => s.content
export const selectConnection = (s: WorkbenchV2State) => s.connection
export const selectError = (s: WorkbenchV2State) => s.errorMessage
