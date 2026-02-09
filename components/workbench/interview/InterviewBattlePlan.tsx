'use client'

import React, { useMemo, useState } from 'react'
import { RadarModule } from './RadarModule'
import { HookModule } from './HookModule'
import { EvidenceModule } from './EvidenceModule'
import { DefenseModule } from './DefenseModule'
import { ReverseModule } from './ReverseModule'
import { KnowledgeRefreshModule } from './KnowledgeRefreshModule'
import { Button } from '@/components/ui/button'
import { Printer, Copy, Check, RotateCcw } from 'lucide-react'
import { cn, getMatchScore, getMatchThemeColor } from '@/lib/utils'

interface InterviewBattlePlanData {
  radar: {
    core_challenges: Array<{
      challenge: string
      why_important: string
      your_angle: string
    }>
    interview_rounds: Array<{
      round_name: string
      interviewer_role: string
      focus_points: string[]
    }>
    hidden_requirements: string[]
  }
  hook: {
    ppf_script: string
    key_hooks: Array<{
      hook: string
      evidence_source: string
    }>
    delivery_tips: string[]
  }
  evidence: Array<{
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
  }>
  defense: Array<{
    weakness: string
    anticipated_question: string
    defense_script: string
    supporting_evidence: string
  }>
  reverse_questions: Array<{
    question: string
    ask_intent: string
    listen_for: string
  }>
  knowledge_refresh?: Array<{
    topic: string
    key_points: string[]
    relevance: string
  }>
}

interface InterviewBattlePlanProps {
  data: InterviewBattlePlanData
  matchScore?: number // For dynamic theme color (emerald/amber/rose)
  labels?: {
    title?: string
    print?: string
    copy?: string
    copied?: string
    regenerate?: string
    radar?: {
      title?: string
      coreChallenges?: string
      challenge?: string
      whyImportant?: string
      yourAngle?: string
      interviewRounds?: string
      round?: string
      focus?: string
      hiddenRequirements?: string
    }
    hook?: {
      title?: string
      ppfScript?: string
      keyHooks?: string
      hook?: string
      evidenceSource?: string
      deliveryTips?: string
      copy?: string
      copied?: string
    }
    evidence?: {
      title?: string
      storyTitle?: string
      storyLabel?: string
      storyCount?: string
      matchedPainPoint?: string
      situation?: string
      task?: string
      action?: string
      result?: string
      impact?: string
      source?: string
      sourceResume?: string
      sourceDetailedResume?: string
    }
    defense?: {
      title?: string
      weakness?: string
      anticipatedQuestion?: string
      defenseScript?: string
      supportingEvidence?: string
      weaknessCount?: string
    }
    reverse?: {
      title?: string
      question?: string
      askIntent?: string
      listenFor?: string
    }
    knowledgeRefresh?: {
      title?: string
    }
  }
  className?: string
  onRegenerate?: () => void
}

const defaultLabels = {
  title: '面试作战手卡',
  print: '打印',
  copy: '复制全文',
  copied: '已复制',
  regenerate: '重新生成',
  radar: {
    title: '情报透视',
    coreChallenges: '核心挑战',
    challenge: '挑战',
    whyImportant: '为何重要',
    yourAngle: '你的切入点',
    interviewRounds: '面试链路',
    round: '第{round}轮',
    focus: '考察重点',
    hiddenRequirements: '隐藏要求',
  },
  hook: {
    title: '开场定调',
    ppfScript: 'P-P-F 自我介绍脚本',
    keyHooks: '关键钩子',
    hook: '钩子',
    evidenceSource: '来源',
    deliveryTips: '演讲技巧',
    copy: '复制',
    copied: '已复制',
  },
  evidence: {
    title: '核心论据',
    storyTitle: '故事标题',
    storyLabel: '故事',
    storyCount: '{count} 个故事',
    matchedPainPoint: '对应 JD 痛点',
    situation: '背景',
    task: '任务',
    action: '行动',
    result: '结果',
    impact: '量化影响',
    source: '来源',
    sourceResume: '简历',
    sourceDetailedResume: '详细履历',
  },
  defense: {
    title: '弱项演练',
    weakness: '弱点',
    anticipatedQuestion: '预判追问',
    defenseScript: '防御话术',
    supportingEvidence: '支撑证据',
    weaknessCount: '{count} 个弱点',
  },
  reverse: {
    title: '提问利器',
    question: '问题',
    askIntent: '提问意图',
    listenFor: '倾听重点',
  },
  knowledgeRefresh: {
    title: '知识补课',
  },
}

