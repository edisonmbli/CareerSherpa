/**
 * StatusConsole V2
 *
 * Clean status console component with:
 * - Stage-aware progress display
 * - Smooth progress animation
 * - Tier badge display
 * - SSE connection status indicator
 */

'use client'

import { useEffect, useState } from 'react'
import { Loader2, CheckCircle2, AlertCircle, CircleDot, Zap, Coins } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { WorkbenchStatusV2 } from '@/lib/stores/workbench-v2.store'

interface StatusConsoleV2Props {
    status: WorkbenchStatusV2
    statusMessage: string
    progress: number
    tier?: 'free' | 'paid' | undefined
    cost?: number | undefined
    isConnected?: boolean | undefined
    lastEventAt?: number | null | undefined
    errorMessage?: string | undefined
    className?: string | undefined
}

type ConsoleVisualStatus = 'idle' | 'streaming' | 'completed' | 'error'

function deriveVisualStatus(status: WorkbenchStatusV2): ConsoleVisualStatus {
    if (status === 'IDLE') return 'idle'
    if (status.endsWith('_FAILED')) return 'error'
    if (status.endsWith('_COMPLETED') || status === 'MATCH_COMPLETED') return 'completed'
    return 'streaming'
}

export function StatusConsoleV2({
    status,
    statusMessage,
    progress,
    tier,
    cost = 0,
    isConnected = false,
    lastEventAt,
    errorMessage,
    className,
}: StatusConsoleV2Props) {
    const visualStatus = deriveVisualStatus(status)
    const [displayProgress, setDisplayProgress] = useState(progress)
    const [isBlinking, setIsBlinking] = useState(false)

    // Smooth progress animation
    useEffect(() => {
        if (progress === displayProgress) return

        // Animate to new progress value
        const diff = progress - displayProgress
        const step = diff > 0 ? Math.ceil(diff / 10) : Math.floor(diff / 10)

        const timer = setTimeout(() => {
            setDisplayProgress((prev) => {
                const next = prev + step
                if (diff > 0) return Math.min(next, progress)
                return Math.max(next, progress)
            })
        }, 50)

        return () => clearTimeout(timer)
    }, [progress, displayProgress])

    // SSE activity blink
    useEffect(() => {
        if (!lastEventAt) return
        setIsBlinking(true)
        const timer = setTimeout(() => setIsBlinking(false), 300)
        return () => clearTimeout(timer)
    }, [lastEventAt])

    // Status config
    const statusConfig = {
        idle: { color: 'text-muted-foreground', icon: CircleDot, animate: false },
        streaming: { color: 'text-blue-600 dark:text-blue-400', icon: Loader2, animate: true },
        completed: { color: 'text-green-600 dark:text-green-400', icon: CheckCircle2, animate: false },
        error: { color: 'text-red-600 dark:text-red-400', icon: AlertCircle, animate: false },
    }

    const config = statusConfig[visualStatus]
    const Icon = config.icon

    // Hide progress bar for completed/error/idle
    const showProgress = visualStatus === 'streaming' && displayProgress > 0

    return (
        <div
            className={cn(
                'w-full rounded-xl border bg-card/50 backdrop-blur-sm shadow-sm p-4 space-y-4',
                className
            )}
            role="status"
            aria-live="polite"
        >
            {/* Header Row */}
            <div className="flex items-start justify-between">
                {/* Status Icon + Message */}
                <div className="flex items-center gap-3">
                    <div
                        className={cn(
                            'relative flex items-center justify-center w-8 h-8 rounded-lg bg-background border shadow-sm',
                            config.color
                        )}
                    >
                        <Icon className={cn('w-4 h-4', config.animate && 'animate-spin')} />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold text-foreground">
                            {errorMessage || statusMessage}
                        </span>
                    </div>
                </div>

                {/* Right side badges */}
                <div className="flex items-center gap-2">
                    {/* Tier Badge */}
                    {tier && (
                        <Badge
                            variant="outline"
                            className={cn(
                                'gap-1.5 font-medium border-border/50',
                                tier === 'paid'
                                    ? 'bg-amber-500/10 text-amber-600 border-amber-200'
                                    : 'bg-muted/50 text-muted-foreground'
                            )}
                        >
                            <Zap className="w-3 h-3" />
                            {tier === 'paid' ? 'PAID' : 'FREE'}
                        </Badge>
                    )}

                    {/* Cost Badge */}
                    {cost > 0 && visualStatus !== 'error' && (
                        <Badge variant="secondary" className="gap-1.5 font-mono text-xs">
                            <Coins className="w-3 h-3 text-yellow-500" />
                            <span>-{cost}</span>
                        </Badge>
                    )}

                    {/* SSE Activity Indicator */}
                    {visualStatus === 'streaming' && (
                        <div
                            className={cn(
                                'flex items-center justify-center w-6 h-6 rounded-full transition-all duration-200',
                                isBlinking ? 'bg-blue-500/20' : 'bg-transparent'
                            )}
                        >
                            <div
                                className={cn(
                                    'w-2 h-2 rounded-full transition-all duration-200',
                                    isConnected
                                        ? isBlinking
                                            ? 'bg-blue-500/50 scale-105 shadow-[0_0_6px_rgba(59,130,246,0.4)]'
                                            : 'bg-blue-500/30'
                                        : 'bg-gray-300/30'
                                )}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Progress Bar */}
            {showProgress && (
                <div className="space-y-2">
                    <div className="relative flex items-center gap-3">
                        <Progress value={displayProgress} className="h-2 flex-1 transition-all" />
                        <span className="text-xs font-mono text-muted-foreground w-[4ch] text-right">
                            {Math.round(displayProgress)}%
                        </span>
                    </div>
                </div>
            )}
        </div>
    )
}
