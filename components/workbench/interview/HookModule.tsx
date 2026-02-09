'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

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

  const getBadgeStyle = () => {
    return 'bg-slate-100/80 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700/60'
  }

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
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Section Title */}
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

      {/* P-P-F Script Card */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {finalLabels.ppfScript}
          </h4>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCopy}
            className="gap-1.5 h-7 text-xs"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
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

        {/* Script Content - Clean monospace block */}
        <div className="rounded-md bg-slate-50/80 dark:bg-stone-900/40 border border-slate-200/70 dark:border-stone-800/70 p-4">
          <p className="text-sm leading-relaxed whitespace-pre-wrap font-mono text-slate-700 dark:text-slate-300">
            {ppf_script}
          </p>
        </div>
      </div>

      {/* Key Hooks - Subtle list */}
      {key_hooks && key_hooks.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {finalLabels.keyHooks}
          </h4>
          <div className="space-y-3">
            {key_hooks.map((hook, index) => (
              <div key={index} className="flex items-start gap-3">
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full shrink-0 mt-[0.45em]',
                    getAccentDotColor(),
                  )}
                />
                <p className="text-sm font-normal text-slate-900/80 dark:text-slate-100 leading-relaxed">
                  {hook.hook}
                  <span
                    className={cn(
                      'ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium align-middle',
                      getBadgeStyle(),
                    )}
                  >
                    {finalLabels.evidenceSource}:{' '}
                    {formatEvidenceSource(hook.evidence_source)}
                  </span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delivery Tips - Clean numbered list */}
      {delivery_tips && delivery_tips.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {finalLabels.deliveryTips}
          </h4>
          <div className="space-y-3">
            {delivery_tips.map((tip, index) => (
              <div key={index} className="flex items-start gap-3 text-sm">
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full shrink-0 mt-[0.45em]',
                    getAccentDotColor(),
                  )}
                />
                <span className="text-slate-900/80 dark:text-slate-300 leading-relaxed flex-1">
                  {tip}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
