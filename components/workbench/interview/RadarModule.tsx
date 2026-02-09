'use client'

import React from 'react'
import { Compass, Target, Eye } from 'lucide-react'
import * as AccordionPrimitive from '@radix-ui/react-accordion'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

interface InterviewRound {
  round_name: string
  interviewer_role: string
  focus_points: string[]
}

interface Challenge {
  challenge: string
  why_important: string
  your_angle: string
}

interface RadarModuleProps {
  core_challenges: Challenge[]
  interview_rounds: InterviewRound[]
  hidden_requirements: string[]
  themeColor?: 'emerald' | 'amber' | 'rose'
  labels?: {
    title?: string
    coreChallenges?: string
    interviewRounds?: string
    hiddenRequirements?: string
    challenge?: string
    whyImportant?: string
    yourAngle?: string
    focus?: string
    round?: string
  }
  className?: string
}

const defaultLabels = {
  title: '情报透视',
  coreChallenges: '核心挑战',
  interviewRounds: '面试链路',
  hiddenRequirements: '隐藏要求',
  challenge: '挑战',
  whyImportant: '为何重要',
  yourAngle: '你的切入点',
  focus: '考察重点',
  round: '第{round}轮',
}

export function RadarModule({
  core_challenges,
  interview_rounds,
  hidden_requirements,
  themeColor = 'emerald', // Default to emerald (high match)
  labels = defaultLabels,
  className,
}: RadarModuleProps) {
  const finalLabels = { ...defaultLabels, ...labels }

  // Helper function for theme colors
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

  const getWatermarkColor = () => {
    switch (themeColor) {
      case 'emerald':
        return 'text-emerald-300/70 dark:text-emerald-500/65'
      case 'amber':
        return 'text-amber-300/70 dark:text-amber-500/65'
      case 'rose':
        return 'text-rose-300/70 dark:text-rose-500/65'
      default:
        return 'text-emerald-300/70 dark:text-emerald-500/65'
    }
  }

  const CoreAccordionContent = ({
    className,
    children,
    ...props
  }: React.ComponentProps<typeof AccordionPrimitive.Content>) => (
    <AccordionPrimitive.Content
      className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-visible text-sm"
      {...props}
    >
      <div className={cn('pt-3 pb-4', className)}>{children}</div>
    </AccordionPrimitive.Content>
  )

  return (
    <div className={cn('space-y-4', className)}>
      {/* Section Title - M9 Style */}
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

      {/* Accordion - Clean, minimal styling */}
      <Accordion
        type="multiple"
        defaultValue={['challenges', 'rounds', 'hidden']}
        className="space-y-2"
      >
        {/* Core Challenges */}
        <AccordionItem value="challenges" className="border-none">
          <AccordionTrigger className="px-0 py-3 hover:no-underline group">
            <div className="flex items-center w-full">
              <div className="relative inline-block">
                <span className="text-lg font-semibold text-slate-900 dark:text-slate-100 relative">
                  {finalLabels.coreChallenges}
                </span>
              </div>
              <span
                className={cn('ml-2 text-xs font-medium', getAccentTextColor())}
              >
                {core_challenges.length}
              </span>
            </div>
          </AccordionTrigger>
          <CoreAccordionContent className="px-0">
            <div className="space-y-2">
              {core_challenges.map((challenge, index) => (
                <div key={index} className="relative pt-1 pb-6 last:pb-0">
                  <span
                    className={cn(
                      'absolute -left-4 -top-3 text-3xl font-semibold tabular-nums select-none pointer-events-none',
                      getWatermarkColor(),
                    )}
                  >
                    {index + 1}
                  </span>
                  <div className="space-y-3">
                    <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      {challenge.challenge}
                    </h4>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.16em] text-slate-400/80 dark:text-slate-500">
                          <Compass
                            className={cn('h-3 w-3', getAccentTextColor())}
                          />
                          <span className="uppercase">
                            {finalLabels.whyImportant}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600/60 dark:text-slate-400 leading-relaxed">
                          {challenge.why_important}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <div
                          className={cn(
                            'flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em]',
                            getAccentTextColor(),
                          )}
                        >
                          <Target className="h-3 w-3" />
                          <span className="uppercase">
                            {finalLabels.yourAngle}
                          </span>
                        </div>
                        <p className="text-sm text-slate-900/80 dark:text-slate-100 leading-relaxed font-normal">
                          {challenge.your_angle}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CoreAccordionContent>
        </AccordionItem>

        {/* Interview Rounds */}
        <AccordionItem value="rounds" className="border-none">
          <AccordionTrigger className="px-0 py-3 hover:no-underline group">
            <div className="flex items-center w-full">
              <div className="relative inline-block">
                <span className="text-lg font-semibold text-slate-900 dark:text-slate-100 relative">
                  {finalLabels.interviewRounds}
                </span>
              </div>
              <span
                className={cn('ml-2 text-xs font-medium', getAccentTextColor())}
              >
                {interview_rounds.length}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-0 pb-4">
            <Tabs defaultValue="0" className="w-full">
              <TabsList className="w-full inline-flex justify-start bg-transparent p-0 border-b border-slate-200/70 dark:border-slate-800/70 print:hidden flex-nowrap overflow-x-auto no-scrollbar">
                {interview_rounds.map((round, index) => (
                  <TabsTrigger
                    key={index}
                    value={String(index)}
                    className="text-xs px-3 py-2 rounded-none data-[state=active]:text-slate-900 dark:data-[state=active]:text-slate-50 data-[state=active]:border-b-2 data-[state=active]:border-slate-900 dark:data-[state=active]:border-slate-50 max-w-[96px] truncate sm:max-w-none sm:whitespace-nowrap"
                  >
                    <span className="truncate block" title={round.round_name}>
                      {round.round_name}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>

              {interview_rounds.map((round, index) => (
                <TabsContent
                  key={index}
                  value={String(index)}
                  className="mt-4 space-y-3 print:hidden"
                >
                  <ul className="space-y-2">
                    {round.focus_points.map((point, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2 text-sm text-slate-900/80 dark:text-slate-300"
                      >
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full shrink-0 mt-[0.45em]',
                            getAccentDotColor(),
                          )}
                        />
                        <span className="leading-relaxed">{point}</span>
                      </li>
                    ))}
                  </ul>
                </TabsContent>
              ))}

              <div className="hidden print:block space-y-4 mt-4">
                {interview_rounds.map((round, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h5 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {round.round_name}
                      </h5>
                    </div>
                    <ul className="space-y-2">
                      {round.focus_points.map((point, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300"
                        >
                          <span
                            className={cn(
                              'h-1.5 w-1.5 rounded-full shrink-0 mt-[0.45em]',
                              getAccentDotColor(),
                            )}
                          />
                          <span className="leading-relaxed">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Tabs>
          </AccordionContent>
        </AccordionItem>

        {/* Hidden Requirements */}
        <AccordionItem value="hidden" className="border-none">
          <AccordionTrigger className="px-0 py-3 hover:no-underline group">
            <div className="flex items-center w-full">
              <div className="relative inline-block">
                <span className="text-lg font-semibold text-slate-900 dark:text-slate-100 relative">
                  {finalLabels.hiddenRequirements}
                </span>
              </div>
              <span
                className={cn('ml-2 text-xs font-medium', getAccentTextColor())}
              >
                {hidden_requirements.length}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-0 pb-4">
            <div className="space-y-2">
              {hidden_requirements.map((req, index) => (
                <div key={index} className="flex items-start gap-3">
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full shrink-0 mt-[0.45em]',
                      getAccentDotColor(),
                    )}
                  />
                  <span className="text-sm text-slate-900/80 dark:text-slate-300 leading-relaxed flex-1">
                    {req}
                  </span>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
