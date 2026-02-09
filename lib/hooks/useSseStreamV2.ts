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
    status,
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
    appendInterviewContent,
    // Connection
    setConnected,
    recordEvent,
  } = store

  // Refs for connection management
  const esRef = useRef<EventSource | null>(null)
  const currentTaskIdRef = useRef<string | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const connectedTasksRef = useRef<Set<string>>(new Set())
  const connectionSeqRef = useRef(0)

  // Token buffer for batching
  const tokenBufferRef = useRef<string>('')
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tokenTargetRef = useRef<ReturnType<typeof getTokenTarget> | null>(null)
  const lastNonMatchTargetRef = useRef<NonMatchTarget | null>(null)
  const nextTaskIdRef = useRef<string | null>(null)
  const lastEventIdRef = useRef<string | null>(null)
  const lastEventTaskIdRef = useRef<string | null>(null)

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
      case 'interview':
        appendInterviewContent(buffer)
        break
    }
  }, [
    appendVisionContent,
    appendOcrContent,
    appendSummaryContent,
    appendPreMatchContent,
    appendMatchContent,
    appendInterviewContent,
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
      if (tokenTaskId?.startsWith('interview_')) return 'interview'
      if (tokenTaskId?.startsWith('match_')) return 'match'
      const statusTarget = getTokenTarget(currentStatus, currentTier)
      if (tokenTaskId?.startsWith('job_')) {
        return lastNonMatchTargetRef.current || statusTarget
      }
      return statusTarget || lastNonMatchTargetRef.current
    },
    [],
  )

  const getResumeId = useCallback((taskId: string) => {
    return lastEventTaskIdRef.current === taskId ? lastEventIdRef.current : null
  }, [])

  /**
   * Connect to SSE stream for a task
   */
  const connect = useCallback(
    (
      taskId: string,
      fromLatest: boolean = false,
      resumeFromId: string | null = null,
    ) => {
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
        sseLog.connection('client_close', {
          reason: 'connect_new',
          prevTaskId: currentTaskIdRef.current,
          nextTaskId: taskId,
        })
        connectionSeqRef.current += 1
        esRef.current.close()
        esRef.current = null
      }

      // Build URL
      const fromLatestParam = fromLatest ? '1' : '0'
      const resumeParam = resumeFromId
        ? `&lastEventId=${encodeURIComponent(resumeFromId)}`
        : ''
      const url = `/api/sse-stream?userId=${encodeURIComponent(userId)}&serviceId=${encodeURIComponent(serviceId)}&taskId=${encodeURIComponent(taskId)}&fromLatest=${fromLatestParam}${resumeParam}`

      sseLog.connection('connecting', {
        taskId,
        fromLatest: fromLatestParam,
        isReconnect: connectedTasksRef.current.has(taskId),
      })

      const connectionId = connectionSeqRef.current + 1
      connectionSeqRef.current = connectionId
      const es = new EventSource(url)
      esRef.current = es
      currentTaskIdRef.current = taskId
      connectedTasksRef.current.add(taskId)

      es.onopen = () => {
        if (connectionSeqRef.current !== connectionId) return
        sseLog.connection('opened', { taskId })
        setConnected(true, taskId)

        // Clear reconnect timeout on successful connection
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
          reconnectTimeoutRef.current = null
        }
      }

      es.onmessage = (ev) => {
        if (connectionSeqRef.current !== connectionId) return
        if (!ev?.data) return

        try {
          const raw = JSON.parse(ev.data)
          recordEvent()

          if (ev.lastEventId) {
            lastEventIdRef.current = ev.lastEventId
            lastEventTaskIdRef.current = currentTaskIdRef.current
          } else if ((raw as any)?._sid) {
            lastEventIdRef.current = String((raw as any)._sid)
            lastEventTaskIdRef.current = currentTaskIdRef.current
          }

          const processed = processSseEvent(raw)
          if (!processed) return

          const currentState = useWorkbenchV2Store.getState()

          if (processed.nextTaskId) {
            nextTaskIdRef.current = processed.nextTaskId
          }

          sseLog.event('process_event', {
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

          const shouldCloseForTerminal =
            raw.type === 'status' &&
            processed.newStatus &&
            isTerminalStatus(processed.newStatus)

          // Handle status change
          // Handle status change
          if (processed.newStatus) {
            // CRITICAL: Execute state updates synchronously, not after async operations
            // Save old status for transition logic
            const oldStatus = currentState.status

            setLastNonMatchTarget(processed.newStatus, currentState.tier)

            sseLog.event('set_status', { status: processed.newStatus })

            setStatus(processed.newStatus, processed.statusDetail)
            // Log event after applying status
            sseLog.event('status_applied', { status: processed.newStatus })

            sseLog.event('status_logic', {
              newStatus: processed.newStatus,
              oldStatus: oldStatus,
              shouldSwitch: shouldSwitchTask(oldStatus, processed.newStatus),
              hasNextTaskId: !!processed.nextTaskId,
            })

            // Check if we need to switch task
            if (shouldSwitchTask(oldStatus, processed.newStatus)) {
              // Look for next task ID in the event
              const nextTaskId = processed.nextTaskId || nextTaskIdRef.current
              if (nextTaskId && nextTaskId !== currentTaskIdRef.current) {
                sseLog.connection('switching_task', {
                  from: currentTaskIdRef.current,
                  to: nextTaskId,
                  reason: `${oldStatus} → ${processed.newStatus}`,
                })

                // Flush any pending tokens before switch
                flushTokenBuffer()

                // Connect to new task
                connect(nextTaskId, false)
                nextTaskIdRef.current = null
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
            const shouldSetError =
              !!processed.newStatus && processed.newStatus.endsWith('FAILED')
            if (shouldSetError) {
              setError(processed.errorMessage)
            }
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

          if (processed.matchResult) {
            sseLog.event('match_result_received', {
              keys: Object.keys(processed.matchResult),
              hasMatchScore: 'match_score' in processed.matchResult,
            })
            setMatchResult(processed.matchResult)
            const state = useWorkbenchV2Store.getState()
            if (!state.content.matchContent) {
              appendMatchContent(JSON.stringify(processed.matchResult, null, 2))
            }
            if (
              state.status === 'MATCH_STREAMING' ||
              state.status === 'MATCH_PENDING'
            ) {
              flushTokenBuffer()
              setStatus('MATCH_COMPLETED')
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
            } else if (s === 'INTERVIEW_PENDING') {
              setStatus('INTERVIEW_STREAMING')
            }
          }

          if (processed.streamCompleted) {
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
            } else if (
              currentStatus === 'INTERVIEW_STREAMING' ||
              currentStatus === 'INTERVIEW_PENDING'
            ) {
              setStatus('INTERVIEW_COMPLETED')
            }

            if (
              (currentStatus === 'JOB_VISION_STREAMING' ||
                currentStatus === 'JOB_VISION_PENDING' ||
                currentStatus === 'OCR_STREAMING' ||
                currentStatus === 'OCR_PENDING' ||
                currentStatus === 'SUMMARY_STREAMING' ||
                currentStatus === 'SUMMARY_PENDING' ||
                currentStatus === 'PREMATCH_STREAMING' ||
                currentStatus === 'PREMATCH_PENDING') &&
              nextTaskIdRef.current &&
              nextTaskIdRef.current !== currentTaskIdRef.current
            ) {
              const nextTaskId = nextTaskIdRef.current
              sseLog.connection('switching_task', {
                from: currentTaskIdRef.current,
                to: nextTaskId,
                reason: `${currentStatus} → completed`,
              })
              connect(nextTaskId, false)
              nextTaskIdRef.current = null
              return
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

          if (shouldCloseForTerminal && esRef.current) {
            sseLog.connection('client_close', {
              reason: 'terminal_event',
              status: processed.newStatus,
              taskId: currentTaskIdRef.current,
            })
            connectionSeqRef.current += 1
            esRef.current.close()
            esRef.current = null
            if (reconnectTimeoutRef.current) {
              clearTimeout(reconnectTimeoutRef.current)
              reconnectTimeoutRef.current = null
            }
            setConnected(false)
          }
        } catch (e) {
          sseLog.error('Event parse error', { error: e, data: ev.data })
        }
      }

      es.onerror = () => {
        if (connectionSeqRef.current !== connectionId) return
        sseLog.warn('Connection error', {
          taskId,
          readyState: es.readyState,
          lastEventId: lastEventIdRef.current,
        })
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
            if (esRef.current && esRef.current.readyState !== 2) {
              sseLog.connection('manual_reconnect_skip', {
                taskId,
                readyState: esRef.current.readyState,
                lastEventId: lastEventIdRef.current,
              })
              return
            }
            const resumeId =
              lastEventTaskIdRef.current === taskId
                ? lastEventIdRef.current
                : null
            sseLog.connection('manual_reconnect', {
              taskId,
              resumeId,
            })
            connect(taskId, false, resumeId)
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
    const resumeId = getResumeId(taskId)
    const fromLatest = !resumeId && !isNewConnection

    sseLog.connection('hook_init', {
      taskId,
      isNew: isNewConnection,
      skip,
    })

    // Connect
    connect(taskId, fromLatest, resumeId)

    // Cleanup
    return () => {
      if (esRef.current) {
        sseLog.connection('client_close', {
          reason: 'cleanup',
          taskId: currentTaskIdRef.current,
        })
        connectionSeqRef.current += 1
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
  }, [
    userId,
    serviceId,
    initialTaskId,
    skip,
    connect,
    flushTokenBuffer,
    getResumeId,
  ])

  // Return current connection state for debugging
  return {
    isConnected: store.connection.isConnected,
    currentTaskId: currentTaskIdRef.current,
  }
}

// Helper to check terminal status
function isTerminalStatus(status: WorkbenchStatusV2): boolean {
  return (
    status === 'MATCH_COMPLETED' ||
    status === 'MATCH_FAILED' ||
    status === 'CUSTOMIZE_COMPLETED' ||
    status === 'CUSTOMIZE_FAILED' ||
    status === 'INTERVIEW_COMPLETED' ||
    status === 'INTERVIEW_FAILED' ||
    status.endsWith('_FAILED')
  )
}
