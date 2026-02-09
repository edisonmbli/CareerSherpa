/**
 * SSE Event Processor V2
 *
 * Clean event processing logic for workbench SSE stream.
 * Processes raw SSE events and dispatches actions to the store.
 *
 * Event Types:
 * - status: Status changes with optional code/failureCode
 * - token/token_batch: Streaming content chunks
 * - start: Stream beginning marker
 * - done: Stream completion marker
 * - error: Error events
 * - ocr_result: OCR text extraction result
 * - summary_result: Job summary JSON result
 * - match_result: Match analysis JSON result
 * - info: Informational events (e.g., queue position)
 */

import { z } from 'zod'
import { sseLog } from '@/lib/ui/sse-debug-logger'
import type {
  WorkbenchStatusV2,
  ExecutionTier,
} from '@/lib/stores/workbench-v2.store'

// =============================================================================
// Event Schema
// =============================================================================

const sseEventSchema = z.discriminatedUnion('type', [
  // Status change event
  z.object({
    type: z.literal('status'),
    status: z.string().optional(),
    code: z.string().optional(),
    failureCode: z.string().optional(),
    errorMessage: z.string().optional(),
    taskId: z.string().optional(),
    nextTaskId: z.string().optional(), // For task switching
    stage: z.string().optional(),
  }),
  // Streaming content
  z.object({
    type: z.literal('token'),
    text: z.string().optional(),
    taskId: z.string().optional(),
    stage: z.string().optional(),
    requestId: z.string().optional(),
    traceId: z.string().optional(),
  }),
  z.object({
    type: z.literal('token_batch'),
    text: z.string().optional(),
    data: z.string().optional(),
    taskId: z.string().optional(),
    stage: z.string().optional(),
    count: z.number().optional(),
    startedAt: z.number().optional(),
  }),
  // Lifecycle events
  z.object({ type: z.literal('start') }),
  z.object({ type: z.literal('done') }),
  z.object({ type: z.literal('connected') }), // SSE connection established
  z.object({
    type: z.literal('error'),
    message: z.string().optional(),
    error: z.string().optional(),
  }),
  // Result events
  z.object({
    type: z.literal('ocr_result'),
    text: z.string().optional(),
  }),
  z.object({
    type: z.literal('summary_result'),
    json: z.any().optional(),
  }),
  z.object({
    type: z.literal('match_result'),
    json: z.any().optional(),
  }),
  z.object({
    type: z.literal('pre_match_result'),
    json: z.any().optional(),
  }),
  // Info events
  z.object({
    type: z.literal('info'),
    code: z.string().optional(),
    message: z.string().optional(),
  }),
])

type SseEvent = z.infer<typeof sseEventSchema>

// =============================================================================
// Status Mapping
// =============================================================================

/**
 * Maps SSE status/code strings to WorkbenchStatusV2
 */
