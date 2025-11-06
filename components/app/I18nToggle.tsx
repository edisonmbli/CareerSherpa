'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { usePathname, useRouter } from 'next/navigation'
import type { Locale } from '@/i18n-config'

export function switchLocalePath(currentPathname: string, nextLocale: Locale): string {
  const normalized = currentPathname || '/'
  const match = normalized.match(/^\/(en|zh)(?:\/(.*))?$/)
  if (match) {
    const rest = match[2] ? `/${match[2]}` : ''
    return `/${nextLocale}${rest}`
  }
  // If no locale segment, prefix with next locale
  return `/${nextLocale}${normalized.startsWith('/') ? normalized : `/${normalized}`}`
}

interface I18nToggleProps {
  className?: string
}

export function I18nToggle({ className }: I18nToggleProps) {
  const pathname = usePathname()
  const router = useRouter()

  const go = React.useCallback(
    (target: Locale) => {
      const next = switchLocalePath(pathname ?? '/', target)
      router.push(next)
    },
    [pathname, router]
  )

  return (
    <div className={className}>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => go('en')}>
          EN
        </Button>
        <Button size="sm" variant="outline" onClick={() => go('zh')}>
          中文
        </Button>
      </div>
    </div>
  )
}