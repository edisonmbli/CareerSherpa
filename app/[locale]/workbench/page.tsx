import { WorkbenchServer } from '@/components/workbench/workbench-server'
import type { Locale } from '@/i18n-config'

export default async function WorkbenchPage({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  const resolvedParams = await params
  const locale = resolvedParams.locale

  return <WorkbenchServer locale={locale} />
}
