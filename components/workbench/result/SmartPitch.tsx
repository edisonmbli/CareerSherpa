'use client'

import React, { useState } from 'react'
import { cn, getMatchThemeClass } from '@/lib/utils'
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

export function SmartPitch({
  script,
  themeColor = 'slate',
  labels,
}: SmartPitchProps) {
  const [isCopied, setIsCopied] = useState(false)
  const matchThemeClass = getMatchThemeClass(themeColor)
  const styles = {
    highlight: 'bg-match-highlight',
    text: 'text-match-text',
    border: 'border-match-border',
  }

  const handleCopy = () => {
    const clean = script.replace(/[【\[][HVC][】\]]/g, '').trim()
    navigator.clipboard.writeText(clean)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  const renderAnnotatedText = (text: string) => {
    const parts = text.split(/([【\[][HVC][】\]])/g)

    return (
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-stone-800 dark:text-stone-200 font-[family-name:var(--font-noto-serif),serif]">
        {parts.map((part, i) => {
          const isTag = part.match(/^[【\[][HVC][】\]]$/)

          if (isTag) {
            const tagCode = part.includes('H')
              ? 'H'
              : part.includes('V')
                ? 'V'
                : 'C'
            const tagText =
              tagCode === 'H' ? 'HOOK' : tagCode === 'V' ? 'VALUE' : 'CTA'

            // Unified Magazine Style: Match AnalysisAccordion "Resume Tweak" style
            // Structure: Opacity Container -> Icon (Dot) -> Text
            return (
              <span
                key={i}
                className="inline-flex items-center gap-1 opacity-80 hover:opacity-100 transition-opacity mx-1.5 align-text-bottom translate-y-[-1px]"
              >
                <span
                  className={cn(
                    'text-[9px] font-bold tracking-widest uppercase select-none',
                    styles.text,
                  )}
                >
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

  const scriptLines = script
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  return (
    <div className={cn('w-full group', matchThemeClass)}>
      {/* Header Row - Matches AnalysisAccordion (Half-Highlight Style) */}
      <div className="flex items-center w-full mb-6 pl-2">
        <div className="flex-1 flex items-center justify-between">
          {/* Title Container with Highlight */}
          <div className="relative inline-block ml-0">
            {/* Highlight Block (Background) */}
            <div
              className={cn(
                'absolute bottom-4 -left-4 w-24 h-5 -z-10',
                styles.highlight,
              )}
            />

            {/* Title Text (Foreground) */}
            <span className="font-[family-name:var(--font-playfair),serif] text-[22px] leading-[30px] font-bold text-stone-900 dark:text-stone-50 tracking-tight z-10 relative">
              {labels?.title || 'Smart Pitch'}
            </span>
          </div>

          {/* Action Area */}
          <div className="flex items-center gap-3">
            {/* Success Message (Side) */}
            <span
              className={cn(
                'text-xs text-stone-600/50 dark:text-stone-400/80 font-base transition-all duration-300',
                isCopied
                  ? 'opacity-100 translate-x-0'
                  : 'opacity-0 translate-x-4 pointer-events-none',
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
                    className="h-8 w-8 p-0 rounded-full text-stone-400 hover:text-stone-900 dark:text-stone-500 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                    onClick={handleCopy}
                  >
                    {isCopied ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-xs text-xs">
                  <p className="font-semibold mb-1 opacity-70 border-b border-stone-200 dark:border-stone-800 pb-1 mb-2">
                    {labels?.definitions?.structure || 'Structure:'}
                  </p>
                  <ul className="space-y-1.5 list-none text-stone-600 dark:text-stone-400">
                    <li>
                      <span className="font-semibold text-stone-900 dark:text-stone-100 inline-block w-4">
                        H
                      </span>
                      {labels?.smartPitchDefs?.hook || 'Hook: Grab attention'}
                    </li>
                    <li>
                      <span className="font-semibold text-stone-900 dark:text-stone-100 inline-block w-4">
                        V
                      </span>
                      {labels?.smartPitchDefs?.value || 'Value: Showcase fit'}
                    </li>
                    <li>
                      <span className="font-semibold text-stone-900 dark:text-stone-100 inline-block w-4">
                        C
                      </span>
                      {labels?.smartPitchDefs?.cta || 'CTA: Call-to-Action'}
                    </li>
                  </ul>
                  <p className="mt-2 text-[10px] text-stone-400 border-t border-stone-200 dark:border-stone-800 pt-1.5 opacity-60">
                    {labels?.definitions?.clickToCopy || 'Click to copy text'}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>
      {/* Content Row */}
      <div className="space-y-2">
        {scriptLines.map((line, index) => (
          <div key={`${line}-${index}`} className="relative">
            <div className="py-1.5">{renderAnnotatedText(line)}</div>
          </div>
        ))}
      </div>
      {/* This closes the "Content Row" div */}
      {/* Mobile Legend (Guide) */}
      <div className="md:hidden mt-4 pt-3 border-t border-stone-200/50 dark:border-stone-800/50">
        <div className="flex justify-center gap-2">
          {[
            {
              label: 'H',
              text: labels?.smartPitchDefs?.hook || 'Hook: Grab attention',
            },
            {
              label: 'V',
              text: labels?.smartPitchDefs?.value || 'Value: Showcase fit',
            },
            {
              label: 'C',
              text: labels?.smartPitchDefs?.cta || 'CTA: Call-to-Action',
            },
          ].map((item, idx) => (
            <div
              key={idx}
              className="flex  gap-2 text-[10px] leading-relaxed text-stone-500 dark:text-stone-400"
            >
              <span
                className={cn(
                  'font-bold text-stone-900 dark:text-stone-200 min-w-[1.5ch] mt-[1px]',
                  // Use theme color for the letter to link back to tags
                  styles.text,
                )}
              >
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
