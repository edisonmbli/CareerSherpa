'use client'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Languages } from 'lucide-react'
import { switchLocalePath } from '@/components/app/I18nToggle'
import type { Locale } from '@/i18n-config'

/**
 * @desc Compact icon-only language toggle for the global header.
 *
 * Why we write the cookie here:
 *   - router.push only changes the URL, not the server-side locale preference.
 *   - On subsequent visits to '/', the middleware reads the cookie to decide
 *     which locale to redirect to, preventing any "flash of wrong language".
 *   - We set max-age to 1 year (31536000s) so the preference is long-lived.
 */
export function I18nToggleCompact() {
  const pathname = usePathname() || '/'
  const router = useRouter()
  const isZh = /^\/zh(\/|$)/.test(pathname)
  const nextLocale: Locale = isZh ? 'en' : 'zh'

  const onToggle = () => {
    // 1. Persist preference as a cookie so middleware can read it server-side
    document.cookie = `lang=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`

    // 2. Navigate to the equivalent page in the new locale
    const next = switchLocalePath(pathname, nextLocale)
    router.push(next)
  }

  return (
    <Button aria-label="Toggle language" size="icon" variant="ghost" onClick={onToggle}>
      <Languages className="h-4 w-4" />
    </Button>
  )
}