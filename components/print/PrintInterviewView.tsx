/**
 * PrintInterviewView — A4-optimised static interview battle plan view.
 * Uses Noto Sans SC (already loaded by root layout) for CJK rendering.
 * All 6 modules rendered inline — no animation/Radix dependencies.
 */
import React from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

interface CoreChallenge { challenge: string; why_important: string; your_angle: string }
interface InterviewRound { round_name: string; interviewer_role?: string; focus_points: string[] }
interface HookItem { hook: string; evidence_source: string }
interface EvidenceStory {
    story_title: string
    matched_pain_point: string
    star: { situation: string; task: string; action: string; result: string }
    quantified_impact: string
    source?: 'resume' | 'detailed_resume'
}
interface DefenseItem { weakness: string; anticipated_question: string; defense_script: string; supporting_evidence: string }
interface ReverseQuestion { question: string; ask_intent: string; listen_for: string }
interface KnowledgeTopic { topic: string; key_points: string[]; relevance: string }

interface InterviewData {
    radar?: { core_challenges?: CoreChallenge[]; interview_rounds?: InterviewRound[]; hidden_requirements?: string[] }
    hook?: { ppf_script?: string; key_hooks?: HookItem[]; delivery_tips?: string[] }
    evidence?: EvidenceStory[]
    defense?: DefenseItem[]
    reverse_questions?: ReverseQuestion[]
    knowledge_refresh?: KnowledgeTopic[]
}

interface PrintInterviewViewProps {
    data: InterviewData
    labels?: {
        radar?: { title?: string; coreChallenges?: string; challenge?: string; whyImportant?: string; yourAngle?: string; interviewRounds?: string; round?: string; focus?: string; hiddenRequirements?: string }
        hook?: { title?: string; ppfScript?: string; keyHooks?: string; hook?: string; evidenceSource?: string; deliveryTips?: string }
        evidence?: { title?: string; storyLabel?: string; matchedPainPoint?: string; situation?: string; task?: string; action?: string; result?: string; impact?: string; source?: string; sourceResume?: string; sourceDetailedResume?: string }
        defense?: { title?: string; weakness?: string; anticipatedQuestion?: string; defenseScript?: string; supportingEvidence?: string }
        reverse?: { title?: string; question?: string; askIntent?: string; listenFor?: string }
        knowledgeRefresh?: { title?: string }
    }
    accentColor?: string
}

const L = {
    radar: { title: '情报透视', coreChallenges: '核心挑战', challenge: '挑战', whyImportant: '为何重要', yourAngle: '你的切入点', interviewRounds: '面试链路', round: '第{round}轮', focus: '考察重点', hiddenRequirements: '隐藏要求' },
    hook: { title: '开场定调', ppfScript: 'P-P-F 自我介绍脚本', keyHooks: '关键钩子', hook: '钩子', evidenceSource: '来源', deliveryTips: '演讲技巧' },
    evidence: { title: '核心论据', storyLabel: '故事', matchedPainPoint: '对应 JD 痛点', situation: '背景', task: '任务', action: '行动', result: '结果', impact: '量化影响', source: '来源', sourceResume: '简历', sourceDetailedResume: '详细履历' },
    defense: { title: '弱项演练', weakness: '弱点', anticipatedQuestion: '预判追问', defenseScript: '防御话术', supportingEvidence: '支撑证据' },
    reverse: { title: '提问利器', question: '问题', askIntent: '提问意图', listenFor: '倾听重点' },
    knowledgeRefresh: { title: '知识补课' },
}

// ── Shared style helpers ──────────────────────────────────────────────────────

const CJK_FONT = "var(--font-noto-sans-sc, 'Noto Sans SC'), var(--font-geist-sans), 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif"

function sectionHead(accent: string): React.CSSProperties {
    return { margin: '0 0 12px', fontSize: '14px', fontWeight: 800, color: 'rgb(15 23 42)', borderLeft: `3px solid ${accent}`, paddingLeft: '8px', letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: '6px' }
}

function chip(accent: string): React.CSSProperties {
    return { display: 'inline-block', fontSize: '10px', fontWeight: 700, color: accent, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '3px' }
}

