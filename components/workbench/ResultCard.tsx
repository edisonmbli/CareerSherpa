'use client'

import React, { useRef, useState, useEffect } from 'react'
import {
  cn,
  getMatchScore,
  getMatchThemeClass,
  getMatchThemeColor,
} from '@/lib/utils'
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

type MatchStrength = { point: string; evidence: string; section?: string }
type MatchWeakness = {
  point: string
  evidence: string
  tip?: { interview: string; resume: string } | string
}

function parseMatchData(data: any) {
  const score = getMatchScore(data)

  const strengths: MatchStrength[] = (
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

  const weaknesses: MatchWeakness[] = (
    Array.isArray(data?.gaps)
      ? data.gaps.map((s: any) => ({ point: String(s), evidence: '' }))
      : Array.isArray(data?.weaknesses)
        ? data.weaknesses.map((w: any) => {
          if (typeof w === 'string') return { point: w, evidence: '' }
          const point = w?.Point ?? w?.point ?? ''
          const evidence = w?.Evidence ?? w?.evidence ?? w?.suggestion ?? ''
          const tip = w?.Tip ?? w?.tip ?? null

          const tipObj:
            | { interview: string; resume: string }
            | string
            | undefined =
            typeof tip === 'object' && tip !== null
              ? { interview: tip.interview ?? '', resume: tip.resume ?? '' }
              : typeof tip === 'string'
                ? { interview: tip, resume: '' }
                : undefined

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
          ? typeof data.cover_letter_script.script === 'string'
            ? data.cover_letter_script.script
            : typeof data.cover_letter_script.H === 'string'
              ? `【H】${data.cover_letter_script.H || ''}\n\n【V】${data.cover_letter_script.V || ''
              }\n\n【C】${data.cover_letter_script.C || ''}`
              : null
          : null

  const expertVerdict = data?.overall_assessment as string | undefined

  return {
    score,
    strengths,
    weaknesses,
    recommendations,
    dmScript,
    expertVerdict,
  }
}

export function buildMatchResultCopyText(
  data: any,
  options?: {
    company?: string
    jobTitle?: string
    labels?: ResultCardProps['labels']
  },
) {
  const parsed = parseMatchData(data)
  const labels = options?.labels
  const company = options?.company || labels?.targetCompany || 'Target Company'
  const jobTitle =
    options?.jobTitle || labels?.targetPosition || 'Target Position'

  const overallLabel = labels?.overallAssessment || 'Overall Assessment'
  const highlightsLabel = labels?.highlights || 'Highlights'
  const gapsLabel = labels?.gapsAndSuggestions || 'Risks & Challenges'
  const recommendationsLabel = labels?.recommendations || 'Recommendations'
  const smartPitchLabel = labels?.smartPitch || 'Smart Pitch'

  const sections = [
    `# ${company}`,
    jobTitle,
    '',
    `## ${overallLabel}`,
    parsed.expertVerdict || '',
    '',
    `## ${highlightsLabel}`,
    ...(parsed.strengths.length
      ? parsed.strengths.map((s, i) =>
        [
          `${i + 1}. ${s.point}`,
          s.evidence ? `- ${s.evidence}` : '',
          s.section ? `- ${s.section}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      )
      : [labels?.noHighlights || '']),
    '',
    `## ${gapsLabel}`,
    ...(parsed.weaknesses.length
      ? parsed.weaknesses.map((w, i) => {
        const tipObj =
          typeof w.tip === 'string' ? { interview: w.tip, resume: '' } : w.tip
        return [
          `${i + 1}. ${w.point}`,
          w.evidence ? `- ${w.evidence}` : '',
          tipObj?.resume
            ? `- ${labels?.resumeTweak || 'Resume'}: ${tipObj.resume}`
            : '',
          tipObj?.interview
            ? `- ${labels?.interviewPrep || 'Interview'}: ${tipObj.interview}`
            : '',
        ]
          .filter(Boolean)
          .join('\n')
      })
      : [labels?.noGaps || '']),
  ]

  if (parsed.recommendations.length > 0) {
    sections.push('')
    sections.push(`## ${recommendationsLabel}`)
    parsed.recommendations.forEach((rec: any, i: number) => {
      sections.push(`${i + 1}. ${String(rec)}`)
    })
  }

  if (parsed.dmScript) {
    sections.push('')
    sections.push(`## ${smartPitchLabel}`)
    sections.push(parsed.dmScript)
  }

  return sections.join('\n').trim()
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
  const {
    score,
    strengths,
    weaknesses,
    recommendations,
    dmScript,
    expertVerdict,
  } = parseMatchData(data)

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
  const matchThemeClass = getMatchThemeClass(themeColor)

  return (
    <div
      className={cn(
        // V5 Measured Document Styling:
        // 1. Centered "Page" with max-width (Letterhead feel)
        'max-w-none sm:max-w-[880px] mx-0 sm:mx-auto w-full relative mt-4 overflow-visible animate-in fade-in slide-in-from-bottom-6 duration-[800ms] ease-out',
        // 2. Tinted Neutral Background - Unified with Landing Page
        'bg-white/70 dark:bg-white/[0.03]',
        // 3. Double Border Effect - Unified with Landing Page
        'border-[0.5px] border-black/5 dark:border-white/10',
        'shadow-[inset_0_2px_5px_rgba(255,255,255,0.9),0_40px_80px_-20px_rgba(14,165,233,0.15)] dark:shadow-2xl',
        'rounded-sm sm:rounded-[2rem] backdrop-blur-2xl',
        matchThemeClass,
        className,
      )}
    >
      {/* Fine Noise Texture for the glass (matching Landing Page) */}
      <div aria-hidden="true" className="absolute inset-0 mix-blend-overlay opacity-10 pointer-events-none rounded-sm sm:rounded-[2rem] z-0" style={{ backgroundImage: 'url("/noise.svg")', backgroundRepeat: 'repeat' }} />

      <div
        ref={scrollRef}
        className="flex-1 overflow-visible px-0 py-3 sm:p-4 md:p-8 space-y-5 md:space-y-8 relative z-10"
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
          <ChevronDown className="w-4 h-4 text-stone-400" />
        </div>
      )}
    </div>
  )
}
