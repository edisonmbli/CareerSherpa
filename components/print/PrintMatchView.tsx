/**
 * PrintMatchView — "所见即所 Print" edition.
 * Mirrors the actual ResultCard / AnalysisAccordion / ExpertVerdict web design:
 *   • SVG radial progress ring (identical gradient stops)
 *   • Playfair Display section headings
 *   • Timeline vertical line + dot bullets  
 *   • Evidence & tip.resume / tip.interview chips
 *   • ExpertVerdict sparkle label + warm card
 *   • Score thresholds: ≥85 emerald, ≥60 amber, <60 rose (matching MATCH_SCORE_THRESHOLDS)
 */
import React from 'react'

// ── Types (mirroring ResultCard internals) ───────────────────────────────────

export interface StrengthItem {
    point: string
    evidence?: string
    section?: string
}

export interface WeaknessItem {
    point: string
    evidence?: string
    tip?: { interview?: string; resume?: string } | string
}

export interface PrintMatchData {
    score: number
    expertVerdict?: string | undefined
    strengths: StrengthItem[]
    weaknesses: WeaknessItem[]
    recommendations?: string[] | undefined
    dmScript?: string | undefined
    company?: string | undefined
    jobTitle?: string | undefined
}

interface PrintMatchViewProps {
    data: PrintMatchData
    labels?: {
        overallAssessment?: string
        highlights?: string
        gapsAndSuggestions?: string
        recommendations?: string
        smartPitch?: string
        highlyMatched?: string
        goodFit?: string
        lowMatch?: string
        resumeTweak?: string
        interviewPrep?: string
    }
}

// ── Theme helpers (matching MATCH_SCORE_THRESHOLDS: 85 / 60) ─────────────────

function getTheme(score: number) {
    if (score >= 85) {
        return { stop1: '#059669', stop2: '#34d399', text: '#059669', bg: '#d1fae5', border: '#6ee7b7', label: '高度匹配' }
    }
    if (score >= 60) {
        return { stop1: '#d97706', stop2: '#fbbf24', text: '#d97706', bg: '#fef3c7', border: '#fcd34d', label: '良好匹配' }
    }
    return { stop1: '#e11d48', stop2: '#fb7185', text: '#e11d48', bg: '#ffe4e6', border: '#fda4af', label: '低度匹配' }
}

const CJK = "var(--font-noto-sans-sc,'Noto Sans SC'),'PingFang SC','Microsoft YaHei',system-ui,sans-serif"
const SERIF = "var(--font-playfair,'Playfair Display'),'Georgia',serif"
const NOTO_SERIF = "var(--font-noto-serif,'Noto Serif'),'Georgia',serif"

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreRing({ score, theme }: { score: number; theme: ReturnType<typeof getTheme> }) {
    const radius = 36
    const circ = 2 * Math.PI * radius
    const offset = circ - (score / 100) * circ
    const uid = `sg-print`
    return (
        <div style={{ position: 'relative', width: '72px', height: '72px', flexShrink: 0 }}>
            <svg style={{ position: 'absolute', width: 0, height: 0 }}>
                <defs>
                    <linearGradient id={uid} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={theme.stop1} />
                        <stop offset="100%" stopColor={theme.stop2} />
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
                <span style={{ fontSize: '18px', fontWeight: 800, color: theme.text, fontFamily: 'monospace', letterSpacing: '-0.04em' }}>
                    {score}
                </span>
            </div>
        </div>
    )
}

function SectionTitle({ children, theme }: { children: React.ReactNode; theme: ReturnType<typeof getTheme> }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px', paddingLeft: '8px' }}>
            <div style={{ borderLeft: `3px solid ${theme.text}`, paddingLeft: '10px', paddingBottom: '2px' }}>
                <span style={{
                    fontFamily: SERIF,
                    fontSize: '18px',
                    fontWeight: 700,
                    color: 'rgb(28 25 23)',
                    lineHeight: 1.2,
                    letterSpacing: '-0.01em',
                }}>
                    {children}
                </span>
            </div>
        </div>
    )
}

type TipObj = { interview?: string; resume?: string }

