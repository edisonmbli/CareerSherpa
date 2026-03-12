// Server Component for workbench route
// Minimal stub to satisfy Next.js App Router module requirements

import type { Locale } from '@/i18n-config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { stackServerApp } from '@/stack/server'
import { prisma as db } from '@/lib/prisma'
import { NewServiceForm } from '@/components/app/NewServiceForm'
import { getOrCreateQuota } from '@/lib/dal/quotas'
import { Metadata } from 'next'
import { FounderFeedbackDialog } from '@/components/feedback/FounderFeedbackDialog'
import {
  FeedbackFabButton,
  feedbackFabDesktopSlotClassName,
  feedbackFabMobileSlotClassName,
} from '@/components/feedback/feedback-fab'

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params
  const dict = await getDictionary(locale)
  return {
    title: `${dict.workbench_title.split(' · ')[1] || 'Workbench'} | AI CareerSherpa`,
  }
}

export default async function WorkbenchPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params
  const user = await stackServerApp.getUser()
  const latestResume = user?.id
    ? await db.resume.findFirst({
      where: { userId: user.id },
      select: { status: true, resumeSummaryJson: true },
    })
    : null
  const isAssetReady = Boolean(
    latestResume?.status === 'COMPLETED' && latestResume?.resumeSummaryJson,
  )

  // Fetch quota balance for UX guard
  let quotaBalance = 0
  if (user?.id) {
    const quota = await getOrCreateQuota(user.id)
    quotaBalance = quota.balance
  }

  const dict = await getDictionary(locale)
  const w = dict.workbench
  return (
    <>
      <div className="flex-1 flex flex-col min-h-0 max-w-4xl mx-auto w-full">
        <NewServiceForm
          locale={locale}
          dict={w.new}
          tabsDict={w.tabs}
          statusDict={w.statusText}
          notificationDict={w.notification}
          isAssetReady={isAssetReady}
          quotaBalance={quotaBalance}
        />
      </div>
      <div className={feedbackFabDesktopSlotClassName}>
        <FounderFeedbackDialog
          labels={dict.feedbackInbox}
          context={{
            locale,
            surface: 'workbench',
            tab: 'create-service',
            extras: {
              createServiceState: true,
              currentTabStatus: isAssetReady
                ? 'READY_TO_CREATE'
                : 'ASSET_REQUIRED',
              isAssetReady,
              quotaBalance,
            },
          }}
          trigger={<FeedbackFabButton tooltip={dict.feedbackInbox.tooltip} />}
        />
      </div>
      <div className={feedbackFabMobileSlotClassName}>
        <FounderFeedbackDialog
          labels={dict.feedbackInbox}
          context={{
            locale,
            surface: 'workbench',
            tab: 'create-service',
            extras: {
              createServiceState: true,
              currentTabStatus: isAssetReady
                ? 'READY_TO_CREATE'
                : 'ASSET_REQUIRED',
              isAssetReady,
              quotaBalance,
            },
          }}
          trigger={<FeedbackFabButton tooltip={dict.feedbackInbox.tooltip} />}
        />
      </div>
    </>
  )
}
