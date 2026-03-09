/**
 * Standalone Print Page — Server Component
 * Route: /[locale]/print/[serviceId]?type=match|interview
 *
 * Lives OUTSIDE the /workbench/ directory tree so it does NOT inherit the
 * workbench sidebar/columns layout. Only inherits the root layout (which
 * has SiteHeader — hidden via SiteHeaderClient pathname check), so the content
 * fills the full viewport cleanly.
 *
 * Auto-triggers window.print() after the page fully loads.
 */
import { redirect } from 'next/navigation'
import Script from 'next/script'
import { stackServerApp } from '@/stack/server'
import { getServiceForUser } from '@/lib/dal/services'
import { getDictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/i18n-config'
import { PrintMatchView } from '@/components/print/PrintMatchView'
import { PrintInterviewView } from '@/components/print/PrintInterviewView'

interface PageProps {
    params: Promise<{ locale: Locale; serviceId: string }>
    searchParams: Promise<{ type?: string }>
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseJson(raw: any) {
    if (!raw) return null
    if (typeof raw === 'object') return raw
    try {
        return JSON.parse(raw)
    } catch {
        return null
    }
}

function getMatchScore(data: any): number {
    if (!data) return 0
    const raw = data?.score ?? data?.match_score ?? data?.matchScore ?? 0
    const n = typeof raw === 'string' ? parseFloat(raw) : Number(raw)
    return isNaN(n) ? 0 : Math.min(100, Math.max(0, n))
}

function getScoreAccentColor(score: number): string {
    if (score >= 85) return '#059669'
    if (score >= 60) return '#d97706'
    return '#e11d48'
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function PrintPage({ params, searchParams }: PageProps) {
    const { locale, serviceId } = await params
    const { type } = await searchParams

    const user = await stackServerApp.getUser()
    if (!user?.id) {
        redirect(`/${locale}/handler/sign-in`)
    }

    const service = await getServiceForUser(serviceId, user.id)
    if (!service) {
        redirect(`/${locale}/workbench`)
    }

    const dict = await getDictionary(locale)
    const wbDict = (dict as any)?.workbench

    // ── Match ────────────────────────────────────────────────────────────────
    if (type === 'match') {
        const matchJson = parseJson(service.match?.matchSummaryJson)
        if (!matchJson) redirect(`/${locale}/workbench/${serviceId}`)

        const jobJson = parseJson(service.job?.jobSummaryJson)
        const company = jobJson?.company || jobJson?.company_name || jobJson?.org || ''
        const jobTitle = jobJson?.jobTitle || jobJson?.job_title || jobJson?.title || ''
        const score = getMatchScore(matchJson)

        const strengths = (
            Array.isArray(matchJson?.highlights)
                ? matchJson.highlights.map((s: any) => ({ point: String(s ?? ''), evidence: '' }))
                : Array.isArray(matchJson?.strengths)
                    ? matchJson.strengths.map((s: any) => ({
                        point: String(s?.Point ?? s?.point ?? s ?? ''),
                        evidence: String(s?.Evidence ?? s?.evidence ?? '').trim(),
                        section: s?.Section ?? s?.section ?? undefined,
                    }))
                    : []
        ).filter((s: any) => s.point)

        const weaknesses = (
            Array.isArray(matchJson?.gaps)
                ? matchJson.gaps.map((g: any) => ({ point: String(g ?? ''), evidence: '' }))
                : Array.isArray(matchJson?.weaknesses)
                    ? matchJson.weaknesses.map((w: any) => {
                        const point = String(w?.Point ?? w?.point ?? w ?? '')
                        const evidence = String(w?.Evidence ?? w?.evidence ?? w?.suggestion ?? '').trim()
                        const tip = typeof w?.tip === 'object' && w.tip !== null
                            ? { interview: w.tip.interview ?? '', resume: w.tip.resume ?? '' }
                            : typeof w?.tip === 'string'
                                ? { interview: w.tip, resume: '' }
                                : undefined
                        return { point, evidence, ...(tip ? { tip } : {}) }
                    })
                    : []
        ).filter((w: any) => w.point)

        const recommendations = Array.isArray(matchJson?.recommendations)
            ? matchJson.recommendations.map((r: any) => String(r ?? '').trim()).filter(Boolean)
            : []

        const dmScript =
            typeof matchJson?.dm_script === 'string'
                ? matchJson.dm_script
                : typeof matchJson?.cover_letter_script?.script === 'string'
                    ? matchJson.cover_letter_script.script
                    : ''

        const expertVerdict = String(matchJson?.overall_assessment || '').trim()

        const printData = {
            score,
            ...(expertVerdict ? { expertVerdict } : {}),
            strengths,
            weaknesses,
            recommendations,
            ...(dmScript ? { dmScript } : {}),
            ...(company ? { company } : {}),
            ...(jobTitle ? { jobTitle } : {}),
        }

        const labels = {
            overallAssessment: wbDict?.resultCard?.overallAssessment,
            highlights: wbDict?.resultCard?.highlights,
            gapsAndSuggestions: wbDict?.resultCard?.gapsAndSuggestions,
            recommendations: wbDict?.resultCard?.recommendations,
            smartPitch: wbDict?.resultCard?.smartPitch?.label,
            highlyMatched: wbDict?.resultCard?.highlyMatched,
            goodFit: wbDict?.resultCard?.goodFit,
            lowMatch: wbDict?.resultCard?.lowMatch,
            resumeTweak: wbDict?.resultCard?.resumeTweak,
            interviewPrep: wbDict?.resultCard?.interviewPrep,
        }

        return (
            <>
                {/* Auto-print once the page is fully interactive */}
                <Script id="auto-print" strategy="afterInteractive">{`
          setTimeout(function() { window.print(); }, 1500);
        `}</Script>
                <PrintMatchView data={printData} labels={labels} />
            </>
        )
    }

    // ── Interview ─────────────────────────────────────────────────────────────
    if (type === 'interview') {
        const interviewJson = parseJson(service.interview?.interviewTipsJson)
        if (!interviewJson) redirect(`/${locale}/workbench/${serviceId}`)

        const matchJson = parseJson(service.match?.matchSummaryJson)
        const score = getMatchScore(matchJson)
        const accentColor = getScoreAccentColor(score)
        const jobJson = parseJson(service.job?.jobSummaryJson)
        const company = jobJson?.company || jobJson?.company_name || jobJson?.org || ''
        const jobTitle = jobJson?.jobTitle || jobJson?.job_title || jobJson?.title || ''

        const ibpDict = wbDict?.interviewBattlePlan
        const assessmentLabel = score >= 85
            ? (wbDict?.resultCard?.highlyMatched || '高度匹配')
            : score >= 60
                ? (wbDict?.resultCard?.goodFit || '良好匹配')
                : (wbDict?.resultCard?.lowMatch || '低度匹配')

        const labels = {
            radar: {
                title: ibpDict?.radar?.title,
                coreChallenges: ibpDict?.radar?.coreChallenges,
                challenge: ibpDict?.radar?.challenge,
                whyImportant: ibpDict?.radar?.whyImportant,
                yourAngle: ibpDict?.radar?.yourAngle,
                interviewRounds: ibpDict?.radar?.interviewRounds,
                round: ibpDict?.radar?.round,
                focus: ibpDict?.radar?.focus,
                hiddenRequirements: ibpDict?.radar?.hiddenRequirements,
            },
            hook: {
                title: ibpDict?.hook?.title,
                ppfScript: ibpDict?.hook?.ppfScript,
                keyHooks: ibpDict?.hook?.keyHooks,
                hook: ibpDict?.hook?.hook,
                evidenceSource: ibpDict?.hook?.evidenceSource,
                deliveryTips: ibpDict?.hook?.deliveryTips,
            },
            evidence: {
                title: ibpDict?.evidence?.title,
                storyTitle: ibpDict?.evidence?.storyTitle,
                storyLabel: ibpDict?.evidence?.storyLabel,
                matchedPainPoint: ibpDict?.evidence?.matchedPainPoint,
                situation: ibpDict?.evidence?.situation,
                task: ibpDict?.evidence?.task,
                action: ibpDict?.evidence?.action,
                result: ibpDict?.evidence?.result,
                impact: ibpDict?.evidence?.impact,
                source: ibpDict?.evidence?.source,
                sourceResume: ibpDict?.evidence?.sourceResume,
                sourceDetailedResume: ibpDict?.evidence?.sourceDetailedResume,
            },
            defense: {
                title: ibpDict?.defense?.title,
                weakness: ibpDict?.defense?.weakness,
                anticipatedQuestion: ibpDict?.defense?.anticipatedQuestion,
                defenseScript: ibpDict?.defense?.defenseScript,
                supportingEvidence: ibpDict?.defense?.supportingEvidence,
            },
            reverse: {
                title: ibpDict?.reverse?.title,
                question: ibpDict?.reverse?.question,
                askIntent: ibpDict?.reverse?.askIntent,
                listenFor: ibpDict?.reverse?.listenFor,
            },
            knowledgeRefresh: {
                title: ibpDict?.knowledgeRefresh?.title,
            },
        }

        return (
            <>
                <Script id="auto-print" strategy="afterInteractive">{`
          setTimeout(function() { window.print(); }, 1500);
        `}</Script>
                <PrintInterviewView
                    data={interviewJson}
                    labels={labels}
                    accentColor={accentColor}
                    meta={{
                        ...(company ? { company } : {}),
                        ...(jobTitle ? { jobTitle } : {}),
                        ...(score > 0 ? { score } : {}),
                        assessmentLabel,
                    }}
                />
            </>
        )
    }

    // Unknown type → redirect
    redirect(`/${locale}/workbench/${serviceId}`)
}
