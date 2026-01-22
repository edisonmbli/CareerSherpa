/**
 * useTypewriterBuffer Hook
 *
 * A unified typewriter buffer that smoothly paces content output regardless
 * of whether the source is batch or streaming, with configurable speeds
 * and state-aware completion triggers.
 *
 * Features:
 * - Adaptive speed: slower for tasks with follow-ups, faster for final tasks
 * - Auto-flush: instantly complete when next task starts
 * - Buffer-size adaptive: speeds up if buffer gets too large
 */

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface TypewriterBufferOptions {
    /** Raw content from SSE (source of truth) */
    content: string
    /** Whether this is the final task (e.g., job_match has no follow-up) */
    isFinalTask: boolean
    /** Trigger immediate completion (e.g., next task has content or JSON result received) */
    shouldFlush: boolean
    /** Characters to type per frame at base speed (default: 8) */
    baseSpeed?: number
    /** Characters to type per frame at fast speed (default: 40) */
    fastSpeed?: number
    /** Buffer threshold before auto-speeding up (default: 1500) */
    maxBuffer?: number
    /** Enable/disable typewriter effect entirely (default: true) */
    enabled?: boolean
}

interface TypewriterBufferResult {
    /** Content to display in UI */
    displayedContent: string
    /** Whether typing animation is active */
    isTyping: boolean
    /** Percentage of content displayed (0-100) */
    progress: number
}

/**
 * Typewriter buffer hook for smooth content pacing
 */
export function useTypewriterBuffer(options: TypewriterBufferOptions): TypewriterBufferResult {
    const {
        content,
        isFinalTask,
        shouldFlush,
        baseSpeed = 8,
        fastSpeed = 40,
        maxBuffer = 1500,
        enabled = true,
    } = options

    const [displayedContent, setDisplayedContent] = useState('')
    const displayedRef = useRef('')
    const frameIdRef = useRef<number | null>(null)

    // Flush immediately when requested
    useEffect(() => {
        if (shouldFlush && displayedRef.current !== content) {
            displayedRef.current = content
            setDisplayedContent(content)
        }
    }, [shouldFlush, content])

    // Main typing animation loop
    useEffect(() => {
        // Disabled or already complete
        if (!enabled || shouldFlush) {
            return
        }

        const target = content
        const current = displayedRef.current

        // Already caught up
        if (current === target) {
            return
        }

        // If content got shorter (reset scenario), snap to it
        if (target.length < current.length) {
            displayedRef.current = target
            setDisplayedContent(target)
            return
        }

        // Calculate remaining buffer
        const remaining = target.length - current.length

        // Determine speed based on task position and buffer size
        let speed = isFinalTask ? fastSpeed : baseSpeed

        // Adaptive: if buffer is large, speed up
        if (remaining > maxBuffer) {
            speed = Math.min(speed * 2, fastSpeed)
        }

        // Extra boost for very large buffers
        if (remaining > maxBuffer * 2) {
            speed = fastSpeed
        }

        // Animation frame for smooth typing
        const animate = () => {
            const current = displayedRef.current
            const target = content // Use closure to get latest

            if (current.length >= target.length) {
                frameIdRef.current = null
                return
            }

            // Type next chunk
            const nextLength = Math.min(current.length + speed, target.length)
            displayedRef.current = target.slice(0, nextLength)
            setDisplayedContent(displayedRef.current)

            // Continue if more to type
            if (nextLength < target.length) {
                frameIdRef.current = requestAnimationFrame(animate)
            } else {
                frameIdRef.current = null
            }
        }

        // Cancel any existing animation
        if (frameIdRef.current) {
            cancelAnimationFrame(frameIdRef.current)
        }

        // Start new animation after brief delay to batch rapid updates
        const timeoutId = setTimeout(() => {
            frameIdRef.current = requestAnimationFrame(animate)
        }, 16) // ~1 frame delay for batching

        return () => {
            clearTimeout(timeoutId)
            if (frameIdRef.current) {
                cancelAnimationFrame(frameIdRef.current)
                frameIdRef.current = null
            }
        }
    }, [content, isFinalTask, shouldFlush, baseSpeed, fastSpeed, maxBuffer, enabled])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (frameIdRef.current) {
                cancelAnimationFrame(frameIdRef.current)
            }
        }
    }, [])

    // Calculate progress
    const progress = content.length > 0
        ? Math.round((displayedContent.length / content.length) * 100)
        : 0

    const isTyping = enabled && !shouldFlush && displayedContent.length < content.length

    return {
        displayedContent,
        isTyping,
        progress,
    }
}