function TimelineList({
    items,
    theme,
    labels,
    withTip = false,
}: {
    items: any[]
    theme: ReturnType<typeof getTheme>
    labels?: { resumeTweak?: string | undefined; interviewPrep?: string | undefined }
    withTip?: boolean
}) {
    return (
        <div style={{ paddingLeft: '12px', borderLeft: '1px solid rgb(214 211 209 / 0.6)', marginLeft: '12px' }}>
            {items.map((item, idx) => {
                const isStr = typeof item === 'string'
                const point = isStr ? item : (item.point || String(item))
                const evidence = isStr ? undefined : item.evidence
                const tip: TipObj | undefined = withTip && !isStr && item.tip
                    ? (typeof item.tip === 'object' ? item.tip : { interview: String(item.tip) })
                    : undefined

                return (
                    <div key={idx} style={{ position: 'relative', paddingLeft: '24px', paddingBottom: '28px' }}>
                        {/* Dot */}
                        <div style={{
                            position: 'absolute',
                            left: '-5px',
                            top: '6px',
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: theme.text,
                            boxShadow: `0 0 0 3px white, 0 0 0 4px ${theme.border}`,
                        }} />

                        {/* Point */}
                        <div style={{
                            fontFamily: NOTO_SERIF,
                            fontSize: '13px',
                            lineHeight: '1.65',
                            color: 'rgb(41 37 36)',
                        }}>
                            {point}
                        </div>

                        {/* Evidence */}
                        {evidence && (
                            <div style={{
                                marginTop: '5px',
                                fontSize: '11.5px',
                                color: 'rgb(120 113 108)',
                                lineHeight: '1.55',
                            }}>
                                {evidence}
                            </div>
                        )}

                        {/* Tip chips */}
                        {tip && (tip.resume || tip.interview) && (
                            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {tip.resume && (
                                    <div>
                                        <div style={{
                                            fontSize: '9px',
                                            fontWeight: 700,
                                            letterSpacing: '0.08em',
                                            textTransform: 'uppercase',
                                            color: theme.text,
                                            marginBottom: '2px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                        }}>
                                            &#128196; {labels?.resumeTweak || '简历调整'}
                                        </div>
                                        <div style={{ fontSize: '12px', color: 'rgb(87 83 78)', lineHeight: 1.55, paddingLeft: '2px' }}>
                                            {tip.resume}
                                        </div>
                                    </div>
                                )}
                                {tip.interview && (
                                    <div>
                                        <div style={{
                                            fontSize: '9px',
                                            fontWeight: 700,
                                            letterSpacing: '0.08em',
                                            textTransform: 'uppercase',
                                            color: theme.text,
                                            marginBottom: '2px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                        }}>
                                            &#127908; {labels?.interviewPrep || '面试建议'}
                                        </div>
                                        <div style={{ fontSize: '12px', color: 'rgb(87 83 78)', lineHeight: 1.55, paddingLeft: '2px' }}>
                                            {tip.interview}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function PrintMatchView({ data, labels }: PrintMatchViewProps) {
    const { score, expertVerdict, strengths, weaknesses, recommendations = [], dmScript, company, jobTitle } = data
    const theme = getTheme(score)

    const assessmentLabel = score >= 85
        ? (labels?.highlyMatched || theme.label)
        : score >= 60
            ? (labels?.goodFit || theme.label)
            : (labels?.lowMatch || theme.label)

    return (
        <div style={{
            fontFamily: CJK,
            fontSize: '13px',
            color: 'rgb(15 23 42)',
            background: 'white',
            maxWidth: '794px',
            margin: '0 auto',
            padding: '36px 40px 48px',
        }}>

            {/* ── Header ─────────────────────────────────────────────────────────── */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '36px',
            }}>
                <div style={{ flex: 1, minWidth: 0, paddingRight: '20px' }}>
                    <h1 style={{
                        margin: 0,
                        fontFamily: SERIF,
                        fontSize: '28px',
                        fontWeight: 700,
                        lineHeight: 1.2,
                        color: 'rgb(28 25 23)',
                        letterSpacing: '-0.02em',
                    }}>
                        {company || '—'}
                    </h1>
                    {jobTitle && (
                        <p style={{
                            margin: '6px 0 0',
                            fontSize: '11px',
                            color: 'rgb(120 113 108)',
                            fontWeight: 600,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                        }}>
                            {jobTitle}
                        </p>
                    )}
                </div>

                {/* Score + label */}
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                    <span style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: theme.text,
                    }}>
                        {assessmentLabel}
                    </span>
                    <ScoreRing score={score} theme={theme} />
                </div>
            </div>

            {/* ── Expert Verdict ─────────────────────────────────────────────────── */}
            {expertVerdict && (
                <div style={{
                    position: 'relative',
                    marginBottom: '36px',
                    background: `${theme.bg}40`,
                    border: `1px solid ${theme.border}40`,
                    borderRadius: '12px',
                    padding: '20px 24px',
                    overflow: 'hidden',
                }}>
                    {/* Big quote watermark */}
                    <div style={{
                        position: 'absolute',
                        top: '-24px',
                        left: '-4px',
                        fontSize: '120px',
                        fontFamily: SERIF,
                        lineHeight: 1,
                        color: `${theme.text}08`,
                        pointerEvents: 'none',
                        userSelect: 'none',
                    }}>
                        &ldquo;
                    </div>
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            marginBottom: '10px',
                        }}>
                            <span style={{ fontSize: '13px', color: theme.text }}>✦</span>
                            <span style={{
                                fontSize: '9px',
                                fontWeight: 700,
                                letterSpacing: '0.1em',
                                textTransform: 'uppercase',
                                color: theme.text,
                            }}>
                                {labels?.overallAssessment || '专家评估'}
                            </span>
                        </div>
                        <p style={{
                            margin: 0,
                            fontFamily: NOTO_SERIF,
                            fontSize: '13px',
                            lineHeight: '1.75',
                            color: 'rgb(68 64 60)',
                        }}>
                            {expertVerdict}
                        </p>
                    </div>
                </div>
            )}

            {/* ── Strengths ──────────────────────────────────────────────────────── */}
            {strengths.length > 0 && (
                <div style={{ marginBottom: '32px' }}>
                    <SectionTitle theme={theme}>{labels?.highlights || '亮点分析'}</SectionTitle>
                    <TimelineList items={strengths} theme={theme} />
                </div>
            )}

            {/* ── Gaps ───────────────────────────────────────────────────────────── */}
            {weaknesses.length > 0 && (
                <div style={{ marginBottom: '32px' }}>
                    <SectionTitle theme={theme}>{labels?.gapsAndSuggestions || '差距与应对'}</SectionTitle>
                    <TimelineList
                        items={weaknesses}
                        theme={theme}
                        withTip
                        labels={{ resumeTweak: labels?.resumeTweak, interviewPrep: labels?.interviewPrep }}
                    />
                </div>
            )}

            {/* ── Recommendations ────────────────────────────────────────────────── */}
            {recommendations.length > 0 && (
                <div style={{ marginBottom: '32px' }}>
                    <SectionTitle theme={theme}>{labels?.recommendations || '行动建议'}</SectionTitle>
                    <TimelineList items={recommendations} theme={theme} />
                </div>
            )}

            {/* ── Smart Pitch ────────────────────────────────────────────────────── */}
            {dmScript && (
                <div style={{ marginBottom: '32px', pageBreakBefore: 'auto' }}>
                    <SectionTitle theme={theme}>{labels?.smartPitch || '沟通话术'}</SectionTitle>
                    <div style={{
                        padding: '16px 18px',
                        background: 'rgb(250 250 249)',
                        border: `1px solid ${theme.border}60`,
                        borderLeft: `3px solid ${theme.text}`,
                        borderRadius: '8px',
                        fontSize: '13px',
                        lineHeight: '1.8',
                        whiteSpace: 'pre-wrap',
                        fontFamily: NOTO_SERIF,
                        color: 'rgb(41 37 36)',
                    }}>
                        {dmScript}
                    </div>
                </div>
            )}

            {/* Footer */}
            <div style={{
                marginTop: '40px',
                paddingTop: '10px',
                borderTop: '1px solid rgb(231 229 228)',
                fontSize: '10px',
                color: 'rgb(168 162 158)',
                textAlign: 'center',
                letterSpacing: '0.04em',
            }}>
                AI CareerSherpa · {new Date().toLocaleDateString('zh-CN')}
            </div>
        </div>
    )
}
