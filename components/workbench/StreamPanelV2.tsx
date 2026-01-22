/**
 * StreamPanel V2
 *
 * Unified streaming content panel with:
 * - Mode-aware content display (vision/match/error)
 * - Preserved content during phase transitions
 * - Smooth typewriter effect for match streaming
 * - JSON pretty-printing for completed results
 */

'use client'

import { useEffect, useRef, useMemo } from 'react'
import { Rocket, AlertCircle, RotateCcw } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { WorkbenchStatusV2 } from '@/lib/stores/workbench-v2.store'
import { useTypewriterBuffer } from '@/lib/hooks/useTypewriterBuffer'

type StreamMode =
  | 'vision'
  | 'ocr'
  | 'summary'
  | 'preMatch'
  | 'match'
  | 'error'
  | 'init'
  | 'waiting'

interface StreamPanelV2Props {
  status: WorkbenchStatusV2
  tier?: 'free' | 'paid'
  // Free tier content
  visionContent?: string | undefined
  visionJson?: Record<string, unknown> | null | undefined
  // Paid tier content
  ocrContent?: string | undefined
  ocrJson?: Record<string, unknown> | null | undefined
  summaryContent?: string | undefined
  summaryJson?: Record<string, unknown> | null | undefined
  preMatchContent?: string | undefined
  preMatchJson?: Record<string, unknown> | null | undefined
  // Both tiers
  matchContent?: string | undefined
  matchJson?: Record<string, unknown> | null | undefined
  errorMessage?: string | undefined
  className?: string | undefined
  /** i18n dictionary for streamPanel strings */
  dict?: {
    vision?: string
    ocr?: string
    summary?: string
    preMatch?: string
    match?: string
    error?: string
    waiting?: string
    waitingVision?: string
    waitingOcr?: string
    waitingSummary?: string
    waitingPreMatch?: string
    waitingDefault?: string
    analyzingMatch?: string
    matchPending?: string
    errorDefault?: string
  }
  onRetry?: () => void
}

/**
 * Derive display mode from status
 * Free tier has two flows based on input type:
 * - Text JD: IDLE → SUMMARY_* → MATCH_*
 * - Image JD: IDLE → JOB_VISION_* → MATCH_*
 * Paid tier: IDLE → OCR_* → SUMMARY_* → PREMATCH_* → MATCH_*
 *
 * IMPORTANT: During MATCH_PENDING, we continue showing previous content (vision/preMatch)
 * with typewriter effect. Only switch to 'match' mode during MATCH_STREAMING when actual
 * match content starts arriving.
 */
function deriveMode(
  status: WorkbenchStatusV2,
  tier: 'free' | 'paid' = 'free',
  contentState?: {
    hasMatchContent: boolean
    hasPreMatchContent: boolean
    hasSummaryContent: boolean
    hasOcrContent: boolean
  },
): StreamMode {
  const {
    hasMatchContent = false,
    hasPreMatchContent = false,
    hasSummaryContent = false,
    hasOcrContent = false,
  } = contentState || {}
  if (status.endsWith('_FAILED')) return 'error'

  // Init state - task not yet started
  if (status === 'IDLE') return 'init'

  // Paid tier - separate modes for each phase
  if (tier === 'paid') {
    if (
      status === 'OCR_PENDING' ||
      status === 'OCR_COMPLETED' ||
      status === 'OCR_STREAMING'
    ) {
      return 'ocr'
    }
    if (
      status === 'SUMMARY_PENDING' ||
      status === 'SUMMARY_COMPLETED' ||
      status === 'SUMMARY_STREAMING'
    ) {
      if (hasSummaryContent) return 'summary'
      if (hasOcrContent) return 'ocr'
      return 'summary'
    }
    if (
      status === 'PREMATCH_PENDING' ||
      status === 'PREMATCH_COMPLETED' ||
      status === 'PREMATCH_STREAMING'
    ) {
      if (hasPreMatchContent) return 'preMatch'
      if (hasSummaryContent) return 'summary'
      return hasOcrContent ? 'ocr' : 'summary'
    }
    if (status === 'MATCH_PENDING' || status === 'MATCH_STREAMING') {
      if (hasMatchContent) return 'match'
      if (hasPreMatchContent) return 'preMatch'
      if (hasSummaryContent) return 'summary'
      return hasOcrContent ? 'ocr' : 'preMatch'
    }
  }

  // Free tier - vision mode for image JD (JOB_VISION_*)
  if (
    status === 'JOB_VISION_PENDING' ||
    status === 'JOB_VISION_STREAMING' ||
    status === 'JOB_VISION_COMPLETED'
  ) {
    return 'vision'
  }

  // Free tier - vision mode for text JD (SUMMARY_* maps to vision for consistent UI)
  if (
    tier === 'free' &&
    (status === 'SUMMARY_PENDING' ||
      status === 'SUMMARY_STREAMING' ||
      status === 'SUMMARY_COMPLETED')
  ) {
    return 'vision'
  }

  // Free tier: During MATCH_PENDING or MATCH_STREAMING, continue showing vision content
  // until actual match content arrives. Status transitions fast but content takes time.
  if (
    tier === 'free' &&
    (status === 'MATCH_PENDING' || status === 'MATCH_STREAMING') &&
    !hasMatchContent
  ) {
    return 'vision'
  }

  // Paid tier: During MATCH_PENDING or MATCH_STREAMING, continue showing preMatch content
  // until actual match content arrives
  if (
    tier === 'paid' &&
    (status === 'MATCH_PENDING' || status === 'MATCH_STREAMING') &&
    !hasMatchContent
  ) {
    return 'preMatch'
  }

  // Both tiers - match mode (when content has arrived)
  if (
    status === 'MATCH_COMPLETED' ||
    ((status === 'MATCH_PENDING' || status === 'MATCH_STREAMING') &&
      hasMatchContent)
  ) {
    return 'match'
  }

  return 'waiting'
}

