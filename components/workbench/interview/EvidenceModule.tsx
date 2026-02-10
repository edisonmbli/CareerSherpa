'use client'

import React from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn, getMatchThemeClass } from '@/lib/utils'

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
  const matchThemeClass = getMatchThemeClass(themeColor)

  const formatLabel = (
    template: string,
    vars: Record<string, string | number>,
  ) => template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ''))

  if (!stories || stories.length === 0) {
    return null
  }

  return (
    <div className={cn('space-y-6', matchThemeClass, className)}>
      {/* Section Title */}
      <div className="flex items-center gap-3">
        <div className="relative inline-block">
          <div className="absolute bottom-4 -left-4 w-24 h-5 -z-10 bg-match-highlight" />
          <h3 className="text-[22px] leading-[30px] font-bold font-[family-name:var(--font-playfair),serif] text-foreground tracking-tight relative">
            {finalLabels.title}
          </h3>
        </div>
        <span className="text-xs font-medium text-match-text">
          {formatLabel(finalLabels.storyCount, { count: stories.length })}
        </span>
      </div>

      <Tabs defaultValue="0" className="w-full">
        <TabsList className="w-full inline-flex justify-start bg-transparent p-0 border-b border-stone-200/70 dark:border-stone-800/70 print:hidden">
          {stories.map((story, index) => (
            <TabsTrigger
              key={index}
              value={String(index)}
              className="text-xs px-3 py-2 rounded-none text-stone-500/80 dark:text-stone-400/80 data-[state=active]:text-stone-700/90 dark:data-[state=active]:text-stone-200 data-[state=active]:border-b-2 data-[state=active]:border-stone-300/80 dark:data-[state=active]:border-stone-700/80"
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
            <div className="md:hidden rounded-lg border border-stone-200/70 dark:border-stone-800/70 p-3 space-y-3">
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500/80 dark:text-stone-400/80">
                  {finalLabels.storyTitle}
                </p>
                <h4 className="text-base font-semibold text-stone-900 dark:text-stone-100">
                  {story.story_title}
                </h4>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="text-stone-500/80 dark:text-stone-400/80">
                    {finalLabels.source}:{' '}
                    <span className="text-stone-700 dark:text-stone-300">
                      {story.source === 'resume'
                        ? finalLabels.sourceResume
                        : finalLabels.sourceDetailedResume}
                    </span>
                  </span>
                  {story.quantified_impact && (
                    <>
                      <span className="text-stone-300 dark:text-stone-700">
                        •
                      </span>
                      <span className="text-stone-700 dark:text-stone-300 font-medium">
                        {story.quantified_impact}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {story.matched_pain_point && (
                <div className="space-y-1 rounded-lg p-3 bg-stone-100/80 dark:bg-stone-900/40">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-600/90 dark:text-stone-300">
                    {finalLabels.matchedPainPoint}
                  </p>
                  <p className="text-sm text-foreground/80 leading-relaxed">
                    {story.matched_pain_point}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <span className="w-4 text-[11px] font-semibold text-match-text pt-[2px]">
                    S
                  </span>
                  <p className="text-sm text-foreground/80 leading-relaxed">
                    {story.star.situation}
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 text-[11px] font-semibold text-match-text pt-[2px]">
                    T
                  </span>
                  <p className="text-sm text-foreground/80 leading-relaxed">
                    {story.star.task}
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 text-[11px] font-semibold text-match-text pt-[2px]">
                    A
                  </span>
                  <p className="text-sm text-foreground/80 leading-relaxed">
                    {story.star.action}
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 text-[11px] font-semibold text-match-text pt-[2px]">
                    R
                  </span>
                  <p className="text-sm text-foreground/80 leading-relaxed">
                    {story.star.result}
                  </p>
                </div>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="rounded-xl border border-stone-200/70 dark:border-stone-800/60 p-4 space-y-4 print:break-inside-avoid">
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500/80 dark:text-stone-400/80">
                    {finalLabels.storyTitle}
                  </p>
                  <h4 className="text-base font-semibold text-foreground">
                    {story.story_title}
                  </h4>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <span className="text-stone-500/80 dark:text-stone-400/80">
                      {finalLabels.source}:{' '}
                      <span className="text-foreground/80">
                        {story.source === 'resume'
                          ? finalLabels.sourceResume
                          : finalLabels.sourceDetailedResume}
                      </span>
                    </span>
                    {story.quantified_impact && (
                      <>
                        <span className="text-stone-300 dark:text-stone-700">
                          •
                        </span>
                        <span className="text-foreground/80 font-medium">
                          {story.quantified_impact}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {story.matched_pain_point && (
                  <div className="space-y-1 rounded-lg p-4 bg-stone-100/80 dark:bg-stone-900/40">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-600/90 dark:text-stone-300">
                      {finalLabels.matchedPainPoint}
                    </p>
                    <p className="text-sm text-foreground/80 leading-relaxed">
                      {story.matched_pain_point}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-3 auto-rows-fr">
                  <div className="rounded-lg border border-stone-200/70 dark:border-stone-800/60 p-3 space-y-1 h-full">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-match-text">
                      S · {finalLabels.situation}
                    </p>
                    <p className="text-sm text-foreground/80 leading-relaxed">
                      {story.star.situation}
                    </p>
                  </div>
                  <div className="rounded-lg border border-stone-200/70 dark:border-stone-800/60 p-3 space-y-1 h-full">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-match-text">
                      T · {finalLabels.task}
                    </p>
                    <p className="text-sm text-foreground/80 leading-relaxed">
                      {story.star.task}
                    </p>
                  </div>
                  <div className="rounded-lg border border-stone-200/70 dark:border-stone-800/60 p-3 space-y-1 h-full">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-match-text">
                      A · {finalLabels.action}
                    </p>
                    <p className="text-sm text-foreground/80 leading-relaxed">
                      {story.star.action}
                    </p>
                  </div>
                  <div className="rounded-lg border border-stone-200/70 dark:border-stone-800/60 p-3 space-y-1 h-full">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-match-text">
                      R · {finalLabels.result}
                    </p>
                    <p className="text-sm text-foreground/80 leading-relaxed">
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
              className="rounded-xl border border-stone-200/70 dark:border-stone-800/60 p-4 space-y-4 print:break-inside-avoid"
            >
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500/80 dark:text-stone-400/80">
                  {finalLabels.storyTitle}
                </p>
                <h4 className="text-base font-semibold text-foreground">
                  {story.story_title}
                </h4>
                <div className="flex flex-wrap gap-2 text-sm">
                  <span className="text-stone-500/80 dark:text-stone-400/80">
                    {finalLabels.source}:{' '}
                    <span className="text-foreground/80">
                      {story.source === 'resume'
                        ? finalLabels.sourceResume
                        : finalLabels.sourceDetailedResume}
                    </span>
                  </span>
                  {story.quantified_impact && (
                    <>
                      <span className="text-stone-300 dark:text-stone-700">
                        •
                      </span>
                      <span className="text-foreground/80 font-medium">
                        {story.quantified_impact}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {story.matched_pain_point && (
                <div className="space-y-1 rounded-lg p-3 bg-stone-100/80 dark:bg-stone-900/40">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-600/90 dark:text-stone-300">
                    {finalLabels.matchedPainPoint}
                  </p>
                  <p className="text-sm text-foreground/80 leading-relaxed">
                    {story.matched_pain_point}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-3 auto-rows-fr">
                <div className="rounded-lg border border-stone-200/70 dark:border-stone-800/60 p-3 space-y-1 h-full">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-match-text">
                    S · {finalLabels.situation}
                  </p>
                  <p className="text-sm text-foreground/80 leading-relaxed">
                    {story.star.situation}
                  </p>
                </div>
                <div className="rounded-lg border border-stone-200/70 dark:border-stone-800/60 p-3 space-y-1 h-full">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-match-text">
                    T · {finalLabels.task}
                  </p>
                  <p className="text-sm text-foreground/80 leading-relaxed">
                    {story.star.task}
                  </p>
                </div>
                <div className="rounded-lg border border-stone-200/70 dark:border-stone-800/60 p-3 space-y-1 h-full">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-match-text">
                    A · {finalLabels.action}
                  </p>
                  <p className="text-sm text-foreground/80 leading-relaxed">
                    {story.star.action}
                  </p>
                </div>
                <div className="rounded-lg border border-stone-200/70 dark:border-stone-800/60 p-3 space-y-1 h-full">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-match-text">
                    R · {finalLabels.result}
                  </p>
                  <p className="text-sm text-foreground/80 leading-relaxed">
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
