'use client'

import React, { useState } from 'react'
import { cn, getMatchThemeClass } from '@/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { motion, AnimatePresence } from 'framer-motion'

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
  const [activeTab, setActiveTab] = useState('0')

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
      <div className="flex items-center gap-3 w-full mb-6 relative pl-2">
        <div className={cn('relative ml-0 border-l-[3px] pl-3 py-0.5', 'border-match-dot')}>
          <h3 className="text-2xl font-serif text-foreground z-10 relative">
            {finalLabels.title}
          </h3>
        </div>
        <span className="text-xs font-medium text-match-text">
          {formatLabel(finalLabels.storyCount, { count: stories.length })}
        </span>
      </div>

      {/* Mobile: Horizontal Snap */}
      <div className="md:hidden flex flex-col w-full relative -mx-4 px-4 pb-2">
        <div className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar gap-4 w-full">
          {stories.map((story, index) => (
            <div key={index} className="w-[88vw] snap-center snap-always shrink-0">
              <StoryCardContent story={story} index={index} />
            </div>
          ))}
        </div>

        {/* Swipe Hint Animation */}
        {stories.length > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4 text-xs font-medium text-muted-foreground/50 animate-pulse">
            <span className="shrink-0">👈</span>
            <span>滑动查看更多故事</span>
            <span className="shrink-0">👉</span>
          </div>
        )}
      </div>

      {/* Desktop: Tabs */}
      <div className="hidden md:block min-h-[400px]">
        <Tabs defaultValue="0" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full inline-flex justify-start bg-transparent p-0 border-b border-black/5 dark:border-white/10 mb-6 flex-wrap h-auto">
            {stories.map((_, index) => (
              <TabsTrigger
                key={index}
                value={String(index)}
                className="text-xs px-4 py-2.5 rounded-none text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-match-dot font-medium tracking-wide uppercase transition-all"
              >
                {finalLabels.storyLabel} {index + 1}
              </TabsTrigger>
            ))}
          </TabsList>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.2 }}
            >
              <StoryCardContent story={stories[Number(activeTab)] as StarStory} index={Number(activeTab)} />
            </motion.div>
          </AnimatePresence>
        </Tabs>
      </div>
    </div>
  )

  function StoryCardContent({ story, index }: { story: StarStory; index: number }) {
    if (!story) return null

    return (
      <div className="relative overflow-hidden z-10 bg-white/60 dark:bg-white/[0.03] backdrop-blur-2xl border-[0.5px] border-black/5 dark:border-white/10 rounded-xl p-5 md:p-6 print:break-inside-avoid shadow-sm">
        {/* Proportional Ghost Watermark Large */}
        <div className="absolute -top-6 -left-4 text-[8rem] font-black pointer-events-none select-none opacity-[0.06] dark:opacity-[0.05] z-0 text-slate-900 dark:text-white leading-none">
          {index + 1}
        </div>

        <div className="relative z-10 space-y-5 md:space-y-6">
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {finalLabels.storyTitle}
            </p>
            <h4 className="text-lg font-semibold text-foreground leading-tight">
              {story.story_title}
            </h4>
            <div className="flex flex-wrap gap-2 text-xs md:text-sm">
              <span className="text-muted-foreground font-medium">
                {finalLabels.source}:{' '}
                <span className="text-slate-600 dark:text-slate-400">
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
                  <span className="text-slate-700 dark:text-slate-300 font-medium break-words">
                    {story.quantified_impact}
                  </span>
                </>
              )}
            </div>
          </div>

          {story.matched_pain_point && (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {finalLabels.matchedPainPoint}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed border-l-[3px] border-match-dot pl-4 py-1">
                {story.matched_pain_point}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-4 md:gap-6 pt-2">
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                S · {finalLabels.situation}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {story.star.situation}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                T · {finalLabels.task}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {story.star.task}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                A · {finalLabels.action}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {story.star.action}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                R · {finalLabels.result}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {story.star.result}
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }
}
