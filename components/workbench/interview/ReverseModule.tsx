// Server Component - Pure presentation, no interactivity
import React from 'react'
import { Ear, Flag } from 'lucide-react'
import { cn } from '@/lib/utils'

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

  const getAccentDotColor = () => {
    switch (themeColor) {
      case 'emerald':
        return 'bg-emerald-400/70 dark:bg-emerald-500/40'
      case 'amber':
        return 'bg-amber-400/70 dark:bg-amber-500/40'
      case 'rose':
        return 'bg-rose-400/70 dark:bg-rose-500/40'
      default:
        return 'bg-emerald-400/70 dark:bg-emerald-500/40'
    }
  }

  const getAccentTextColor = () => {
    switch (themeColor) {
      case 'emerald':
        return 'text-emerald-600/80 dark:text-emerald-300'
      case 'amber':
        return 'text-amber-600/80 dark:text-amber-300'
      case 'rose':
        return 'text-rose-600/80 dark:text-rose-300'
      default:
        return 'text-emerald-600/80 dark:text-emerald-300'
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

  if (!questions || questions.length === 0) {
    return null
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Section Header - M9 Style with subtle highlight */}
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

      {/* Questions List - Clean timeline style */}
      <div className="space-y-2">
        {questions.map((q, index) => (
          <div key={index} className="relative pt-1 pb-6 last:pb-0">
            <span
              className={cn(
                'absolute -left-4 -top-3 text-3xl font-semibold tabular-nums select-none pointer-events-none',
                getWatermarkColor(),
              )}
            >
              {index + 1}
            </span>
            <div className="space-y-3 pb-2">
              <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100 leading-relaxed">
                {q.question}
              </h4>

              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-slate-500">
                    <Flag className={cn('h-3 w-3', getAccentTextColor())} />
                    <span className="uppercase">{finalLabels.askIntent}</span>
                  </div>
                  <p className="text-sm text-slate-900/80 dark:text-slate-300 leading-relaxed">
                    {q.ask_intent}
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-slate-500">
                    <Ear className={cn('h-3 w-3', getAccentTextColor())} />
                    <span className="uppercase">{finalLabels.listenFor}</span>
                  </div>
                  <p className="text-sm text-slate-900/80 dark:text-slate-300 leading-relaxed">
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
