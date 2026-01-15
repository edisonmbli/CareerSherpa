'use client'

import React from 'react'
import ReactMarkdown from 'react-markdown'
import { Quote } from 'lucide-react'

interface ExpertVerdictProps {
  content: string
  label?: string
}

export function ExpertVerdict({ content, label }: ExpertVerdictProps) {
  if (!content) return null

  return (
    <div className="relative overflow-hidden rounded-xl bg-stone-50 dark:bg-stone-900/40 border border-slate-200/60 dark:border-white/10 shadow-sm backdrop-blur-sm">
      {/* Decorative Background - Paper Texture */}
      <div
        className="absolute inset-0 opacity-[0.15] dark:opacity-[0.1] pointer-events-none z-0 mix-blend-multiply dark:mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
        }}
      />

      {/* Left Accent Bar - Removed for V5 Monochrome */}
      {/* <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 to-indigo-600 dark:from-indigo-400 dark:to-indigo-500" /> */}

      <div className="relative z-10 p-5 md:p-6">
        {/* Header Label - Removed as part of V8 Polish (Quote Icon is now background watermark) */}

        {/* Quote Watermark */}
        <Quote className="absolute -top-2 -left-2 w-16 h-16 md:w-20 md:h-20 text-slate-900/5 dark:text-slate-100/5 rotate-180 z-0" />

        {/* Content - Serif Lead Paragraph with Drop Cap styling simulation */}
        <div className="prose prose-lg max-w-none dark:prose-invert relative z-10">
          {/* Custom Markdown Components for Typography */}
          <ReactMarkdown
            components={{
              p: ({ node, ...props }) => (
                <p
                  className="font-[family-name:var(--font-noto-serif),serif] text-xs md:text-sm leading-relaxed text-slate-700 dark:text-slate-200 first-letter:float-left first-letter:text-4xl first-letter:font-bold first-letter:mr-2 first-letter:mt-0.5 first-letter:text-slate-900/40 dark:first-letter:text-slate-100/40 first-letter:font-[family-name:var(--font-playfair),serif]"
                  {...props}
                />
              ),
              strong: ({ node, ...props }) => (
                <span
                  className="font-medium text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-1 rounded mx-0.5 box-decoration-clone border border-slate-200 dark:border-slate-700/50"
                  {...props}
                />
              ),
              // Remove default margins for cleaner layout
              div: ({ node, ...props }) => (
                <div className="first:mt-0 last:mb-0" {...props} />
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        </div>

        {/* Signature / Footer decoration */}
        <div className="mt-4 flex justify-end opacity-40">
          <div className="h-px w-16 bg-slate-900 dark:bg-slate-100" />
        </div>
      </div>
    </div>
  )
}
