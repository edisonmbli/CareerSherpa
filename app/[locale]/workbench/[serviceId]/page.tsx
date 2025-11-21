import type { Locale } from '@/i18n-config'
import { stackServerApp } from '@/stack/server'
import { prisma as db } from '@/lib/prisma'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { ServiceDisplay } from '@/components/app/ServiceDisplay'

export default async function ServicePage({ params }: { params: Promise<{ locale: Locale; serviceId: string }> }) {
  const { locale, serviceId } = await params
  const user = await stackServerApp.getUser()
  if (!user?.id) return null
  const service = await db.service.findFirst({ where: { id: serviceId, userId: user.id }, include: { job: true, match: true, customizedResume: true, interview: true } })
  if (!service) return null
  const dict = await getDictionary(locale)
  return <ServiceDisplay initialService={service} locale={locale} dict={dict} userId={user.id} />
}