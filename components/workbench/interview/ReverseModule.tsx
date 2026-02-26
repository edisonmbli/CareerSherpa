// Server Component - Pure presentation, no interactivity
import React from 'react'
import { Ear, Flag } from 'lucide-react'
import { cn, getMatchThemeClass } from '@/lib/utils'

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
      <div className="flex items-center w-full mb-6 relative pl-2">
        <div className={cn('relative ml-0 border-l-[3px] pl-3 py-0.5', 'border-match-dot')}>
          <h3 className="text-2xl font-serif text-foreground z-10 relative">
            {finalLabels.title}
          </h3>
        </div>
      </div>

      {/* Questions List */}
      <div className="space-y-4">
        {questions.map((q, index) => (
          <div key={index} className="relative overflow-hidden z-10 bg-white/60 dark:bg-white/[0.03] backdrop-blur-2xl border-[0.5px] border-black/5 dark:border-white/10 rounded-xl p-4 md:p-5 shadow-sm">
            {/* Proportional Ghost Watermark Small */}
            <div className="absolute -top-3 -left-2 text-[5rem] font-black pointer-events-none select-none opacity-[0.08] dark:opacity-[0.05] z-0 text-slate-900 dark:text-white leading-none">
              {index + 1}
            </div>

            <div className="relative z-10 space-y-4">
              <h4 className="text-lg font-semibold text-foreground leading-tight">
                {q.question}
              </h4>

              <div className="space-y-4 pt-1">
                <div className="space-y-1.5 bg-white/30 dark:bg-white/[0.01] border-[0.5px] border-black/5 dark:border-white/10 rounded-lg p-3 md:p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-muted-foreground mb-1 uppercase">
                    <Flag className="h-3 w-3 text-stone-400" />
                    <span>{finalLabels.askIntent}</span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium text-pretty">
                    {q.ask_intent}
                  </p>
                </div>

                <div className="space-y-1.5 bg-match-highlight/[0.05] dark:bg-match-highlight/[0.02] border-l-2 border-match-dot rounded-r-lg p-3 md:p-4">
                  <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-match-text mb-1 uppercase">
                    <Ear className="h-3 w-3" />
                    <span>{finalLabels.listenFor}</span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium text-pretty">
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
