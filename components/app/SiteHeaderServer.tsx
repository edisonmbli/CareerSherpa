import { headers } from 'next/headers'
import { stackServerApp } from '@/stack/server'
import { prisma as db } from '@/lib/prisma'
import { SiteHeaderClient } from '@/components/app/SiteHeaderClient'
import { getDictionary } from '@/lib/i18n/dictionaries'

export default async function SiteHeaderServer() {
  const h = await headers()
  const locale = h.get('x-locale') || 'en'
  const user = await stackServerApp.getUser()
  let quotaBalance: number | null = null
  if (user?.id) {
    const quota = await db.quota.findFirst({ where: { userId: user.id } })
    quotaBalance = quota?.balance ?? null
  }
  const headerDict = (await getDictionary(locale as any)).shell ?? {
    brand: 'AI CareerSherpa',
    signIn: 'Sign in',
    coins: 'Coins',
    assets: 'Assets',
    billing: 'Coins & Billing',
  }
  return (
    <SiteHeaderClient
      locale={locale}
      isAuthenticated={Boolean(user)}
      quotaBalance={quotaBalance}
      dict={headerDict}
    />
  )
}
