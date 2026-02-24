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
import { WatermarkPrefix } from '@/components/workbench/WatermarkPrefix'

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
      <div className="flex items-center gap-3">
        <div className="relative inline-block">
          <div className="absolute bottom-4 -left-4 w-24 h-5 -z-10 bg-match-highlight" />
          <h3 className="text-[22px] leading-[30px] font-bold font-[family-name:var(--font-playfair),serif] text-stone-900 dark:text-white tracking-tight relative">
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
        className="space-y-2"
      >
        {defenses.map((defense, index) => (
          <AccordionItem
            key={index}
            value={String(index)}
            className="border-none"
          >
            <AccordionTrigger className="px-0 py-3 hover:no-underline group">
              <div className="relative w-full text-left pt-1">
                <WatermarkPrefix index={index} themeColor={themeColor} />
                <span className="text-base font-semibold text-stone-900 dark:text-white">
                  {defense.weakness}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-0 pb-4">
              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500 dark:text-stone-400/80">
                    {finalLabels.anticipatedQuestion}
                  </p>
                  <p className="text-sm text-stone-600/80 dark:text-slate-300 leading-relaxed">
                    &ldquo;{defense.anticipated_question}&rdquo;
                  </p>
                </div>

                {defense.supporting_evidence && (
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500 dark:text-stone-400/80">
                      {finalLabels.supportingEvidence}
                    </p>
                    <p className="text-sm text-stone-600/80 dark:text-slate-300 leading-relaxed">
                      {defense.supporting_evidence}
                    </p>
                  </div>
                )}

                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] flex items-center gap-2 text-match-text">
                    <ShieldCheck className="h-3 w-3" />
                    {finalLabels.defenseScript}
                  </p>
                  <p className="text-sm text-stone-900/90 dark:text-slate-300 leading-relaxed font-normal">
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
