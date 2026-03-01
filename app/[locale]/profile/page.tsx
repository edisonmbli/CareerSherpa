import { getDictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/i18n-config'
import { Metadata } from 'next'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>
}): Promise<Metadata> {
  const { locale } = await params
  const dict = await getDictionary(locale)
  return {
    title: `${dict.profile.title} | AI CareerSherpa`,
  }
}
import Link from 'next/link'
import {
  AppCard,
  AppCardContent,
  AppCardHeader,
  AppCardTitle,
} from '@/components/app/AppCard'
import { AssetUploader } from '@/components/app/AssetUploader'
import { FileText, NotebookText, Lock } from 'lucide-react'
import { stackServerApp } from '@/stack/server'
import { getLatestResume, getLatestDetailedResume } from '@/lib/dal/resume'
import { listLedgerByUser } from '@/lib/dal/coinLedger'
import { LEDGER_PAGE_SIZE } from '@/lib/constants'
import { BillingFiltersClient } from '@/components/app/BillingFiltersClient'
import { RechargeWaitlistClient } from '@/components/app/RechargeWaitlistClient'
import { ResumeGuidanceTooltip } from '@/components/resume/ResumeGuidanceTooltip'
import { Button } from '@/components/ui/button'
import { LedgerGroupList } from '@/components/app/LedgerGroupList'
import { ProfileTabs } from '@/components/profile/ProfileTabs'
import { ResumePanelClient } from '@/components/profile/ResumePanelClient'
import { AssetProgressClient } from '@/components/profile/AssetProgressClient'
import { cn } from '@/lib/utils'