/**
 * Default mode labels (English fallback - i18n dict provides localized text)
 */
const DEFAULT_MODE_LABELS: Record<StreamMode, string> = {
  vision: 'Job Extraction',
  ocr: 'OCR Extraction',
  summary: 'Job Summary',
  preMatch: 'HR Review',
  match: 'Match Analysis',
  error: 'Task Failed',
  init: 'Initializing',
  waiting: 'Waiting',
}

export function StreamPanelV2({
  status,
  tier = 'free',
  // Free tier
  visionContent = '',
  visionJson,
  // Paid tier
  ocrContent = '',
  ocrJson,
  summaryContent = '',
  summaryJson,
  preMatchContent = '',
  preMatchJson,
  // Both tiers
  matchContent = '',
  matchJson,
  errorMessage,
  dict,
  onRetry,
  className,
}: StreamPanelV2Props) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)

  const hasMatchContent = !!(matchContent || matchJson)
  const hasPreMatchContent = !!(preMatchContent || preMatchJson)
  const hasSummaryContent = !!(summaryContent || summaryJson)
  const hasOcrContent = !!(ocrContent || ocrJson)

  const mode = deriveMode(status, tier, {
    hasMatchContent,
    hasPreMatchContent,
    hasSummaryContent,
    hasOcrContent,
  })

  const modeLabels: Record<StreamMode, string> = useMemo(
    () => ({
      vision: dict?.vision || DEFAULT_MODE_LABELS.vision,
      ocr: dict?.ocr || DEFAULT_MODE_LABELS.ocr,
      summary: dict?.summary || DEFAULT_MODE_LABELS.summary,
      preMatch: dict?.preMatch || DEFAULT_MODE_LABELS.preMatch,
      match: dict?.match || DEFAULT_MODE_LABELS.match,
      error: dict?.error || DEFAULT_MODE_LABELS.error,
      init: DEFAULT_MODE_LABELS.init,
      waiting: dict?.waiting || DEFAULT_MODE_LABELS.waiting,
    }),
    [dict],
  )

  // Pre-format vision content for natural line-by-line typewriter output
  // This adds proper line breaks to JSON so typewriter can output line-by-line with scroll
  const formattedVisionContent = useMemo(() => {
    if (!visionContent) return ''
    try {
      // Remove markdown code block wrapper if present
      const cleaned = visionContent.replace(/```json\n?|\n?```/g, '').trim()
      if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
        // Parse and re-stringify with pretty formatting
        const parsed = JSON.parse(cleaned)
        return JSON.stringify(parsed, null, 2)
      }
    } catch {
      // If parsing fails, return original content
    }
    return visionContent
  }, [visionContent])

  // Typewriter buffer for vision content (Free tier)
  // Vision is NOT final - match task follows
  // Flush only when matchJson arrives (actual match result), not when switching to match mode
  // This allows vision content to continue typing during match queue/processing wait
  const isVisionFinal = false
  const matchStreamStarted = status === 'MATCH_STREAMING' && !!matchContent
  const matchHasFinal = !!matchJson
  const visionFlush = matchHasFinal || matchStreamStarted
  const { displayedContent: displayedVisionContent, isTyping: isVisionTyping } =
    useTypewriterBuffer({
      content: formattedVisionContent, // Use pre-formatted content with line breaks
      isFinalTask: isVisionFinal,
      shouldFlush: visionFlush,
      baseSpeed: 1, // Slower for smooth typewriter effect
    })

  // Pre-format Paid tier content for natural line-by-line typewriter output
  const formattedOcrContent = useMemo(() => {
    if (!ocrContent) return ''
    try {
      const cleaned = ocrContent.replace(/```json\n?|\n?```/g, '').trim()
      if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
        return JSON.stringify(JSON.parse(cleaned), null, 2)
      }
    } catch {
      /* keep original */
    }
    return ocrContent
  }, [ocrContent])

  const formattedSummaryContent = useMemo(() => {
    if (!summaryContent) return ''
    try {
      const cleaned = summaryContent.replace(/```json\n?|\n?```/g, '').trim()
      if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
        return JSON.stringify(JSON.parse(cleaned), null, 2)
      }
    } catch {
      /* keep original */
    }
    return summaryContent
  }, [summaryContent])

  const formattedPreMatchContent = useMemo(() => {
    if (!preMatchContent) return ''
    try {
      const cleaned = preMatchContent.replace(/```json\n?|\n?```/g, '').trim()
      if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
        return JSON.stringify(JSON.parse(cleaned), null, 2)
      }
    } catch {
      /* keep original */
    }
    return preMatchContent
  }, [preMatchContent])

  // Typewriter buffer for OCR content (Paid tier)
  // OCR is NOT final - Summary task follows
  // Flush when summaryJson arrives
  const ocrFlush = !!(summaryJson || summaryContent)
  const { displayedContent: displayedOcrContent, isTyping: isOcrTyping } =
    useTypewriterBuffer({
      content: formattedOcrContent,
      isFinalTask: false,
      shouldFlush: ocrFlush,
      baseSpeed: 1,
    })

  // Typewriter buffer for Summary content (Paid tier)
  // Summary is NOT final - PreMatch task follows
  // Flush when preMatchJson arrives
  const summaryFlush = !!(preMatchJson || preMatchContent)
  const {
    displayedContent: displayedSummaryContent,
    isTyping: isSummaryTyping,
  } = useTypewriterBuffer({
    content: formattedSummaryContent,
    isFinalTask: false,
    shouldFlush: summaryFlush,
    baseSpeed: 1,
  })

  // Typewriter buffer for PreMatch content (Paid tier)
  // PreMatch is NOT final - Match task follows
  // Flush when matchJson arrives
  const preMatchFlush = matchHasFinal || matchStreamStarted
  const {
    displayedContent: displayedPreMatchContent,
    isTyping: isPreMatchTyping,
  } = useTypewriterBuffer({
    content: formattedPreMatchContent,
    isFinalTask: false,
    shouldFlush: preMatchFlush,
    baseSpeed: 1,
  })

  // Typewriter buffer for match content (Both tiers)
  // Match is ALWAYS final - no flush, high speed
  const isMatchFinal = true
  const matchFlush = false // Never flush, high-speed to completion

  // Pre-format match content for natural line-by-line typewriter output
  // This adds proper line breaks to JSON so typewriter can output line-by-line with scroll
  const formattedMatchContent = useMemo(() => {
    if (!matchContent) return ''
    try {
      // Remove markdown code block wrapper if present
      const cleaned = matchContent.replace(/```json\n?|\n?```/g, '').trim()
      if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
        // Parse and re-stringify with pretty formatting
        const parsed = JSON.parse(cleaned)
        return JSON.stringify(parsed, null, 2)
      }
    } catch {
      // If parsing fails, return original content
    }
    return matchContent
  }, [matchContent])

  const { displayedContent: displayedMatchContent, isTyping: isMatchTyping } =
    useTypewriterBuffer({
      content: formattedMatchContent, // Use pre-formatted content with line breaks
      isFinalTask: isMatchFinal,
      shouldFlush: matchFlush,
      fastSpeed: 2, // Moderate speed for readable output (was 50)
    })

  // Auto-scroll to bottom
  useEffect(() => {
    const viewport = scrollerRef.current?.closest(
      '[data-slot="scroll-area-viewport"]',
    )
    if (viewport) {
      requestAnimationFrame(() => {
        viewport.scrollTop = viewport.scrollHeight
      })
    }
  }, [
    status,
    displayedMatchContent,
    displayedVisionContent,
    displayedOcrContent,
    displayedSummaryContent,
    displayedPreMatchContent,
    visionJson,
    ocrJson,
    summaryJson,
    preMatchJson,
    matchJson,
  ])

  // Display content logic
  const displayContent = useMemo(() => {
    switch (mode) {
      case 'error':
        return errorMessage || dict?.errorDefault || '任务执行失败，请重试'

      case 'vision':
        if (tier === 'free') {
          if (matchHasFinal || matchStreamStarted) {
            if (visionJson) {
              return JSON.stringify(visionJson, null, 2)
            }
            if (summaryJson) {
              return JSON.stringify(summaryJson, null, 2)
            }
          }
          if (displayedSummaryContent) {
            return displayedSummaryContent
          }
        }
        if (displayedVisionContent) {
          return displayedVisionContent
        }
        return dict?.waitingVision || '正在提取岗位信息...'

      case 'ocr':
        // Paid tier OCR: Prioritize typewriter if active, then JSON
        if (isOcrTyping) {
          return displayedOcrContent
        }
        if (ocrJson) {
          return JSON.stringify(ocrJson, null, 2)
        }
        if (displayedOcrContent) {
          return displayedOcrContent
        }
        return dict?.waitingOcr || '正在提取截图文字...'

      case 'summary':
        // Paid tier Summary: Prioritize typewriter if active, then JSON
        if (isSummaryTyping) {
          return displayedSummaryContent
        }
        if (summaryJson) {
          return JSON.stringify(summaryJson, null, 2)
        }
        if (displayedSummaryContent) {
          return displayedSummaryContent
        }
        return dict?.waitingSummary || '正在提取岗位信息...'

      case 'preMatch':
        // Paid tier PreMatch: Prioritize typewriter if active, then JSON
        if (isPreMatchTyping) {
          return displayedPreMatchContent
        }
        if (preMatchJson) {
          return JSON.stringify(preMatchJson, null, 2)
        }
        if (displayedPreMatchContent) {
          return displayedPreMatchContent
        }
        return dict?.waitingPreMatch || '正在进行HR点评...'

      case 'match':
        // Both tiers: Show JSON if completed (flush), otherwise typewriter streaming content
        if (matchJson) {
          return JSON.stringify(matchJson, null, 2)
        }
        if (displayedMatchContent) {
          return displayedMatchContent
        }
        if (status === 'MATCH_PENDING') {
          return dict?.matchPending || '匹配度分析任务已在排队，请稍候...'
        }
        return dict?.analyzingMatch || '正在分析匹配度...'

      case 'init':
        return dict?.waitingDefault || 'Initializing...'

      case 'waiting':
      default:
        return dict?.waitingDefault || '等待任务开始...'
    }
  }, [
    mode,
    status,
    tier,
    displayedVisionContent,
    visionJson,
    displayedOcrContent,
    ocrJson,
    isOcrTyping,
    displayedSummaryContent,
    summaryJson,
    isSummaryTyping,
    displayedPreMatchContent,
    preMatchJson,
    isPreMatchTyping,
    displayedMatchContent,
    matchJson,
    matchHasFinal,
    matchStreamStarted,
    errorMessage,
    dict,
  ])

  // Show cursor only during streaming
  const showCursor = mode === 'match' && isMatchTyping && !matchJson

  return (
    <div
      className={cn(
        'rounded-xl border bg-muted/30 p-4 flex flex-col h-[280px] overflow-hidden',
        className,
      )}
      aria-live="polite"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          {mode === 'error' ? (
            <AlertCircle className="w-3.5 h-3.5 text-red-500" />
          ) : (
            <Rocket className="w-3.5 h-3.5 text-muted-foreground/70" />
          )}
          {modeLabels[mode]}
        </div>
        {mode === 'error' && onRetry && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={onRetry}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="sr-only">Retry</span>
          </Button>
        )}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 w-full h-full rounded-md border border-dashed bg-background/40 p-3 overflow-y-auto">
        <div
          ref={scrollerRef}
          className="h-full font-mono text-[10px] leading-relaxed whitespace-pre-wrap break-words text-muted-foreground/90"
        >
          {displayContent}
          {showCursor && (
            <span className="inline-block w-1.5 h-3 ml-0.5 align-middle bg-blue-500 animate-pulse" />
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
