'use client'

import React from 'react'
import { ShieldCheck } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { cn } from '@/lib/utils'

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

  const formatLabel = (
    template: string,
    vars: Record<string, string | number>,
  ) => template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ''))

  const getHighlightColor = () => {
    switch (themeColor) {
      case 'emerald':
        return 'bg-emerald-200 dark:bg-emerald-500/65'
      case 'amber':
        return 'bg-amber-200 dark:bg-amber-500/65'
      case 'rose':
        return 'bg-rose-200 dark:bg-rose-500/65'
      default:
        return 'bg-emerald-200 dark:bg-emerald-500/65'
    }
  }

  const getAccentTextColor = () => {
    switch (themeColor) {
      case 'emerald':
        return 'text-emerald-700/80 dark:text-emerald-300'
      case 'amber':
        return 'text-amber-700/80 dark:text-amber-300'
      case 'rose':
        return 'text-rose-700/80 dark:text-rose-300'
      default:
        return 'text-emerald-700/80 dark:text-emerald-300'
    }
  }

  const getWatermarkColor = () => {
    switch (themeColor) {
      case 'emerald':
        return 'text-emerald-300/70 dark:text-emerald-500/65'
      case 'amber':
        return 'text-amber-300/70 dark:text-amber-500/65'
      case 'rose':
        return 'text-rose-300/70 dark:text-rose-500/65'
      default:
        return 'text-emerald-300/70 dark:text-emerald-500/65'
    }
  }

  if (!defenses || defenses.length === 0) {
    return null
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Section Title */}
      <div className="flex items-center gap-3">
        <div className="relative inline-block">
          <div
            className={cn(
              'absolute bottom-4 -left-4 w-20 h-5 -z-10',
              getHighlightColor(),
            )}
          />
          <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-50 tracking-tight relative">
            {finalLabels.title}
          </h3>
        </div>
        <span className={cn('text-xs font-medium', getAccentTextColor())}>
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
                <span
                  className={cn(
                    'absolute -left-4 -top-3 text-3xl font-semibold tabular-nums select-none pointer-events-none',
                    getWatermarkColor(),
                  )}
                >
                  {index + 1}
                </span>
                <span className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {defense.weakness}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-0 pb-4">
              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400/80 dark:text-slate-500">
                    {finalLabels.anticipatedQuestion}
                  </p>
                  <p className="text-sm text-slate-600/60 dark:text-slate-400 leading-relaxed">
                    &ldquo;{defense.anticipated_question}&rdquo;
                  </p>
                </div>

                {defense.supporting_evidence && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400/80 dark:text-slate-500">
                      {finalLabels.supportingEvidence}
                    </p>
                    <p className="text-sm text-slate-600/80 dark:text-slate-400 leading-relaxed">
                      {defense.supporting_evidence}
                    </p>
                  </div>
                )}

                <div className="space-y-1">
                  <p
                    className={cn(
                      'text-[11px] font-semibold uppercase tracking-[0.18em] flex items-center gap-2',
                      getAccentTextColor(),
                    )}
                  >
                    <ShieldCheck className="h-3 w-3" />
                    {finalLabels.defenseScript}
                  </p>
                  <p className="text-sm text-slate-900/80 dark:text-slate-100 leading-relaxed font-normal">
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
