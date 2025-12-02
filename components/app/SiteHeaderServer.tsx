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
  const headerDict = (await getDictionary(locale as any)).header ?? {
    brand: locale === 'zh' ? 'AI求职助手' : 'CareerShaper',
    signIn: locale === 'zh' ? '登录' : 'Sign in',
    coins: locale === 'zh' ? '金币' : 'Coins',
    assets: locale === 'zh' ? '资产管理' : 'Assets',
    billing: locale === 'zh' ? '金币与账单' : 'Coins & Billing',
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
