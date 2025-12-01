'use client'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useEffect, useRef, useState } from 'react'
import { getDictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/i18n-config'

interface StreamPanelProps {
  content?: string
  ocrText?: string
  summaryJson?: any
  mode?: 'ocr' | 'summary' | 'match' | 'error'
  timestamp?: Date | null
  isLoading?: boolean
  className?: string
  locale?: Locale
}

export function StreamPanel({
  content,
  ocrText,
  summaryJson,
  mode = 'match',
  timestamp,
  // isLoading,
  className,
  locale,
  displayedMatchContent: externalDisplayedMatchContent,
  dict: externalDict,
  errorMessage,
  onRetry,
}: StreamPanelProps & {
  displayedMatchContent?: string
  dict?: any
  errorMessage?: string
  onRetry?: () => void
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const [localDict, setLocalDict] = useState<any>(null)
  const [internalDisplayedMatchContent, setInternalDisplayedMatchContent] =
    useState('')

  const dict = externalDict || localDict
  // Use external controlled state if provided, otherwise fallback to internal
  const displayedMatchContent =
    externalDisplayedMatchContent !== undefined
      ? externalDisplayedMatchContent
      : internalDisplayedMatchContent

  useEffect(() => {
    // Only use internal typing effect if external state is NOT provided
    if (externalDisplayedMatchContent !== undefined) return
    if (mode !== 'match') return
    const target = content || ''
    let current = internalDisplayedMatchContent

    if (current === target) return

    // If target is shorter (reset), set immediately
    if (target.length < current.length) {
      setInternalDisplayedMatchContent(target)
      return
    }

    // Typewriter effect
    const timer = requestAnimationFrame(() => {
      const diff = target.length - current.length
      const step = Math.max(1, Math.ceil(diff / 20)) // Smaller step for smoother effect
      setInternalDisplayedMatchContent(target.slice(0, current.length + step))
    })

    return () => cancelAnimationFrame(timer)
  }, [
    content,
    mode,
    internalDisplayedMatchContent,
    externalDisplayedMatchContent,
  ])

  // Auto-scroll logic
  const scrollViewportRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    // Locate the viewport by the data attribute added in ScrollArea component
    // The scrollerRef points to the inner content div.
    // Its parent is the viewport (ScrollAreaPrimitive.Viewport) which has data-slot="scroll-area-viewport"
    const viewport = scrollerRef.current?.closest(
      '[data-slot="scroll-area-viewport"]'
    )

    if (viewport) {
      // Force scroll to bottom for match streaming
      if (mode === 'match' && content) {
        requestAnimationFrame(() => {
          viewport.scrollTop = viewport.scrollHeight
        })
      }
    }
  }, [displayedMatchContent, mode, ocrText, summaryJson, content])

  useEffect(() => {
    const loadDict = async () => {
      if (locale) {
        const d = await getDictionary(locale)
        setLocalDict(d)
      }
    }
    loadDict()
  }, [locale])

  const displayContent = (() => {
    if (mode === 'ocr')
      return (
        ocrText ||
        dict?.workbench?.streamPanel?.waitingOcr ||
        'Waiting for OCR...'
      )
    if (mode === 'summary')
      return summaryJson
        ? JSON.stringify(summaryJson, null, 2)
        : dict?.workbench?.streamPanel?.waitingSummary ||
            'Waiting for Job Summary...'

    if (mode === 'error')
      return errorMessage || content || 'Task execution failed'

    // Match mode uses the animated state
    if (!content)
      return (
        dict?.workbench?.streamPanel?.waitingMatch ||
        'Waiting for Match Analysis...'
      )

    return displayedMatchContent
  })()

  return (
    <div
      className={cn(
        'rounded-xl border bg-muted/30 p-4 flex flex-col h-[280px] overflow-hidden',
        className
      )}
      aria-live="polite"
      aria-atomic="false"
    >
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          {mode === 'ocr' && (
            <span className="animate-pulse text-blue-500">●</span>
          )}
          {mode === 'summary' && (
            <span className="animate-pulse text-blue-500">●</span>
          )}
          {mode === 'match' && (
            <span className="animate-pulse text-blue-500">●</span>
          )}
          {mode === 'error' && <span className="text-red-500">●</span>}
          {mode === 'ocr'
            ? dict?.workbench?.streamPanel?.ocr || 'OCR Extraction'
            : mode === 'summary'
            ? dict?.workbench?.streamPanel?.summary || 'Job Summary'
            : mode === 'match'
            ? dict?.workbench?.streamPanel?.match || 'Match Analysis'
            : dict?.workbench?.streamPanel?.error || 'Task Failed'}
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-muted-foreground font-mono">
            {timestamp ? timestamp.toLocaleTimeString() : ''}
          </div>
          {mode === 'error' && onRetry && (
            <button
              onClick={onRetry}
              className="text-xs text-primary hover:underline font-medium"
            >
              {dict?.workbench?.statusText?.retryMatch || 'Retry'}
            </button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 w-full h-full rounded-md border border-dashed bg-background/40 p-3 overflow-y-auto">
        <div
          ref={scrollerRef}
          className="h-full font-mono text-[10px] leading-relaxed whitespace-pre-wrap break-words text-muted-foreground/90"
        >
          {displayContent}
          {/* Blinking cursor effect */}
          <span className="inline-block w-1.5 h-3 ml-0.5 align-middle bg-blue-500 animate-pulse" />
        </div>
      </ScrollArea>
    </div>
  )
}