export function mapToStatus(
  status?: string,
  code?: string,
): WorkbenchStatusV2 | null {
  const s = status?.toUpperCase()
  const c = code?.toLowerCase()

  // Status string mapping (direct match)
  const statusMap: Record<string, WorkbenchStatusV2> = {
    // Free tier vision
    JOB_VISION_PENDING: 'JOB_VISION_PENDING',
    JOB_VISION_STREAMING: 'JOB_VISION_STREAMING',
    JOB_VISION_COMPLETED: 'JOB_VISION_COMPLETED',
    JOB_VISION_FAILED: 'JOB_VISION_FAILED',
    // Paid tier OCR
    OCR_PENDING: 'OCR_PENDING',
    OCR_COMPLETED: 'OCR_COMPLETED',
    OCR_FAILED: 'OCR_FAILED',
    // Summary (Paid tier + Free tier text JD)
    SUMMARY_PENDING: 'SUMMARY_PENDING',
    SUMMARY_STREAMING: 'SUMMARY_STREAMING', // Free tier text JD uses this
    SUMMARY_COMPLETED: 'SUMMARY_COMPLETED',
    SUMMARY_FAILED: 'SUMMARY_FAILED',
    // Pre-match
    PREMATCH_PENDING: 'PREMATCH_PENDING',
    PREMATCH_STREAMING: 'PREMATCH_STREAMING',
    PREMATCH_COMPLETED: 'PREMATCH_COMPLETED',
    PREMATCH_FAILED: 'PREMATCH_FAILED',
    // Match
    MATCH_PENDING: 'MATCH_PENDING',
    MATCH_STREAMING: 'MATCH_STREAMING',
    MATCH_COMPLETED: 'MATCH_COMPLETED',
    MATCH_FAILED: 'MATCH_FAILED',
    COMPLETED: 'MATCH_COMPLETED',
    // Customize
    CUSTOMIZE_PENDING: 'CUSTOMIZE_PENDING',
    CUSTOMIZE_COMPLETED: 'CUSTOMIZE_COMPLETED',
    CUSTOMIZE_FAILED: 'CUSTOMIZE_FAILED',
    // Interview
    INTERVIEW_PENDING: 'INTERVIEW_PENDING',
    INTERVIEW_STREAMING: 'INTERVIEW_STREAMING',
    INTERVIEW_COMPLETED: 'INTERVIEW_COMPLETED',
    INTERVIEW_FAILED: 'INTERVIEW_FAILED',
  }

  if (s && statusMap[s]) {
    return statusMap[s]
  }

  // Code string mapping (event codes from backend)
  const codeMap: Record<string, WorkbenchStatusV2> = {
    // Job Vision variants
    job_vision_queued: 'JOB_VISION_PENDING',
    job_vision_enqueued: 'JOB_VISION_PENDING',
    job_vision_started: 'JOB_VISION_STREAMING',
    job_vision_summary_started: 'JOB_VISION_STREAMING',
    job_vision_completed: 'JOB_VISION_COMPLETED',
    job_vision_failed: 'JOB_VISION_FAILED',

    // OCR variants
    ocr_pending: 'OCR_PENDING',
    ocr_queued: 'OCR_PENDING',
    ocr_completed: 'OCR_COMPLETED',
    ocr_failed: 'OCR_FAILED',

    // Summary variants (Paid tier + Free tier text JD)
    summary_pending: 'SUMMARY_PENDING',
    summary_queued: 'SUMMARY_PENDING',
    job_summary_started: 'SUMMARY_STREAMING', // Free tier text JD
    summary_started: 'SUMMARY_STREAMING',
    summary_completed: 'SUMMARY_COMPLETED',
    summary_failed: 'SUMMARY_FAILED',

    // Prematch variants
    prematch_queued: 'PREMATCH_PENDING',
    prematch_pending: 'PREMATCH_PENDING',
    prematch_started: 'PREMATCH_STREAMING',
    prematch_streaming: 'PREMATCH_STREAMING',
    prematch_completed: 'PREMATCH_COMPLETED',
    prematch_failed: 'PREMATCH_FAILED',

    // Match variants
    match_pending: 'MATCH_PENDING',
    match_queued: 'MATCH_PENDING',
    match_streaming: 'MATCH_STREAMING',
    match_completed: 'MATCH_COMPLETED',
    match_failed: 'MATCH_FAILED',

    // Customize variants
    customize_pending: 'CUSTOMIZE_PENDING',
    customize_queued: 'CUSTOMIZE_PENDING',
    customize_completed: 'CUSTOMIZE_COMPLETED',
    customize_failed: 'CUSTOMIZE_FAILED',

    // Interview variants
    interview_pending: 'INTERVIEW_PENDING',
    interview_queued: 'INTERVIEW_PENDING',
    interview_streaming: 'INTERVIEW_STREAMING',
    interview_started: 'INTERVIEW_STREAMING',
    interview_completed: 'INTERVIEW_COMPLETED',
    interview_failed: 'INTERVIEW_FAILED',
  }

  // Normalized lookup
  if (c) {
    // Try direct match
    if (codeMap[c]) return codeMap[c]

    // Try fuzzy match for "streaming" or "started"
    if (c.includes('streaming') || c.includes('started')) {
      if (c.includes('vision')) return 'JOB_VISION_STREAMING'
      if (c.includes('prematch')) return 'PREMATCH_STREAMING'
      if (c.includes('match')) return 'MATCH_STREAMING'
      if (c.includes('interview')) return 'INTERVIEW_STREAMING'
    }
  }

  return null
}

export interface ProcessedEvent {
  // Status change
  newStatus?: WorkbenchStatusV2 | undefined
  statusDetail?: string | undefined
  errorMessage?: string | undefined

  // Content
  tokenChunk?: string | undefined
  tokenTaskId?: string | undefined
  visionResult?: Record<string, unknown> | undefined
  summaryResult?: Record<string, unknown> | undefined
  matchResult?: Record<string, unknown> | undefined
  preMatchResult?: Record<string, unknown> | undefined
  ocrText?: string | undefined

  // Lifecycle
  streamStarted?: boolean | undefined
  streamCompleted?: boolean | undefined

  // Task switch
  nextTaskId?: string | undefined
}

/**
 * Process a raw SSE event into actionable updates
 */
