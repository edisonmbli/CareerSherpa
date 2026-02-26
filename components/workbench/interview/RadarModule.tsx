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
    <div className={cn('space-y-2', matchThemeClass, className)}>
      {/* Section Title */}
      <div className="flex items-center w-full mb-6 relative pl-2">
        <div className={cn('relative ml-0 border-l-[3px] pl-3 py-0.5', 'border-match-dot')}>
          <h3 className="text-2xl font-serif text-foreground z-10 relative">
            {finalLabels.title}
          </h3>
        </div>
      </div>

      {/* Accordion - Clean, minimal styling */}
      <Accordion
        type="multiple"
        defaultValue={['challenges', 'rounds', 'hidden']}
        className="space-y-2"
      >
        <AccordionItem value="challenges" className="border-none">
          <AccordionTrigger className="px-0 py-3 hover:no-underline group focus-visible:ring-0 focus-visible:outline-none">
            <div className="flex items-center w-full">
              <div className="relative inline-block">
                <span className="text-lg font-semibold text-foreground relative">
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
                <div key={index} className="relative overflow-hidden z-10 bg-white/60 dark:bg-white/[0.03] backdrop-blur-2xl border-[0.5px] border-black/5 dark:border-white/10 rounded-xl p-4 md:p-5 mb-4 last:mb-0 shadow-sm">
                  {/* Proportional Ghost Watermark Small */}
                  <div className="absolute -top-3 -left-2 text-[5rem] font-black pointer-events-none select-none opacity-[0.06] dark:opacity-[0.05] z-0 text-slate-900 dark:text-white leading-none">
                    {index + 1}
                  </div>
                  <div className="relative z-10 space-y-4">
                    <h4 className="text-lg font-semibold text-foreground leading-tight">
                      {challenge.challenge}
                    </h4>
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-muted-foreground uppercase">
                          <Compass className="h-3 w-3" />
                          <span>{finalLabels.whyImportant}</span>
                        </div>
                        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                          {challenge.why_important}
                        </p>
                      </div>
                      <div className="space-y-2 border-l-[3px] border-match-dot pl-4 py-1">
                        <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-match-text uppercase mb-1">
                          <Target className="h-3 w-3 text-match-text" />
                          <span>{finalLabels.yourAngle}</span>
                        </div>
                        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400 font-medium text-pretty">
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
          <AccordionTrigger className="px-0 py-3 hover:no-underline group focus-visible:ring-0 focus-visible:outline-none">
            <div className="flex items-center w-full">
              <div className="relative inline-block">
                <span className="text-lg font-semibold text-foreground dark:text-white relative">
                  {finalLabels.interviewRounds}
                </span>
              </div>
              <span className="ml-2 text-xs font-medium text-match-text">
                {interview_rounds.length}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-0 pb-4">
            <div className="relative overflow-hidden z-10 bg-white/60 dark:bg-white/[0.03] backdrop-blur-2xl border-[0.5px] border-black/5 dark:border-white/10 rounded-xl p-4 md:p-5 shadow-sm">
              <Tabs defaultValue="0" className="w-full">
                <TabsList className="w-full inline-flex justify-start bg-transparent p-0 border-b border-black/5 dark:border-white/10 print:hidden flex-nowrap overflow-x-auto no-scrollbar">
                  {interview_rounds.map((round, index) => (
                    <TabsTrigger
                      key={index}
                      value={String(index)}
                      className="text-xs px-3 py-2 rounded-none text-stone-500/80 dark:text-stone-400/80 data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-match-dot max-w-[96px] truncate sm:max-w-none sm:whitespace-nowrap"
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
                          className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300"
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
                        <h5 className="text-sm font-semibold text-foreground dark:text-white">
                          {round.round_name}
                        </h5>
                      </div>
                      <ul className="space-y-2">
                        {round.focus_points.map((point, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300"
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
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Hidden Requirements */}
        <AccordionItem value="hidden" className="border-none">
          <AccordionTrigger className="px-0 py-3 hover:no-underline group focus-visible:ring-0 focus-visible:outline-none">
            <div className="flex items-center w-full">
              <div className="relative inline-block">
                <span className="text-lg font-semibold text-foreground dark:text-white relative">
                  {finalLabels.hiddenRequirements}
                </span>
              </div>
              <span className="ml-2 text-xs font-medium text-match-text">
                {hidden_requirements.length}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-0 pb-4">
            <div className="relative overflow-hidden z-10 bg-white/60 dark:bg-white/[0.03] backdrop-blur-2xl border-[0.5px] border-black/5 dark:border-white/10 rounded-xl p-4 md:p-5 shadow-sm">
              <div className="space-y-3">
                {hidden_requirements.map((req, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <span className="h-1.5 w-1.5 rounded-full shrink-0 mt-[0.55em] border bg-transparent border-match-dot" />
                    <span className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed flex-1">
                      {req}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
