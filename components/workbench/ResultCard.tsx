'use client'
import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle2,
  Target,
  Copy,
  Check,
  Quote,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface ResultCardProps {
  data: any
  company?: string
  jobTitle?: string
  labels?: {
    title?: string
    copy?: string
    overallAssessment?: string
    highlights?: string
    gapsAndSuggestions?: string
    smartPitch?: string
    copyTooltip?: string
    loading?: string
    empty?: string
    matchScore?: string
    copied?: string
    copySuccess?: string
    highlyMatched?: string
    goodFit?: string
    lowMatch?: string
    targetCompany?: string
    targetPosition?: string
    noHighlights?: string
    noGaps?: string
    tip?: string
  }
  className?: string
}

export function ResultCard({
  data,
  company,
  jobTitle,
  labels,
  className,
}: ResultCardProps) {
  const score =
    typeof data?.score !== 'undefined'
      ? Number(data?.score)
      : typeof data?.match_score !== 'undefined'
      ? Number(data?.match_score)
      : 0

  const assessment =
    data?.overall_assessment ||
    (score >= 80
      ? labels?.highlyMatched || 'Highly Matched'
      : score >= 60
      ? labels?.goodFit || 'Good Fit'
      : labels?.lowMatch || 'Low Match')

  // Parse strengths with evidence
  const strengths = (
    Array.isArray(data?.highlights)
      ? data.highlights.map((s: any) => ({ point: String(s), evidence: '' }))
      : Array.isArray(data?.strengths)
      ? data.strengths.map((s: any) => ({
          point: String(s?.point ?? s),
          evidence: s?.evidence ? String(s.evidence) : '',
          section: s?.section,
        }))
      : []
  ).slice(0, 6)

  // Parse weaknesses with suggestions
  const weaknesses = (
    Array.isArray(data?.gaps)
      ? data.gaps.map((s: any) => ({ point: String(s), suggestion: '' }))
      : Array.isArray(data?.weaknesses)
      ? data.weaknesses.map((w: any) => ({
          point: String(w?.point ?? w),
          suggestion: w?.suggestion ? String(w.suggestion) : '',
        }))
      : []
  ).slice(0, 6)

  const dmScript =
    typeof data?.dm_script === 'string'
      ? data.dm_script
      : typeof data?.cover_letter_script === 'string'
      ? data.cover_letter_script
      : null

  const markdown = typeof data?.markdown === 'string' ? data.markdown : null

  // Smart Pitch Highlighting
  const renderPitch = (text: string) => {
    // Regex to match tags like 【H】, [H], 【V】, [V], 【C】, [C]
    const parts = text.split(/([【\[][HVC][】\]])/g)
    return (
      <div className="font-mono text-sm leading-relaxed whitespace-pre-wrap">
        {parts.map((part, i) => {
          if (part.match(/^[【\[]H[】\]]$/)) {
            return (
              <span
                key={i}
                className="text-blue-600 dark:text-blue-400 font-bold mx-0.5"
              >
                {part}
              </span>
            )
          }
          if (part.match(/^[【\[]V[】\]]$/)) {
            return (
              <span
                key={i}
                className="text-emerald-600 dark:text-emerald-400 font-bold mx-0.5"
              >
                {part}
              </span>
            )
          }
          if (part.match(/^[【\[]C[】\]]$/)) {
            return (
              <span
                key={i}
                className="text-amber-600 dark:text-amber-400 font-bold mx-0.5"
              >
                {part}
              </span>
            )
          }
          return (
            <span key={i} className="text-muted-foreground/90">
              {part}
            </span>
          )
        })}
      </div>
    )
  }

  const [isCopied, setIsCopied] = useState(false)

  const handleCopy = () => {
    if (!dmScript) return
    // Remove tags for clipboard
    const clean = dmScript.replace(/[【\[][HVC][】\]]/g, '')
    navigator.clipboard.writeText(clean)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  // Score Color Logic
  const scoreColor =
    score >= 80
      ? 'text-emerald-500'
      : score >= 60
      ? 'text-amber-500'
      : 'text-red-500'

  const scrollRef = useRef<HTMLDivElement>(null)
  const [showScrollHint, setShowScrollHint] = useState(false)
  const hasScrolledRef = useRef(false)

  useEffect(() => {
    const checkScroll = () => {
      if (scrollRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current

        if (scrollTop > 20) {
          hasScrolledRef.current = true
        }

        const isScrollable = scrollHeight > clientHeight
        // Only show if scrollable and user hasn't scrolled significantly yet
        setShowScrollHint(isScrollable && !hasScrolledRef.current)
      }
    }

    checkScroll()
    window.addEventListener('resize', checkScroll)

    const el = scrollRef.current
    if (el) {
      el.addEventListener('scroll', checkScroll)
    }

    return () => {
      window.removeEventListener('resize', checkScroll)
      if (el) el.removeEventListener('scroll', checkScroll)
    }
  }, [data, strengths, weaknesses, dmScript, markdown])

  return (
    <div
      className={cn(
        'flex flex-col bg-card border rounded-xl shadow-sm md:flex-1 md:overflow-hidden h-auto relative',
        className
      )}
    >
      {/* Header Section - No border */}
      <div className="flex items-center justify-between p-6 shrink-0">
        {/* Left: Company & Job */}
        <div className="flex flex-col gap-1 min-w-0 flex-1 mr-4">
          <div className="text-lg font-semibold truncate text-foreground">
            {company || labels?.targetCompany || 'Target Company'}
          </div>
          <div className="text-sm text-muted-foreground truncate">
            {jobTitle || labels?.targetPosition || 'Target Position'}
          </div>
        </div>

        {/* Right: Score & Assessment */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex flex-col items-end md:items-start gap-1">
            <div className="hidden md:block text-sm font-bold text-muted-foreground uppercase tracking-wider font-mono">
              {labels?.overallAssessment || 'Overall Assessment'}
            </div>
            <Badge
              variant={score >= 80 ? 'default' : 'secondary'}
              className={cn(
                'text-base px-3 py-1',
                score >= 80
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/25 border-emerald-500/20'
                  : ''
              )}
            >
              {assessment}
            </Badge>
          </div>

          <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
            <svg
              className="w-full h-full transform -rotate-90"
              viewBox="0 0 36 36"
            >
              <path
                className="text-muted/20"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
              />
              <path
                className={scoreColor}
                strokeDasharray={`${score}, 100`}
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={cn('text-lg font-bold', scoreColor)}>
                {score}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div
        ref={scrollRef}
        className="flex-1 md:overflow-y-auto overflow-visible px-6 pb-20 md:pb-6 space-y-8 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent relative"
      >
        {/* Block A: Strengths (Highlights) */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            {labels?.highlights || 'Highlights'}
          </div>
          <div className="space-y-4">
            {strengths.map((item: any, i: number) => (
              <div
                key={i}
                className="group relative pl-4 border-l-2 border-emerald-500/20 hover:border-emerald-500/50 transition-colors"
              >
                <div className="font-medium text-sm text-foreground">
                  {item.point}
                </div>
                {item.evidence && (
                  <div className="mt-1.5 text-xs text-muted-foreground">
                    {item.evidence}
                  </div>
                )}
              </div>
            ))}
            {strengths.length === 0 && (
              <div className="text-sm text-muted-foreground italic pl-2">
                {labels?.noHighlights || 'No highlights found.'}
              </div>
            )}
          </div>
        </div>

        {/* Block B: Weaknesses (Gaps) - Vertical Stack below Highlights */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
            <Target className="w-4 h-4 text-amber-500" />
            {labels?.gapsAndSuggestions || 'Gaps & Suggestions'}
          </div>
          <div className="space-y-4">
            {weaknesses.map((item: any, i: number) => (
              <div
                key={i}
                className="group relative pl-4 border-l-2 border-amber-500/20 hover:border-amber-500/50 transition-colors"
              >
                <div className="font-medium text-sm text-foreground">
                  {item.point}
                </div>
                {item.suggestion && (
                  <div className="mt-2 flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 p-2 rounded-md">
                    <span className="text-amber-500 font-bold text-[10px] border border-amber-500/30 px-1 rounded uppercase shrink-0 mt-0.5">
                      {labels?.tip || 'Tip'}
                    </span>
                    {item.suggestion}
                  </div>
                )}
              </div>
            ))}
            {weaknesses.length === 0 && (
              <div className="text-sm text-muted-foreground italic pl-2">
                {labels?.noGaps || 'No gaps detected.'}
              </div>
            )}
          </div>
        </div>

        {/* Smart Pitch Section */}
        {dmScript && (
          <div className="space-y-3 pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
                <Quote className="w-4 h-4 text-blue-500" />
                {labels?.smartPitch || 'Smart Pitch'}
              </div>

              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1.5"
                      onClick={handleCopy}
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          {labels?.copied || 'Copied'}
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          {labels?.copy || 'Copy'}
                        </>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="left"
                    sideOffset={10}
                    className="hidden md:block bg-transparent border-0 shadow-none p-0"
                  >
                    <p className="text-xs text-muted-foreground font-normal whitespace-nowrap">
                      {labels?.copyTooltip || 'Hook, Value, Call to Action'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="relative rounded-xl border bg-muted/30 p-5 font-mono text-sm">
              <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/50 rounded-l-xl" />
              {renderPitch(dmScript)}
            </div>

            {/* Mobile Fallback Hint */}
            <div className="md:hidden text-[10px] text-muted-foreground/70 px-1">
              * {labels?.copyTooltip || 'Hook, Value, Call to Action'}
            </div>
          </div>
        )}

        {/* Fallback Markdown */}
        {!strengths.length && !weaknesses.length && !dmScript && markdown && (
          <div className="prose prose-sm max-w-none whitespace-pre-wrap dark:prose-invert">
            {markdown}
          </div>
        )}
      </div>

      {/* Scroll Hint */}
      {showScrollHint && (
        <>
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none hidden md:block z-10" />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none hidden md:block">
            <div className="animate-bounce p-2 bg-background/80 backdrop-blur-sm rounded-full shadow-sm border border-border/50">
              <ChevronDown className="w-4 h-4 text-primary" />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
