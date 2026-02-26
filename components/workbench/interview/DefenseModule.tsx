'use client'

import React from 'react'
import { ShieldCheck } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { cn, getMatchThemeClass } from '@/lib/utils'

interface DefenseScript {
  weakness: string
  anticipated_question: string
  defense_script: string
  supporting_evidence: string
}

interface DefenseModuleProps {
  defenses: DefenseScript[]
  themeColor?: 'emerald' | 'amber' | 'rose'
  labels?: {
    title?: string
    weakness?: string
    anticipatedQuestion?: string
    defenseScript?: string
    supportingEvidence?: string
    weaknessCount?: string
  }
  className?: string
}

const defaultLabels = {
  title: '弱项演练',
  weakness: '弱点',
  anticipatedQuestion: '预判追问',
  defenseScript: '防御话术',
  supportingEvidence: '支撑证据',
  weaknessCount: '{count} 个弱点',
}

export function DefenseModule({
  defenses,
  themeColor = 'emerald',
  labels = defaultLabels,
  className,
}: DefenseModuleProps) {
  const finalLabels = { ...defaultLabels, ...labels }
  const matchThemeClass = getMatchThemeClass(themeColor)

  const formatLabel = (
    template: string,
    vars: Record<string, string | number>,
  ) => template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ''))

  if (!defenses || defenses.length === 0) {
    return null
  }

  return (
    <div className={cn('space-y-3', matchThemeClass, className)}>
      {/* Section Title */}
      <div className="flex items-center gap-3 w-full mb-6 relative pl-2">
        <div className={cn('relative ml-0 border-l-[3px] pl-3 py-0.5', 'border-match-dot')}>
          <h3 className="text-2xl font-serif text-foreground z-10 relative">
            {finalLabels.title}
          </h3>
        </div>
        <span className="text-xs font-medium text-match-text">
          {formatLabel(finalLabels.weaknessCount, { count: defenses.length })}
        </span>
      </div>

      {/* Accordion */}
      <Accordion
        type="multiple"
        defaultValue={defenses.map((_, i) => String(i))}
        className="space-y-4"
      >
        {defenses.map((defense, index) => (
          <AccordionItem
            key={index}
            value={String(index)}
            className="relative overflow-hidden z-10 bg-white/60 dark:bg-white/[0.03] backdrop-blur-2xl border-[0.5px] border-black/5 dark:border-white/10 rounded-xl px-4 md:px-5 shadow-sm"
          >
            {/* Proportional Ghost Watermark Small */}
            <div className="absolute -top-3 -left-2 text-[5rem] font-black pointer-events-none select-none opacity-[0.08] dark:opacity-[0.05] z-0 text-slate-900 dark:text-white leading-none">
              {index + 1}
            </div>

            <AccordionTrigger className="relative z-10 px-0 py-4 hover:no-underline group focus-visible:ring-0 focus-visible:outline-none border-none">
              <div className="w-full text-left">
                <span className="text-lg font-semibold text-foreground leading-tight">
                  {defense.weakness}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="relative z-10 px-0 pb-5">
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5 bg-white/30 dark:bg-white/[0.01] border-[0.5px] border-black/5 dark:border-white/10 rounded-lg p-3 md:p-4 mb-2 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">
                    {finalLabels.anticipatedQuestion}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    &ldquo;{defense.anticipated_question}&rdquo;
                  </p>
                </div>

                {defense.supporting_evidence && (
                  <div className="space-y-1.5 px-1">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      {finalLabels.supportingEvidence}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      {defense.supporting_evidence}
                    </p>
                  </div>
                )}

                <div className="space-y-1.5 mt-4 bg-match-highlight/[0.05] dark:bg-match-highlight/[0.02] border-l-2 border-match-dot rounded-r-lg p-3 md:p-4">
                  <p className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-match-text mb-1">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {finalLabels.defenseScript}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium text-pretty">
                    {defense.defense_script}
                  </p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}
