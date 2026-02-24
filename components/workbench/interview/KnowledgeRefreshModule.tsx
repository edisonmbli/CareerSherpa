'use client'

import React from 'react'
import { BookOpen } from 'lucide-react'
import { cn, getMatchThemeClass } from '@/lib/utils'

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
  const matchThemeClass = getMatchThemeClass(themeColor)

  if (!topics || topics.length === 0) {
    return null
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg sm:rounded-xl bg-stone-50 dark:bg-white/[0.02] border border-stone-200/60 dark:border-white/5 shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-sm',
        matchThemeClass,
        className,
      )}
    >
      <BookOpen className="absolute top-4 right-4 w-24 h-24 text-stone-900/5 dark:text-stone-100/5 rotate-6 pointer-events-none" />
      <div className="relative z-10 p-5 md:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="relative inline-block">
            <div className="absolute bottom-4 -left-4 w-24 h-5 -z-10 bg-match-highlight" />
            <h4 className="text-[22px] leading-[30px] font-bold font-[family-name:var(--font-playfair),serif] text-stone-900 dark:text-white tracking-tight relative">
              {finalLabels.title}
            </h4>
          </div>
          <span className="text-xs text-match-text">{topics.length}</span>
        </div>
        <div className="space-y-6">
          {topics.map((topic, index) => (
            <div key={index} className="space-y-3">
              <h5 className="text-base font-semibold text-stone-900 dark:text-white">
                {topic.topic}
              </h5>
              <p className="text-sm text-stone-600/80 dark:text-slate-300 pl-3 border-l-2 border-stone-200 dark:border-white/10 leading-relaxed">
                {topic.relevance}
              </p>
              <ul className="space-y-2">
                {topic.key_points.map((point, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-sm text-stone-900/80 dark:text-slate-300"
                  >
                    <span className="h-1.5 w-1.5 rounded-full shrink-0 mt-[0.55em] border bg-transparent border-match-dot" />
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
