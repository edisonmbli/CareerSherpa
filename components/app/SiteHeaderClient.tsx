'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ThemeToggle } from '@/components/app/ThemeToggle'
import { I18nToggleCompact } from '@/components/app/I18nToggleCompact'
import { cn } from '@/lib/utils'
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
  dict: any
}) {
  const pathname = usePathname()
  const brand = dict.brand || 'AI CareerSherpa'
  const brandHref = isAuthenticated ? `/${locale}/workbench` : `/${locale}`

  const isWorkbench = pathname?.includes('/workbench')
  const isResumeShare = pathname?.includes('/r/')

  if (isResumeShare) return null

  return (
    <header
      className={cn(
        'w-full bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 border-b border-border/40 print:hidden',
        isWorkbench && 'hidden md:block',
      )}
    >
      <div
        className={cn(
          'container mx-auto px-4 py-3 flex items-center justify-between transition-all',
          // Reserve space for mobile menu button in workbench
          isWorkbench && 'pl-12 lg:pl-4'
        )}
      >
        <Link href={brandHref} className="text-xl font-semibold tracking-tight flex items-center gap-1.5 group">
          <span className="bg-foreground text-background w-[1.8em] h-[1.3em] inline-flex items-center justify-center rounded-md text-[0.75em] font-bold leading-none transition-transform group-hover:scale-105">
            AI
          </span>
          <span>CareerSherpa</span>
        </Link>
        <div className="flex items-center gap-2">
          <I18nToggleCompact />
          <ThemeToggle />
          {isAuthenticated ? (
            <UserMenu
              locale={locale}
              dict={{ shell: dict }}
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
