'use client'

import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Copy, Check, Sparkles, Info } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface SmartPitchProps {
  script: string
  themeColor?: string
  labels?: {
    title?: string
    copy?: string
    copied?: string
    copyTooltip?: string
    cleanCopied?: string
    definitions?: {
      structure?: string
      clickToCopy?: string
    }
    smartPitchDefs?: {
      hook?: string
      value?: string
      cta?: string
    }
  }
}

export function SmartPitch({ script, themeColor = 'slate', labels }: SmartPitchProps) {
  const [isCopied, setIsCopied] = useState(false)

  // Theme Logic
  const getThemeStyles = (color: string) => {
    switch (color) {
      case 'emerald':
        return {
          block: 'bg-emerald-500 shadow-emerald-500/20',
          accent: 'bg-emerald-500',
          text: 'text-emerald-600 dark:text-emerald-400',
          border: 'border-emerald-500/20',
        }
      case 'amber':
        return {
          block: 'bg-amber-500 shadow-amber-500/20',
          accent: 'bg-amber-500',
          text: 'text-amber-600 dark:text-amber-400',
          border: 'border-amber-500/20',
        }
      case 'rose':
        return {
          block: 'bg-rose-500 shadow-rose-500/20',
          accent: 'bg-rose-500',
          text: 'text-rose-600 dark:text-rose-400',
          border: 'border-rose-500/20',
        }
      default:
        return {
          block: 'bg-slate-500',
          accent: 'bg-slate-500',
          text: 'text-slate-600 dark:text-slate-400',
          border: 'border-slate-500/20',
        }
    }
  }
  const styles = getThemeStyles(themeColor)


  const handleCopy = () => {
    const clean = script.replace(/[【\[][HVC][】\]]/g, '').trim()
    navigator.clipboard.writeText(clean)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  const renderAnnotatedText = (text: string) => {
    const parts = text.split(/([【\[][HVC][】\]])/g)

    return (
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300 font-sans">
        {parts.map((part, i) => {
          const isTag = part.match(/^[【\[][HVC][】\]]$/)

          if (isTag) {
            const tagCode = part.includes('H') ? 'H' : part.includes('V') ? 'V' : 'C'
            const tagText = tagCode === 'H' ? 'HOOK' : tagCode === 'V' ? 'VALUE' : 'CTA'

            // Unified Magazine Style: Match AnalysisAccordion "Resume Tweak" style
            // Structure: Opacity Container -> Icon (Dot) -> Text
            return (
              <span
                key={i}
                className="inline-flex items-center gap-1 opacity-80 hover:opacity-100 transition-opacity mx-1.5 align-text-bottom translate-y-[-1px]"
              >
                <span className={cn(
                  "text-[9px] font-bold tracking-widest uppercase select-none",
                  styles.text
                )}>
                  {tagText}
                </span>
              </span>
            )
          }

          if (!part) return null
          return <span key={i}>{part}</span>
        })}
      </div>
    )
  }

  return (
    <div className="w-full group">
      {/* Header Row - Matches AnalysisAccordion */}
      <div className="flex items-center gap-4 w-full mb-4">
        {/* Magazine Style: Double Layer Offset Block */}
        <div className="relative w-10 h-10 shrink-0 mr-2 group/block">
          {/* Back Layer: Solid Theme Color */}
          <div className={cn(
            "absolute inset-0 translate-x-1 translate-y-1 rounded-sm transition-transform group-hover/block:translate-x-1.5 group-hover/block:translate-y-1.5",
            styles.accent
          )} />
          {/* Front Layer: White with Border */}
          <div className={cn(
            "absolute inset-0 bg-white dark:bg-slate-900 border flex items-center justify-center rounded-sm z-10",
            styles.border
          )}>
            <Sparkles className={cn("w-4 h-4", styles.text)} />
          </div>
        </div>

        {/* Title */}
        <div className="flex-1 flex items-center justify-between">
          <span className="font-[family-name:var(--font-playfair),serif] text-base font-medium text-slate-900 dark:text-slate-100 tracking-tight z-10">
            {labels?.title || 'Smart Pitch'}
          </span>

          {/* Action Area */}
          <div className="flex items-center gap-3">
            {/* Success Message (Side) */}
            <span
              className={cn(
                "text-xs text-slate-600/50 dark:text-slate-400/80 font-base transition-all duration-300",
                isCopied ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4 pointer-events-none"
              )}
            >
              {labels?.cleanCopied || 'Clean text copied'}
            </span>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 rounded-full text-slate-400 hover:text-slate-900 dark:text-slate-500 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    onClick={handleCopy}
                  >
                    {isCopied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-xs text-xs">
                  <p className="font-semibold mb-1 opacity-70 border-b border-slate-200 dark:border-slate-800 pb-1 mb-2">
                    {labels?.definitions?.structure || 'Structure:'}
                  </p>
                  <ul className="space-y-1.5 list-none text-slate-600 dark:text-slate-400">
                    <li>
                      <span className="font-semibold text-slate-900 dark:text-slate-100 inline-block w-4">H</span>
                      {labels?.smartPitchDefs?.hook || 'Hook: Grab attention'}
                    </li>
                    <li>
                      <span className="font-semibold text-slate-900 dark:text-slate-100 inline-block w-4">V</span>
                      {labels?.smartPitchDefs?.value || 'Value: Showcase fit'}
                    </li>
                    <li>
                      <span className="font-semibold text-slate-900 dark:text-slate-100 inline-block w-4">C</span>
                      {labels?.smartPitchDefs?.cta || 'CTA: Call-to-Action'}
                    </li>
                  </ul>
                  <p className="mt-2 text-[10px] text-slate-400 border-t border-slate-200 dark:border-slate-800 pt-1.5 opacity-60">
                    {labels?.definitions?.clickToCopy || 'Click to copy text'}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>

      {/* Content Row */}
      <div className="relative">
        {/* Vertical Guide Line - Monochrome - Aligned with gutter */}
        <div className="absolute left-[3px] top-0 bottom-0 w-px bg-slate-200/50 dark:bg-slate-800/50" />

        <div className="relative pl-4">
          {/* Plain Text Container (No Bubble) */}
          <div className="relative py-2">
            {renderAnnotatedText(script)}
          </div>
        </div>
      </div> {/* This closes the "Content Row" div */}
      {/* Mobile Legend (Guide) */}
      <div className="md:hidden mt-4 pt-3 border-t border-slate-200/50 dark:border-slate-800/50">
        <div className="flex justify-center gap-2">
          {[
            { label: 'H', text: labels?.smartPitchDefs?.hook || 'Hook: Grab attention' },
            { label: 'V', text: labels?.smartPitchDefs?.value || 'Value: Showcase fit' },
            { label: 'C', text: labels?.smartPitchDefs?.cta || 'CTA: Call-to-Action' }
          ].map((item, idx) => (
            <div key={idx} className="flex  gap-2 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
              <span className={cn(
                "font-bold text-slate-900 dark:text-slate-200 min-w-[1.5ch] mt-[1px]",
                // Use theme color for the letter to link back to tags
                styles.text
              )}>
                {item.label}
              </span>
              <span className="opacity-80">{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
