'use client'

import React from 'react'
import ReactMarkdown from 'react-markdown'
import { cn, getMatchThemeClass } from '@/lib/utils'
import { WatermarkPrefix } from '@/components/workbench/WatermarkPrefix'
import {
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  MessageSquare,
  FileText,
  Mic,
} from 'lucide-react'

// Flexible type definition to handle various schemas
interface AnalysisItem {
  point?: string
  evidence?: string
  section?: string
  tip?:
  | {
    interview?: string
    resume?: string
  }
  | string
}

interface AnalysisAccordionProps {
  type: 'strength' | 'weakness' | 'recommendation'
  items: (AnalysisItem | string)[]
  title: string
  defaultOpen?: boolean
  themeColor?: string // 'emerald' | 'amber' | 'rose'
  labels?: {
    resumeTweak?: string
    interviewPrep?: string
  }
}



export function AnalysisAccordion({
  type,
  items,
  title,
  defaultOpen = false,
  themeColor = 'slate',
  labels,
}: AnalysisAccordionProps) {
  if (!items || items.length === 0) return null
  const matchThemeClass = getMatchThemeClass(themeColor)
  const styles = {
    highlight: 'bg-match-highlight',
    text: 'text-match-text',
    border: 'border-match-border',
    accent: 'border-match-accent',
    dotBorder: 'border-match-dot',
    decoration: 'decoration-match-decoration',
  }

  return (
    <div className={cn('w-full', matchThemeClass)}>
      {/* Header: Editorial Typography with subtle Left Border */}
      <div className="flex items-center w-full mb-6 md:mb-8 relative pl-2">
        {/* Title Container with Left Border Accent */}
        <div className={cn('relative ml-0 border-l-[3px] pl-3 py-0.5', styles.dotBorder)}>
          <span className="font-[family-name:var(--font-playfair),serif] text-xl md:text-[22px] leading-tight font-bold text-stone-900 dark:text-stone-50 tracking-tight z-10 relative">
            {title}
          </span>
        </div>
      </div>

      <div className="px-1 md:px-2">
        {/* Timeline Line */}
        <div className="space-y-0 relative border-l border-stone-200/60 dark:border-white/10 ml-3 md:ml-4">
          {items.map((item, idx) => {
            const isString = typeof item === 'string'
            const point = isString
              ? (item as string)
              : (item as AnalysisItem).point
            const evidence = isString ? null : (item as AnalysisItem).evidence
            const tip = isString ? null : (item as AnalysisItem).tip

            return (
              <div
                key={idx}
                className="group/item relative pt-0 pb-10 md:pb-12 last:pb-2 pl-6 md:pl-8 origin-top"
              >
                {/* Timeline Dot */}
                <div className="absolute left-[-4.5px] top-2.5 w-2 h-2 rounded-full bg-stone-300 dark:bg-stone-600 ring-4 ring-white dark:ring-[#0a0a0a] group-hover/item:bg-match-dot transition-colors duration-300" />

                {/* Subtle Watermark anchoring the section */}
                <WatermarkPrefix index={idx} themeColor={themeColor} className="-top-4 sm:-top-2 sm:-left-6 text-[32px] sm:text-4xl opacity-30 group-hover/item:opacity-80 group-hover/item:scale-110 transition-all duration-300" />

                <div className="space-y-3 relative z-10 pt-1 transition-transform duration-300 group-hover/item:translate-x-1">
                  {/* Main Point */}
                  <div className="text-sm leading-relaxed text-stone-800 dark:text-slate-300 font-[family-name:var(--font-noto-serif),serif]">
                    <ReactMarkdown
                      components={{
                        p: ({ node, ...props }) => (
                          <p className="inline" {...props} />
                        ),
                        strong: ({ node, ...props }) => (
                          <span
                            className={cn(
                              'font-semibold underline decoration-2 underline-offset-2 decoration-wavy',
                              styles.decoration,
                            )}
                            {...props}
                          />
                        ),
                      }}
                    >
                      {point || ''}
                    </ReactMarkdown>
                  </div>

                  {/* Evidence - Subtle */}
                  {evidence && (
                    <div className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed font-light pl-0.5">
                      <ReactMarkdown>{evidence}</ReactMarkdown>
                    </div>
                  )}

                  {/* Tips - Editorial Style with Theme Colors */}
                  {tip &&
                    typeof tip === 'object' &&
                    (tip.interview || tip.resume) && (
                      <div className="mt-4 md:mt-5 flex flex-col gap-3 group-hover/item:opacity-100 transition-opacity">
                        {tip.resume && (
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity">
                              <FileText
                                className={cn('w-3 h-3', styles.text)}
                              />
                              <div
                                className={cn(
                                  'text-[9px] font-bold uppercase tracking-widest',
                                  styles.text,
                                )}
                              >
                                {labels?.resumeTweak || 'Resume Tweak'}
                              </div>
                            </div>
                            <p
                              className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed pl-1"
                            >
                              {tip.resume}
                            </p>
                          </div>
                        )}
                        {tip.interview && (
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity">
                              <Mic className={cn('w-3 h-3', styles.text)} />
                              <div
                                className={cn(
                                  'text-[9px] font-bold uppercase tracking-widest',
                                  styles.text,
                                )}
                              >
                                {labels?.interviewPrep || 'Interview Prep'}
                              </div>
                            </div>
                            <p
                              className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed pl-1"
                            >
                              {tip.interview}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
