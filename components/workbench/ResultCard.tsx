'use client'

import React, { useRef, useState, useEffect } from 'react'
import { cn, getMatchScore, getMatchThemeColor } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'
import { ResultHeader } from './result/ResultHeader'
import { ExpertVerdict } from './result/ExpertVerdict'
import { AnalysisAccordion } from './result/AnalysisAccordion'
import { SmartPitch } from './result/SmartPitch'

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
    preview?: string
    source?: string
    resumeTweak?: string
    interviewPrep?: string
    cleanCopied?: string
    definitions?: {
      structure?: string
      clickToCopy?: string
    }
    smartPitchDefs?: {
      hook?: string
      value?: string
      cta?: string
    }
  }
  className?: string
  loading?: boolean
  actionButton?: React.ReactNode
}

const defaultLabels = {
  title: '',
  copy: '',
  overallAssessment: '',
  highlights: '',
  gapsAndSuggestions: '',
  recommendations: '',
  source: '',
  expertVerdict: '',
  targetCompany: '',
  targetPosition: '',
  highlyMatched: '',
  goodFit: '',
  lowMatch: '',
  smartPitch: '',
  copied: '',
  preview: '',
}

export function ResultCard({
  data,
  company,
  jobTitle,
  labels = defaultLabels,
  loading = false,
  actionButton,
  className,
}: ResultCardProps) {
  // --- Data Parsing Logic (Preserved from old component) ---
  const score = getMatchScore(data)

  // Strengths
  const strengths = (
    Array.isArray(data?.highlights)
      ? data.highlights.map((s: any) => ({ point: String(s), evidence: '' }))
      : Array.isArray(data?.strengths)
      ? data.strengths.map((s: any) => {
          if (typeof s === 'string') return { point: s, evidence: '' }
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

  // Weaknesses
  const weaknesses = (
    Array.isArray(data?.gaps)
      ? data.gaps.map((s: any) => ({ point: String(s), evidence: '' }))
      : Array.isArray(data?.weaknesses)
      ? data.weaknesses.map((w: any) => {
          if (typeof w === 'string')
            return { point: w, evidence: '', tip: null }
          const point = w?.Point ?? w?.point ?? ''
          const evidence = w?.Evidence ?? w?.evidence ?? w?.suggestion ?? ''
          const tip = w?.Tip ?? w?.tip ?? null

          const tipObj =
            typeof tip === 'object' && tip !== null
              ? { interview: tip.interview ?? '', resume: tip.resume ?? '' }
              : typeof tip === 'string'
              ? { interview: tip, resume: '' }
              : null

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

  // Pitch Script
  const dmScript =
    typeof data?.dm_script === 'string'
      ? data.dm_script
      : typeof data?.cover_letter_script === 'string'
      ? data.cover_letter_script
      : typeof data?.cover_letter_script === 'object' &&
        data?.cover_letter_script !== null
      ? typeof data.cover_letter_script.script === 'string'
        ? data.cover_letter_script.script
        : typeof data.cover_letter_script.H === 'string'
        ? `【H】${data.cover_letter_script.H || ''}\n\n【V】${
            data.cover_letter_script.V || ''
          }\n\n【C】${data.cover_letter_script.C || ''}`
        : null
      : null

  const expertVerdict = data?.overall_assessment as string | undefined

  // --- Scroll Hint Logic ---
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showScrollHint, setShowScrollHint] = useState(false)

  // (Simplified scroll logic for V2 - only check if scrollable on mount/resize)
  // ... omited complex logic for brevity, keeping simple check
  useEffect(() => {
    if (
      scrollRef.current &&
      scrollRef.current.scrollHeight > scrollRef.current.clientHeight + 20
    ) {
      setShowScrollHint(true)
    }
  }, [data])

  // Theme Logic
  const themeColor = getMatchThemeColor(score)

  return (
    <div
      className={cn(
        // V5 Measured Document Styling:
        // 1. Centered "Page" with max-width (Letterhead feel)
        'max-w-[880px] mx-auto w-full relative mt-4 animate-in fade-in slide-in-from-bottom-6 duration-[800ms] ease-out',
        // 2. Tinted Neutral Background
        'bg-card/50',
        // 3. Double Border Effect
        'border border-border',
        'shadow-[0_0_0_1px_rgba(255,255,255,0.5)_inset,0_4px_12px_rgba(0,0,0,0.05)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.05)_inset,0_4px_24px_rgba(0,0,0,0.2)]',
        'rounded-xl backdrop-blur-sm',
        className
      )}
      style={{
        // Subtle noise texture overlay
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.03'/%3E%3C/svg%3E")`,
      }}
    >
      <div
        ref={scrollRef}
        className="flex-1 overflow-visible p-4 sm:p-5 md:p-8 space-y-6 md:space-y-8"
      >
        {/* Module A: Hero Header (Now handles CTA) */}
        <ResultHeader
          score={score}
          company={company || ''}
          jobTitle={jobTitle || ''}
          labels={labels}
        />

        {/* Module B: Insight Block */}
        {expertVerdict && (
          <ExpertVerdict
            content={expertVerdict}
            label={labels?.expertVerdict || ''}
          />
        )}

        {/* Module C: Accordions */}
        <div className="space-y-6">
          {strengths.length > 0 && (
            <AnalysisAccordion
              type="strength"
              items={strengths}
              title={labels?.highlights || 'Highlights'}
              defaultOpen={true}
              themeColor={themeColor}
              labels={{
                resumeTweak: labels?.resumeTweak || 'Resume Tweak',
                interviewPrep: labels?.interviewPrep || 'Interview Prep',
              }}
            />
          )}

          {weaknesses.length > 0 && (
            <AnalysisAccordion
              type="weakness"
              items={weaknesses}
              title={labels?.gapsAndSuggestions || 'Risks & Challenges'}
              defaultOpen={true}
              themeColor={themeColor}
              labels={{
                resumeTweak: labels?.resumeTweak || 'Resume Tweak',
                interviewPrep: labels?.interviewPrep || 'Interview Prep',
              }}
            />
          )}

          {recommendations.length > 0 && (
            <AnalysisAccordion
              type="recommendation"
              items={recommendations}
              title={labels?.recommendations || 'Recommendations'}
              defaultOpen={true}
              themeColor={themeColor}
            />
          )}
        </div>

        {/* Module D: Smart Pitch */}
        {dmScript && (
          <SmartPitch
            script={dmScript}
            themeColor={themeColor}
            labels={{
              title: labels?.smartPitch || '',
              copy: labels?.copy || '',
              copied: labels?.copied || '',
              copyTooltip: labels?.copyTooltip || '',
              cleanCopied: labels?.cleanCopied || '',
              ...(labels?.definitions
                ? { definitions: labels.definitions }
                : {}),
              ...(labels?.smartPitchDefs
                ? { smartPitchDefs: labels.smartPitchDefs }
                : {}),
            }}
          />
        )}
      </div>

      {/* Scroll Hint */}
      {showScrollHint && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none hidden md:flex flex-col items-center gap-1 opacity-60 animate-bounce">
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </div>
      )}
    </div>
  )
}
