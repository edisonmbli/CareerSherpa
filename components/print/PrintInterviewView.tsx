/**
 * PrintInterviewView — "所见即所 Print" edition.
 * Mirrors the actual InterviewBattlePlan web design:
 *   • Playfair Display section headings with left border
 *   • Rounded cards with giant numeric background watermarks
 *   • Uppercase tracking-widest mini-labels (e.g., WHY IMPORTANT)
 *   • Left-bordered highlight blocks (e.g., YOUR ANGLE)
 *   • Consistent CJK font stack setup
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
        evidence?: { title?: string; storyLabel?: string; matchedPainPoint?: string; situation?: string; task?: string; action?: string; result?: string; impact?: string; source?: string; sourceResume?: string; sourceDetailedResume?: string; storyTitle?: string }
        defense?: { title?: string; weakness?: string; anticipatedQuestion?: string; defenseScript?: string; supportingEvidence?: string }
        reverse?: { title?: string; question?: string; askIntent?: string; listenFor?: string }
        knowledgeRefresh?: { title?: string }
    }
    accentColor?: string
    meta?: {
        company?: string
        jobTitle?: string
        score?: number
        assessmentLabel?: string
    }
}

const L = {
    radar: { title: '情报透视', coreChallenges: '核心挑战', challenge: '挑战', whyImportant: '为何重要', yourAngle: '你的切入点', interviewRounds: '面试链路', round: '第{round}轮', focus: '考察重点', hiddenRequirements: '隐藏要求' },
    hook: { title: '开场定调', ppfScript: 'P-P-F 自我介绍脚本', keyHooks: '关键钩子', hook: '钩子', evidenceSource: '来源', deliveryTips: '演讲技巧' },
    evidence: { title: '核心论据', storyTitle: '故事标题', storyLabel: '故事', matchedPainPoint: '对应 JD 痛点', situation: '背景', task: '任务', action: '行动', result: '结果', impact: '量化影响', source: '来源', sourceResume: '简历', sourceDetailedResume: '详细履历' },
    defense: { title: '弱项演练', weakness: '弱点', anticipatedQuestion: '预判追问', defenseScript: '防御话术', supportingEvidence: '支撑证据' },
    reverse: { title: '提问利器', question: '问题', askIntent: '提问意图', listenFor: '倾听重点' },
    knowledgeRefresh: { title: '知识补课' },
}

// ── Shared style helpers ──────────────────────────────────────────────────────

const CJK = "var(--font-noto-sans-sc,'Noto Sans SC'),'PingFang SC','Microsoft YaHei',system-ui,sans-serif"
const SERIF = "var(--font-playfair,'Playfair Display'),'Georgia',serif"
const NOTO_SERIF = "var(--font-noto-serif,'Noto Serif'),'Georgia',serif"

function getScoreTheme(score: number) {
    if (score >= 85) {
        return { stop1: '#059669', stop2: '#34d399', text: '#059669' }
    }
    if (score >= 60) {
        return { stop1: '#d97706', stop2: '#fbbf24', text: '#d97706' }
    }
    return { stop1: '#e11d48', stop2: '#fb7185', text: '#e11d48' }
}

const S = {
    card: {
        position: 'relative',
        background: 'rgba(248,250,252,0.86)', // closer to web glass card
        border: '0.5px solid rgba(0,0,0,0.05)',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '16px',
        overflow: 'hidden',
    } as React.CSSProperties,

    cardWatermark: {
        position: 'absolute',
        top: '-8px',
        left: '-8px',
        fontSize: '80px', // 5rem equivalent
        fontWeight: 900,
        color: 'rgba(0,0,0,0.04)',
        lineHeight: 1,
        pointerEvents: 'none',
        userSelect: 'none',
    } as React.CSSProperties,

    miniLabel: {
        fontSize: '9px', // compact print scale
        fontWeight: 700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: 'rgb(100 116 139)', // muted slate
        marginBottom: '6px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
    } as React.CSSProperties,

    textValue: {
        fontSize: '12.5px',
        color: 'rgb(71 85 105)', // slate-600
        lineHeight: '1.6',
        fontFamily: NOTO_SERIF,
    } as React.CSSProperties,

    roundBullet: (accent: string): React.CSSProperties => ({
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        border: `1.5px solid ${accent}`,
        flexShrink: 0,
        marginTop: '6px',
    }),

    h4: {
        fontSize: '14.5px',
        fontWeight: 600,
        color: 'rgb(15 23 42)', // foreground slate-900
        lineHeight: 1.3,
        marginBottom: '12px',
    } as React.CSSProperties,
}

// ── Main component ────────────────────────────────────────────────────────────

export function PrintInterviewView({ data, labels, accentColor = '#059669', meta }: PrintInterviewViewProps) {
    const rl = { radar: { ...L.radar, ...labels?.radar }, hook: { ...L.hook, ...labels?.hook }, evidence: { ...L.evidence, ...labels?.evidence }, defense: { ...L.defense, ...labels?.defense }, reverse: { ...L.reverse, ...labels?.reverse }, knowledgeRefresh: { ...L.knowledgeRefresh, ...labels?.knowledgeRefresh } }
    const score = Number(meta?.score ?? 0)
    const hasScore = Number.isFinite(score) && score > 0
    const scoreTheme = getScoreTheme(score)
    const generatedAt = new Date().toLocaleString('zh-CN', { hour12: false })

    const SectionTitle = ({ children }: { children: React.ReactNode }) => (
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', paddingLeft: '8px' }}>
            <div style={{ borderLeft: `3px solid ${accentColor}`, paddingLeft: '12px', paddingBottom: '2px' }}>
                <h2 style={{ margin: 0, fontFamily: SERIF, fontSize: '23px', fontWeight: 700, color: 'rgb(15 23 42)', lineHeight: 1.2 }}>
                    {children}
                </h2>
            </div>
        </div>
    )

    const SubHeader = ({ children }: { children: React.ReactNode }) => (
        <h3 style={{ fontSize: '14.5px', fontWeight: 600, color: 'rgb(15 23 42)', marginBottom: '14px', marginTop: '14px' }}>
            {children}
        </h3>
    )

    const ListIcon = () => <span style={S.roundBullet(accentColor)} />

    const ScoreRing = ({ value }: { value: number }) => {
        const radius = 32
        const circ = 2 * Math.PI * radius
        const clamped = Math.max(0, Math.min(100, value))
        const offset = circ - (clamped / 100) * circ
        const uid = 'interview-print-score'
        return (
            <div style={{ position: 'relative', width: '64px', height: '64px', flexShrink: 0 }}>
                <svg style={{ position: 'absolute', width: 0, height: 0 }}>
                    <defs>
                        <linearGradient id={uid} x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor={scoreTheme.stop1} />
                            <stop offset="100%" stopColor={scoreTheme.stop2} />
                        </linearGradient>
                    </defs>
                </svg>
                <svg style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }} viewBox="0 0 100 100">
                    <circle stroke="#e7e5e4" strokeWidth="8" fill="transparent" r={radius} cx="50" cy="50" />
                    <circle
                        stroke={`url(#${uid})`}
                        strokeWidth="8"
                        strokeDasharray={circ}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        fill="transparent"
                        r={radius}
                        cx="50"
                        cy="50"
                    />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '16px', fontWeight: 800, color: scoreTheme.text, fontFamily: 'monospace', letterSpacing: '-0.03em' }}>
                        {Math.round(clamped)}
                    </span>
                </div>
            </div>
        )
    }

    return (
        <div style={{
            fontFamily: CJK,
            fontSize: '13.5px',
            lineHeight: '1.62',
            color: 'rgb(15 23 42)',
            background: 'white',
            maxWidth: '880px',
            margin: '0 auto',
            padding: '30px 32px 40px',
            border: '1px solid rgb(241 245 249)',
            borderRadius: '24px',
        }}>
            {(meta?.company || meta?.jobTitle || hasScore) && (
                <header style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '18px',
                    marginBottom: '30px',
                    paddingBottom: '18px',
                    borderBottom: '1px solid rgb(226 232 240)',
                    breakInside: 'avoid',
                    pageBreakInside: 'avoid',
                }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <h1 style={{ margin: 0, fontFamily: SERIF, fontSize: '26px', fontWeight: 700, color: 'rgb(15 23 42)', lineHeight: 1.2 }}>
                            {meta?.company || '—'}
                        </h1>
                        {meta?.jobTitle && (
                            <p style={{
                                margin: '6px 0 0',
                                fontSize: '10.5px',
                                color: 'rgb(100 116 139)',
                                fontWeight: 600,
                                letterSpacing: '0.08em',
                                textTransform: 'uppercase',
                            }}>
                                {meta.jobTitle}
                            </p>
                        )}
                    </div>
                    {hasScore && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                            {meta?.assessmentLabel && (
                                <span style={{
                                    fontSize: '11.5px',
                                    fontWeight: 700,
                                    letterSpacing: '0.06em',
                                    textTransform: 'uppercase',
                                    color: scoreTheme.text,
                                }}>
                                    {meta.assessmentLabel}
                                </span>
                            )}
                            <ScoreRing value={score} />
                        </div>
                    )}
                </header>
            )}

            {/* ── Section 1: Radar ─────────────────────────────── */}
            {data?.radar && (
                <section style={{ marginBottom: '34px' }}>
                    <SectionTitle>{rl.radar.title}</SectionTitle>

                    {/* Core Challenges */}
                    {(data.radar.core_challenges?.length ?? 0) > 0 && (
                        <>
                            <SubHeader>{rl.radar.coreChallenges} <span style={{ color: accentColor, fontSize: '11px', marginLeft: '6px' }}>{data.radar.core_challenges!.length}</span></SubHeader>
                            {data.radar.core_challenges!.map((c, i) => (
                                <div key={i} style={S.card}>
                                    <div style={S.cardWatermark}>{i + 1}</div>
                                    <div style={{ position: 'relative', zIndex: 1 }}>
                                        <div style={S.h4}>{c.challenge}</div>

                                        <div style={{ marginBottom: '16px' }}>
                                            <div style={S.miniLabel}>&#129517; {rl.radar.whyImportant}</div>
                                            <div style={S.textValue}>{c.why_important}</div>
                                        </div>

                                        <div style={{ borderLeft: `3px solid ${accentColor}`, paddingLeft: '16px', paddingTop: '4px', paddingBottom: '4px' }}>
                                            <div style={{ ...S.miniLabel, color: accentColor }}>&#127919; {rl.radar.yourAngle}</div>
                                            <div style={{ ...S.textValue, fontWeight: 500 }}>{c.your_angle}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </>
                    )}

                    {/* Interview Rounds */}
                    {(data.radar.interview_rounds?.length ?? 0) > 0 && (
                        <>
                            <SubHeader>{rl.radar.interviewRounds} <span style={{ color: accentColor, fontSize: '11px', marginLeft: '6px' }}>{data.radar.interview_rounds!.length}</span></SubHeader>
                            <div style={S.card}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative', zIndex: 1 }}>
                                    {data.radar.interview_rounds!.map((round, i) => (
                                        <div key={i}>
                                            <div style={{ fontSize: '14px', fontWeight: 600, color: 'rgb(15 23 42)', marginBottom: '8px' }}>
                                                {round.round_name}
                                            </div>
                                            {round.interviewer_role && <div style={{ fontSize: '11px', color: 'rgb(100 116 139)', marginBottom: '6px' }}>{round.interviewer_role}</div>}
                                            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {round.focus_points.map((p, j) => (
                                                    <li key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                                        <ListIcon />
                                                        <span style={S.textValue}>{p}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {/* Hidden Requirements */}
                    {(data.radar.hidden_requirements?.length ?? 0) > 0 && (
                        <>
                            <SubHeader>{rl.radar.hiddenRequirements} <span style={{ color: accentColor, fontSize: '11px', marginLeft: '6px' }}>{data.radar.hidden_requirements!.length}</span></SubHeader>
                            <div style={S.card}>
                                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative', zIndex: 1 }}>
                                    {data.radar.hidden_requirements!.map((req, i) => (
                                        <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                            <ListIcon />
                                            <span style={S.textValue}>{req}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </>
                    )}
                </section>
            )}

            {/* ── Section 2: Hook ───────────────────────────────── */}
            {data?.hook && (
                <section style={{ marginBottom: '34px' }}>
                    <SectionTitle>{rl.hook.title}</SectionTitle>

                    {data.hook.ppf_script && (
                        <>
                            <SubHeader>{rl.hook.ppfScript}</SubHeader>
                            <div style={{ ...S.card, padding: '24px' }}>
                                <div style={{ ...S.textValue, whiteSpace: 'pre-wrap', lineHeight: '1.8' }}>
                                    {data.hook.ppf_script}
                                </div>
                            </div>
                        </>
                    )}

                    {(data.hook.key_hooks?.length ?? 0) > 0 && (
                        <>
                            <SubHeader>{rl.hook.keyHooks}</SubHeader>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {data.hook.key_hooks!.map((hook, i) => (
                                    <div key={i} style={{ ...S.card, marginBottom: 0 }}>
                                        <div style={S.cardWatermark}>{i + 1}</div>
                                        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                            <ListIcon />
                                            <div style={{ flex: 1 }}>
                                                <div style={{ ...S.textValue, marginBottom: '6px' }}>{hook.hook}</div>
                                                <div style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', color: 'rgb(148 163 184)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    &#128196; {rl.hook.evidenceSource}: {hook.evidence_source}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {(data.hook.delivery_tips?.length ?? 0) > 0 && (
                        <>
                            <SubHeader>{rl.hook.deliveryTips}</SubHeader>
                            <div style={S.card}>
                                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative', zIndex: 1 }}>
                                    {data.hook.delivery_tips!.map((tip, i) => (
                                        <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                            <ListIcon />
                                            <span style={S.textValue}>{tip}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </>
                    )}
                </section>
            )}

            {/* ── Section 3: Evidence ───────────────────────────── */}
            {data?.evidence && data.evidence.length > 0 && (
                <section style={{ marginBottom: '34px' }}>
                    <SectionTitle>{rl.evidence.title} <span style={{ color: accentColor, fontSize: '13px', marginLeft: '12px', fontFamily: CJK, fontWeight: 500 }}>{data.evidence.length}</span></SectionTitle>

                    {data.evidence.map((story, i) => (
                        <div key={i} style={{ ...S.card, padding: '24px' }}>
                            <div style={{ ...S.cardWatermark, fontSize: '120px', top: '-16px', left: '-12px' }}>{i + 1}</div>
                            <div style={{ position: 'relative', zIndex: 1 }}>

                                <div style={{ ...S.miniLabel, marginBottom: '4px' }}>{rl.evidence.storyTitle || '故事标题'}</div>
                                <div style={{ fontSize: '16px', fontWeight: 600, color: 'rgb(15 23 42)', marginBottom: '8px' }}>
                                    {story.story_title}
                                </div>

                                <div style={{ display: 'flex', gap: '12px', fontSize: '11px', marginBottom: '20px' }}>
                                    <span style={{ color: 'rgb(100 116 139)', fontWeight: 500 }}>
                                        {rl.evidence.source}: <span style={{ color: 'rgb(71 85 105)' }}>
                                            {story.source === 'detailed_resume' ? rl.evidence.sourceDetailedResume : rl.evidence.sourceResume}
                                        </span>
                                    </span>
                                    {story.quantified_impact && (
                                        <>
                                            <span style={{ color: 'rgb(203 213 225)' }}>•</span>
                                            <span style={{ color: 'rgb(71 85 105)', fontWeight: 500 }}>{story.quantified_impact}</span>
                                        </>
                                    )}
                                </div>

                                {story.matched_pain_point && (
                                    <div style={{ marginBottom: '20px' }}>
                                        <div style={S.miniLabel}>{rl.evidence.matchedPainPoint}</div>
                                        <div style={{ borderLeft: `3px solid ${accentColor}`, paddingLeft: '16px', paddingTop: '4px', paddingBottom: '4px', ...S.textValue }}>
                                            {story.matched_pain_point}
                                        </div>
                                    </div>
                                )}

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 24px', paddingTop: '8px' }}>
                                    <div>
                                        <div style={S.miniLabel}>S · {rl.evidence.situation}</div>
                                        <div style={S.textValue}>{story.star.situation}</div>
                                    </div>
                                    <div>
                                        <div style={S.miniLabel}>T · {rl.evidence.task}</div>
                                        <div style={S.textValue}>{story.star.task}</div>
                                    </div>
                                    <div>
                                        <div style={S.miniLabel}>A · {rl.evidence.action}</div>
                                        <div style={S.textValue}>{story.star.action}</div>
                                    </div>
                                    <div>
                                        <div style={S.miniLabel}>R · {rl.evidence.result}</div>
                                        <div style={S.textValue}>{story.star.result}</div>
                                    </div>
                                </div>

                            </div>
                        </div>
                    ))}
                </section>
            )}

            {/* ── Section 4: Defense ────────────────────────────── */}
            {data?.defense && data.defense.length > 0 && (
                <section style={{ marginBottom: '34px' }}>
                    <SectionTitle>{rl.defense.title} <span style={{ color: accentColor, fontSize: '13px', marginLeft: '12px', fontFamily: CJK, fontWeight: 500 }}>{data.defense.length}</span></SectionTitle>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {data.defense.map((item, i) => (
                            <div key={i} style={{ ...S.card, marginBottom: 0 }}>
                                <div style={S.cardWatermark}>{i + 1}</div>
                                <div style={{ position: 'relative', zIndex: 1 }}>

                                    <div style={{ ...S.miniLabel, color: accentColor }}>{rl.defense.weakness}</div>
                                    <div style={{ ...S.h4, marginBottom: '16px' }}>{item.weakness}</div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                                        <div style={{ borderLeft: `3px solid rgb(226 232 240)`, paddingLeft: '16px' }}>
                                            <div style={S.miniLabel}>{rl.defense.anticipatedQuestion}</div>
                                            <div style={{ ...S.textValue, fontWeight: 500, color: 'rgb(51 65 85)' }}>{item.anticipated_question}</div>
                                        </div>

                                        <div style={{ borderLeft: `3px solid ${accentColor}`, paddingLeft: '16px' }}>
                                            <div style={{ ...S.miniLabel, color: accentColor }}>{rl.defense.defenseScript}</div>
                                            <div style={S.textValue}>{item.defense_script}</div>
                                        </div>

                                        <div style={{ borderLeft: `3px solid rgb(226 232 240)`, paddingLeft: '16px' }}>
                                            <div style={S.miniLabel}>{rl.defense.supportingEvidence}</div>
                                            <div style={S.textValue}>{item.supporting_evidence}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* ── Section 5: Reverse Questions ──────────────────── */}
            {data?.reverse_questions && data.reverse_questions.length > 0 && (
                <section style={{ marginBottom: '34px' }}>
                    <SectionTitle>{rl.reverse.title}</SectionTitle>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {data.reverse_questions.map((q, i) => (
                            <div key={i} style={{ ...S.card, marginBottom: 0 }}>
                                <div style={S.cardWatermark}>{i + 1}</div>
                                <div style={{ position: 'relative', zIndex: 1 }}>

                                    <div style={{ ...S.miniLabel, color: accentColor }}>{rl.reverse.question}</div>
                                    <div style={{ ...S.h4, marginBottom: '16px' }}>{q.question}</div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', background: 'white', padding: '16px', borderRadius: '8px' }}>
                                        <div>
                                            <div style={S.miniLabel}>{rl.reverse.askIntent}</div>
                                            <div style={S.textValue}>{q.ask_intent}</div>
                                        </div>
                                        <div>
                                            <div style={S.miniLabel}>{rl.reverse.listenFor}</div>
                                            <div style={S.textValue}>{q.listen_for}</div>
                                        </div>
                                    </div>

                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* ── Section 6: Knowledge Refresh ──────────────────── */}
            {data?.knowledge_refresh && data.knowledge_refresh.length > 0 && (
                <section style={{ marginBottom: '34px' }}>
                    <SectionTitle>{rl.knowledgeRefresh.title}</SectionTitle>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {data.knowledge_refresh.map((topic, i) => (
                            <div key={i} style={{ ...S.card, marginBottom: 0 }}>
                                <div style={S.cardWatermark}>{i + 1}</div>
                                <div style={{ position: 'relative', zIndex: 1 }}>

                                    <div style={{ ...S.h4, marginBottom: '8px' }}>{topic.topic}</div>
                                    <div style={{ fontSize: '11.5px', color: 'rgb(100 116 139)', marginBottom: '16px', fontWeight: 500 }}>
                                        {topic.relevance}
                                    </div>

                                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {topic.key_points.map((p, j) => (
                                            <li key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                                <ListIcon />
                                                <span style={S.textValue}>{p}</span>
                                            </li>
                                        ))}
                                    </ul>

                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Footer */}
            <div style={{
                marginTop: '34px',
                paddingTop: '8px',
                borderTop: '1px solid rgb(231 229 228)',
                fontSize: '9.5px',
                color: 'rgb(148 163 184)',
                letterSpacing: '0.03em',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
            }}>
                <span>面试战术报告 · AI CareerSherpa</span>
                <span>生成时间 {generatedAt}</span>
            </div>
        </div>
    )
}
