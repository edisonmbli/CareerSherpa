import type { Locale } from '@/i18n-config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { SignIn } from '@stackframe/stack'

export default async function SignInPage({ params, searchParams }: { params: Promise<{ locale: Locale }>; searchParams: Promise<{ redirect?: string }> }) {
  const { locale } = await params
  const sp = await searchParams
  const dict = await getDictionary(locale)
  const title = locale === 'zh' ? '登录' : 'Sign in'
  const redirect = sp?.redirect || `/${locale}/workbench`
  return (
    <main className="container mx-auto px-4 py-12">
      <div className="flex flex-col items-center">
        <div className="w-full max-w-xl">
          <SignIn automaticRedirect />
        </div>
      </div>
    </main>
  )
}