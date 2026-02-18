'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useResumeStore } from '@/store/resume-store'
import { uiLog } from '@/lib/ui/sse-debug-logger'

// Constants for error backoff (scaled to 15s base interval)
const MIN_RETRY_DELAY = 15000   // 15 seconds (matches default idle delay)
const MAX_RETRY_DELAY = 360000  // 6 minutes
const MAX_CONSECUTIVE_ERRORS = 5

/**
 * Custom hook for idle-triggered auto-save
 * Automatically saves when user is inactive for the specified delay
 * Implements exponential backoff on repeated failures
 */
export function useAutoSave(idleDelayMs: number = 15000) {
    const {
        isDirty,
        lastLocalChangeAt,
        isSaving,
        manualSave,
        serviceId,
    } = useResumeStore()

    const timerRef = useRef<NodeJS.Timeout | null>(null)
    const lastSaveAttemptRef = useRef<number>(0)
    const consecutiveErrorsRef = useRef<number>(0)
    const currentDelayRef = useRef<number>(idleDelayMs)

    // Clear any existing timer
    const clearTimer = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current)
            timerRef.current = null
        }
    }, [])

    // Reset error state (called when save succeeds or user makes new changes)
    const resetErrorState = useCallback(() => {
        consecutiveErrorsRef.current = 0
        currentDelayRef.current = idleDelayMs
    }, [idleDelayMs])

    // Trigger save after idle period
    useEffect(() => {
        // Skip if not dirty, already saving, or no service
        if (!isDirty || isSaving || !serviceId) {
            clearTimer()
            return
        }

        // If user made a new change, reset error state
        if (lastLocalChangeAt && lastLocalChangeAt > lastSaveAttemptRef.current) {
            resetErrorState()
        }

        // Stop retrying after too many consecutive errors
        if (consecutiveErrorsRef.current >= MAX_CONSECUTIVE_ERRORS) {
            uiLog.warn('auto-save max retries reached', {
                serviceId,
            })
            clearTimer()
            return
        }

        // Clear previous timer
        clearTimer()

        // Calculate delay with exponential backoff
        const now = Date.now()
        const timeSinceChange = lastLocalChangeAt ? now - lastLocalChangeAt : 0
        const effectiveDelay = currentDelayRef.current
        const remainingDelay = Math.max(0, effectiveDelay - timeSinceChange)

        timerRef.current = setTimeout(async () => {
            // Double-check we're still dirty before saving
            const currentState = useResumeStore.getState()
            if (currentState.isDirty && !currentState.isSaving) {
                // Prevent rapid successive saves
                const timeSinceLastAttempt = Date.now() - lastSaveAttemptRef.current
                if (timeSinceLastAttempt < 2000) return

                lastSaveAttemptRef.current = Date.now()

                // Silent background save
                const result = await currentState.manualSave()

                if (result.ok) {
                    // Success: reset error state
                    resetErrorState()
                } else {
                    // Error: apply exponential backoff
                    consecutiveErrorsRef.current += 1
                    currentDelayRef.current = Math.min(
                        currentDelayRef.current * 2,
                        MAX_RETRY_DELAY
                    )
                    uiLog.warn('auto-save failed', {
                        attempt: consecutiveErrorsRef.current,
                        maxAttempts: MAX_CONSECUTIVE_ERRORS,
                        error: result.error,
                        nextRetrySeconds: currentDelayRef.current / 1000,
                        serviceId,
                    })
                }
            }
        }, remainingDelay)

        return clearTimer
    }, [isDirty, lastLocalChangeAt, isSaving, serviceId, idleDelayMs, clearTimer, resetErrorState])

    // Cleanup on unmount
    useEffect(() => {
        return clearTimer
    }, [clearTimer])

    return {
        isDirty,
        isSaving,
    }
}
