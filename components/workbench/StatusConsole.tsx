'use client'
import {
  Loader2,
  Coins,
  AlertCircle,
  CheckCircle2,
  Zap,
  CircleDot,
  Activity,
} from 'lucide-react'
import type { Locale } from '@/i18n-config'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { useState, useEffect } from 'react'

export type ConsoleStatus = 'idle' | 'streaming' | 'completed' | 'error'

interface StatusConsoleProps {
  status: ConsoleStatus
  progress: number
  statusMessage: string
  cost?: number
  tier?: 'free' | 'paid'
  errorMessage?: string | undefined
  lastUpdated?: Date | null
  isConnected?: boolean
  locale?: Locale
  className?: string
  ocrResult?: string | null
  summaryResult?: any
  matchResult?: any
  streamingResponse?: string
  onRetry?: () => void
}

export function StatusConsole({
  status,
  progress,
  statusMessage,
  cost = 0,
  tier,
  errorMessage,
  lastUpdated,
  isConnected,
  locale,
  className,
}: StatusConsoleProps) {
  const [dict, setDict] = useState<any>(null)
  const [isBlinking, setIsBlinking] = useState(false)

  useEffect(() => {
    const loadDict = async () => {
      if (locale) {
        const d = await getDictionary(locale)
        setDict(d)
      }
    }
    loadDict()
  }, [locale])

  // Trigger blink effect when lastUpdated changes (indicating new SSE activity)
  useEffect(() => {
    if (lastUpdated) {
      setIsBlinking(true)
      const timer = setTimeout(() => setIsBlinking(false), 300) // Short blink
      return () => clearTimeout(timer)
    }
  }, [lastUpdated])

  const statusConfig = {
    idle: { color: 'text-muted-foreground', icon: CircleDot, pulse: false },
    streaming: {
      color: 'text-blue-600 dark:text-blue-400',
      icon: Loader2,
      pulse: true,
    },
    completed: {
      color: 'text-green-600 dark:text-green-400',
      icon: CheckCircle2,
      pulse: false,
    },
    error: {
      color: 'text-red-600 dark:text-red-400',
      icon: AlertCircle,
      pulse: false,
    },
  } as const
  const currentConfig = statusConfig[status]
  const Icon = currentConfig.icon

  function formatRelative(d?: Date | null): string {
    if (!d) return ''
    const ms = Date.now() - new Date(d).getTime()
    const sec = Math.floor(ms / 1000)
    if (sec < 60)
      return `${sec}${dict?.workbench?.statusConsole?.seconds || 's ago'}`
    const min = Math.floor(sec / 60)
    if (min < 60)
      return `${min}${dict?.workbench?.statusConsole?.minutes || 'm ago'}`
    return new Date(d).toLocaleString()
  }

  const progressValue = (() => {
    // Prevent progress from jumping back to 0 when transitioning from stream to complete
    if (status === 'COMPLETED') return 100
    if (status === 'MATCH_STREAMING' || status === 'MATCH_PENDING') return 80
    if (status === 'SUMMARY_PENDING') return 66
    if (status === 'OCR_PENDING') return 33
    // Return a non-zero fallback for other active states to reduce flicker
    if (status === 'SUMMARY_COMPLETED') return 66
    if (status === 'OCR_COMPLETED') return 33
    return 0
  })()

  return (
    <div
      className={cn(
        'w-full rounded-xl border bg-card/50 backdrop-blur-sm shadow-sm p-4 space-y-4',
        className
      )}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'relative flex items-center justify-center w-8 h-8 rounded-lg bg-background border shadow-sm',
              currentConfig.color
            )}
          >
            <Icon
              className={cn(
                'w-4 h-4',
                status === 'streaming' && 'animate-spin'
              )}
            />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground">
              {status === 'error' ? statusMessage : statusMessage}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
              {tier === 'paid'
                ? dict?.workbench?.statusConsole?.paid || 'PAID'
                : dict?.workbench?.statusConsole?.free || 'FREE'}
            </Badge>
          )}
          {cost > 0 && (
            <Badge variant="secondary" className="gap-1.5 font-mono text-xs">
              <Coins className="w-3 h-3 text-yellow-500" />
              <span>-{cost}</span>
            </Badge>
          )}

          {/* SSE Activity Indicator */}
          {status !== 'completed' && status !== 'error' && (
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
      {status !== 'error' && status !== 'completed' && (
        <div className="space-y-2">
          <div className="relative flex items-center gap-3">
            <Progress
              value={progress > 0 ? progress : progressValue}
              className="h-2 flex-1 transition-all"
            />
            <span className="text-xs font-mono text-muted-foreground w-[4ch] text-right">
              {Math.max(
                0,
                Math.min(
                  100,
                  Math.round(progress > 0 ? progress : progressValue)
                )
              )}
              %
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
