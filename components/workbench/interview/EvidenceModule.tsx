'use client'

import React from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

interface StarStory {
  story_title: string
  matched_pain_point: string
  star: {
    situation: string
    task: string
    action: string
    result: string
  }
  quantified_impact: string
  source: 'resume' | 'detailed_resume'
}

interface EvidenceModuleProps {
  stories: StarStory[]
  themeColor?: 'emerald' | 'amber' | 'rose'
  labels?: {
    title?: string
    situation?: string
    task?: string
    action?: string
    result?: string
    impact?: string
    storyTitle?: string
    storyLabel?: string
    storyCount?: string
    matchedPainPoint?: string
    source?: string
    sourceResume?: string
    sourceDetailedResume?: string
  }
  className?: string
}

const defaultLabels = {
  title: '核心论据',
  situation: '背景',
  task: '任务',
  action: '行动',
  result: '结果',
  impact: '量化影响',
  storyTitle: '故事标题',
  storyLabel: '故事',
  storyCount: '{count} 个故事',
  matchedPainPoint: '对应 JD 痛点',
  source: '来源',
  sourceResume: '简历',
  sourceDetailedResume: '详细履历',
}

export function EvidenceModule({
  stories,
  themeColor = 'emerald',
  labels = defaultLabels,
  className,
}: EvidenceModuleProps) {
  const finalLabels = { ...defaultLabels, ...labels }

  const formatLabel = (
    template: string,
    vars: Record<string, string | number>,
  ) => template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ''))

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

  const getAccentBorderColor = () => {
    switch (themeColor) {
      case 'emerald':
        return 'data-[state=active]:border-emerald-600'
      case 'amber':
        return 'data-[state=active]:border-amber-600'
      case 'rose':
        return 'data-[state=active]:border-rose-600'
      default:
        return 'data-[state=active]:border-emerald-600'
    }
  }

  if (!stories || stories.length === 0) {
    return null
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Section Title */}
      <div className="flex items-center gap-3">
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
        <span className={cn('text-xs font-medium', getAccentTextColor())}>
          {formatLabel(finalLabels.storyCount, { count: stories.length })}
        </span>
      </div>

      <Tabs defaultValue="0" className="w-full">
        <TabsList className="w-full inline-flex justify-start bg-transparent p-0 border-b border-slate-200/70 dark:border-slate-800/70 print:hidden">
          {stories.map((story, index) => (
            <TabsTrigger
              key={index}
              value={String(index)}
              className={cn(
                'text-xs px-3 py-2 rounded-none data-[state=active]:text-slate-900 dark:data-[state=active]:text-slate-50 data-[state=active]:border-b-2',
                getAccentBorderColor(),
              )}
            >
              {finalLabels.storyLabel || finalLabels.storyTitle} {index + 1}
            </TabsTrigger>
          ))}
        </TabsList>

        {stories.map((story, index) => (
          <TabsContent
            key={index}
            value={String(index)}
            className="mt-4 space-y-4 print:hidden"
          >
            <div className="md:hidden rounded-lg border border-slate-200/70 dark:border-stone-800/70 bg-white/70 dark:bg-stone-900/40 p-3 space-y-3">
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {finalLabels.storyTitle}
                </p>
                <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {story.story_title}
                </h4>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="text-slate-500 dark:text-slate-500">
                    {finalLabels.source}:{' '}
                    <span className="text-slate-700 dark:text-slate-300">
                      {story.source === 'resume'
                        ? finalLabels.sourceResume
                        : finalLabels.sourceDetailedResume}
                    </span>
                  </span>
                  {story.quantified_impact && (
                    <>
                      <span className="text-slate-300 dark:text-slate-700">
                        •
                      </span>
                      <span className="text-slate-700 dark:text-slate-300 font-medium">
                        {story.quantified_impact}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {story.matched_pain_point && (
                <div className="space-y-1 rounded-lg p-3 bg-stone-400/10 dark:bg-stone-800/60">
                  <p
                    className={cn(
                      'text-[11px] font-semibold uppercase tracking-[0.18em]',
                      getAccentTextColor(),
                    )}
                  >
                    {finalLabels.matchedPainPoint}
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    {story.matched_pain_point}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <span className="w-4 text-[11px] font-semibold text-slate-400 pt-[2px]">
                    S
                  </span>
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    {story.star.situation}
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 text-[11px] font-semibold text-slate-400 pt-[2px]">
                    T
                  </span>
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    {story.star.task}
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 text-[11px] font-semibold text-slate-400 pt-[2px]">
                    A
                  </span>
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    {story.star.action}
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 text-[11px] font-semibold text-slate-400 pt-[2px]">
                    R
                  </span>
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    {story.star.result}
                  </p>
                </div>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="rounded-xl border border-slate-200/70 dark:border-stone-800/70 bg-white/70 dark:bg-stone-900/40 p-4 space-y-4 print:break-inside-avoid">
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {finalLabels.storyTitle}
                  </p>
                  <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    {story.story_title}
                  </h4>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <span className="text-slate-500 dark:text-slate-500">
                      {finalLabels.source}:{' '}
                      <span className="text-slate-700 dark:text-slate-300">
                        {story.source === 'resume'
                          ? finalLabels.sourceResume
                          : finalLabels.sourceDetailedResume}
                      </span>
                    </span>
                    {story.quantified_impact && (
                      <>
                        <span className="text-slate-300 dark:text-slate-700">
                          •
                        </span>
                        <span className="text-slate-700 dark:text-slate-300 font-medium">
                          {story.quantified_impact}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {story.matched_pain_point && (
                  <div className="space-y-1 rounded-lg p-4 bg-stone-400/10 dark:bg-stone-800/50">
                    <p
                      className={cn(
                        'text-[11px] font-semibold uppercase tracking-[0.18em]',
                        getAccentTextColor(),
                      )}
                    >
                      {finalLabels.matchedPainPoint}
                    </p>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      {story.matched_pain_point}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-3 auto-rows-fr">
                  <div className="rounded-lg border border-slate-200/70 dark:border-stone-800/70 p-3 space-y-1 h-full">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      S · {finalLabels.situation}
                    </p>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      {story.star.situation}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200/70 dark:border-stone-800/70 p-3 space-y-1 h-full">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      T · {finalLabels.task}
                    </p>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      {story.star.task}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200/70 dark:border-stone-800/70 p-3 space-y-1 h-full">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      A · {finalLabels.action}
                    </p>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      {story.star.action}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200/70 dark:border-stone-800/70 p-3 space-y-1 h-full">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      R · {finalLabels.result}
                    </p>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      {story.star.result}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        ))}

        <div className="hidden print:block space-y-4 mt-4">
          {stories.map((story, index) => (
            <div
              key={index}
              className="rounded-xl border border-slate-200/70 dark:border-stone-800/70 bg-white/70 dark:bg-stone-900/40 p-4 space-y-4 print:break-inside-avoid"
            >
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {finalLabels.storyTitle}
                </p>
                <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {story.story_title}
                </h4>
                <div className="flex flex-wrap gap-2 text-sm">
                  <span className="text-slate-500 dark:text-slate-500">
                    {finalLabels.source}:{' '}
                    <span className="text-slate-700 dark:text-slate-300">
                      {story.source === 'resume'
                        ? finalLabels.sourceResume
                        : finalLabels.sourceDetailedResume}
                    </span>
                  </span>
                  {story.quantified_impact && (
                    <>
                      <span className="text-slate-300 dark:text-slate-700">
                        •
                      </span>
                      <span className="text-slate-700 dark:text-slate-300 font-medium">
                        {story.quantified_impact}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {story.matched_pain_point && (
                <div className="space-y-1 rounded-lg p-3 bg-slate-50/80 dark:bg-slate-900/50">
                  <p
                    className={cn(
                      'text-[11px] font-semibold uppercase tracking-[0.18em]',
                      getAccentTextColor(),
                    )}
                  >
                    {finalLabels.matchedPainPoint}
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    {story.matched_pain_point}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-3 auto-rows-fr">
                <div className="rounded-lg border border-slate-200/70 dark:border-slate-800/70 p-3 space-y-1 h-full">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    S · {finalLabels.situation}
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    {story.star.situation}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200/70 dark:border-slate-800/70 p-3 space-y-1 h-full">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    T · {finalLabels.task}
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    {story.star.task}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200/70 dark:border-slate-800/70 p-3 space-y-1 h-full">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    A · {finalLabels.action}
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    {story.star.action}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200/70 dark:border-slate-800/70 p-3 space-y-1 h-full">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    R · {finalLabels.result}
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    {story.star.result}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Tabs>
    </div>
  )
}
