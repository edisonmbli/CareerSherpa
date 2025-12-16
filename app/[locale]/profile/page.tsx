import { getDictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/i18n-config'
import Link from 'next/link'
import {
  AppCard,
  AppCardContent,
  AppCardHeader,
  AppCardTitle,
  AppCardDescription,
} from '@/components/app/AppCard'
import { AssetUploader } from '@/components/app/AssetUploader'
import { FileText, NotebookText, Sparkles, Asterisk } from 'lucide-react'
import { stackServerApp } from '@/stack/server'
import { getLatestResume, getLatestDetailedResume } from '@/lib/dal/resume'
import { listLedgerByUser } from '@/lib/dal/coinLedger'
import { LEDGER_PAGE_SIZE } from '@/lib/constants'
import { BillingFiltersClient } from '@/components/app/BillingFiltersClient'
import { RechargeWaitlistClient } from '@/components/app/RechargeWaitlistClient'
import { Button } from '@/components/ui/button'
import { LedgerGroupList } from '@/components/app/LedgerGroupList'
import { ProfileTabs } from '@/components/profile/ProfileTabs'

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

  return (
    <div className="container mx-auto px-4 py-4">
      <div className="bg-muted/60 dark:bg-muted/50 rounded-xl p-6 min-h-[calc(100vh-6rem)]">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-end mb-6">
            <Link href={`/${locale}/workbench`} className="text-sm underline">
              {locale === 'zh' ? '返回工作台' : 'Back to Workbench'}
            </Link>
          </div>

          <div className="w-full">
            <ProfileTabs defaultValue={tab} labels={p.tabs} />

            <div
              className={tab === 'assets' ? 'block space-y-6 pt-6' : 'hidden'}
            >
              <AppCard>
                <AppCardHeader>
                  <AppCardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    {p.resume.title}
                    <Asterisk className="h-3 w-3 text-red-500" />
                  </AppCardTitle>
                  <AppCardDescription>
                    {p.resume.description}
                  </AppCardDescription>
                </AppCardHeader>
                <AppCardContent>
                  <AssetUploader
                    locale={locale}
                    taskTemplateId="resume_summary"
                    initialStatus={
                      latestResume ? (latestResume.status as any) : 'IDLE'
                    }
                    initialFileName={
                      latestResume && latestResume.status === 'COMPLETED'
                        ? '个人通用简历.pdf'
                        : null
                    }
                    initialSummaryJson={latestResume?.resumeSummaryJson || null}
                    dict={p.uploader}
                    pdfNotice={dict.designSystem.samples.pdfNotice}
                    labels={{
                      ...p.previewLabels,
                      actionPreview: p.uploader.preview,
                      actionReupload: p.uploader.reupload,
                    }}
                  />
                </AppCardContent>
              </AppCard>

              <AppCard>
                <AppCardHeader>
                  <AppCardTitle className="flex items-center gap-2">
                    <NotebookText className="h-5 w-5 text-primary" />
                    {p.detailed.title}
                    <Sparkles className="h-3 w-3 text-primary" />
                  </AppCardTitle>
                  <AppCardDescription>
                    {p.detailed.description}
                  </AppCardDescription>
                </AppCardHeader>
                <AppCardContent>
                  <AssetUploader
                    locale={locale}
                    taskTemplateId="detailed_resume_summary"
                    initialStatus={
                      latestDetailed ? (latestDetailed.status as any) : 'IDLE'
                    }
                    initialFileName={
                      latestDetailed && latestDetailed.status === 'COMPLETED'
                        ? '个人详细履历.pdf'
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
                  />
                </AppCardContent>
              </AppCard>
            </div>

            <div
              className={tab === 'billing' ? 'block space-y-6 pt-6' : 'hidden'}
            >
              <AppCard>
                <AppCardHeader className="relative">
                  <div className="flex items-center justify-between">
                    <div>
                      <AppCardTitle>{p.billing.cardTitle}</AppCardTitle>
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
                <AppCardContent>
                  <div className="mb-6 md:mb-8">
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
                          String(total)
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/${locale}/profile?tab=billing&page=${Math.max(
                            1,
                            page - 1
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
                            page + 1
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
