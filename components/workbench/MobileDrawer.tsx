'use client'
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet'
import type { Locale } from '@/i18n-config'
import { SidebarHistory } from '@/components/workbench/SidebarHistory'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Coins } from 'lucide-react'

export function MobileDrawer({
  locale,
  quotaBalance,
  services,
  dict,
}: {
  locale: Locale
  quotaBalance: number | null
  services: Array<{
    id: string
    title: string | null
    createdAt: Date
    updatedAt?: Date
  }>
  dict: any
}) {
  return (
    <Sheet>
      <SheetTrigger
        className="inline-flex items-center rounded-md border px-3 py-2 text-sm"
        aria-label={dict.workbench.sidebar.openMenu}
      >
        {dict.workbench.sidebar.menu}
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[85vw] sm:w-[360px] p-0"
        aria-label={dict.workbench.sidebar.sidebarDrawer}
      >
        <SheetTitle className="sr-only">
          {dict.workbench.sidebar.menu}
        </SheetTitle>
        <div className="p-4 space-y-4">
          <Button className="w-full" asChild>
            <Link href={`/${locale}/workbench`}>
              + {dict.workbench.sidebar.newService}
            </Link>
          </Button>

          <SidebarHistory locale={locale} services={services} />

          <div className="flex items-center gap-4">
            <Button asChild variant="secondary" className="w-32 shrink-0">
              <Link href={`/${locale}/profile?tab=assets`}>
                {dict.workbench.sidebar.myCv}
              </Link>
            </Button>
            <Link
              href={`/${locale}/profile?tab=billing`}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted active:bg-muted/70 shrink-0"
            >
              <span className="font-mono">{quotaBalance ?? 0}</span>
              <Coins className="w-4 h-4 text-yellow-500" />
            </Link>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
