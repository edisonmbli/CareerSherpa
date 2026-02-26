'use client'

import React from 'react'
import ReactMarkdown from 'react-markdown'
import { Sparkles } from 'lucide-react'
import { cn, getMatchThemeClass } from '@/lib/utils'

interface ExpertVerdictProps {
  content: string
  label?: string
  themeColor?: string
}

export function ExpertVerdict({ content, label, themeColor = 'slate' }: ExpertVerdictProps) {
  if (!content) return null

  const matchThemeClass = getMatchThemeClass(themeColor)

  return (
    <div className={cn("relative mt-2 md:mt-4 bg-slate-500/[0.04] dark:bg-white/[0.02] rounded-xl p-5 sm:p-6 md:p-8 border border-black/5 dark:border-white/5 overflow-hidden", matchThemeClass)}>
      {/* Abstract Watermark - Massive Quotes */}
      <div className="absolute -top-6 -left-2 text-[120px] md:text-[140px] lg:text-[160px] font-serif leading-none text-stone-900/[0.03] dark:text-white/[0.05] select-none font-[family-name:var(--font-playfair),serif] pointer-events-none z-0">
        &ldquo;
      </div>

      <div className="relative z-10 w-full">
        {/* Kicker - Identity Label */}
        <div className="flex items-center gap-1.5 mb-3 md:mb-4 opacity-90">
          <Sparkles className="w-[11px] h-[11px] md:w-3 md:h-3 text-match-text" />
          <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-match-text">
            {label || 'EXPERT VERDICT'}
          </span>
        </div>

        {/* Content - Executive Summarization Typography */}
        <div className="prose max-w-none dark:prose-invert">
          <ReactMarkdown
            components={{
              p: ({ node, ...props }) => (
                <p
                  className="font-[family-name:var(--font-noto-serif),serif] text-[13px] md:text-sm leading-[1.7] text-pretty text-slate-700 dark:text-slate-300"
                  {...props}
                />
              ),
              strong: ({ ...props }) => (
                <span
                  className="font-semibold text-slate-900 dark:text-white underline decoration-slate-300/50 dark:decoration-white/10 decoration-2 underline-offset-[4px]"
                  {...props}
                />
              ),
              div: ({ ...props }) => (
                <div className="first:mt-0 last:mb-0" {...props} />
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
