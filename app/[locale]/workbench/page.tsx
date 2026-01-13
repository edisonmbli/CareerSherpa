// Server Component for workbench route
// Minimal stub to satisfy Next.js App Router module requirements

import type { Locale } from '@/i18n-config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { stackServerApp } from '@/stack/server'
import { prisma as db } from '@/lib/prisma'
import { NewServiceForm } from '@/components/app/NewServiceForm'
import { getOrCreateQuota } from '@/lib/dal/quotas'

export default async function WorkbenchPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params
  const user = await stackServerApp.getUser()
  const hasResume = user?.id
    ? Boolean(
      await db.resume.findFirst({ where: { userId: user.id, status: 'COMPLETED' } })
    )
    : false

  // Fetch quota balance for UX guard
  let quotaBalance = 0
  if (user?.id) {
    const quota = await getOrCreateQuota(user.id)
    quotaBalance = quota.balance
  }

  const dict = await getDictionary(locale)
  const w = dict.workbench
  return (
    <div className="space-y-6">
      <NewServiceForm
        locale={locale}
        dict={w.new}
        tabsDict={w.tabs}
        statusDict={w.statusText}
        notificationDict={w.notification}
        hasResume={hasResume}
        quotaBalance={quotaBalance}
      />
    </div>
  )
}