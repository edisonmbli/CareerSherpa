'use client'

/**
 * useServiceStatus Hook
 *
 * Centralizes workbench status initialization and synchronization.
 * Handles:
 * - Server status → Zustand store mapping
 * - Terminal state detection
 * - Error message resolution from server state
 * - SSE connection status
 */

import { useEffect } from 'react'
import { useWorkbenchStore, type WorkbenchStatus } from '@/lib/stores/workbench.store'
import { useRouter } from 'next/navigation'

/**
 * Maps server status string to WorkbenchStatus type
 */
export function mapServerStatus(serverStatus: string | undefined): WorkbenchStatus {
    if (!serverStatus) return 'IDLE'

    const status = serverStatus.toUpperCase()

    const statusMap: Record<string, WorkbenchStatus> = {
        OCR_PENDING: 'OCR_PENDING',
        OCR_COMPLETED: 'OCR_COMPLETED',
        OCR_FAILED: 'OCR_FAILED',
        SUMMARY_PENDING: 'SUMMARY_PENDING',
        SUMMARY_COMPLETED: 'SUMMARY_COMPLETED',
        SUMMARY_FAILED: 'SUMMARY_FAILED',
        MATCH_PENDING: 'MATCH_PENDING',
        MATCH_STREAMING: 'MATCH_STREAMING',
        MATCH_COMPLETED: 'MATCH_COMPLETED',
        MATCH_FAILED: 'MATCH_FAILED',
        CUSTOMIZE_PENDING: 'CUSTOMIZE_PENDING',
        CUSTOMIZE_COMPLETED: 'CUSTOMIZE_COMPLETED',
        CUSTOMIZE_FAILED: 'CUSTOMIZE_FAILED',
        INTERVIEW_PENDING: 'INTERVIEW_PENDING',
        INTERVIEW_COMPLETED: 'INTERVIEW_COMPLETED',
        INTERVIEW_FAILED: 'INTERVIEW_FAILED',
    }

    return statusMap[status] ?? 'IDLE'
}

/**
 * Checks if a status is terminal (COMPLETED or FAILED)
 */
export function isTerminalStatus(status: WorkbenchStatus): boolean {
    return (
        status.endsWith('_COMPLETED') ||
        status.endsWith('_FAILED') ||
        status === 'COMPLETED' ||
        status === 'FAILED'
    )
}

/**
 * Checks if a status is a failure state
 */
export function isFailureStatus(status: WorkbenchStatus): boolean {
    return (
        status === 'MATCH_FAILED' ||
        status === 'SUMMARY_FAILED' ||
        status === 'OCR_FAILED' ||
        status === 'CUSTOMIZE_FAILED' ||
        status === 'INTERVIEW_FAILED'
    )
}

interface UseServiceStatusOptions {
    /** Initial service data from server */
    initialService: {
        id: string
        currentStatus?: string
        failureCode?: string
        match?: { error?: string }
        job?: { error?: string }
        executionSessionId?: string
    } | null
    /** i18n dictionary for error messages */
    dict?: {
        workbench?: {
            statusText?: Record<string, string>
        }
    }
}

/**
 * Hook to sync server service status with Zustand store
 *
 * @returns Store status and related state
 */
export function useServiceStatus(options: UseServiceStatusOptions) {
    const { initialService, dict } = options
    const router = useRouter()

    const {
        status: storeStatus,
        startTask,
        currentServiceId,
    } = useWorkbenchStore()

    // Auto-refresh on completion to sync server state
    useEffect(() => {
        if (storeStatus === 'COMPLETED' || storeStatus === 'MATCH_COMPLETED') {
            router.refresh()
        }
    }, [storeStatus, router])

    // Sync server status to store
    useEffect(() => {
        if (!initialService?.currentStatus) return

        const mapped = mapServerStatus(initialService.currentStatus)
        if (mapped === 'IDLE') return

        const currentStatus = useWorkbenchStore.getState().status

        // Update conditions:
        // 1. Service changed
        // 2. Store is IDLE
        // 3. New terminal state different from current
        const shouldUpdate =
            currentServiceId !== initialService.id ||
            currentStatus === 'IDLE' ||
            (isTerminalStatus(mapped) && mapped !== currentStatus)

        if (shouldUpdate) {
            startTask(initialService.id, mapped)

            // Sync error message for failure states
            if (isFailureStatus(mapped)) {
                let resolvedError = initialService.match?.error || initialService.job?.error

                // Use failureCode for localized error
                if (initialService.failureCode) {
                    const codeKey = String(initialService.failureCode).toLowerCase()
                    const dictMsg = dict?.workbench?.statusText?.[codeKey]
                    if (dictMsg) {
                        resolvedError = dictMsg
                    }
                }

                if (resolvedError) {
                    useWorkbenchStore.getState().setError(resolvedError)
                }
            }
        }
    }, [initialService, startTask, currentServiceId, dict?.workbench?.statusText])

    return {
        status: storeStatus,
        serviceId: initialService?.id,
        isTerminal: isTerminalStatus(storeStatus),
        isFailure: isFailureStatus(storeStatus),
    }
}
