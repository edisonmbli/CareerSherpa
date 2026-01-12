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
    scrollHint?: string
    recommendations?: string
  }
  className?: string
  actionButton?: React.ReactNode
}

export function ResultCard({
  data,
  company,
  jobTitle,
  labels,
  className,
  actionButton,
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
          const tip = w?.Tip ?? w?.tip ?? null

          // Handle both string (legacy) and object (new) tip formats
          const tipObj = typeof tip === 'object' && tip !== null
            ? { interview: tip.interview ?? '', resume: tip.resume ?? '' }
            : typeof tip === 'string'
              ? { interview: tip, resume: '' }
              : { interview: '', resume: '' }

          return {
            point: String(point),
            evidence: evidence ? String(evidence) : '',
            tip: tipObj,
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
            : typeof data.cover_letter_script.H === 'string' // New standard (H/V/C)
              ? `【H】${data.cover_letter_script.H || ''}\n\n【V】${data.cover_letter_script.V || ''
              }\n\n【C】${data.cover_letter_script.C || ''}`
              : typeof data.cover_letter_script.h === 'string' // Legacy lowercase
                ? `【H】${data.cover_letter_script.h || ''}\n\n【V】${data.cover_letter_script.v || ''
                }\n\n【C】${data.cover_letter_script.c || ''}`
                : // Legacy long names
                typeof data.cover_letter_script.hook === 'string'
                  ? `【H】${data.cover_letter_script.hook || ''}\n\n【V】${data.cover_letter_script.value || ''
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

    // Unified typography with Expert Verdict: Playfair Display
    return (
      <div className="text-sm leading-loose whitespace-pre-wrap font-normal text-foreground/80 tracking-wide font-[family-name:var(--font-playfair),serif]">
        {parts.map((part, i) => {
          if (part.match(/^[【\[]H[】\]]$/)) {
            return (
              <span
                key={i}
                className="text-blue-600 dark:text-blue-400 font-bold mx-1 text-[10px] uppercase tracking-wider bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-sm select-none font-sans"
              >
                HOOK
              </span>
            )
          }
          if (part.match(/^[【\[]V[】\]]$/)) {
            return (
              <span
                key={i}
                className="text-blue-600 dark:text-blue-400 font-bold mx-1 text-[10px] uppercase tracking-wider bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-sm select-none font-sans"
              >
                VALUE
              </span>
            )
          }
          if (part.match(/^[【\[]C[】\]]$/)) {
            return (
              <span
                key={i}
                className="text-blue-600 dark:text-blue-400 font-bold mx-1 text-[10px] uppercase tracking-wider bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-sm select-none font-sans"
              >
                CTA
              </span>
            )
          }
          // Fix: Ensure regular text is rendered if it's not empty
          if (!part) return null
          return <span key={i}>{part}</span>
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
        'flex flex-col bg-card mt-4 border rounded-xl shadow-sm md:flex-1 md:overflow-hidden h-auto relative',
        className
      )}
    >
      {/* Mobile Header (< md) - Keep existing layout */}
      <div className="flex md:hidden items-center justify-between p-6 shrink-0">
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

      {/* Desktop Header (>= md) - Redesigned per user request */}
      <div className="hidden md:flex items-center justify-between h-20 shrink-0 bg-muted/5 w-full px-6">
        {/* Left: Square Score + Info */}
        <div className="flex items-center">
          {/* Square Score Box */}
          <div
            className={cn(
              'flex flex-col items-center justify-center w-14 h-14 rounded-lg shadow-sm border border-border/50 shrink-0',
              score >= 80
                ? 'bg-emerald-50 dark:bg-emerald-900/20'
                : score >= 60
                  ? 'bg-amber-50 dark:bg-amber-900/20'
                  : 'bg-red-50 dark:bg-red-900/20'
            )}
          >
            <span
              className={cn(
                'text-[9px] font-bold uppercase tracking-wider mb-0.5 text-center',
                score >= 80
                  ? 'text-emerald-600/90 dark:text-emerald-400'
                  : score >= 60
                    ? 'text-amber-700/90 dark:text-amber-400'
                    : 'text-red-700/90 dark:text-red-400'
              )}
            >
              {assessmentLabel}
            </span>
            <span
              className={cn(
                'text-2xl font-black leading-none',
                score >= 80
                  ? 'text-emerald-500/90 dark:text-emerald-500'
                  : score >= 60
                    ? 'text-amber-500/90 dark:text-amber-500'
                    : 'text-red-500/90 dark:text-red-500'
              )}
            >
              {score}
            </span>
          </div>

          {/* Vertical Divider */}
          <div className="w-px h-8 bg-border/60 mx-5"></div>

          {/* Info Text */}
          <div className="flex flex-col justify-center space-y-1">
            <div className="text-lg font-bold text-foreground tracking-tight leading-none">
              {company || labels?.targetCompany || 'Target Company'}
            </div>
            <div className="text-sm font-medium text-muted-foreground leading-none">
              {jobTitle || labels?.targetPosition || 'Target Position'}
            </div>
          </div>
        </div>

        {/* Right: Action Button (CTA) */}
        <div className="flex items-center">{actionButton}</div>
      </div>

      {/* Scrollable Content */}
      <div
        ref={scrollRef}
        className="flex-1 md:overflow-y-auto overflow-visible px-4 md:px-6 pb-20 md:pb-0 space-y-8 md:space-y-10 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent relative"
      >
        {/* Expert Verdict Section - Clean & Premium */}
        {expertVerdict && (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-50/50 via-transparent to-transparent dark:from-amber-900/10 p-5 md:p-8 border border-amber-100/20 dark:border-amber-900/20">
            {/* Watermark Icon - Flipped & Warm Lighting Effect */}
            <div className="absolute -top-6 -right-6 opacity-100 pointer-events-none">
              {/* The Lamp */}
              <LampDesk className="w-40 h-40 text-amber-500/10 dark:text-amber-500/10 scale-x-[-1]" />
              {/* The Warm Light Glow */}
              <div className="absolute top-3/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-amber-100/20 dark:bg-amber-500/10 blur-[50px] rounded-full mix-blend-multiply dark:mix-blend-screen" />
            </div>

            <div className="relative z-10 space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 bg-amber-500/40 rounded-full" />
                <span className="text-xs font-bold uppercase tracking-widest text-amber-900/60 dark:text-amber-500/60">
                  {labels?.expertVerdict || 'Expert Verdict'}
                </span>
              </div>
              {/* Typography matched with Smart Pitch: text-sm, leading-loose, tracking-wide */}
              <div className="text-sm leading-loose text-foreground/80 font-normal tracking-wide text-justify font-[family-name:var(--font-playfair),serif]">
                {expertVerdict}
              </div>
            </div>
          </div>
        )}

        {/* Block A: Strengths (Highlights) - Magazine Style Header */}
        <div className="space-y-5 md:space-y-7">
          {/* Magazine Header: Gradient Background + Offset */}
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-50 to-transparent dark:from-emerald-900/20 -skew-x-12 rounded-sm -mx-2" />
            <div className="relative flex items-center gap-2 px-1">
              <span className="text-base font-black text-emerald-900/80 dark:text-emerald-400 tracking-tight italic">
                {labels?.highlights || 'Highlights'}
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-emerald-500/30 to-transparent w-32" />
            </div>
          </div>

          <div className="relative pl-2 ml-1.5 space-y-6">
            {/* Vertical Line */}
            <div className="absolute left-0 top-1 bottom-1 w-px bg-gradient-to-b from-emerald-500/30 via-emerald-500/10 to-transparent" />

            {strengths.map((item: any, i: number) => (
              <div key={i} className="relative pl-6">
                {/* Timeline Dot - Smaller & Subtle */}
                <div className="absolute -left-[3px] top-2.5 w-1.5 h-1.5 rounded-full bg-emerald-500/60 shadow-sm z-10 ring-4 ring-background" />

                <div className="space-y-1.5">
                  <div className="text-sm font-semibold text-foreground/90 leading-relaxed font-[family-name:var(--font-jetbrains-mono),monospace]">
                    {item.point}
                  </div>
                  {item.evidence && (
                    <div className="text-xs text-muted-foreground/80 leading-relaxed">
                      {item.evidence}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {strengths.length === 0 && (
              <div className="text-sm text-muted-foreground pl-6">
                {labels?.noHighlights || 'No highlights found.'}
              </div>
            )}
          </div>
        </div>

        {/* Block B: Weaknesses (Gaps) - Magazine Style Header */}
        <div className="space-y-5 md:space-y-7">
          {/* Magazine Header */}
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-50 to-transparent dark:from-amber-900/20 -skew-x-12 rounded-sm -mx-2" />
            <div className="relative flex items-center gap-2 px-1">
              <span className="text-base font-black text-amber-900/80 dark:text-amber-400 tracking-tight italic">
                {labels?.gapsAndSuggestions || 'Risks & Challenges'}
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-amber-500/30 to-transparent w-32" />
            </div>
          </div>

          <div className="relative pl-2 ml-1.5 space-y-6">
            {/* Vertical Line */}
            <div className="absolute left-0 top-1 bottom-1 w-px bg-gradient-to-b from-amber-500/30 via-amber-500/10 to-transparent" />

            {weaknesses.map((item: any, i: number) => (
              <div key={i} className="relative pl-6">
                {/* Timeline Dot */}
                <div className="absolute -left-[3px] top-2.5 w-1.5 h-1.5 rounded-full bg-amber-500/60 shadow-sm z-10 ring-4 ring-background" />

                <div className="space-y-1.5">
                  <div className="text-sm font-semibold text-foreground/90 leading-relaxed font-[family-name:var(--font-jetbrains-mono),monospace]">
                    {item.point}
                  </div>

                  {/* Evidence Block */}
                  {item.evidence && (
                    <div className="text-xs text-muted-foreground/80 leading-relaxed">
                      {item.evidence}
                    </div>
                  )}

                  {/* Tip Block - Structured with interview and resume */}
                  {(item.tip?.interview || item.tip?.resume) && (
                    <div className="mt-2 flex flex-col gap-1.5">
                      {item.tip.interview && (
                        <div className="inline-flex items-start gap-2 py-1.5 px-3 rounded-md bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100/50 dark:border-blue-900/20 max-w-full">
                          <span className="shrink-0 text-[10px] font-bold uppercase text-blue-600/70 tracking-wider mt-0.5">
                            面试应对
                          </span>
                          <div className="text-xs text-muted-foreground/90 leading-relaxed">
                            {item.tip.interview}
                          </div>
                        </div>
                      )}
                      {item.tip.resume && (
                        <div className="inline-flex items-start gap-2 py-1.5 px-3 rounded-md bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100/50 dark:border-amber-900/20 max-w-full">
                          <span className="shrink-0 text-[10px] font-bold uppercase text-amber-600/70 tracking-wider mt-0.5">
                            简历微调
                          </span>
                          <div className="text-xs text-muted-foreground/90 leading-relaxed">
                            {item.tip.resume}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {weaknesses.length === 0 && (
              <div className="text-sm text-muted-foreground pl-6">
                {labels?.noGaps || 'No gaps detected.'}
              </div>
            )}
          </div>
        </div>

        {/* Block C: Recommendations (Action Plan) - Magazine Style Header */}
        {recommendations.length > 0 && (
          <div className="space-y-5 md:space-y-7">
            {/* Magazine Header */}
            <div className="relative inline-block">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-900/20 -skew-x-12 rounded-sm -mx-2" />
              <div className="relative flex items-center gap-2 px-1">
                <span className="text-base font-black text-blue-900/80 dark:text-blue-400 tracking-tight italic">
                  {labels?.recommendations || 'Recommendations'}
                </span>
                <div className="h-px flex-1 bg-gradient-to-r from-blue-500/30 to-transparent w-32" />
              </div>
            </div>

            <div className="relative pl-2 ml-1.5 space-y-6">
              {/* Vertical Line */}
              <div className="absolute left-0 top-1 bottom-1 w-px bg-gradient-to-b from-blue-500/30 via-blue-500/10 to-transparent" />

              {recommendations.map((rec: string, i: number) => (
                <div key={i} className="relative pl-6">
                  {/* Timeline Dot */}
                  <div className="absolute -left-[3px] top-2.5 w-1.5 h-1.5 rounded-full bg-blue-500/60 shadow-sm z-10 ring-4 ring-background" />

                  <div className="space-y-1.5">
                    <div className="text-sm font-medium text-foreground/90 leading-relaxed font-[family-name:var(--font-jetbrains-mono),monospace]">
                      {rec}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Smart Pitch Section */}
        {dmScript && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded bg-blue-100 dark:bg-blue-900/30">
                  <Quote className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-sm font-bold text-foreground tracking-tight">
                  {labels?.smartPitch || 'Smart Pitch'}
                </span>
              </div>

              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
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
                    className="hidden md:block bg-popover text-popover-foreground border shadow-sm"
                  >
                    <p className="text-xs">
                      {labels?.copyTooltip || 'Hook, Value, Call to Action'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="relative rounded-xl border bg-muted/30 p-5 font-mono text-sm shadow-sm">
              <div className="absolute top-4 left-0 w-1 h-[calc(100%-32px)] bg-blue-500/30 rounded-r-full" />
              <div className="pl-2">{renderPitch(dmScript)}</div>
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
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none hidden md:flex flex-col items-center gap-1">
            <div className="animate-bounce p-2 bg-background/80 backdrop-blur-sm rounded-full shadow-sm border border-border/50">
              <ChevronDown className="w-4 h-4 text-primary" />
            </div>
            <span className="text-xs text-muted-foreground font-extralight">
              {labels?.scrollHint || 'Scroll down for more'}
            </span>
          </div>
        </>
      )}
    </div>
  )
}
