'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ThemeToggle } from '@/components/app/ThemeToggle'
import { I18nToggleCompact } from '@/components/app/I18nToggleCompact'
import { UserMenu } from '@/components/app/UserMenu'

export function SiteHeaderClient({
  locale,
  isAuthenticated,
  quotaBalance,
  dict,
}: {
  locale: string
  isAuthenticated: boolean
  quotaBalance: number | null
  dict: {
    brand: string
    signIn: string
    myAccount?: string
    accountSettings?: string
    cvAssets?: string
    coinsBilling?: string
  }
}) {
  const pathname = usePathname()
  const isZh = /^\/zh(\/|$)/.test(pathname || '')
  const brand = isZh ? 'AI求职助手' : 'CareerShaper'
  const brandHref = isAuthenticated ? `/${locale}/workbench` : `/${locale}`

  return (
    <header className="w-full bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link href={brandHref} className="text-xl font-semibold tracking-tight">
          {brand}
        </Link>
        <div className="flex items-center gap-2">
          <I18nToggleCompact />
          <ThemeToggle />
          {isAuthenticated ? (
            <UserMenu
              locale={locale}
              dict={{
                assets: dict.cvAssets || 'CV Assets',
                billing: dict.coinsBilling || 'Coins & Billing',
              }}
            />
          ) : (
            <Button asChild size="sm" variant="outline">
              <Link
                href={`/${locale}/auth/sign-in?redirect=${encodeURIComponent(
                  pathname || '/'
                )}`}
              >
                {dict.signIn}
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