const fieldLabel: React.CSSProperties = { fontSize: '10px', fontWeight: 700, color: 'rgb(148 163 184)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '2px', marginTop: '8px' }
const fieldValue: React.CSSProperties = { fontSize: '12.5px', color: 'rgb(30 41 59)', lineHeight: '1.65' }
const card: React.CSSProperties = { background: 'rgb(248 250 252)', borderRadius: '6px', padding: '10px 12px', marginBottom: '8px', pageBreakInside: 'avoid', breakInside: 'avoid', border: '1px solid rgb(226 232 240)' }

// ── Main component ────────────────────────────────────────────────────────────

export function PrintInterviewView({ data, labels, accentColor = '#d97706' }: PrintInterviewViewProps) {
    const rl = { radar: { ...L.radar, ...labels?.radar }, hook: { ...L.hook, ...labels?.hook }, evidence: { ...L.evidence, ...labels?.evidence }, defense: { ...L.defense, ...labels?.defense }, reverse: { ...L.reverse, ...labels?.reverse }, knowledgeRefresh: { ...L.knowledgeRefresh, ...labels?.knowledgeRefresh } }

    return (
        <div style={{ fontFamily: CJK_FONT, fontSize: '12.5px', lineHeight: '1.65', color: 'rgb(15 23 42)', background: 'white', maxWidth: '794px', margin: '0 auto', padding: '24px 32px 40px' }}>

            {/* ── Section 1: Radar ─────────────────────────────── */}
            {data?.radar && (
                <Section>
                    <h2 style={sectionHead(accentColor)}>{rl.radar.title}</h2>

                    {/* Core Challenges */}
                    {(data.radar.core_challenges?.length ?? 0) > 0 && (
                        <>
                            <SubHead>{rl.radar.coreChallenges}</SubHead>
                            {data.radar.core_challenges!.map((c, i) => (
                                <div key={i} style={card}>
                                    <span style={chip(accentColor)}>{rl.radar.challenge} {i + 1}</span>
                                    <div style={{ ...fieldValue, fontWeight: 600, marginBottom: '6px' }}>{c.challenge}</div>
                                    <Row label={rl.radar.whyImportant} value={c.why_important} />
                                    <Row label={rl.radar.yourAngle} value={c.your_angle} />
                                </div>
                            ))}
                        </>
                    )}

                    {/* Interview Rounds */}
                    {(data.radar.interview_rounds?.length ?? 0) > 0 && (
                        <>
                            <SubHead>{rl.radar.interviewRounds}</SubHead>
                            {data.radar.interview_rounds!.map((round, i) => (
                                <div key={i} style={card}>
                                    <span style={chip(accentColor)}>{rl.radar.round.replace('{round}', String(i + 1))}: {round.round_name}</span>
                                    {round.interviewer_role && <div style={{ fontSize: '11px', color: 'rgb(100 116 139)', marginBottom: '4px' }}>{round.interviewer_role}</div>}
                                    <div style={fieldLabel}>{rl.radar.focus}</div>
                                    <ul style={{ margin: '4px 0 0', paddingLeft: '16px' }}>
                                        {round.focus_points.map((p, j) => <li key={j} style={{ ...fieldValue, marginBottom: '2px' }}>{p}</li>)}
                                    </ul>
                                </div>
                            ))}
                        </>
                    )}

                    {/* Hidden Requirements */}
                    {(data.radar.hidden_requirements?.length ?? 0) > 0 && (
                        <>
                            <SubHead>{rl.radar.hiddenRequirements}</SubHead>
                            <div style={card}>
                                <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                    {data.radar.hidden_requirements!.map((req, i) => <li key={i} style={{ ...fieldValue, marginBottom: '3px' }}>{req}</li>)}
                                </ul>
                            </div>
                        </>
                    )}
                </Section>
            )}

            {/* ── Section 2: Hook ───────────────────────────────── */}
            {data?.hook && (
                <Section>
                    <h2 style={sectionHead(accentColor)}>{rl.hook.title}</h2>

                    {data.hook.ppf_script && (
                        <>
                            <SubHead>{rl.hook.ppfScript}</SubHead>
                            <div style={{ ...card, whiteSpace: 'pre-wrap', lineHeight: '1.8', fontSize: '12.5px' }}>{data.hook.ppf_script}</div>
                        </>
                    )}

                    {(data.hook.key_hooks?.length ?? 0) > 0 && (
                        <>
                            <SubHead>{rl.hook.keyHooks}</SubHead>
                            {data.hook.key_hooks!.map((hook, i) => (
                                <div key={i} style={card}>
                                    <span style={chip(accentColor)}>{rl.hook.hook} {i + 1}</span>
                                    <div style={{ ...fieldValue, fontWeight: 600, marginBottom: '4px' }}>{hook.hook}</div>
                                    <Row label={rl.hook.evidenceSource} value={hook.evidence_source} />
                                </div>
                            ))}
                        </>
                    )}

                    {(data.hook.delivery_tips?.length ?? 0) > 0 && (
                        <>
                            <SubHead>{rl.hook.deliveryTips}</SubHead>
                            <div style={card}>
                                <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                    {data.hook.delivery_tips!.map((tip, i) => <li key={i} style={{ ...fieldValue, marginBottom: '3px' }}>{tip}</li>)}
                                </ul>
                            </div>
                        </>
                    )}
                </Section>
            )}

            {/* ── Section 3: Evidence ───────────────────────────── */}
            {data?.evidence && data.evidence.length > 0 && (
                <Section>
                    <h2 style={sectionHead(accentColor)}>{rl.evidence.title}</h2>
                    {data.evidence.map((story, i) => (
                        <div key={i} style={{ ...card, marginBottom: '12px' }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: 'rgb(15 23 42)' }}>
                                <span style={{ color: accentColor }}>{rl.evidence.storyLabel} {i + 1}</span>：{story.story_title}
                            </div>
                            <Row label={rl.evidence.matchedPainPoint} value={story.matched_pain_point} />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px', marginTop: '4px' }}>
                                <Row label={rl.evidence.situation} value={story.star.situation} />
                                <Row label={rl.evidence.task} value={story.star.task} />
                                <Row label={rl.evidence.action} value={story.star.action} />
                                <Row label={rl.evidence.result} value={story.star.result} />
                            </div>
                            <Row label={rl.evidence.impact} value={story.quantified_impact} bold />
                            {story.source && (
                                <div style={{ fontSize: '10px', color: 'rgb(148 163 184)', marginTop: '4px' }}>
                                    {rl.evidence.source}: {story.source === 'detailed_resume' ? rl.evidence.sourceDetailedResume : rl.evidence.sourceResume}
                                </div>
                            )}
                        </div>
                    ))}
                </Section>
            )}

            {/* ── Section 4: Defense ────────────────────────────── */}
            {data?.defense && data.defense.length > 0 && (
                <Section>
                    <h2 style={sectionHead(accentColor)}>{rl.defense.title}</h2>
                    {data.defense.map((item, i) => (
                        <div key={i} style={{ ...card, marginBottom: '10px' }}>
                            <span style={chip(accentColor)}>{rl.defense.weakness} {i + 1}: {item.weakness}</span>
                            <Row label={rl.defense.anticipatedQuestion} value={item.anticipated_question} />
                            <Row label={rl.defense.defenseScript} value={item.defense_script} />
                            <Row label={rl.defense.supportingEvidence} value={item.supporting_evidence} />
                        </div>
                    ))}
                </Section>
            )}

            {/* ── Section 5: Reverse Questions ──────────────────── */}
            {data?.reverse_questions && data.reverse_questions.length > 0 && (
                <Section>
                    <h2 style={sectionHead(accentColor)}>{rl.reverse.title}</h2>
                    {data.reverse_questions.map((q, i) => (
                        <div key={i} style={{ ...card, marginBottom: '8px' }}>
                            <span style={chip(accentColor)}>{rl.reverse.question} {i + 1}</span>
                            <div style={{ ...fieldValue, fontWeight: 600, marginBottom: '6px' }}>{q.question}</div>
                            <Row label={rl.reverse.askIntent} value={q.ask_intent} />
                            <Row label={rl.reverse.listenFor} value={q.listen_for} />
                        </div>
                    ))}
                </Section>
            )}

            {/* ── Section 6: Knowledge Refresh ──────────────────── */}
            {data?.knowledge_refresh && data.knowledge_refresh.length > 0 && (
                <Section>
                    <h2 style={sectionHead(accentColor)}>{rl.knowledgeRefresh.title}</h2>
                    {data.knowledge_refresh.map((topic, i) => (
                        <div key={i} style={{ ...card, marginBottom: '8px' }}>
                            <span style={{ fontWeight: 700, fontSize: '13px' }}>{i + 1}. {topic.topic}</span>
                            <div style={{ fontSize: '11px', color: 'rgb(100 116 139)', marginBottom: '4px', marginTop: '2px' }}>{topic.relevance}</div>
                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                {topic.key_points.map((p, j) => <li key={j} style={{ ...fieldValue, marginBottom: '2px' }}>{p}</li>)}
                            </ul>
                        </div>
                    ))}
                </Section>
            )}

            {/* Footer */}
            <div style={{ marginTop: '32px', paddingTop: '8px', borderTop: '1px solid rgb(226 232 240)', fontSize: '10px', color: 'rgb(148 163 184)', textAlign: 'center' }}>
                AI CareerSherpa · Generated {new Date().toLocaleDateString('zh-CN')}
            </div>
        </div>
    )
}

// ── Mini components ───────────────────────────────────────────────────────────

function Section({ children }: { children: React.ReactNode }) {
    return <div style={{ marginTop: '24px', pageBreakInside: 'avoid', breakInside: 'avoid' }}>{children}</div>
}

function SubHead({ children }: { children: React.ReactNode }) {
    return <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgb(100 116 139)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px', marginTop: '10px' }}>{children}</div>
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
    return (
        <div>
            <div style={fieldLabel}>{label}</div>
            <div style={{ ...fieldValue, ...(bold ? { fontWeight: 700 } : {}) }}>{value}</div>
        </div>
    )
}
