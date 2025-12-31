'use client'

import { useEffect, useCallback, useRef } from 'react'
import { useResumeStore } from '@/store/resume-store'

/**
 * Hook to protect against accidental page close or navigation
 * when there are unsaved changes.
 * 
 * Behavior: Silent auto-save on exit (no confirmation dialog)
 */
export function useExitProtection() {
    const { isDirty, manualSave, isSaving } = useResumeStore()
    const isSavingRef = useRef(isSaving)

    // Keep ref in sync
    useEffect(() => {
        isSavingRef.current = isSaving
    }, [isSaving])

    // Handle browser close/refresh - trigger silent save
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirty && !isSavingRef.current) {
                // Attempt to save before unload
                // Note: This is best-effort, browser may not wait for async operations
                // Using sendBeacon would be more reliable but requires API changes
                const state = useResumeStore.getState()
                if (state.isDirty && !state.isSaving) {
                    // Trigger synchronous-ish save attempt
                    state.manualSave().catch(() => {
                        // Ignore errors on exit
                    })
                }

                // Still prevent unload to give save a chance to start
                e.preventDefault()
                e.returnValue = ''
                return ''
            }
            return undefined
        }

        window.addEventListener('beforeunload', handleBeforeUnload)
        return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }, [isDirty])

    // Function to save and then navigate
    const saveAndNavigate = useCallback(async (path: string) => {
        if (isDirty && !isSaving) {
            // Silent save attempt before navigation
            await manualSave()
            // Continue navigation regardless of result
        }
        // Note: Navigation must be handled by caller using router.push
        return true
    }, [isDirty, isSaving, manualSave])

    return {
        isDirty,
        saveAndNavigate,
    }
}
