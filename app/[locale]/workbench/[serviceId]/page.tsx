import type { Locale } from '@/i18n-config'
import { stackServerApp } from '@/stack/server'
import { getServiceForUser } from '@/lib/dal/services'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { ServiceDisplay } from '@/components/app/ServiceDisplay'
import { getOrCreateQuota } from '@/lib/dal/quotas'
import { getLedgerSummaryByService } from '@/lib/dal/coinLedger'

export default async function ServicePage({
  params,
}: {
  params: Promise<{ locale: Locale; serviceId: string }>
}) {
  const { locale, serviceId } = await params
  const user = await stackServerApp.getUser()
  if (!user?.id) return null
  const service = await getServiceForUser(serviceId, user.id)
  if (!service) return null

  const dict = await getDictionary(locale)
  const quota = await getOrCreateQuota(user.id)
  const quotaBalance = quota?.balance ?? null
  const summary = await getLedgerSummaryByService(user.id, serviceId)
  const tierByLedger: 'free' | 'paid' = summary.hasAny ? 'paid' : 'free'
  const actualCost = summary.totalDelta < 0 ? Math.abs(summary.totalDelta) : 0
  return (
    <ServiceDisplay
      initialService={service}
      locale={locale}
      dict={dict}
      userId={user.id}
      quotaBalance={quotaBalance}
      lastCost={actualCost}
      tierOverride={tierByLedger}
    />
  )
}