export function processSseEvent(raw: unknown): ProcessedEvent | null {
  const parsed = sseEventSchema.safeParse(raw)
  if (!parsed.success) {
    sseLog.warn('Invalid SSE event', { raw, error: parsed.error.message })
    return null
  }

  const event = parsed.data
  sseLog.event(event.type, event)

  const result: ProcessedEvent = {}

  switch (event.type) {
    case 'status': {
      const mappedStatus = mapToStatus(event.status, event.code)
      if (mappedStatus) {
        result.newStatus = mappedStatus
        result.statusDetail = event.stage || event.code || event.status
      }
      if (event.errorMessage) {
        result.errorMessage = event.errorMessage
      } else if (event.failureCode) {
        result.errorMessage = event.failureCode
      }
      // Use dedicated nextTaskId field for task switching, fallback to taskId
      if (event.nextTaskId) {
        result.nextTaskId = event.nextTaskId
      } else if (event.taskId) {
        result.nextTaskId = event.taskId
      }
      break
    }

    case 'token': {
      if (event.text) {
        result.tokenChunk = event.text
      }
      if (event.taskId) {
        result.tokenTaskId = event.taskId
      }
      break
    }

    case 'token_batch': {
      const text = event.text || event.data
      if (text) {
        result.tokenChunk = text
      }
      if (event.taskId) {
        result.tokenTaskId = event.taskId
      }
      break
    }

    case 'start': {
      result.streamStarted = true
      break
    }

    case 'done': {
      result.streamCompleted = true
      break
    }

    case 'error': {
      result.errorMessage = event.message || event.error || 'stream_error'
      break
    }

    case 'ocr_result': {
      if (event.text) {
        result.ocrText = event.text
      }
      break
    }

    case 'summary_result': {
      if (event.json && typeof event.json === 'object') {
        result.summaryResult = event.json as Record<string, unknown>
      }
      break
    }

    case 'match_result': {
      if (event.json && typeof event.json === 'object') {
        result.matchResult = event.json as Record<string, unknown>
      }
      break
    }

    case 'pre_match_result': {
      if (event.json && typeof event.json === 'object') {
        result.preMatchResult = event.json as Record<string, unknown>
      }
      break
    }

    case 'info': {
      // Info events for logging/display only
      if (event.code) {
        result.statusDetail = event.code
      }
      break
    }

    case 'connected': {
      // SSE connection established - no state update needed
      // This is a lifecycle event from the server, not a worker event
      break
    }
  }

  return Object.keys(result).length > 0 ? result : null
}

/**
 * Determine which content buffer a token should go to based on current status
 */
export function getTokenTarget(
  status: WorkbenchStatusV2,
  tier: ExecutionTier = 'free',
): 'vision' | 'ocr' | 'summary' | 'preMatch' | 'match' | 'interview' | null {
  // Free tier - Vision
  if (status === 'JOB_VISION_STREAMING' || status === 'JOB_VISION_PENDING') {
    return 'vision'
  }

  // Paid tier - OCR
  if (status === 'OCR_STREAMING' || status === 'OCR_PENDING') {
    return 'ocr'
  }

  // Summary (Paid tier + Free tier text JD)
  if (status === 'SUMMARY_STREAMING' || status === 'SUMMARY_PENDING') {
    return tier === 'paid' ? 'summary' : 'vision'
  }

  // Paid tier - PreMatch
  if (status === 'PREMATCH_STREAMING' || status === 'PREMATCH_PENDING') {
    return 'preMatch'
  }

  // Both tiers - Match
  if (status === 'MATCH_STREAMING' || status === 'MATCH_PENDING') {
    return 'match'
  }

  if (status === 'INTERVIEW_STREAMING' || status === 'INTERVIEW_PENDING') {
    return 'interview'
  }

  return null
}

/**
 * Check if a status transition should trigger a task ID switch
 */
export function shouldSwitchTask(
  prevStatus: WorkbenchStatusV2,
  newStatus: WorkbenchStatusV2,
): boolean {
  // Vision/Summary completion → Switch to match task
  // The worker sends nextTaskId with completion events
  if (
    newStatus === 'JOB_VISION_COMPLETED' ||
    newStatus === 'OCR_COMPLETED' ||
    newStatus === 'SUMMARY_COMPLETED' ||
    newStatus === 'PREMATCH_COMPLETED'
  ) {
    return true
  }

  // Also handle direct transition to match phase
  if (
    (prevStatus === 'JOB_VISION_COMPLETED' ||
      prevStatus === 'JOB_VISION_STREAMING' ||
      prevStatus === 'SUMMARY_COMPLETED' ||
      prevStatus === 'PREMATCH_PENDING' ||
      prevStatus === 'PREMATCH_STREAMING' ||
      prevStatus === 'PREMATCH_COMPLETED') &&
    (newStatus === 'MATCH_PENDING' || newStatus === 'MATCH_STREAMING')
  ) {
    return true
  }

  return false
}

/**
 * Get expected task ID prefix for a status
 */
export function getTaskPrefix(
  status: WorkbenchStatusV2,
): 'job' | 'match' | 'customize' | 'interview' {
  if (
    status === 'JOB_VISION_PENDING' ||
    status === 'JOB_VISION_STREAMING' ||
    status === 'JOB_VISION_COMPLETED' ||
    status === 'OCR_PENDING' ||
    status === 'OCR_COMPLETED' ||
    status === 'SUMMARY_PENDING'
  ) {
    return 'job'
  }

  if (status.startsWith('CUSTOMIZE')) {
    return 'customize'
  }

  if (status.startsWith('INTERVIEW')) {
    return 'interview'
  }

  return 'match'
}
