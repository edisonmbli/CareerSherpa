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
import { cn, getMatchThemeClass } from '@/lib/utils'
import { WatermarkPrefix } from '@/components/workbench/WatermarkPrefix'

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
  const matchThemeClass = getMatchThemeClass(themeColor)

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
    <div className={cn('space-y-4', matchThemeClass, className)}>
      {/* Section Title */}
      <div className="relative inline-block">
        <div className="absolute bottom-4 -left-4 w-24 h-5 -z-10 bg-match-highlight" />
        <h3 className="text-[22px] leading-[30px] font-bold font-[family-name:var(--font-playfair),serif] text-foreground tracking-tight relative">
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
                <span className="text-sm font-semibold text-foreground relative">
                  {finalLabels.coreChallenges}
                </span>
              </div>
              <span className="ml-2 text-xs font-medium text-match-text">
                {core_challenges.length}
              </span>
            </div>
          </AccordionTrigger>
          <CoreAccordionContent className="px-0">
            <div className="space-y-2">
              {core_challenges.map((challenge, index) => (
                <div key={index} className="relative pt-1 pb-6 last:pb-0">
                  <WatermarkPrefix index={index} themeColor={themeColor} />
                  <div className="space-y-3">
                    <h4 className="text-base font-semibold text-foreground">
                      {challenge.challenge}
                    </h4>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-stone-500/80 dark:text-stone-400/80">
                          <Compass className="h-3 w-3 text-stone-500/80 dark:text-stone-400/80" />
                          <span className="uppercase">
                            {finalLabels.whyImportant}
                          </span>
                        </div>
                        <p className="text-sm text-stone-600/80 dark:text-stone-400 leading-relaxed">
                          {challenge.why_important}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-match-text">
                          <Target className="h-3 w-3" />
                          <span className="uppercase">
                            {finalLabels.yourAngle}
                          </span>
                        </div>
                        <p className="text-sm text-stone-900/90 dark:text-stone-100 leading-relaxed font-normal">
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
                <span className="text-sm font-semibold text-foreground relative">
                  {finalLabels.interviewRounds}
                </span>
              </div>
              <span className="ml-2 text-xs font-medium text-match-text">
                {interview_rounds.length}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-0 pb-4">
            <Tabs defaultValue="0" className="w-full">
              <TabsList className="w-full inline-flex justify-start bg-transparent p-0 border-b border-match-border print:hidden flex-nowrap overflow-x-auto no-scrollbar">
                {interview_rounds.map((round, index) => (
                  <TabsTrigger
                    key={index}
                    value={String(index)}
                    className="text-xs px-3 py-2 rounded-none text-match-text-muted data-[state=active]:text-match-accent data-[state=active]:border-b-2 data-[state=active]:border-match-accent max-w-[96px] truncate sm:max-w-none sm:whitespace-nowrap"
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
                        className="flex items-start gap-3 text-sm text-stone-900/80 dark:text-stone-300"
                      >
                        <span className="h-1.5 w-1.5 rounded-full shrink-0 mt-[0.55em] border bg-transparent border-match-dot" />
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
                      <h5 className="text-sm font-semibold text-foreground">
                        {round.round_name}
                      </h5>
                    </div>
                    <ul className="space-y-2">
                      {round.focus_points.map((point, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 text-xs text-stone-700 dark:text-stone-300"
                        >
                          <span className="h-1.5 w-1.5 rounded-full shrink-0 mt-[0.55em] border bg-transparent border-match-dot" />
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
                <span className="text-sm font-semibold text-foreground relative">
                  {finalLabels.hiddenRequirements}
                </span>
              </div>
              <span className="ml-2 text-xs font-medium text-match-text">
                {hidden_requirements.length}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-0 pb-4">
            <div className="space-y-2">
              {hidden_requirements.map((req, index) => (
                <div key={index} className="flex items-start gap-3">
                  <span className="h-1.5 w-1.5 rounded-full shrink-0 mt-[0.55em] border bg-transparent border-match-dot" />
                  <span className="text-sm text-stone-900/80 dark:text-stone-300 leading-relaxed flex-1">
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
