// Server Component - Pure presentation, no interactivity
import React from 'react'
import { Ear, Flag } from 'lucide-react'
import { cn, getMatchThemeClass } from '@/lib/utils'
import { WatermarkPrefix } from '@/components/workbench/WatermarkPrefix'

interface ReverseQuestion {
  question: string
  ask_intent: string
  listen_for: string
}

interface ReverseModuleProps {
  questions: ReverseQuestion[]
  themeColor?: 'emerald' | 'amber' | 'rose'
  labels?: {
    title?: string
    question?: string
    askIntent?: string
    listenFor?: string
  }
  className?: string
}

const defaultLabels = {
  title: '提问利器',
  question: '问题',
  askIntent: '提问意图',
  listenFor: '倾听重点',
}

export function ReverseModule({
  questions,
  themeColor = 'emerald',
  labels = defaultLabels,
  className,
}: ReverseModuleProps) {
  const finalLabels = { ...defaultLabels, ...labels }
  const matchThemeClass = getMatchThemeClass(themeColor)

  if (!questions || questions.length === 0) {
    return null
  }

  return (
    <div className={cn('space-y-6', matchThemeClass, className)}>
      {/* Section Header */}
      <div className="relative inline-block">
        <div className="absolute bottom-4 -left-4 w-24 h-5 -z-10 bg-match-highlight" />
        <h3 className="text-[22px] leading-[30px] font-bold font-[family-name:var(--font-playfair),serif] text-stone-900 dark:text-white tracking-tight relative">
          {finalLabels.title}
        </h3>
      </div>

      {/* Questions List - Clean timeline style */}
      <div className="space-y-2">
        {questions.map((q, index) => (
          <div key={index} className="relative pt-1 pb-6 last:pb-0">
            <WatermarkPrefix index={index} themeColor={themeColor} />
            <div className="space-y-3 pb-2">
              <h4 className="text-base font-semibold text-stone-900 dark:text-white leading-relaxed">
                {q.question}
              </h4>

              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-stone-500">
                    <Flag className="h-3 w-3 text-match-text" />
                    <span className="uppercase">{finalLabels.askIntent}</span>
                  </div>
                  <p className="text-sm text-stone-900/90 dark:text-slate-300 leading-relaxed">
                    {q.ask_intent}
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-stone-500">
                    <Ear className="h-3 w-3 text-match-text" />
                    <span className="uppercase">{finalLabels.listenFor}</span>
                  </div>
                  <p className="text-sm text-stone-900/90 dark:text-slate-300 leading-relaxed">
                    {q.listen_for}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
