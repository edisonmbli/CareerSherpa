import type { Locale } from '@/i18n-config'
import { stackServerApp } from '@/stack/server'
import { getServiceForUser, getServiceStatusForUser } from '@/lib/dal/services'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { ServiceDisplay } from '@/components/app/ServiceDisplay'
import { getOrCreateQuota } from '@/lib/dal/quotas'
import { getLedgerSummaryByService } from '@/lib/dal/coinLedger'
import { unstable_cache } from 'next/cache'
import { logInfo } from '@/lib/logger'
import {
  WORKBENCH_LEDGER_CACHE_SECONDS,
  WORKBENCH_QUOTA_CACHE_SECONDS,
  WORKBENCH_RECENT_COMPLETION_WINDOW_MS,
} from '@/lib/constants'

const isTerminalStatus = (status: string | null | undefined) => {
  if (!status) return false
  if (status === 'COMPLETED' || status === 'FAILED') return true
  if (status.endsWith('_COMPLETED') || status.endsWith('_FAILED')) return true
  return false
}

const getLatestUpdatedAt = (snapshot: {
  updatedAt?: Date | null
  match?: { updatedAt?: Date | null } | null
  customizedResume?: { updatedAt?: Date | null } | null
  interview?: { updatedAt?: Date | null } | null
}) => {
  const timestamps = [
    snapshot.updatedAt?.getTime(),
    snapshot.match?.updatedAt?.getTime(),
    snapshot.customizedResume?.updatedAt?.getTime(),
    snapshot.interview?.updatedAt?.getTime(),
  ].filter((value): value is number => typeof value === 'number')
  if (!timestamps.length) return null
  return Math.max(...timestamps)
}

export default async function ServicePage({
  params,
}: {
  params: Promise<{ locale: Locale; serviceId: string }>
}) {
  const { locale, serviceId } = await params
  const pageStartedAt = Date.now()
  logInfo({
    reqId: serviceId,
    route: 'workbench/page',
    phase: 'start',
    locale,
  })
  const authStartedAt = Date.now()
  const user = await stackServerApp.getUser()
  logInfo({
    reqId: serviceId,
    route: 'workbench/page',
    phase: 'auth',
    serviceId,
    ms: Date.now() - authStartedAt,
    ...(user?.id ? { userKey: user.id } : {}),
  })
  if (!user?.id) return null
  const dictPromise = (async () => {
    const startedAt = Date.now()
    const result = await getDictionary(locale)
    logInfo({
      reqId: serviceId,
      route: 'workbench/page',
      phase: 'dict',
      serviceId,
      ms: Date.now() - startedAt,
    })
    return result
  })()
  const getQuotaCached = unstable_cache(
    async () => getOrCreateQuota(user.id),
    ['workbench-quota', user.id],
    { revalidate: WORKBENCH_QUOTA_CACHE_SECONDS },
  )
  const quotaPromise = (async () => {
    const startedAt = Date.now()
    const result = await getQuotaCached()
    logInfo({
      reqId: serviceId,
      route: 'workbench/page',
      phase: 'quota',
      serviceId,
      userKey: user.id,
      ms: Date.now() - startedAt,
    })
    return result
  })()
  const getLedgerCached = unstable_cache(
    async () => getLedgerSummaryByService(user.id, serviceId),
    ['workbench-ledger', serviceId, user.id],
    { revalidate: WORKBENCH_LEDGER_CACHE_SECONDS },
  )
  const ledgerPromise = (async () => {
    const startedAt = Date.now()
    const result = await getLedgerCached()
    logInfo({
      reqId: serviceId,
      route: 'workbench/page',
      phase: 'ledger',
      serviceId,
      userKey: user.id,
      ms: Date.now() - startedAt,
    })
    return result
  })()
  const statusSnapshotPromise = getServiceStatusForUser(serviceId, user.id)
  const statusSnapshot = await statusSnapshotPromise
  const isTerminal = isTerminalStatus(statusSnapshot?.currentStatus ?? null)
  const latestUpdatedAt = statusSnapshot
    ? getLatestUpdatedAt(statusSnapshot)
    : null
  const isFreshTerminal =
    isTerminal &&
    latestUpdatedAt !== null &&
    Date.now() - latestUpdatedAt < WORKBENCH_RECENT_COMPLETION_WINDOW_MS
  const getServiceForUserCached = unstable_cache(
    async () => getServiceForUser(serviceId, user.id),
    ['workbench-service', serviceId, user.id],
    { revalidate: 6 },
  )
  const serviceStartedAt = Date.now()
  const service =
    isTerminal && !isFreshTerminal
      ? await getServiceForUserCached()
      : await getServiceForUser(serviceId, user.id)
  logInfo({
    reqId: serviceId,
    route: 'workbench/page',
    phase: 'service',
    serviceId,
    userKey: user.id,
    ms: Date.now() - serviceStartedAt,
    ok: Boolean(service),
  })
  if (!service) return null

  const [dict, quota, summary] = await Promise.all([
    dictPromise,
    quotaPromise,
    ledgerPromise,
  ])
  logInfo({
    reqId: serviceId,
    route: 'workbench/page',
    phase: 'ready',
    serviceId,
    userKey: user.id,
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
