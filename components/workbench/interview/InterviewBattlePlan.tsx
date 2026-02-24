'use client'

import React, { useMemo } from 'react'
import { RadarModule } from './RadarModule'
import { HookModule } from './HookModule'
import { EvidenceModule } from './EvidenceModule'
import { DefenseModule } from './DefenseModule'
import { ReverseModule } from './ReverseModule'
import { KnowledgeRefreshModule } from './KnowledgeRefreshModule'
import {
  cn,
  getMatchScore,
  getMatchThemeClass,
  getMatchThemeColor,
} from '@/lib/utils'

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

export function buildInterviewBattlePlanCopyText(
  data: InterviewBattlePlanData,
  labels?: InterviewBattlePlanProps['labels'],
) {
  const finalLabels = {
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
  }

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
    `## ${finalLabels.evidence.title}`,
    ...data.evidence.map((story, i) =>
      [
        `${finalLabels.evidence.storyLabel} ${i + 1}: ${story.story_title}`,
        `${finalLabels.evidence.matchedPainPoint}: ${story.matched_pain_point}`,
        `${finalLabels.evidence.situation}: ${story.star.situation}`,
        `${finalLabels.evidence.task}: ${story.star.task}`,
        `${finalLabels.evidence.action}: ${story.star.action}`,
        `${finalLabels.evidence.result}: ${story.star.result}`,
        `${finalLabels.evidence.impact}: ${story.quantified_impact}`,
        `${finalLabels.evidence.source}: ${story.source === 'detailed_resume'
          ? finalLabels.evidence.sourceDetailedResume
          : finalLabels.evidence.sourceResume
        }`,
      ].join('\n'),
    ),
    '',
    `## ${finalLabels.defense.title}`,
    ...data.defense.map((item, i) =>
      [
        `${finalLabels.defense.weakness} ${i + 1}: ${item.weakness}`,
        `${finalLabels.defense.anticipatedQuestion}: ${item.anticipated_question}`,
        `${finalLabels.defense.defenseScript}: ${item.defense_script}`,
        `${finalLabels.defense.supportingEvidence}: ${item.supporting_evidence}`,
      ].join('\n'),
    ),
    '',
    `## ${finalLabels.reverse.title}`,
    ...data.reverse_questions.map((q, i) =>
      [
        `${finalLabels.reverse.question} ${i + 1}: ${q.question}`,
        `${finalLabels.reverse.askIntent}: ${q.ask_intent}`,
        `${finalLabels.reverse.listenFor}: ${q.listen_for}`,
      ].join('\n'),
    ),
  ]

  if (data.knowledge_refresh && data.knowledge_refresh.length > 0) {
    sections.push('')
    sections.push(`## ${finalLabels.knowledgeRefresh.title}`)
    data.knowledge_refresh.forEach((topic, i) => {
      sections.push(
        `${i + 1}. ${topic.topic}\n${topic.relevance}\n${topic.key_points.map((p) => `- ${p}`).join('\n')}`,
      )
    })
  }

  return sections.join('\n')
}

export function InterviewBattlePlan({
  data,
  matchScore,
  labels = defaultLabels,
  className,
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
  const resolvedScore = getMatchScore({ score: matchScore })
  const themeColor = getMatchThemeColor(resolvedScore)
  const matchThemeClass = getMatchThemeClass(themeColor)

  return (
    <div
      className={cn(
        'max-w-none sm:max-w-[880px] mx-0 sm:mx-auto w-full relative mt-4 overflow-visible print:max-w-none print:w-full print:mt-0 print:break-before-auto print:break-inside-auto animate-in fade-in slide-in-from-bottom-6 duration-[800ms] ease-out',
        'bg-white/70 dark:bg-white/[0.03]',
        'border-[0.5px] border-black/5 dark:border-white/10',
        'shadow-[inset_0_2px_5px_rgba(255,255,255,0.9),0_40px_80px_-20px_rgba(14,165,233,0.15)] dark:shadow-2xl',
        'rounded-sm sm:rounded-[2rem] backdrop-blur-2xl',
        'print:shadow-none print:border-0',
        matchThemeClass,
        className,
      )}
    >
      {/* Fine Noise Texture for the glass (matching Landing Page and Step 1) */}
      <div aria-hidden="true" className="absolute inset-0 mix-blend-overlay opacity-10 pointer-events-none rounded-sm sm:rounded-[2rem] z-0" style={{ backgroundImage: 'url("/noise.svg")', backgroundRepeat: 'repeat' }} />

      <div className="relative px-0 py-3 sm:p-4 md:p-8 pb-24 md:pb-10 print:pt-4 print:pb-4 print:px-2 z-10">
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
