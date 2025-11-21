// Server Component for workbench route
// Minimal stub to satisfy Next.js App Router module requirements

import type { Locale } from '@/i18n-config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { stackServerApp } from '@/stack/server'
import { prisma as db } from '@/lib/prisma'
import { NewServiceForm } from '@/components/app/NewServiceForm'

export default async function WorkbenchPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params
  const user = await stackServerApp.getUser()
  const hasResume = user?.id
    ? Boolean(
        await db.resume.findFirst({ where: { userId: user.id, status: 'COMPLETED' } })
      )
    : false
  const dict = await getDictionary(locale)
  const w = dict.workbench
  return (
    <div className="space-y-6">
      <NewServiceForm locale={locale} dict={w.new} hasResume={hasResume} />
    </div>
  )
}