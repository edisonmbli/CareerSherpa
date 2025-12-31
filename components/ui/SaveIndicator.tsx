'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Check, Save } from 'lucide-react'
import { useResumeStore } from '@/store/resume-store'
import { useAutoSave } from '@/hooks/use-auto-save'

type SaveState = 'hidden' | 'dirty' | 'success'

interface SaveIndicatorProps {
    className?: string
    /** Show as floating pill (for mobile) vs inline button (for desktop toolbar) */
    variant?: 'inline' | 'floating'
}

export function SaveIndicator({ className, variant = 'inline' }: SaveIndicatorProps) {
    const { isDirty, isSaving, manualSave } = useResumeStore()

    // Enable auto-save (15s idle)
    useAutoSave(15000)

    const [state, setState] = useState<SaveState>('hidden')
    const successTimerRef = useRef<NodeJS.Timeout | null>(null)
    const prevIsDirtyRef = useRef(isDirty)

    // Clear timer helper
    const clearSuccessTimer = useCallback(() => {
        if (successTimerRef.current) {
            clearTimeout(successTimerRef.current)
            successTimerRef.current = null
        }
    }, [])

    // Clear timer on unmount
    useEffect(() => {
        return clearSuccessTimer
    }, [clearSuccessTimer])

    // State machine: track dirty→saved transitions
    useEffect(() => {
        const wasDirty = prevIsDirtyRef.current
        prevIsDirtyRef.current = isDirty

        // Transition: dirty → clean (just saved)
        if (wasDirty && !isDirty && !isSaving) {
            clearSuccessTimer()
            setState('success')
            successTimerRef.current = setTimeout(() => {
                setState('hidden')
            }, 2000)
            return
        }

        // If dirty, show save button
        if (isDirty) {
            clearSuccessTimer()
            setState('dirty')
            return
        }

        // If clean and not in success state, hide
        if (!isDirty && state !== 'success') {
            setState('hidden')
        }
    }, [isDirty, isSaving, state, clearSuccessTimer])

    // Handle manual save
    const handleSave = useCallback(async () => {
        if (state !== 'dirty' || isSaving) return
        await manualSave()
    }, [state, isSaving, manualSave])

    // Don't render anything if hidden
    if (state === 'hidden') return null

    const isFloating = variant === 'floating'

    // ===== INLINE (DESKTOP TOOLBAR) =====
    if (!isFloating) {
        // Success state - subtle text only
        if (state === 'success') {
            return (
                <div
                    className={cn(
                        'flex items-center gap-1.5 text-muted-foreground/70 text-xs',
                        'animate-in fade-in duration-200',
                        className
                    )}
                >
                    <Check className="h-3.5 w-3.5 text-green-600" />
                    <span>已保存</span>
                </div>
            )
        }

        // Dirty state - ghost button matching toolbar style
        return (
            <button
                onClick={handleSave}
                disabled={isSaving}
                className={cn(
                    'flex items-center gap-2 h-8 px-2 text-sm',
                    'text-muted-foreground hover:text-foreground',
                    'hover:bg-accent rounded-md transition-colors',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    className
                )}
            >
                <Save className="h-4 w-4" />
                <span className="hidden lg:inline">保存</span>
            </button>
        )
    }

    // ===== FLOATING (MOBILE FAB) =====
    // Position above the existing FAB menu button (which is at bottom-[85px])
    // Match exact styling from MobileControlFab.tsx
    const fabBaseClasses = cn(
        'fixed right-4 h-10 w-10 rounded-full shadow-lg z-40 transition-all duration-300 md:hidden',
        'active:scale-95 flex items-center justify-center'
    )

    // Success state - green checkmark FAB
    if (state === 'success') {
        return (
            <button
                className={cn(
                    fabBaseClasses,
                    'bottom-[140px]', // 55px above menu FAB (40px height + 15px gap)
                    'bg-gradient-to-r from-green-200 to-green-300 text-green-600 border border-green-200',
                    'animate-in fade-in zoom-in-50 duration-200',
                    className
                )}
            >
                <Check className="h-5 w-5" />
            </button>
        )
    }

    // Dirty state - save FAB matching menu FAB style
    return (
        <button
            onClick={handleSave}
            disabled={isSaving}
            className={cn(
                fabBaseClasses,
                'bottom-[140px]', // 55px above menu FAB (40px height + 15px gap)
                'bg-gradient-to-r from-blue-200 to-blue-300 text-blue-600 hover:from-blue-200 hover:to-blue-300 border border-blue-200',
                'disabled:opacity-50',
                'animate-in fade-in zoom-in-50 slide-in-from-bottom-2 duration-200',
                className
            )}
        >
            <Save className="h-5 w-5" />
        </button>
    )
}
