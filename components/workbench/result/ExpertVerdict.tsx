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
    <div className="relative overflow-hidden rounded-lg sm:rounded-xl bg-stone-50 dark:bg-white/[0.02] border border-stone-200/60 dark:border-white/10 shadow-sm backdrop-blur-sm">
      {/* Quote Watermark - Replaces Noise Texture */}
      <Quote className="absolute -top-4 -left-4 w-24 h-24 text-stone-900/5 dark:text-white/5 rotate-180 z-0 pointer-events-none" />

      {/* Left Accent Bar - Removed for V5 Monochrome */}
      {/* <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 to-indigo-600 dark:from-indigo-400 dark:to-indigo-500" /> */}

      <div className="relative z-10 p-5 md:p-6">
        {/* Content - Serif Lead Paragraph with Drop Cap styling simulation */}
        <div className="prose prose-lg max-w-none dark:prose-invert relative z-10">
          {/* Custom Markdown Components for Typography */}
          <ReactMarkdown
            components={{
              p: ({ node, ...props }) => (
                <p
                  className="font-[family-name:var(--font-noto-serif),serif] text-xs md:text-sm leading-relaxed text-stone-700 dark:text-slate-300 first-letter:float-left first-letter:text-4xl first-letter:font-bold first-letter:mr-2 first-letter:mt-0.5 first-letter:text-stone-900/40 dark:first-letter:text-white/20 first-letter:font-[family-name:var(--font-playfair),serif]"
                  {...props}
                />
              ),
              strong: ({ node, ...props }) => (
                <span
                  className="font-medium text-stone-900 dark:text-white bg-stone-100 dark:bg-white/10 px-1 rounded mx-0.5 box-decoration-clone border border-stone-200 dark:border-white/5"
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
          <div className="h-px w-16 bg-stone-900 dark:bg-white/40" />
        </div>
      </div>
    </div>
  )
}
