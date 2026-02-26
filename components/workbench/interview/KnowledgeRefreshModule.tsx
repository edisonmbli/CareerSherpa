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
    <div className={cn('space-y-6', matchThemeClass, className)}>
      {/* Section Header */}
      <div className="flex items-center w-full mb-6 relative pl-2">
        <div className={cn('relative ml-0 border-l-[3px] pl-3 py-0.5', 'border-match-dot')}>
          <h3 className="text-2xl font-serif text-foreground z-10 relative">
            {finalLabels.title}
          </h3>
        </div>
      </div>
      {/* Knowledge Topics */}
      <div className="space-y-4">
        {topics.map((topic, index) => (
          <div key={index} className="relative overflow-hidden z-10 bg-white/60 dark:bg-white/[0.03] backdrop-blur-2xl border-[0.5px] border-black/5 dark:border-white/10 rounded-xl p-4 md:p-5 shadow-sm">
            {/* Proportional Ghost Watermark Small */}
            <div className="absolute -top-3 -left-2 text-[5rem] font-black pointer-events-none select-none opacity-[0.08] dark:opacity-[0.05] z-0 text-slate-900 dark:text-white leading-none">
              {index + 1}
            </div>

            <div className="relative z-10 space-y-4">
              <h4 className="text-lg font-semibold text-foreground leading-tight">
                {topic.topic}
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-400 pl-3 border-l-2 border-match-dot leading-relaxed">
                {topic.relevance}
              </p>
              <ul className="space-y-2">
                {topic.key_points.map((point, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300"
                  >
                    <span className="h-1.5 w-1.5 rounded-full shrink-0 mt-[0.55em] border bg-transparent border-match-dot" />
                    <span className="leading-relaxed">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
