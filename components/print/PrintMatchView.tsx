/**
 * PrintMatchView — A4-optimised static match result view.
 * Uses Noto Sans SC (already loaded by root layout) for CJK rendering.
 * Designed to look close to the original ResultCard web UI.
 */
import React from 'react'

interface StrengthItem {
    point: string
    evidence?: string
    section?: string
}

interface WeaknessItem {
    point: string
    evidence?: string
}

interface PrintMatchData {
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
        matchScore?: string
    }
}

function getScoreColor(score: number) {
    if (score >= 80) return '#059669'
    if (score >= 60) return '#d97706'
    return '#e11d48'
}

function getScoreBg(score: number) {
    if (score >= 80) return '#d1fae5'
    if (score >= 60) return '#fef3c7'
    return '#ffe4e6'
}

export function PrintMatchView({ data, labels }: PrintMatchViewProps) {
    const {
        score,
        expertVerdict,
        strengths,
        weaknesses,
        recommendations = [],
        dmScript,
        company,
        jobTitle,
    } = data

    const accent = getScoreColor(score)
    const scoreBg = getScoreBg(score)

    // A4 at screen: 794px; we use max-width + auto margins
    return (
        <div style={{
            fontFamily: "var(--font-noto-sans-sc, 'Noto Sans SC'), var(--font-geist-sans), 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif",
            fontSize: '13px',
            lineHeight: '1.7',
            color: 'rgb(15 23 42)',
            background: 'white',
            maxWidth: '794px',
            margin: '0 auto',
            padding: '28px 32px 40px',
            minHeight: '297mm',
        }}>

            {/* ── Header ─────────────────────────────────────────── */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: `2px solid ${accent}`,
                paddingBottom: '14px',
                marginBottom: '20px',
            }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, lineHeight: 1.2, color: 'rgb(15 23 42)', letterSpacing: '-0.02em' }}>
                        {company || '—'}
                    </h1>
                    {jobTitle && (
                        <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'rgb(100 116 139)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                            {jobTitle}
                        </p>
                    )}
                </div>
                <div style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '50%',
                    background: accent,
                    color: 'white',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '20px',
                    flexShrink: 0,
                    boxShadow: `0 0 0 4px ${scoreBg}`,
                }}>
                    {score}
                </div>
            </div>

            {/* ── Overall Assessment ──────────────────────────────── */}
            {expertVerdict && (
                <Section accent={accent}>
                    <SectionHeading accent={accent}>{labels?.overallAssessment || '综合评估'}</SectionHeading>
                    <div style={{
                        padding: '12px 14px',
                        background: 'rgb(248 250 252)',
                        borderRadius: '6px',
                        fontSize: '13px',
                        lineHeight: '1.75',
                        color: 'rgb(30 41 59)',
                    }}>
                        {expertVerdict}
                    </div>
                </Section>
            )}

            {/* ── Strengths ──────────────────────────────────────── */}
            {strengths.length > 0 && (
                <Section accent={accent}>
                    <SectionHeading accent={accent}>{labels?.highlights || '优势亮点'}</SectionHeading>
                    <NumberedList items={strengths.map(s => ({ main: s.point, ...(s.evidence || s.section ? { sub: s.evidence || s.section } : {}) }))} accent={accent} />
                </Section>
            )}

            {/* ── Gaps ──────────────────────────────────────────── */}
            {weaknesses.length > 0 && (
                <Section accent={accent}>
                    <SectionHeading accent={accent}>{labels?.gapsAndSuggestions || '差距与应对'}</SectionHeading>
                    <NumberedList items={weaknesses.map(w => ({ main: w.point, ...(w.evidence ? { sub: w.evidence } : {}) }))} accent={accent} />
                </Section>
            )}

            {/* ── Recommendations ───────────────────────────────── */}
            {recommendations.length > 0 && (
                <Section accent={accent}>
                    <SectionHeading accent={accent}>{labels?.recommendations || '行动建议'}</SectionHeading>
                    <NumberedList items={recommendations.map(r => ({ main: String(r) }))} accent={accent} />
                </Section>
            )}

            {/* ── Smart Pitch ───────────────────────────────────── */}
            {dmScript && (
                <Section accent={accent}>
                    <SectionHeading accent={accent}>{labels?.smartPitch || 'Smart Pitch'}</SectionHeading>
                    <div style={{
                        padding: '12px 14px',
                        background: 'rgb(248 250 252)',
                        border: `1px solid ${scoreBg}`,
                        borderLeft: `3px solid ${accent}`,
                        borderRadius: '6px',
                        fontSize: '13px',
                        lineHeight: '1.8',
                        whiteSpace: 'pre-wrap',
                        color: 'rgb(30 41 59)',
                    }}>
                        {dmScript}
                    </div>
                </Section>
            )}

            {/* Footer */}
            <div style={{
                marginTop: '32px',
                paddingTop: '8px',
                borderTop: '1px solid rgb(226 232 240)',
                fontSize: '10px',
                color: 'rgb(148 163 184)',
                textAlign: 'center',
            }}>
                AI CareerSherpa · Generated {new Date().toLocaleDateString('zh-CN')}
            </div>
        </div>
    )
}

// ── Sub-components ─────────────────────────────────────────

function Section({ children, accent }: { children: React.ReactNode; accent: string }) {
    return (
        <div style={{
            marginTop: '20px',
            pageBreakInside: 'avoid',
            breakInside: 'avoid',
        }}>
            {children}
        </div>
    )
}

function SectionHeading({ children, accent }: { children: React.ReactNode; accent: string }) {
    return (
        <h2 style={{
            margin: '0 0 10px',
            fontSize: '13px',
            fontWeight: 700,
            color: 'rgb(15 23 42)',
            letterSpacing: '0.04em',
            borderLeft: `3px solid ${accent}`,
            paddingLeft: '8px',
            textTransform: 'none',
        }}>
            {children}
        </h2>
    )
}

function NumberedList({ items, accent }: { items: Array<{ main: string; sub?: string }>; accent: string }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {items.map((item, i) => (
                <div key={i} style={{
                    display: 'flex',
                    gap: '10px',
                    padding: '8px 10px',
                    background: i % 2 === 0 ? 'rgb(248 250 252)' : 'white',
                    borderRadius: '4px',
                    pageBreakInside: 'avoid',
                    breakInside: 'avoid',
                }}>
                    <span style={{
                        fontWeight: 700,
                        fontSize: '12px',
                        color: accent,
                        flexShrink: 0,
                        width: '18px',
                        lineHeight: '1.7',
                    }}>
                        {i + 1}.
                    </span>
                    <div>
                        <span style={{ fontSize: '13px', color: 'rgb(30 41 59)', lineHeight: '1.7' }}>
                            {item.main}
                        </span>
                        {item.sub && (
                            <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'rgb(100 116 139)', lineHeight: '1.55' }}>
                                {item.sub}
                            </p>
                        )}
                    </div>
                </div>
            ))}
        </div>
    )
}