type ParsedProfile = {
  career_persona: string
  experience_focus: string
  years_of_experience: number
  domain_expertise: string[]
  hard_skills: string[]
  signature_project: {
    project_name: string
    core_impact: string
  }
  core_strengths: Array<{
    trait: string
    evidence: string
  }>
}

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>
  searchParams: Promise<{
    tab?: string
    page?: string
    type?: string
    status?: string
    tpl?: string
    svc?: string
    after?: string
    before?: string
  }>
}) {
  const { locale } = await params
  await stackServerApp.getUser({ or: 'redirect' } as any)
  const dict = await getDictionary(locale)
  const p = dict.profile
  const w = dict.workbench
  const sp = await searchParams
  const tab =
    sp?.tab === 'billing' || sp?.tab === 'assets' ? sp!.tab! : 'assets'
  const page = Math.max(1, Number(sp?.page || '1'))
  const fType = (sp?.type || '') as any
  const fStatus = (sp?.status || '') as any
  const fTemplate = (sp?.tpl || '') as string
  const fService = (sp?.svc || '') as string
  const fAfter = sp?.after ? new Date(String(sp.after)) : undefined
  const fBefore = sp?.before ? new Date(String(sp.before)) : undefined
  const user = await stackServerApp.getUser()
  const latestResume = user ? await getLatestResume(user.id) : null
  const latestDetailed = user ? await getLatestDetailedResume(user.id) : null
  const hasGeneral = latestResume?.status === 'COMPLETED'
  const hasDetailed = latestDetailed?.status === 'COMPLETED'
  const assetProgress = hasGeneral ? (hasDetailed ? 100 : 60) : 0
  const parsedProfile =
    (latestResume as any)?.parsedProfileJson ||
    (latestResume as any)?.resumeSummaryJson?.parsed_profile_json ||
    null
  const normalizedProfile: ParsedProfile | null = parsedProfile
    ? {
        career_persona: String(parsedProfile?.career_persona || ''),
        experience_focus: String(parsedProfile?.experience_focus || ''),
        years_of_experience: Number.isFinite(
          Number(parsedProfile?.years_of_experience),
        )
          ? Number(parsedProfile?.years_of_experience)
          : 0,
        domain_expertise: Array.isArray(parsedProfile?.domain_expertise)
          ? parsedProfile.domain_expertise
          : [],
        hard_skills: Array.isArray(parsedProfile?.hard_skills)
          ? parsedProfile.hard_skills
          : [],
        signature_project:
          parsedProfile?.signature_project &&
          typeof parsedProfile.signature_project === 'object'
            ? {
                project_name: String(
                  parsedProfile.signature_project.project_name || '',
                ),
                core_impact: String(
                  parsedProfile.signature_project.core_impact || '',
                ),
              }
            : { project_name: '', core_impact: '' },
        core_strengths: Array.isArray(parsedProfile?.core_strengths)
          ? parsedProfile.core_strengths
          : [],
      }
    : null

  // Fetch quota balance for UX guard
  let quotaBalance = 0
  if (user?.id) {
    const { getOrCreateQuota } = await import('@/lib/dal/quotas')
    const quota = await getOrCreateQuota(user.id)
    quotaBalance = quota.balance
  }

  const ledgerData = user
    ? await listLedgerByUser(user.id, page, LEDGER_PAGE_SIZE, {
        type:
          fType &&
          [
            'SIGNUP_BONUS',
            'PURCHASE',
            'SERVICE_DEBIT',
            'FAILURE_REFUND',
            'MANUAL_ADJUST',
          ].includes(fType)
            ? fType
            : undefined,
        status:
          fStatus &&
          ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'].includes(fStatus)
            ? fStatus
            : undefined,
        templateId: fTemplate || undefined,
        serviceId: fService || undefined,
        after: fAfter,
        before: fBefore,
      })
    : { items: [], total: 0 }
  const ledger = (ledgerData as any).items || []
  const total = Number((ledgerData as any).total || 0)
  const pageCount = Math.max(1, Math.ceil(total / LEDGER_PAGE_SIZE))
  const surfaceClass = cn(
    'w-full relative overflow-visible',
    'bg-white dark:bg-[#121212]',
    'border border-slate-200 dark:border-[#2A2A2A]',
    'shadow-sm ring-1 ring-black/5 dark:shadow-xl',
    'rounded-2xl backdrop-blur-2xl',
  )
  const surfaceStyle = {
    backgroundImage: 'url("/noise.svg")',
  }

  return (
    <div className="container mx-auto px-4 py-4 bg-slate-50/50 dark:bg-[#0a0a0a]">
      <div className="min-h-[calc(100vh-6rem)]">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-end mb-6">
            <Link href={`/${locale}/workbench`} className="text-sm underline">
              {w.sidebar.backToWorkbench}
            </Link>
          </div>

          <div className="w-full">
            <ProfileTabs defaultValue={tab} labels={p.tabs} />

            <div
              className={
                tab === 'assets'
                  ? 'mt-6 md:mt-8 space-y-6 md:space-y-8'
                  : 'hidden'
              }
            >
              <div
                className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-900/5 p-6 sm:p-8 dark:bg-[#121212] dark:ring-white/10"
                style={surfaceStyle}
              >
                <AssetProgressClient
                  initialProgress={assetProgress}
                  lead={p.assetProgress.lead}
                  level0={p.assetProgress.level0}
                  level60={p.assetProgress.level60}
                  level100={p.assetProgress.level100}
                />
              </div>
              <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-900/5 p-6 md:p-8 flex flex-col dark:bg-[#121212] dark:ring-white/10">
                <ResumePanelClient
                  locale={locale}
                  resumeTitle={p.resume.title}
                  resumeDescription={p.resume.description}
                  requiredBadge={p.resume.requiredBadge}
                  detailedTitle={p.detailed.title}
                  uploaderDict={p.uploader}
                  pdfNotice={dict.designSystem.samples.pdfNotice}
                  previewLabels={p.previewLabels}
                  quotaBalance={quotaBalance}
                  statusTextDict={w.statusText}
                  notificationDict={w.notification}
                  latestResumeStatus={latestResume?.status || 'IDLE'}
                  latestResumeFileName={
                    latestResume && latestResume.status === 'COMPLETED'
                      ? p.resume.defaultFileName
                      : null
                  }
                  resumeSummaryJson={latestResume?.resumeSummaryJson || null}
                  hasGeneral={hasGeneral}
                  normalizedProfile={normalizedProfile}
                  profilePanel={p.profilePanel}
                  workbenchHref={`/${locale}/workbench`}
                />
              </div>

              <div className="mt-6 lg:col-span-12">
                <div
                  className={cn(
                    'bg-white rounded-2xl shadow-sm ring-1 ring-slate-900/5 p-6 sm:p-8 dark:bg-[#121212] dark:ring-white/10',
                    !hasGeneral &&
                      'opacity-50 pointer-events-none saturate-50 grayscale-[50%]',
                  )}
                  style={surfaceStyle}
                >
                  <div className="relative">
                    {!hasGeneral && (
                      <div className="absolute right-0 top-0 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <Lock className="h-3.5 w-3.5" />
                        <span>{p.detailed.lockHint}</span>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 relative">
                      <div className="flex items-center gap-2.5">
                        <div className="flex items-center justify-center w-7 h-7 shrink-0 rounded-lg bg-slate-100 dark:bg-white/[0.06]">
                          <NotebookText className="h-4 w-4 text-primary" />
                        </div>
                        <span className="text-lg sm:text-xl font-[family-name:var(--font-playfair),serif] font-bold tracking-tight whitespace-nowrap">
                          {p.detailed.title}
                        </span>
                      </div>
                      <ResumeGuidanceTooltip
                        triggerClassName="inline-flex items-center gap-0.5 rounded bg-blue-50 px-2 py-0.5 text-xs font-light text-blue-500 ring-1 ring-inset ring-blue-100/10 dark:bg-blue-400/10 dark:text-blue-400 dark:ring-blue-400/10"
                        examples={{
                          ...(p.detailed.examples as any),
                          tips: p.resume.tips,
                        }}
                      >
                        {p.detailed.badge}
                      </ResumeGuidanceTooltip>
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-4 mt-3 relative">
                      {p.detailed.description}
                    </div>
                    <div className="mt-6 relative">
                      <AssetUploader
                        locale={locale}
                        taskTemplateId="detailed_resume_summary"
                        initialStatus={
                          latestDetailed
                            ? (latestDetailed.status as any)
                            : 'IDLE'
                        }
                        initialFileName={
                          latestDetailed &&
                          latestDetailed.status === 'COMPLETED'
                            ? p.detailed.defaultFileName
                            : null
                        }
                        initialSummaryJson={
                          latestDetailed?.detailedSummaryJson || null
                        }
                        dict={p.uploader}
                        pdfNotice={dict.designSystem.samples.pdfNotice}
                        labels={{
                          ...p.previewLabels,
                          actionPreview: p.uploader.preview,
                          actionReupload: p.uploader.reupload,
                        }}
                        quotaBalance={quotaBalance}
                        statusTextDict={w.statusText}
                        notificationDict={w.notification}
                        resumeTitle={p.resume.title}
                        detailedTitle={p.detailed.title}
                        dimmed={!hasGeneral}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div
              className={
                tab === 'billing'
                  ? 'block mt-6 md:mt-8 space-y-6 md:space-y-8'
                  : 'hidden'
              }
            >
              <AppCard
                padded={false}
                className={surfaceClass}
                style={surfaceStyle}
              >
                <AppCardHeader className="relative pt-3 pb-2 sm:pt-4 sm:pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <AppCardTitle className="text-[15px] font-medium tracking-tight text-foreground/90">
                        {p.billing.cardTitle}
                      </AppCardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <BillingFiltersClient
                        mode="button"
                        locale={locale}
                        dict={p.billing}
                      />
                      <RechargeWaitlistClient
                        locale={locale}
                        dict={{ ...p.billing, ...p.waitlist }}
                      />
                    </div>
                  </div>
                </AppCardHeader>
                <AppCardContent className="pt-0">
                  <div className="mb-2 md:mb-4">
                    <BillingFiltersClient
                      mode="panel"
                      locale={locale}
                      dict={p.billing}
                    />
                  </div>
                  {Array.isArray(ledger) && ledger.length > 0 ? (
                    <div>
                      <LedgerGroupList
                        items={ledger as any}
                        locale={locale}
                        dict={p.billing}
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="text-lg font-medium mb-1">
                        {p.billing.empty.title}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {p.billing.empty.desc}
                      </div>
                      <div className="mt-6">
                        <Link href={`/${locale}/profile?tab=assets`}>
                          <Button variant="default" size="sm">
                            {p.billing.empty.cta}
                          </Button>
                        </Link>
                      </div>
                    </div>
                  )}
                  {Array.isArray(ledger) && ledger.length > 0 && (
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-xs text-muted-foreground">
                        {p.billing.pagination.total.replace(
                          '{total}',
                          String(total),
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/${locale}/profile?tab=billing&page=${Math.max(
                            1,
                            page - 1,
                          )}${fType ? `&type=${fType}` : ''}${
                            fStatus ? `&status=${fStatus}` : ''
                          }${fTemplate ? `&tpl=${fTemplate}` : ''}${
                            fService ? `&svc=${fService}` : ''
                          }${fAfter ? `&after=${fAfter.toISOString()}` : ''}${
                            fBefore ? `&before=${fBefore.toISOString()}` : ''
                          }`}
                          className={`px-2 py-0.5 rounded border text-xs ${
                            page <= 1 ? 'opacity-40 pointer-events-none' : ''
                          }`}
                        >
                          {p.billing.pagination.prev}
                        </Link>
                        <span className="text-xs">
                          {p.billing.pagination.page
                            .replace('{page}', String(page))
                            .replace('{pages}', String(pageCount))}
                        </span>
                        <Link
                          href={`/${locale}/profile?tab=billing&page=${Math.min(
                            pageCount,
                            page + 1,
                          )}${fType ? `&type=${fType}` : ''}${
                            fStatus ? `&status=${fStatus}` : ''
                          }${fTemplate ? `&tpl=${fTemplate}` : ''}${
                            fService ? `&svc=${fService}` : ''
                          }${fAfter ? `&after=${fAfter.toISOString()}` : ''}${
                            fBefore ? `&before=${fBefore.toISOString()}` : ''
                          }`}
                          className={`px-2 py-0.5 rounded border text-xs ${
                            page >= pageCount
                              ? 'opacity-40 pointer-events-none'
                              : ''
                          }`}
                        >
                          {p.billing.pagination.next}
                        </Link>
                      </div>
                    </div>
                  )}
                </AppCardContent>
              </AppCard>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
