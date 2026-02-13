import type { Locale } from '@/i18n-config'
import { stackServerApp } from '@/stack/server'
import { getServiceForUser } from '@/lib/dal/services'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { ServiceDisplay } from '@/components/app/ServiceDisplay'
import { getOrCreateQuota } from '@/lib/dal/quotas'
import { getLedgerSummaryByService } from '@/lib/dal/coinLedger'
import { unstable_cache } from 'next/cache'

export default async function ServicePage({
  params,
}: {
  params: Promise<{ locale: Locale; serviceId: string }>
}) {
  const { locale, serviceId } = await params
  const pageStartedAt = Date.now()
  console.info('workbench_page_start', { locale, serviceId })
  const authStartedAt = Date.now()
  const user = await stackServerApp.getUser()
  console.info('workbench_page_auth', {
    serviceId,
    ms: Date.now() - authStartedAt,
    userId: user?.id ?? null,
  })
  if (!user?.id) return null
  const getServiceForUserCached = unstable_cache(
    async () => getServiceForUser(serviceId, user.id),
    ['workbench-service', serviceId, user.id],
    { revalidate: 30 },
  )
  const serviceStartedAt = Date.now()
  const service = await getServiceForUserCached()
  console.info('workbench_page_service', {
    serviceId,
    userId: user.id,
    ms: Date.now() - serviceStartedAt,
    ok: Boolean(service),
  })
  if (!service) return null

  const dictPromise = (async () => {
    const startedAt = Date.now()
    const result = await getDictionary(locale)
    console.info('workbench_page_dict', {
      serviceId,
      ms: Date.now() - startedAt,
    })
    return result
  })()

  const quotaPromise = (async () => {
    const startedAt = Date.now()
    const result = await getOrCreateQuota(user.id)
    console.info('workbench_page_quota', {
      serviceId,
      userId: user.id,
      ms: Date.now() - startedAt,
    })
    return result
  })()

  const ledgerPromise = (async () => {
    const startedAt = Date.now()
    const result = await getLedgerSummaryByService(user.id, serviceId)
    console.info('workbench_page_ledger', {
      serviceId,
      userId: user.id,
      ms: Date.now() - startedAt,
    })
    return result
  })()

  const [dict, quota, summary] = await Promise.all([
    dictPromise,
    quotaPromise,
    ledgerPromise,
  ])
  console.info('workbench_page_ready', {
    serviceId,
    userId: user.id,
    ms: Date.now() - pageStartedAt,
  })
  const quotaBalance = quota?.balance ?? null
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