export function InterviewBattlePlan({
  data,
  matchScore,
  labels = defaultLabels,
  className,
  onRegenerate,
}: InterviewBattlePlanProps) {
  const finalLabels = useMemo(
    () => ({
      ...defaultLabels,
      ...labels,
      radar: { ...defaultLabels.radar, ...labels?.radar },
      hook: { ...defaultLabels.hook, ...labels?.hook },
      evidence: { ...defaultLabels.evidence, ...labels?.evidence },
      defense: { ...defaultLabels.defense, ...labels?.defense },
      reverse: { ...defaultLabels.reverse, ...labels?.reverse },
      knowledgeRefresh: {
        ...defaultLabels.knowledgeRefresh,
        ...labels?.knowledgeRefresh,
      },
    }),
    [labels],
  )
  const [copied, setCopied] = useState(false)

  const resolvedScore = getMatchScore({ score: matchScore })
  const themeColor = getMatchThemeColor(resolvedScore)

  const handlePrint = () => {
    window.print()
  }

  const handleCopyAll = async () => {
    try {
      const sections = [
        `# ${finalLabels.title}`,
        '',
        `## ${finalLabels.radar.title}`,
        `### ${finalLabels.radar.coreChallenges}`,
        ...data.radar.core_challenges.map((c, i) =>
          [
            `${finalLabels.radar.challenge} ${i + 1}: ${c.challenge}`,
            `${finalLabels.radar.whyImportant}: ${c.why_important}`,
            `${finalLabels.radar.yourAngle}: ${c.your_angle}`,
          ].join('\n'),
        ),
        '',
        `### ${finalLabels.radar.interviewRounds}`,
        ...data.radar.interview_rounds.map((round, i) =>
          [
            `${finalLabels.radar.round.replace('{round}', String(i + 1))}: ${round.round_name}`,
            `${round.interviewer_role}`,
            `${finalLabels.radar.focus}:`,
            ...round.focus_points.map((point) => `- ${point}`),
          ].join('\n'),
        ),
        '',
        `### ${finalLabels.radar.hiddenRequirements}`,
        ...data.radar.hidden_requirements.map((req, i) => `${i + 1}. ${req}`),
        '',
        `## ${finalLabels.hook.title}`,
        `${finalLabels.hook.ppfScript}`,
        data.hook.ppf_script,
        '',
        finalLabels.hook.keyHooks,
        ...data.hook.key_hooks.map((hook, i) =>
          [
            `${i + 1}. ${hook.hook}`,
            `${finalLabels.hook.evidenceSource}: ${hook.evidence_source}`,
          ].join('\n'),
        ),
        '',
        finalLabels.hook.deliveryTips,
        ...data.hook.delivery_tips.map((tip, i) => `${i + 1}. ${tip}`),
        '',
        `## ${finalLabels.evidence.title}`,
        ...data.evidence.map((s, i) =>
          [
            `${finalLabels.evidence.storyLabel || finalLabels.evidence.storyTitle} ${i + 1}: ${s.story_title}`,
            `${finalLabels.evidence.matchedPainPoint}: ${s.matched_pain_point}`,
            `${finalLabels.evidence.impact}: ${s.quantified_impact}`,
            `S · ${finalLabels.evidence.situation}: ${s.star.situation}`,
            `T · ${finalLabels.evidence.task}: ${s.star.task}`,
            `A · ${finalLabels.evidence.action}: ${s.star.action}`,
            `R · ${finalLabels.evidence.result}: ${s.star.result}`,
          ].join('\n'),
        ),
        '',
        `## ${finalLabels.defense.title}`,
        ...data.defense.map((d, i) =>
          [
            `${finalLabels.defense.weakness} ${i + 1}: ${d.weakness}`,
            `${finalLabels.defense.anticipatedQuestion}: ${d.anticipated_question}`,
            `${finalLabels.defense.supportingEvidence}: ${d.supporting_evidence}`,
            `${finalLabels.defense.defenseScript}: ${d.defense_script}`,
          ].join('\n'),
        ),
        '',
        `## ${finalLabels.reverse.title}`,
        ...data.reverse_questions.map((q, i) =>
          [
            `${i + 1}. ${q.question}`,
            `   - ${finalLabels.reverse.askIntent}: ${q.ask_intent}`,
            `   - ${finalLabels.reverse.listenFor}: ${q.listen_for}`,
          ].join('\n'),
        ),
      ]

      const textContent = sections.join('\n')
      await navigator.clipboard.writeText(textContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div
      className={cn(
        'max-w-[880px] mx-auto w-full relative mt-4 print:max-w-none print:w-full print:mt-0 print:break-before-auto print:break-inside-auto animate-in fade-in slide-in-from-bottom-6 duration-[800ms] ease-out',
        'bg-card/50',
        'border border-border',
        'shadow-[0_0_0_1px_rgba(255,255,255,0.5)_inset,0_4px_12px_rgba(0,0,0,0.05)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.05)_inset,0_4px_24px_rgba(0,0,0,0.2)]',
        'rounded-xl backdrop-blur-sm',
        'print:shadow-none print:border-0',
        className,
      )}
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.03'/%3E%3C/svg%3E")`,
      }}
    >
      {/* Action Bar */}
      <div className="hidden md:flex items-center justify-between p-5 md:p-6 border-b border-border print:hidden">
        <h2 className="text-xl font-bold text-foreground">
          {finalLabels.title}
        </h2>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={handlePrint}
            className="gap-1.5 h-8 text-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            {finalLabels.print}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCopyAll}
            className="gap-1.5 h-8 text-xs"
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
          {onRegenerate && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onRegenerate}
              className="gap-1.5 h-8 text-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {finalLabels.regenerate}
            </Button>
          )}
        </div>
      </div>

      <div className="relative p-4 sm:p-5 md:p-8 pb-24 md:pb-10 print:pt-4 print:pb-4 print:px-2">
        <div className="space-y-10">
          {data?.radar && (
            <section
              id="ibp-radar"
              className="scroll-mt-24 print:break-before-avoid print:break-inside-auto break-after-avoid"
            >
              <RadarModule
                core_challenges={data.radar.core_challenges || []}
                interview_rounds={data.radar.interview_rounds || []}
                hidden_requirements={data.radar.hidden_requirements || []}
                themeColor={themeColor}
                labels={finalLabels.radar}
              />
            </section>
          )}

          {data?.hook && (
            <section
              id="ibp-hook"
              className="scroll-mt-24 print:break-inside-auto break-after-avoid"
            >
              <HookModule
                ppf_script={data.hook.ppf_script || ''}
                key_hooks={data.hook.key_hooks || []}
                delivery_tips={data.hook.delivery_tips || []}
                themeColor={themeColor}
                labels={finalLabels.hook}
              />
            </section>
          )}

          {data?.evidence && data.evidence.length > 0 && (
            <section
              id="ibp-evidence"
              className="scroll-mt-24 print:break-inside-auto break-after-avoid"
            >
              <EvidenceModule
                stories={data.evidence}
                themeColor={themeColor}
                labels={finalLabels.evidence}
              />
            </section>
          )}

          {data?.defense && data.defense.length > 0 && (
            <section
              id="ibp-defense"
              className="scroll-mt-24 print:break-inside-auto break-after-avoid"
            >
              <DefenseModule
                defenses={data.defense}
                themeColor={themeColor}
                labels={finalLabels.defense}
              />
            </section>
          )}

          {data?.reverse_questions && data.reverse_questions.length > 0 && (
            <section
              id="ibp-reverse"
              className="scroll-mt-24 print:break-inside-auto break-after-avoid"
            >
              <ReverseModule
                questions={data.reverse_questions}
                themeColor={themeColor}
                labels={finalLabels.reverse}
              />
            </section>
          )}

          {data?.knowledge_refresh && data.knowledge_refresh.length > 0 && (
            <section
              id="ibp-knowledge"
              className="scroll-mt-24 print:break-inside-auto break-after-avoid"
            >
              <KnowledgeRefreshModule
                topics={data.knowledge_refresh}
                themeColor={themeColor}
                labels={finalLabels.knowledgeRefresh}
              />
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
