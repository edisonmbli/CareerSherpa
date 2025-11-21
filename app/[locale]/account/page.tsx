import type { Locale } from '@/i18n-config'
import { stackServerApp } from '@/stack/server'
import { AccountSettingsClient } from '@/components/app/AccountSettingsClient'
import { getDictionary } from '@/lib/i18n/dictionaries'

export default async function AccountPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params
  await stackServerApp.getUser({ or: 'redirect' } as any)
  const dict = (await getDictionary(locale)).account
  return (
    <main className="container mx-auto px-4 py-12">
      <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight mb-6">{dict.title}</h1>
      <AccountSettingsClient locale={locale} dict={dict} />
    </main>
  )
}