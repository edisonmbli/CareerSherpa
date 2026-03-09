import type { Locale } from '@/i18n-config'
import { stackServerApp } from '@/stack/server'
import { prisma as db } from '@/lib/prisma'
import Link from 'next/link'
import { SidebarClient } from '@/components/app/SidebarClient'
import { MobileDrawer } from '@/components/workbench/MobileDrawer'
import { WorkbenchColumns } from '@/components/workbench/WorkbenchColumns'
import { NeuralNetworkBackground } from '@/components/ui/neural-network-bg'
import { PostHogProvider } from '@/components/analytics/PostHogProvider'

import { getDictionary } from '@/lib/i18n/dictionaries'

export default async function WorkbenchLayout(props: any) {
  const { children, params } = props
  const { locale } = await params
  const dict = await getDictionary(locale)
  const user = await stackServerApp.getUser()
  const userId = user?.id || null
  let quotaBalance: number | null = null
  let services: Array<{
    id: string
    title: string | null
    createdAt: Date
    updatedAt?: Date
    lastUpdatedAt?: Date
    currentStatus?: string | null
    matchStatus?: string | null
    customizeStatus?: string | null
    interviewStatus?: string | null
    jobStatus?: string | null
    queueType?: 'paid' | 'free' | null
  }> = []
  if (userId) {
    const quota = await db.quota.findFirst({ where: { userId } })
    quotaBalance = quota?.balance ?? null
    const raw = await db.service.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        lastUpdatedAt: true,
        currentStatus: true,
        match: { select: { status: true, updatedAt: true } },
        customizedResume: { select: { status: true, updatedAt: true } },
        interview: { select: { status: true, updatedAt: true } },
      },
    })
    const jobs = await db.job.findMany({
      where: { serviceId: { in: raw.map((s) => s.id) } },
      select: {
        serviceId: true,
        jobSummaryJson: true,
        status: true,
        updatedAt: true,
      },
    })
    const titleMap = new Map(
      jobs.map((j) => [j.serviceId, j.jobSummaryJson as any])
    )
    const statusMap = new Map(jobs.map((j) => [j.serviceId, j.status as any]))
    const svcIds = raw.map((s) => s.id)
    const ledgers = await db.coinTransaction.findMany({
      where: { userId, serviceId: { in: svcIds }, type: 'SERVICE_DEBIT' },
      select: { serviceId: true, delta: true, createdAt: true },
    })
    const typeMap = new Map<string, 'paid' | 'free'>()
    for (const l of ledgers) {
      if (!l?.serviceId) continue
      const paid = Number(l.delta || 0) < 0
      if (paid) typeMap.set(String(l.serviceId), 'paid')
      else if (!typeMap.has(String(l.serviceId)))
        typeMap.set(String(l.serviceId), 'free')
    }
    services = raw.map((s) => {
      const jobUpd = jobs.find((j) => j.serviceId === s.id)?.updatedAt
      const candidates = [
        s.updatedAt,
        s.createdAt,
        jobUpd,
        s.match?.updatedAt,
        s.customizedResume?.updatedAt,
        s.interview?.updatedAt,
      ].filter(Boolean) as Date[]
      const aggregatedLatest =
        candidates.length > 0
          ? new Date(Math.max(...candidates.map((d) => new Date(d).getTime())))
          : s.updatedAt
      const latest = s.lastUpdatedAt ?? aggregatedLatest
      return {
        id: s.id,
        createdAt: s.createdAt,
        updatedAt: latest,
        ...(s.lastUpdatedAt ? { lastUpdatedAt: s.lastUpdatedAt } : {}),
        currentStatus: s.currentStatus ? String(s.currentStatus) : null,
        title: stringifyTitle(titleMap.get(s.id)),
        matchStatus: s.match?.status ? String(s.match.status) : null,
        customizeStatus: s.customizedResume?.status
          ? String(s.customizedResume.status)
          : null,
        interviewStatus: s.interview?.status
          ? String(s.interview.status)
          : null,
        jobStatus: statusMap.get(s.id) ?? null,
        queueType: typeMap.get(s.id) ?? null,
      }
    })
    services.sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt).getTime() -
        new Date(a.updatedAt || a.createdAt).getTime()
    )
  }

  return (
    <PostHogProvider scope="workbench" locale={locale}>
      <div className="container mx-auto sm:px-6 md:px-8 sm:py-6 flex flex-col min-h-0 h-[calc(100vh-4rem)] sm:h-[calc(100vh-4rem-3rem)]">
        {/* V7 Ambient Background Layer (Neural Network Visual Echo) */}
        <NeuralNetworkBackground variant="workbench" className="fixed print:hidden" />

        <div className="lg:hidden mb-0 sm:mb-8 flex items-center px-6 pt-4 sm:px-0 sm:pt-0 relative z-[50]">
          <MobileDrawer
            locale={locale}
            quotaBalance={quotaBalance}
            services={services.map((s) => ({
              id: s.id,
              title: s.title,
              createdAt: s.createdAt,
              ...(s.updatedAt ? { updatedAt: s.updatedAt } : {}),
            }))}
            dict={dict}
          />
        </div>
        <div className="flex-1 flex flex-col min-h-0 relative z-10">
          <WorkbenchColumns
            sidebar={
              <SidebarClient
                locale={locale}
                quotaBalance={quotaBalance}
                services={services}
                dict={dict}
              />
            }
          >
            {children}
          </WorkbenchColumns>
        </div>
      </div>
    </PostHogProvider>
  )
}

function stringifyTitle(summary: any): string | null {
  if (!summary) return null
  try {
    const obj = typeof summary === 'string' ? JSON.parse(summary) : summary
    const company = obj?.company || obj?.company_name || obj?.org || ''
    const title = obj?.jobTitle || obj?.job_title || obj?.title || ''
    const c = company ? String(company) : ''
    const t = title ? String(title) : ''
    if (c && t) return `${c} - ${t}`
    if (t) return t
    return null
  } catch {
    return null
  }
}
