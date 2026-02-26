'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Copy, Check, FileText } from 'lucide-react'
import { cn, getMatchThemeClass } from '@/lib/utils'
import { uiLog } from '@/lib/ui/sse-debug-logger'

interface KeyHook {
  hook: string
  evidence_source: string
}

interface HookModuleProps {
  ppf_script: string
  key_hooks: KeyHook[]
  delivery_tips: string[]
  themeColor?: 'emerald' | 'amber' | 'rose'
  labels?: {
    title?: string
    ppfScript?: string
    keyHooks?: string
    deliveryTips?: string
    copy?: string
    copied?: string
    evidenceSource?: string
  }
  className?: string
}

const defaultLabels = {
  title: '开场定调',
  ppfScript: 'P-P-F 自我介绍脚本',
  keyHooks: '关键钩子',
  deliveryTips: '演讲技巧',
  copy: '复制',
  copied: '已复制',
  evidenceSource: '来源',
}

export function HookModule({
  ppf_script,
  key_hooks,
  delivery_tips,
  themeColor = 'emerald',
  labels = defaultLabels,
  className,
}: HookModuleProps) {
  const finalLabels = { ...defaultLabels, ...labels }
  const [copied, setCopied] = useState(false)
  const matchThemeClass = getMatchThemeClass(themeColor)

  const formatEvidenceSource = (source: string) => {
    const normalized = (source || '').toLowerCase().replace(/\s+/g, '_')
    const isZh = /[\u4e00-\u9fa5]/.test(finalLabels.evidenceSource || '')
    if (normalized.includes('detail')) {
      return isZh ? '详细履历' : 'Detail Resume'
    }
    if (normalized.includes('resume')) {
      return isZh ? '简历' : 'Resume'
    }
    return source
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(ppf_script)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      uiLog.error('copy_failed', {
        error: err instanceof Error ? err.message : String(err),
      })
    }
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

      {/* P-P-F Script Card */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pl-1">
          <h4 className="text-lg font-semibold text-foreground dark:text-white tracking-wide">
            {finalLabels.ppfScript}
          </h4>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCopy}
            className="gap-1.5 h-7 text-xs text-muted-foreground hover:text-foreground"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                {finalLabels.copied}
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                {finalLabels.copy}
              </>
            )}
          </Button>
        </div>

        {/* Script Content - Teleprompter Inset Block (Glassmorphism) */}
        <div className="bg-white/60 dark:bg-white/[0.03] backdrop-blur-2xl border-[0.5px] border-black/5 dark:border-white/10 rounded-xl p-5 md:p-6 overflow-hidden">
          <p className="font-[family-name:var(--font-noto-serif),serif] text-[13px] md:text-sm leading-[1.8] text-pretty text-slate-700 dark:text-slate-300 relative z-10 whitespace-pre-wrap">
            {ppf_script}
          </p>
        </div>
      </div>

      {/* Key Hooks */}
      {key_hooks && key_hooks.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-foreground pl-1">
            {finalLabels.keyHooks}
          </h4>
          <div className="space-y-4">
            {key_hooks.map((hook, index) => (
              <div key={index} className="relative overflow-hidden z-10 bg-white/60 dark:bg-white/[0.03] backdrop-blur-2xl border-[0.5px] border-black/5 dark:border-white/10 rounded-xl p-4 md:p-5 shadow-sm">
                {/* Proportional Ghost Watermark Small */}
                <div className="absolute -top-3 -left-2 text-[5rem] font-black pointer-events-none select-none opacity-[0.06] dark:opacity-[0.05] z-0 text-slate-900 dark:text-white leading-none">
                  {index + 1}
                </div>
                <div className="relative z-10 flex items-start gap-4">
                  <span className="h-1.5 w-1.5 rounded-full shrink-0 mt-[0.6em] border bg-transparent border-match-dot" />
                  <p className="text-sm font-normal text-slate-600 dark:text-slate-400 leading-relaxed flex-1">
                    {hook.hook}
                    <span className="ml-2 mt-[1px] inline-flex items-start gap-1 align-middle opacity-90 transition-opacity">
                      <FileText className="w-3.5 h-3.5 shrink-0 mt-[1px] text-muted-foreground" />
                      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground text-left">
                        {formatEvidenceSource(hook.evidence_source)}
                      </span>
                    </span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delivery Tips - Clean numbered list */}
      {delivery_tips && delivery_tips.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-foreground pl-1">
            {finalLabels.deliveryTips}
          </h4>
          <div className="relative overflow-hidden z-10 bg-white/60 dark:bg-white/[0.03] backdrop-blur-2xl border-[0.5px] border-black/5 dark:border-white/10 rounded-xl p-4 md:p-5 shadow-sm">
            <div className="space-y-3">
              {delivery_tips.map((tip, index) => (
                <div key={index} className="flex items-start gap-3 text-sm">
                  <span className="h-1.5 w-1.5 rounded-full shrink-0 mt-[0.55em] border bg-transparent border-match-dot" />
                  <span className="text-slate-600 dark:text-slate-400 leading-relaxed flex-1">
                    {tip}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
