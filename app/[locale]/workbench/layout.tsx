import type { Locale } from '@/i18n-config'
import { stackServerApp } from '@/stack/server'
import { prisma as db } from '@/lib/prisma'
import Link from 'next/link'
import { SidebarClient } from '@/components/app/SidebarClient'
import { Sheet, SheetTrigger, SheetContent } from '@/components/ui/sheet'
import { WorkbenchColumns } from '@/components/workbench/WorkbenchColumns'

export default async function WorkbenchLayout(props: any) {
  const { children, params } = props
  const { locale } = await params
  const user = await stackServerApp.getUser()
  const userId = user?.id || null
  let quotaBalance: number | null = null
  let services: Array<{ id: string; title: string | null; createdAt: Date; matchStatus?: string | null; customizeStatus?: string | null; interviewStatus?: string | null; queueType?: 'paid' | 'free' | null }> = []
  if (userId) {
    const quota = await db.quota.findFirst({ where: { userId } })
    quotaBalance = quota?.balance ?? null
    const raw = await db.service.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, match: { select: { status: true } }, customizedResume: { select: { status: true } }, interview: { select: { status: true } } },
    })
    const jobs = await db.job.findMany({ where: { serviceId: { in: raw.map((s) => s.id) } }, select: { serviceId: true, jobSummaryJson: true } })
    const titleMap = new Map(jobs.map((j) => [j.serviceId, j.jobSummaryJson as any]))
    // 读取最近一次 LLM 使用日志以推断队列类型（paid/free）
    const logs = await db.llmUsageLog.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 100, select: { serviceId: true, cost: true } })
    const typeMap = new Map<string, 'paid' | 'free'>(logs.filter((l) => !!l.serviceId).map((l) => [l.serviceId as string, Number(l.cost || 0) > 0 ? 'paid' : 'free']))
    services = raw.map((s) => ({ id: s.id, createdAt: s.createdAt, title: stringifyTitle(titleMap.get(s.id)), matchStatus: s.match?.status ?? null, customizeStatus: s.customizedResume?.status ?? null, interviewStatus: s.interview?.status ?? null, queueType: typeMap.get(s.id) ?? null }))
  }

  return (
    <div className="container mx-auto px-4 py-4">
      <div className="lg:hidden mb-4">
        <Sheet>
          <SheetTrigger className="inline-flex items-center rounded-md border px-3 py-2 text-sm">菜单</SheetTrigger>
          <SheetContent side="left" className="w-[85vw] sm:w-[360px] p-0">
            <div className="p-4">
              <SidebarClient locale={locale} quotaBalance={quotaBalance} services={services} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
      <div className="bg-muted/60 dark:bg-muted/50 rounded-xl p-6 min-h-[calc(100vh-6rem)]">
        <WorkbenchColumns sidebar={<SidebarClient locale={locale} quotaBalance={quotaBalance} services={services} />}>{children}</WorkbenchColumns>
      </div>
    </div>
  )
}

function stringifyTitle(summary: any): string | null {
  if (!summary) return null
  try {
    const obj = typeof summary === 'string' ? JSON.parse(summary) : summary
    const t = obj?.job_title || obj?.title || ''
    return t ? String(t) : null
  } catch {
    return null
  }
}