'use client'

import React from 'react'
import { BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

interface KnowledgeTopic {
  topic: string
  key_points: string[]
  relevance: string
}

interface KnowledgeRefreshModuleProps {
  topics: KnowledgeTopic[]
  themeColor?: 'emerald' | 'amber' | 'rose'
  labels?: {
    title?: string
  }
  className?: string
}

const defaultLabels = {
  title: '知识补课',
}

export function KnowledgeRefreshModule({
  topics,
  themeColor = 'emerald',
  labels = defaultLabels,
  className,
}: KnowledgeRefreshModuleProps) {
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

  if (!topics || topics.length === 0) {
    return null
  }

  return (
    <div className={cn('relative overflow-hidden rounded-xl bg-stone-50 dark:bg-stone-900/40 border border-slate-200/60 dark:border-white/10 shadow-sm backdrop-blur-sm', className)}>
      <BookOpen className="absolute top-4 right-4 w-24 h-24 text-slate-900/5 dark:text-slate-100/5 rotate-6 pointer-events-none" />
      <div className="relative z-10 p-5 md:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="relative inline-block">
            <div
              className={cn(
                'absolute bottom-4 -left-4 w-20 h-5 -z-10',
                getHighlightColor(),
              )}
            />
            <h4 className="text-2xl font-bold text-slate-900 dark:text-slate-50 tracking-tight relative">
              {finalLabels.title}
            </h4>
          </div>
          <span className={cn('text-xs', getAccentTextColor())}>
            {topics.length}
          </span>
        </div>
        <div className="space-y-6">
          {topics.map((topic, index) => (
            <div key={index} className="space-y-3">
              <h5 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {topic.topic}
              </h5>
              <p className="text-sm text-slate-600/60 dark:text-slate-300 pl-3 border-l-2 border-slate-200 dark:border-slate-700 leading-relaxed">
                {topic.relevance}
              </p>
              <ul className="space-y-2">
                {topic.key_points.map((point, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-sm text-slate-900/80 dark:text-slate-300"
                  >
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full shrink-0 mt-[0.45em]',
                        getAccentDotColor(),
                      )}
                    />
                    <span className="leading-relaxed">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
