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
  LampDesk,
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
    expertVerdict?: string
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

  // New Logic: assessment label is strictly based on score or fallback labels
  const assessmentLabel =
    score >= 80
      ? labels?.highlyMatched || 'High Match'
      : score >= 60
      ? labels?.goodFit || 'Medium Match'
      : labels?.lowMatch || 'Challenging'

  // Expert verdict is the long sentence
  const expertVerdict = data?.overall_assessment

  // Parse strengths with evidence
  const strengths = (
    Array.isArray(data?.highlights)
      ? data.highlights.map((s: any) => ({ point: String(s), evidence: '' }))
      : Array.isArray(data?.strengths)
      ? data.strengths.map((s: any) => {
          if (typeof s === 'string') return { point: s, evidence: '' }
          // Fix: Handle both PascalCase (LLM sometimes returns this) and camelCase
          const point = s?.Point ?? s?.point ?? ''
          const evidence = s?.Evidence ?? s?.evidence ?? ''
          const section = s?.Section ?? s?.section

          return {
            point: String(point),
            evidence: evidence ? String(evidence) : '',
            section,
          }
        })
      : []
  ).slice(0, 6)

  // Parse weaknesses with evidence (previously suggestion)
  const weaknesses = (
    Array.isArray(data?.gaps)
      ? data.gaps.map((s: any) => ({ point: String(s), evidence: '' }))
      : Array.isArray(data?.weaknesses)
      ? data.weaknesses.map((w: any) => {
          if (typeof w === 'string') return { point: w, evidence: '', tip: '' }
          // Fix: Handle PascalCase/camelCase
          const point = w?.Point ?? w?.point ?? ''
          const evidence = w?.Evidence ?? w?.evidence ?? w?.suggestion ?? ''
          const tip = w?.Tip ?? w?.tip ?? ''

          return {
            point: String(point),
            evidence: evidence ? String(evidence) : '',
            tip: tip ? String(tip) : '',
          }
        })
      : []
  ).slice(0, 6)

  const recommendations = Array.isArray(data?.recommendations)
    ? data.recommendations
    : []

  const dmScript =
    typeof data?.dm_script === 'string'
      ? data.dm_script
      : typeof data?.cover_letter_script === 'string'
      ? data.cover_letter_script
      : typeof data?.cover_letter_script === 'object' &&
        data?.cover_letter_script !== null
      ? // Fix: Check for nested .script property (used in some LLM responses)
        typeof data.cover_letter_script.script === 'string'
        ? data.cover_letter_script.script
        : typeof data.cover_letter_script.h === 'string'
        ? `【H】${data.cover_letter_script.h || ''}\n\n【V】${
            data.cover_letter_script.v || ''
          }\n\n【C】${data.cover_letter_script.c || ''}`
        : // Handle new schema with full names
        typeof data.cover_letter_script.hook === 'string'
        ? `【H】${data.cover_letter_script.hook || ''}\n\n【V】${
            data.cover_letter_script.value || ''
          }\n\n【C】${data.cover_letter_script.call_to_action || ''}`
        : null
      : null

  const markdown = typeof data?.markdown === 'string' ? data.markdown : null

  // Smart Pitch Highlighting
  const renderPitch = (text: string) => {
    // Debug: Log raw text to see newline chars
    if (process.env.NODE_ENV !== 'production' && false) {
      console.log('[ResultCard] Raw Smart Pitch:', JSON.stringify(text))
    }

    // Clean up extra newlines: Remove all newlines to prevent forced line breaks
    // Replace newlines and multiple spaces with a single space
    const cleanText = text
      .replace(/\\n/g, ' ')
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    // Regex to match tags like 【H】, [H], 【V】, [V], 【C】, [C]
    const parts = cleanText.split(/([【\[][HVC][】\]])/g)
    return (
      <div className="font-mono text-sm leading-relaxed whitespace-pre-wrap">
        {parts.map((part, i) => {
          if (part.match(/^[【\[]H[】\]]$/)) {
            return (
              <span
                key={i}
                className="text-blue-600/50 dark:text-blue-400/50 font-bold mx-0.5"
              >
                {part}
              </span>
            )
          }
          if (part.match(/^[【\[]V[】\]]$/)) {
            return (
              <span
                key={i}
                className="text-blue-600/50 dark:text-blue-400/50 font-bold mx-0.5"
              >
                {part}
              </span>
            )
          }
          if (part.match(/^[【\[]C[】\]]$/)) {
            return (
              <span
                key={i}
                className="text-blue-600/50 dark:text-blue-400/50 font-bold mx-0.5"
              >
                {part}
              </span>
            )
          }
          // Fix: Ensure regular text is rendered if it's not empty
          if (!part) return null
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
    // Remove tags AND newlines for clipboard to ensure single paragraph
    const clean = dmScript
      .replace(/\\n/g, ' ')
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/[【\[][HVC][】\]]/g, '')
      .trim()
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
          <div className="flex flex-col items-center justify-center gap-0.5 min-h-[3.5rem]">
            {/* Redesigned Header: Vertical Center Alignment */}
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] px-1.5 py-0.5 font-semibold border-0 uppercase tracking-wider',
                score >= 80
                  ? 'text-emerald-600/90 bg-emerald-50/80 dark:text-emerald-400 dark:bg-emerald-900/20'
                  : score >= 60
                  ? 'text-amber-600/90 bg-amber-50/80 dark:text-amber-400 dark:bg-amber-900/20'
                  : 'text-red-600/90 bg-red-50/80 dark:text-red-400 dark:bg-red-900/20'
              )}
            >
              {assessmentLabel}
            </Badge>
            <div
              className={cn(
                'text-3xl font-bold tracking-tight leading-none',
                scoreColor
              )}
            >
              {score}
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div
        ref={scrollRef}
        className="flex-1 md:overflow-y-auto overflow-visible px-6 pb-20 md:pb-6 space-y-8 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent relative"
      >
        {/* Expert Verdict Section - Enhanced UI */}
        {expertVerdict && (
          <div className="relative overflow-hidden bg-gradient-to-br from-muted/40 to-muted/10 rounded-xl p-5 border border-border/50 shadow-sm">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-primary/60 to-primary/20" />

            {/* LampDesk Icon with lighting effect */}
            <div className="absolute top-4 right-4 opacity-40 pointer-events-none select-none">
              {/* Light cone effect - gradient simulating light beam */}
              <div className="absolute top-[75px] right-[5px] w-32 h-64 bg-gradient-to-br from-yellow-500/30 via-yellow-500/15 to-transparent rounded-full blur-xl rotate-45 transform-gpu origin-top-right" />

              {/* The Lamp Icon - Flipped horizontally to face left */}
              <LampDesk className="w-12 h-12 text-primary/20 -scale-x-100" />
            </div>

            <div className="relative z-10 flex gap-3">
              <Quote className="w-5 h-5 text-primary/70 shrink-0 mt-0.5 fill-primary/5" />
              <div className="space-y-1.5">
                <div className="text-xs font-semibold uppercase tracking-wider text-primary/80">
                  {labels?.expertVerdict || 'Expert Verdict'}
                </div>
                <div className="text-sm leading-relaxed text-foreground/90 font-medium font-serif italic">
                  "{expertVerdict}"
                </div>
              </div>
            </div>
          </div>
        )}

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

        {/* Block B: Weaknesses (Gaps) - Enhanced Vertical Layout */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
            <Target className="w-4 h-4 text-amber-500" />
            {labels?.gapsAndSuggestions || 'Risks & Challenges'}
          </div>
          <div className="space-y-6">
            {weaknesses.map((item: any, i: number) => (
              <div
                key={i}
                className="group relative pl-4 border-l-2 border-amber-500/20 hover:border-amber-500/50 transition-colors"
              >
                <div className="font-medium text-sm text-foreground mb-3">
                  {item.point}
                </div>

                {/* Vertical Layout always, but rows inside for Desktop */}
                <div className="space-y-3">
                  {/* Evidence Block */}
                  {item.evidence && (
                    <div className="flex flex-col md:flex-row md:items-start md:gap-3 gap-1">
                      <div className="shrink-0 flex items-center gap-1.5 md:mt-0.5 min-w-[4.5rem]">
                        <div className="w-1 h-1 rounded-full bg-amber-500/50" />
                        <span className="text-[10px] font-bold uppercase text-amber-600/80 tracking-wider">
                          Evidence
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground leading-relaxed">
                        {item.evidence}
                      </div>
                    </div>
                  )}

                  {/* Tip Block */}
                  {item.tip && (
                    <div className="flex flex-col md:flex-row md:items-start md:gap-3 gap-1">
                      <div className="shrink-0 flex items-center gap-1.5 md:mt-0.5 min-w-[4.5rem]">
                        <div className="w-1 h-1 rounded-full bg-emerald-500/50" />
                        <span className="text-[10px] font-bold uppercase text-emerald-600/80 tracking-wider">
                          Pro Tip
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground leading-relaxed">
                        {item.tip}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {weaknesses.length === 0 && (
              <div className="text-sm text-muted-foreground italic pl-2">
                {labels?.noGaps || 'No gaps detected.'}
              </div>
            )}
          </div>
        </div>

        {/* Block C: Recommendations (New) */}
        {recommendations.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
              <Target className="w-4 h-4 text-blue-500" />
              Recommendations
            </div>
            <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
              {recommendations.map((rec: string, i: number) => (
                <li key={i}>{rec}</li>
              ))}
            </ul>
          </div>
        )}

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
