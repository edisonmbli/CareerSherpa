import { redirect } from 'next/navigation'
import { Locale } from '@/i18n-config'

interface Props {
  params: {
    locale: Locale
  }
}

export default async function LocaleRootPage({ params }: Props) {
  // Next.js 15 要求异步读取动态 API（params）
  const p = await Promise.resolve(params)
  redirect(`/${p.locale}/workbench`)
}