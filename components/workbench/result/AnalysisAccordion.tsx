'use client'

import React from 'react'
import ReactMarkdown from 'react-markdown'
import { cn, getMatchThemeClass } from '@/lib/utils'
import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { WatermarkPrefix } from '@/components/workbench/WatermarkPrefix'
import {
  Accordion,
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

const AnalysisAccordionContent = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>) => (
  <AccordionPrimitive.Content
    className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-visible text-sm"
    {...props}
  >
    <div className={cn('pt-0 pb-2', className)}>{children}</div>
  </AccordionPrimitive.Content>
)

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
    decoration: 'decoration-match-decoration',
  }

  return (
    <Accordion
      type="single"
      collapsible
      {...(defaultOpen ? { defaultValue: 'item-1' } : {})}
      className={cn('w-full', matchThemeClass)}
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
                  styles.highlight,
                )}
              />

              {/* Title Text (Foreground) */}
              <span className="font-[family-name:var(--font-playfair),serif] text-[22px] leading-[30px] font-bold text-foreground tracking-tight z-10 relative">
                {title}
              </span>
            </div>
          </div>
        </AccordionTrigger>

        <AnalysisAccordionContent className="px-0">
          <div className="space-y-2 pt-1">
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
                  className="group/item relative pt-1 pb-4 last:pb-0"
                >
                  <WatermarkPrefix index={idx} themeColor={themeColor} />
                  <div className="space-y-1.5 relative">
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
                        <div className="mt-3 flex flex-col gap-3">
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
                                className={cn(
                                  'text-xs text-stone-600 dark:text-stone-300 leading-relaxed pl-4 border-l',
                                  styles.border,
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
                                    styles.text,
                                  )}
                                >
                                  {labels?.interviewPrep || 'Interview Prep'}
                                </div>
                              </div>
                              <p
                                className={cn(
                                  'text-xs text-stone-600 dark:text-stone-300 leading-relaxed pl-4 border-l',
                                  styles.border,
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
        </AnalysisAccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
