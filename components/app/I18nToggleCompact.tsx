'use client'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Languages } from 'lucide-react'
import { switchLocalePath } from '@/components/app/I18nToggle'

export function I18nToggleCompact() {
  const pathname = usePathname() || '/'
  const router = useRouter()
  const isZh = /^\/zh(\/|$)/.test(pathname)
  const nextLocale = isZh ? 'en' : 'zh'
  const onToggle = () => {
    const next = switchLocalePath(pathname, nextLocale as any)
    router.push(next)
  }
  return (
    <Button aria-label="Toggle language" size="icon" variant="ghost" onClick={onToggle}>
      <Languages className="h-4 w-4" />
    </Button>
  )
}