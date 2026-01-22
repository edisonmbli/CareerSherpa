/**
 * SSE Stream Hook V2
 *
 * Clean rewrite of SSE connection management with:
 * - Immediate connection on service creation
 * - Automatic task ID switching on phase transitions
 * - Robust reconnection handling
 * - Integration with workbench-v2 store
 */

'use client'

import { useEffect, useRef, useCallback } from 'react'
import {
  useWorkbenchV2Store,
  type WorkbenchStatusV2,
} from '@/lib/stores/workbench-v2.store'
import {
  processSseEvent,
  getTokenTarget,
  shouldSwitchTask,
} from '../ui/sse-event-processor'
import { sseLog } from '@/lib/ui/sse-debug-logger'

type NonMatchTarget = Exclude<ReturnType<typeof getTokenTarget>, 'match' | null>

interface UseSseStreamV2Options {
  userId: string
  serviceId: string
  /**
   * Initial task ID for connection.
   * Format: `${prefix}_${serviceId}_${sessionId}`
   * Prefix: 'job' | 'match' | 'customize' | 'interview'
   */
  initialTaskId?: string | undefined
  /**
   * Skip SSE connection (for terminal states)
   */
  skip?: boolean | undefined
}

export function useSseStreamV2(options: UseSseStreamV2Options) {
  const { userId, serviceId, initialTaskId, skip = false } = options

  // Store actions
  const store = useWorkbenchV2Store()
  const {
    setStatus,
    setStatusDetail,
    setError,
    // Free tier
    appendVisionContent,
    setVisionResult,
    // Paid tier
    appendOcrContent,
    setOcrResult,
    appendSummaryContent,
    setSummaryResult,
    appendPreMatchContent,
    setPreMatchResult,
    // Both tiers
    appendMatchContent,
    setMatchResult,
    // Connection
    setConnected,
    recordEvent,
  } = store

  // Refs for connection management
  const esRef = useRef<EventSource | null>(null)
  const currentTaskIdRef = useRef<string | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const connectedTasksRef = useRef<Set<string>>(new Set())

  // Token buffer for batching
  const tokenBufferRef = useRef<string>('')
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tokenTargetRef = useRef<ReturnType<typeof getTokenTarget> | null>(null)
  const lastNonMatchTargetRef = useRef<NonMatchTarget | null>(null)

  const deriveNonMatchTarget = useCallback(
    (
      status: WorkbenchStatusV2,
      tier: 'free' | 'paid',
    ): NonMatchTarget | null => {
      if (
        status === 'JOB_VISION_PENDING' ||
        status === 'JOB_VISION_STREAMING'
      ) {
        return 'vision'
      }
      if (status === 'OCR_PENDING' || status === 'OCR_STREAMING') {
        return 'ocr'
      }
      if (status === 'SUMMARY_PENDING' || status === 'SUMMARY_STREAMING') {
        return tier === 'paid' ? 'summary' : 'vision'
      }
      if (status === 'PREMATCH_PENDING' || status === 'PREMATCH_STREAMING') {
        return 'preMatch'
      }
      return null
    },
    [],
  )

  const setLastNonMatchTarget = useCallback(
    (status: WorkbenchStatusV2, tier: 'free' | 'paid') => {
      const target = deriveNonMatchTarget(status, tier)
      if (target) {
        lastNonMatchTargetRef.current = target
      }
    },
    [deriveNonMatchTarget],
  )

  /**
   * Flush buffered tokens to store
   */
  const flushTokenBuffer = useCallback(() => {
    const buffer = tokenBufferRef.current
    if (!buffer) return

    tokenBufferRef.current = ''

    const { status: currentStatus, tier: currentTier } =
      useWorkbenchV2Store.getState()
    const target =
      tokenTargetRef.current ||
      getTokenTarget(currentStatus, currentTier) ||
      lastNonMatchTargetRef.current
    tokenTargetRef.current = null

    switch (target) {
      case 'vision':
        appendVisionContent(buffer)
        break
      case 'ocr':
        appendOcrContent(buffer)
        break
      case 'summary':
        appendSummaryContent(buffer)
        break
      case 'preMatch':
        appendPreMatchContent(buffer)
        break
      case 'match':
        appendMatchContent(buffer)
        break
    }
  }, [
    appendVisionContent,
    appendOcrContent,
    appendSummaryContent,
    appendPreMatchContent,
    appendMatchContent,
  ])

  /**
   * Buffer a token chunk and schedule flush
   */
  const bufferToken = useCallback(
    (
      chunk: string,
      targetOverride?: ReturnType<typeof getTokenTarget> | null,
    ) => {
      const currentBuffer = tokenBufferRef.current
      if (!currentBuffer) {
        tokenBufferRef.current = chunk
      } else if (
        chunk.length >= currentBuffer.length &&
        chunk.includes(currentBuffer)
      ) {
        tokenBufferRef.current = chunk
      } else if (currentBuffer.startsWith(chunk)) {
        tokenBufferRef.current = currentBuffer
      } else {
        tokenBufferRef.current = currentBuffer + chunk
      }
      if (targetOverride) {
        tokenTargetRef.current = targetOverride
      }

      // Debounce flush to 30ms for smooth rendering
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current)
      }
      flushTimerRef.current = setTimeout(() => {
        flushTokenBuffer()
        flushTimerRef.current = null
      }, 30)
    },
    [flushTokenBuffer],
  )

  const resolveTokenTarget = useCallback(
    (
      tokenTaskId: string | undefined,
      currentStatus: WorkbenchStatusV2,
      currentTier: 'free' | 'paid',
    ) => {
      if (tokenTaskId?.startsWith('customize_')) return null
      if (tokenTaskId?.startsWith('interview_')) return null
      if (tokenTaskId?.startsWith('match_')) return 'match'
      const statusTarget = getTokenTarget(currentStatus, currentTier)
      if (tokenTaskId?.startsWith('job_')) {
        return lastNonMatchTargetRef.current || statusTarget
      }
      return statusTarget || lastNonMatchTargetRef.current
    },
    [],
  )

  /**
   * Connect to SSE stream for a task
   */
  const connect = useCallback(
    (taskId: string, fromLatest: boolean = false) => {
      if (!userId || !serviceId || !taskId) {
        sseLog.warn('Cannot connect: missing params', {
          userId,
          serviceId,
          taskId,
        })
        return
      }

      // Close existing connection
      if (esRef.current) {
        esRef.current.close()
        esRef.current = null
      }

      // Build URL
      const fromLatestParam = fromLatest ? '1' : '0'
      const url = `/api/sse-stream?userId=${encodeURIComponent(userId)}&serviceId=${encodeURIComponent(serviceId)}&taskId=${encodeURIComponent(taskId)}&fromLatest=${fromLatestParam}`

      sseLog.connection('connecting', {
        taskId,
        fromLatest: fromLatestParam,
        isReconnect: connectedTasksRef.current.has(taskId),
      })

      const es = new EventSource(url)
      esRef.current = es
      currentTaskIdRef.current = taskId
      connectedTasksRef.current.add(taskId)

      es.onopen = () => {
        sseLog.connection('opened', { taskId })
        setConnected(true, taskId)

        // Clear reconnect timeout on successful connection
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
          reconnectTimeoutRef.current = null
        }
      }

      es.onmessage = (ev) => {
        if (!ev?.data) return

        try {
          const raw = JSON.parse(ev.data)
          recordEvent()

          const processed = processSseEvent(raw)
          if (!processed) return

          const currentState = useWorkbenchV2Store.getState()

          // DEBUG: Log raw event processing details
          console.log('[SSE DEBUG] Processing Event:', {
            type: raw.type,
            taskId: currentTaskIdRef.current,
            eventTaskId: raw.taskId,
            status: processed.newStatus,
            hasToken: !!processed.tokenChunk,
            hasResult: !!(
              processed.visionResult ||
              processed.ocrText ||
              processed.summaryResult ||
              processed.matchResult
            ),
          })

          // Handle status change
          // Handle status change
          if (processed.newStatus) {
            // CRITICAL: Execute state updates synchronously, not after async operations
            // Save old status for transition logic
            const oldStatus = currentState.status

            setLastNonMatchTarget(processed.newStatus, currentState.tier)

            console.log(
              '[useSseStreamV2] Defensive setStatus:',
              processed.newStatus,
            )

            setStatus(processed.newStatus, processed.statusDetail)
            // Log event after applying status
            sseLog.event('status_applied', { status: processed.newStatus })

            // Debug: trace all status updates from SSE events
            console.log('[useSseStreamV2] Status logic:', {
              newStatus: processed.newStatus,
              oldStatus: oldStatus,
              shouldSwitch: shouldSwitchTask(oldStatus, processed.newStatus),
              hasNextTaskId: !!processed.nextTaskId,
            })

            // Check if we need to switch task
            if (shouldSwitchTask(oldStatus, processed.newStatus)) {
              // Look for next task ID in the event
              if (
                processed.nextTaskId &&
                processed.nextTaskId !== currentTaskIdRef.current
              ) {
                sseLog.connection('switching_task', {
                  from: currentTaskIdRef.current,
                  to: processed.nextTaskId,
                  reason: `${oldStatus} → ${processed.newStatus}`,
                })

                // Flush any pending tokens before switch
                flushTokenBuffer()

                // Connect to new task
                connect(processed.nextTaskId, false)
                return
              }
            }
          }

          if (processed.statusDetail && !processed.newStatus) {
            setStatusDetail(processed.statusDetail)
          }

          // Handle error - always set error when errorMessage exists
          // (can be in addition to status change for _FAILED events)
          if (processed.errorMessage) {
            setError(processed.errorMessage)
          }

          // Handle tokens
          if (processed.tokenChunk) {
            const tokenTarget = resolveTokenTarget(
              processed.tokenTaskId,
              currentState.status,
              currentState.tier,
            )
            bufferToken(processed.tokenChunk, tokenTarget)
          }

          // Handle results
          if (processed.visionResult) {
            setVisionResult(processed.visionResult)
          }

          if (processed.summaryResult) {
            const state = useWorkbenchV2Store.getState()
            const nextSummaryContent = JSON.stringify(
              processed.summaryResult,
              null,
              2,
            )
            if (state.content.summaryContent !== nextSummaryContent) {
              setSummaryResult(processed.summaryResult)
              if (!state.content.summaryContent) {
                appendSummaryContent(nextSummaryContent)
              }
            }
          }

          // Debug: trace matchResult handling
          if (processed.matchResult) {
            console.log(
              '[useSseStreamV2] matchResult received, calling setMatchResult:',
              {
                keys: Object.keys(processed.matchResult),
                hasMatchScore: 'match_score' in processed.matchResult,
              },
            )
            setMatchResult(processed.matchResult)
            // Content Backfill
            const state = useWorkbenchV2Store.getState()
            if (!state.content.matchContent) {
              appendMatchContent(JSON.stringify(processed.matchResult, null, 2))
            }
          }

          if (processed.preMatchResult) {
            const state = useWorkbenchV2Store.getState()
            const nextPreMatchContent = JSON.stringify(
              processed.preMatchResult,
              null,
              2,
            )
            if (state.content.preMatchContent !== nextPreMatchContent) {
              setPreMatchResult(processed.preMatchResult)
              if (!state.content.preMatchContent) {
                appendPreMatchContent(nextPreMatchContent)
              }
            }
          }

          if (processed.ocrText) {
            // OCR text received - set as ocrJson (batch result)
            setOcrResult({ text: processed.ocrText })
            // Content Backfill
            const state = useWorkbenchV2Store.getState()
            if (!state.content.ocrContent) {
              appendOcrContent(processed.ocrText)
            }
          }

          // Handle stream lifecycle
          if (processed.streamStarted) {
            sseLog.event('stream_started', { taskId })
            // Update status to streaming if pending
            const s = currentState.status
            if (s === 'JOB_VISION_PENDING') {
              setLastNonMatchTarget('JOB_VISION_STREAMING', currentState.tier)
              setStatus('JOB_VISION_STREAMING')
            } else if (s === 'SUMMARY_PENDING') {
              setLastNonMatchTarget('SUMMARY_STREAMING', currentState.tier)
              setStatus('SUMMARY_STREAMING')
            } else if (s === 'PREMATCH_PENDING') {
              setLastNonMatchTarget('PREMATCH_STREAMING', currentState.tier)
              setStatus('PREMATCH_STREAMING')
            } else if (s === 'MATCH_PENDING') {
              setStatus('MATCH_STREAMING')
            }
          }

          if (processed.streamCompleted) {
            console.log('[SSE DEBUG] Stream Completed event received', {
              taskId,
            })
            sseLog.event('stream_completed', { taskId })
            flushTokenBuffer()

            // Try to parse JSON from vision content if not already set
            const state = useWorkbenchV2Store.getState()
            if (
              (state.status === 'JOB_VISION_STREAMING' ||
                state.status === 'JOB_VISION_PENDING') &&
              !state.content.visionJson &&
              state.content.visionContent
            ) {
              try {
                const cleaned = state.content.visionContent
                  .replace(/```json\n?|\n?```/g, '')
                  .trim()
                if (cleaned.startsWith('{')) {
                  const json = JSON.parse(cleaned)
                  setVisionResult(json)
                }
              } catch {
                // Non-fatal: keep raw content
              }
            }

            // Mark phase as completed
            const currentStatus = state.status

            // Free Tier Transitions
            if (
              currentStatus === 'JOB_VISION_STREAMING' ||
              currentStatus === 'JOB_VISION_PENDING'
            ) {
              setStatus('JOB_VISION_COMPLETED')
            }

            // Paid Tier Transitions
            else if (
              currentStatus === 'OCR_STREAMING' ||
              currentStatus === 'OCR_PENDING'
            ) {
              setStatus('OCR_COMPLETED')
            } else if (
              currentStatus === 'SUMMARY_STREAMING' ||
              currentStatus === 'SUMMARY_PENDING'
            ) {
              setStatus('SUMMARY_COMPLETED')
            } else if (
              currentStatus === 'PREMATCH_STREAMING' ||
              currentStatus === 'PREMATCH_PENDING'
            ) {
              setStatus('PREMATCH_COMPLETED')
            }

            // Match Phase Transitions
            else if (
              currentStatus === 'MATCH_STREAMING' ||
              currentStatus === 'MATCH_PENDING'
            ) {
              // Match result should come via match_result event

              // If not, try to parse from content
              if (!state.content.matchJson && state.content.matchContent) {
                try {
                  const cleaned = state.content.matchContent
                    .replace(/```json\n?|\n?```/g, '')
                    .trim()
                  if (cleaned.startsWith('{')) {
                    const json = JSON.parse(cleaned)
                    setMatchResult(json)
                  }
                } catch {
                  // Keep streaming content
                  setStatus('MATCH_COMPLETED')
                }
              }
            }
          }
        } catch (e) {
          sseLog.error('Event parse error', { error: e, data: ev.data })
        }
      }

      es.onerror = () => {
        sseLog.warn('Connection error', { taskId })
        setConnected(false)

        // Don't close - let EventSource auto-reconnect
        // But set a timeout to check connection health
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          const state = useWorkbenchV2Store.getState()
          if (
            !state.connection.isConnected &&
            !isTerminalStatus(state.status)
          ) {
            sseLog.connection('manual_reconnect', { taskId })
            connect(taskId, true) // Reconnect with fromLatest=true
          }
        }, 5000)
      }
    },
    [
      userId,
      serviceId,
      setStatus,
      setStatusDetail,
      setError,
      setVisionResult,
      setMatchResult,
      setOcrResult,
      setSummaryResult,
      setPreMatchResult,
      setConnected,
      recordEvent,
      appendOcrContent,
      appendSummaryContent,
      appendPreMatchContent,
      appendMatchContent,
      bufferToken,
      flushTokenBuffer,
      resolveTokenTarget,
      setLastNonMatchTarget,
    ],
  )

  // Main effect: manage SSE connection lifecycle
  useEffect(() => {
    if (skip || !userId || !serviceId) {
      return
    }

    // Determine initial task ID
    const taskId = initialTaskId || `job_${serviceId}_default`

    // Check if this is a new service (fresh connection needed)
    const isNewConnection = !connectedTasksRef.current.has(taskId)

    sseLog.connection('hook_init', {
      taskId,
      isNew: isNewConnection,
      skip,
    })

    // Connect
    connect(taskId, !isNewConnection)

    // Cleanup
    return () => {
      if (esRef.current) {
        esRef.current.close()
        esRef.current = null
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current)
        flushTimerRef.current = null
      }
      // Flush any remaining tokens
      if (tokenBufferRef.current) {
        flushTokenBuffer()
      }
    }
  }, [userId, serviceId, initialTaskId, skip, connect, flushTokenBuffer])

  // Return current connection state for debugging
  return {
    isConnected: store.connection.isConnected,
    currentTaskId: currentTaskIdRef.current,
  }
}

// Helper to check terminal status
function isTerminalStatus(status: WorkbenchStatusV2): boolean {
  return (
    status.endsWith('_COMPLETED') ||
    status.endsWith('_FAILED') ||
    status === 'MATCH_COMPLETED' ||
    status === 'IDLE'
  )
}
