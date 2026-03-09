/**
 * Print Page — Server Component
 * Route: /[locale]/workbench/[serviceId]/print?type=match|interview
 *
 * Fetches match/interview data server-side and renders a fully static, print-
 * optimised view. Auto-triggers window.print() on page load via an inline
 * script so the browser print dialog opens immediately.
 */
import { redirect } from 'next/navigation'
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
    if (score >= 80) return '#059669'
    if (score >= 60) return '#d97706'
    return '#e11d48'
}

// ── Auto-print inline script ──────────────────────────────────────────────────

const AUTO_PRINT_SCRIPT = `
  (function() {
    function tryPrint() {
      if (document.readyState === 'complete') {
        // Small delay so fonts / images settle
        setTimeout(function() { window.print(); }, 300);
      } else {
        window.addEventListener('load', function() {
          setTimeout(function() { window.print(); }, 300);
        });
      }
    }
    tryPrint();
  })();
`

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

    // ── Match print ────────────────────────────────────────────────────────────
    if (type === 'match') {
        const matchJson = parseJson(service.match?.matchSummaryJson)
        if (!matchJson) {
            redirect(`/${locale}/workbench/${serviceId}`)
        }

        const jobJson = parseJson(service.job?.jobSummaryJson)
        const company =
            jobJson?.company || jobJson?.company_name || jobJson?.org || ''
        const jobTitle =
            jobJson?.jobTitle || jobJson?.job_title || jobJson?.title || ''

        const score = getMatchScore(matchJson)

        const strengths = (
            Array.isArray(matchJson?.highlights)
                ? matchJson.highlights.map((s: any) => ({
                    point: String(s ?? ''),
                    evidence: '',
                }))
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
                ? matchJson.gaps.map((g: any) => ({
                    point: String(g ?? ''),
                    evidence: '',
                }))
                : Array.isArray(matchJson?.weaknesses)
                    ? matchJson.weaknesses.map((w: any) => ({
                        point: String(w?.Point ?? w?.point ?? w ?? ''),
                        evidence: String(
                            w?.Evidence ?? w?.evidence ?? w?.suggestion ?? '',
                        ).trim(),
                    }))
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
        }

        return (
            <>
                {/* eslint-disable-next-line @next/next/no-sync-scripts */}
                <script dangerouslySetInnerHTML={{ __html: AUTO_PRINT_SCRIPT }} />
                <style>{`
          * { box-sizing: border-box; }
          body { margin: 0; background: white; }
          /* Hide site header and workbench sidebar chrome in this page */
          header, nav, [data-sidebar], aside { display: none !important; }
          .workbench-print-page { display: contents; }
          @media print {
            @page { margin: 8mm 10mm; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        `}</style>
                <PrintMatchView data={printData} labels={labels} />
            </>
        )
    }

    // ── Interview print ────────────────────────────────────────────────────────
    if (type === 'interview') {
        const interviewJson = parseJson(service.interview?.interviewTipsJson)
        if (!interviewJson) {
            redirect(`/${locale}/workbench/${serviceId}`)
        }

        const matchJson = parseJson(service.match?.matchSummaryJson)
        const score = getMatchScore(matchJson)
        const accentColor = getScoreAccentColor(score)

        const ibpDict = wbDict?.interviewBattlePlan

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
                {/* eslint-disable-next-line @next/next/no-sync-scripts */}
                <script dangerouslySetInnerHTML={{ __html: AUTO_PRINT_SCRIPT }} />
                <style>{`
          * { box-sizing: border-box; }
          body { margin: 0; background: white; }
          header, nav, [data-sidebar], aside { display: none !important; }
          .workbench-print-page { display: contents; }
          @media print {
            @page { margin: 8mm 10mm; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        `}</style>
                <PrintInterviewView
                    data={interviewJson}
                    labels={labels}
                    accentColor={accentColor}
                />
            </>
        )
    }

    // Unknown type → redirect back
    redirect(`/${locale}/workbench/${serviceId}`)
}
