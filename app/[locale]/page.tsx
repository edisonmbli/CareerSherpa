import { redirect } from 'next/navigation'
import { Locale } from '@/i18n-config'

interface Props {
  params: {
    locale: Locale
  }
}

export default function LocaleRootPage({ params }: Props) {
  // 重定向到工作台页面
  redirect(`/${params.locale}/workbench`)
}