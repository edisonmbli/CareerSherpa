import { getOrCreateQuota } from '@/lib/dal/quotas'

/**
 * Decide which tier to use based on user quota.
 * Returns true for free tier when credits are exhausted or zero.
 */
export async function checkQuotaForService(userId: string): Promise<{
  shouldUseFreeQueue: boolean
  remainingCredits: number
}> {
  const quota = await getOrCreateQuota(userId)
  const remaining = quota?.balance ?? 0
  return {
    shouldUseFreeQueue: remaining <= 0,
    remainingCredits: remaining,
  }
}