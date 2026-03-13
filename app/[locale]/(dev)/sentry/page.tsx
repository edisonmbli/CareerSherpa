import { SentryDevPanel } from '@/components/dev/SentryDevPanel'
import type { Locale } from '@/i18n-config'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-950">Sentry local verification</h1>
        <p className="max-w-2xl text-sm leading-6 text-slate-600">
          Locale: {locale}. Trigger one event per runtime, then confirm the issue arrives in the matching Sentry project.
        </p>
      </div>
      <SentryDevPanel />
    </div>
  )
}
