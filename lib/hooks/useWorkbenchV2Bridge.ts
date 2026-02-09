/**
 * Workbench V2 Bridge Hook
 *
 * Bridges between the old workbench.store and new workbench-v2.store,
 * allowing gradual migration without breaking existing functionality.
 *
 * This hook:
 * - Uses V2 store for SSE event processing and state management
 * - Syncs V2 state to old store for backward compatibility
 * - Returns unified state interface for UI components
 */

'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    useWorkbenchV2Store,
    type WorkbenchStatusV2,
    type ExecutionTier,
} from '@/lib/stores/workbench-v2.store'
import { useSseStreamV2 } from '@/lib/hooks/useSseStreamV2'
import { sseLog } from '@/lib/ui/sse-debug-logger'
import { mapToStatus } from '@/lib/ui/sse-event-processor'

interface WorkbenchBridgeOptions {
    userId: string
    serviceId: string
    initialTaskId?: string | undefined
    tier: ExecutionTier
    initialStatus?: string | undefined
    skip?: boolean | undefined
}

export function useWorkbenchV2Bridge(options: WorkbenchBridgeOptions) {
    const { userId, serviceId, initialTaskId, tier, initialStatus, skip = false } = options

    // V2 Store access
    const v2Store = useWorkbenchV2Store()
    const {
        status: v2Status,
        statusDetail,
        errorMessage,
        lastStatusTimestamp,
        content,
        progress,
        connection,
        initialize,
        getStageLabel,
        updateProgress,
    } = v2Store



    // Initialize V2 store when service changes
    useEffect(() => {
        if (!serviceId) return

        const currentState = useWorkbenchV2Store.getState()
        const currentServiceId = currentState.serviceId
        const currentStatus = currentState.status

        // Only initialize if service changed AND we're not in an active state
        // This prevents React Strict Mode double-mount from resetting progress
        // FIX: Treat intermediate completed states (Paid tier) as active to prevent ghost reverts
        const isActiveState = currentStatus !== 'IDLE'

        // FIX: If we are connected to SSE, DO NOT accept server status updates
        // Server status (initialStatus) is often stale compared to live SSE stream
        const isLive = useWorkbenchV2Store.getState().connection.isConnected

        if (currentServiceId !== serviceId) {
            // New service - always initialize
            sseLog.connection('bridge_init', { serviceId, tier })
            initialize(serviceId, tier)

            // If there's an initial status, set it
            if (initialStatus) {
                const mappedStatus = mapInitialStatus(initialStatus)
                if (mappedStatus) {
                    useWorkbenchV2Store.getState().setStatus(mappedStatus)
                }
            }
        } else if (!isActiveState && !isLive && initialStatus) {
            // Same service, IDLE/Inactive, and NOT connected - accept server status
            const mappedStatus = mapInitialStatus(initialStatus)
            if (mappedStatus && currentStatus !== mappedStatus) {
                sseLog.stateChange(currentStatus, mappedStatus, 'bridge_init_status')
                useWorkbenchV2Store.getState().setStatus(mappedStatus)
            }
        }
        // Skip if same service and already in active state or live (React Strict Mode protection)
    }, [serviceId, tier, initialize, initialStatus])

    // Connect SSE using V2 hook
    const { isConnected, currentTaskId } = useSseStreamV2({
        userId,
        serviceId,
        initialTaskId,
        skip,
    })



    // Fast Polling: If we don't have a task ID yet, poll aggressively to get it
    // This fixes the 16s delay where the frontend waits for executionSessionId
    const router = useRouter()
    useEffect(() => {
        if (!serviceId || skip) return undefined

        // If we need a task ID but don't have one, and we aren't connected
        if (!initialTaskId && !currentTaskId && !isConnected) {
            sseLog.connection('polling_for_id', { serviceId })

            // Poll every 1s (aggressive but short-lived)
            const interval = setInterval(() => {
                router.refresh()
            }, 1000)

            return () => clearInterval(interval)
        }
        return undefined
    }, [serviceId, initialTaskId, currentTaskId, isConnected, skip, router])

    // Stuck state detector: If status is stuck in PENDING/STREAMING for too long,
    // trigger router.refresh() to sync with server state as fallback
    const STUCK_THRESHOLD_MS = 45000 // Increased to 45s to avoid false positives
    const CHECK_INTERVAL_MS = 10000   // Check every 10 seconds

    useEffect(() => {
        if (skip) return undefined

        // Only consider it "stuck" if we haven't received an event recently
        // This prevents refreshing while tokens are actively streaming
        const lastAt = connection.lastEventAt || 0
        const timeSinceLastEvent = Date.now() - lastAt
        const isReceivingEvents = timeSinceLastEvent < 10000

        const isActiveStatus =
            v2Status.includes('PENDING') ||
            v2Status.includes('STREAMING')

        if (!isActiveStatus || isReceivingEvents) return undefined

        const checkStuckState = () => {
            // Re-check event recency inside interval
            const currentLastAt = useWorkbenchV2Store.getState().connection.lastEventAt || 0
            const currentAge = Date.now() - currentLastAt
            if (currentAge < 10000) return

            const age = Date.now() - lastStatusTimestamp
            if (age > STUCK_THRESHOLD_MS) {
                sseLog.warn('stuck_state_detected', {
                    status: v2Status,
                    ageMs: age,
                    threshold: STUCK_THRESHOLD_MS,
                    lastEventAgo: currentAge
                })
                // Trigger server state refresh as fallback
                router.refresh()
            }
        }

        // Check periodically
        const interval = setInterval(checkStuckState, CHECK_INTERVAL_MS)

        return () => clearInterval(interval)
    }, [skip, v2Status, lastStatusTimestamp, router, connection.lastEventAt])

    // Real-time progress ticker
    const [displayProgress, setDisplayProgress] = useState(0)

    useEffect(() => {
        if (!progress.isActive) {
            setDisplayProgress(updateProgress())
            return
        }

        let frameId: number
        const animate = () => {
            setDisplayProgress(updateProgress())
            frameId = requestAnimationFrame(animate)
        }
        frameId = requestAnimationFrame(animate)
        return () => cancelAnimationFrame(frameId)
    }, [progress.isActive, progress.startedAt, updateProgress])

    // Derive UI-friendly status message
    // Use statusDetail if available (for custom server messages), otherwise allowed to be null
    // so UI can use localized fallback via deriveStage
    // console.log('[V2Bridge] statusDetail:', statusDetail)
    const statusMessage = undefined

    return {
        // Status
        status: v2Status,
        statusDetail,
        statusMessage,
        errorMessage,

        // Progress
        progress: displayProgress,
        isProgressActive: progress.isActive,

        // Free tier content
        visionContent: content.visionContent,
        visionJson: content.visionJson,

        // Paid tier content
        ocrContent: content.ocrContent,
        ocrJson: content.ocrJson,
        summaryContent: content.summaryContent,
        summaryJson: content.summaryJson,
        preMatchContent: content.preMatchContent,
        preMatchJson: content.preMatchJson,

        // Both tiers - Match content
        matchContent: content.matchContent,
        matchJson: content.matchJson,

        interviewContent: content.interviewContent,
        interviewJson: content.interviewJson,

        // Connection
        isConnected,
        currentTaskId,
        lastEventAt: connection.lastEventAt,

        // Tier for StreamPanelV2
        tier,

        // Methods
        setStatus: v2Store.setStatus,
        setError: v2Store.setError,
        appendMatchContent: v2Store.appendMatchContent,
        setMatchResult: v2Store.setMatchResult,
        reset: v2Store.reset,
        // NOTE: getStageLabel() is intentionally omitted to force UI to use localized deriveStage logic
    }
}

// =============================================================================
// Status Mapping Helpers
// =============================================================================

function mapInitialStatus(serverStatus: string): WorkbenchStatusV2 | null {
    return mapToStatus(serverStatus)
}
