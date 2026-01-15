'use client'

import React from 'react'
import ReactMarkdown from 'react-markdown'
import { cn } from '@/lib/utils'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
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

  // Theme Styles Mapping
  const getThemeStyles = (color: string) => {
    switch (color) {
      case 'emerald':
        return {
          highlight: 'bg-emerald-200 dark:bg-emerald-900/50', // Highlight Block
          text: 'text-emerald-600 dark:text-emerald-400',
          border: 'border-emerald-500/20',
          decoration: 'decoration-emerald-200 dark:decoration-emerald-800',
        }
      case 'amber':
        return {
          highlight: 'bg-amber-200 dark:bg-amber-900/50',
          text: 'text-amber-600 dark:text-amber-400',
          border: 'border-amber-500/20',
          decoration: 'decoration-amber-200 dark:decoration-amber-800',
        }
      case 'rose':
        return {
          highlight: 'bg-rose-200 dark:bg-rose-900/50',
          text: 'text-rose-600 dark:text-rose-400',
          border: 'border-rose-500/20',
          decoration: 'decoration-rose-200 dark:decoration-rose-800',
        }
      default: // Slate fallback
        return {
          highlight: 'bg-slate-200 dark:bg-slate-800',
          text: 'text-slate-600 dark:text-slate-400',
          border: 'border-slate-500/20',
          decoration: 'decoration-slate-200 dark:decoration-slate-800',
        }
    }
  }

  const styles = getThemeStyles(themeColor)

  return (
    <Accordion
      type="single"
      collapsible
      {...(defaultOpen ? { defaultValue: 'item-1' } : {})}
      className="w-full"
    >
      <AccordionItem
        value="item-1"
        className="border-none" // Remove default border
      >
        {/* Header: Editorial Serif Typography with Half-Highlight Block */}
        <AccordionTrigger className="px-0 py-4 hover:no-underline group">
          <div className="flex items-center w-full relative pl-2">
            {/* Title Container with Highlight */}
            <div className="relative inline-block ml-0">
              {/* Highlight Block (Background) */}
              <div
                className={cn(
                  'absolute bottom-4 -left-4 w-24 h-5 -z-10',
                  styles.highlight
                )}
              />

              {/* Title Text (Foreground) */}
              <span className="font-[family-name:var(--font-playfair),serif] text-2xl font-bold text-slate-900 dark:text-slate-50 tracking-tight z-10 relative">
                {title}
              </span>
            </div>
          </div>
        </AccordionTrigger>

        <AccordionContent className="px-0 pb-2">
          <div className="space-y-4 pt-2">
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
                  className="group/item grid grid-cols-[24px_1fr] relative"
                >
                  {/* Column 1: Gutter (Dot/Line) - Simple Alignment */}
                  <div className="relative flex flex-col items-center w-6">
                    {/* Connector Line - Runs through */}
                    <div className="absolute top-[-24px] bottom-[-24px] w-px bg-slate-200 dark:bg-slate-800" />

                    {/* Hollow Dot Indicator - On top of line */}
                    <div
                      className={cn(
                        'w-1.5 h-1.5 rounded-full border-[1.5px] bg-white dark:bg-slate-950 z-10 mt-2.5 transition-colors duration-300',
                        styles.border
                      )}
                    />
                  </div>

                  {/* Column 2: Content */}
                  <div className="space-y-2 pb-2 relative pl-1">
                    {/* Main Point */}
                    <div className="text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                      <ReactMarkdown
                        components={{
                          p: ({ node, ...props }) => (
                            <p className="inline" {...props} />
                          ),
                          strong: ({ node, ...props }) => (
                            <span
                              className={cn(
                                'font-semibold underline decoration-2 underline-offset-2 decoration-wavy',
                                styles.decoration
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
                      <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-light pl-0.5">
                        <ReactMarkdown>{evidence}</ReactMarkdown>
                      </div>
                    )}

                    {/* Tips - Editorial Style with Theme Colors */}
                    {tip &&
                      typeof tip === 'object' &&
                      (tip.interview || tip.resume) && (
                        <div className="mt-4 pt-1 flex flex-col gap-4">
                          {tip.resume && (
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity">
                                <FileText
                                  className={cn('w-3 h-3', styles.text)}
                                />
                                <div
                                  className={cn(
                                    'text-[9px] font-bold uppercase tracking-widest',
                                    styles.text
                                  )}
                                >
                                  {labels?.resumeTweak || 'Resume Tweak'}
                                </div>
                              </div>
                              <p
                                className={cn(
                                  'text-xs text-slate-600 dark:text-slate-300 leading-relaxed pl-4 border-l',
                                  styles.border
                                )}
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
                                    styles.text
                                  )}
                                >
                                  {labels?.interviewPrep || 'Interview Prep'}
                                </div>
                              </div>
                              <p
                                className={cn(
                                  'text-xs text-slate-600 dark:text-slate-300 leading-relaxed pl-4 border-l',
                                  styles.border
                                )}
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
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
