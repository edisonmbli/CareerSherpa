'use client'
import { useState } from 'react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import type { Locale } from '@/i18n-config'
import { SidebarHistory } from '@/components/workbench/SidebarHistory'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Coins, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'

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
  const [open, setOpen] = useState(false)

  return (
    <div className="print:hidden">
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'fixed top-[14px] left-2 z-[60] lg:hidden h-9 w-9 text-muted-foreground hover:text-foreground print:hidden',
          open && 'hidden',
        )}
        onClick={() => setOpen(true)}
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">{dict.workbench.sidebar.menu}</span>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="w-[75vw] sm:w-[300px] p-0 flex flex-col pt-0 [&>button[class*='right-4']]:hidden"
          aria-describedby="mobile-drawer-description"
        >
          <SheetTitle className="sr-only">
            {dict.workbench.sidebar.menu}
          </SheetTitle>
          <div id="mobile-drawer-description" className="sr-only">
            Mobile navigation menu
          </div>

          {/* Close Button (Internal) */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-3 left-3 z-[60] h-9 w-9 text-muted-foreground hover:text-foreground"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </Button>

          {/* Header Area */}
          <div className="flex items-center justify-center mt-3 px-12">
            <Button
              className="bg-black text-white hover:bg-gray-800 dark:bg-white/[0.04] dark:text-white border-transparent dark:border-white/10 border shadow-sm h-9 w-[70%]"
              asChild
            >
              <Link href={`/${locale}/workbench`}>
                + {dict.workbench.sidebar.newService}
              </Link>
            </Button>
          </div>

          {/* History List (Scrollable) */}
          <div className="flex-1 overflow-y-auto px-2 py-2">
            {/* Removed duplicate history label */}
            <SidebarHistory
              locale={locale}
              services={services}
              labels={dict.workbench.sidebar}
            />
          </div>

          {/* Bottom Footer */}
          <div className="p-4 bg-gray-50/50 dark:bg-white/[0.02] border-t border-black/5 dark:border-white/10 mt-auto">
            <div className="flex items-center justify-center gap-4">
              <Button
                asChild
                variant="outline"
                className="border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] text-slate-800 dark:text-white shadow-sm h-10 w-auto px-4"
              >
                <Link href={`/${locale}/profile?tab=assets`}>
                  {dict.workbench.sidebar.myCv}
                </Link>
              </Button>
              <Link
                href={`/${locale}/profile?tab=billing`}
                className="flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/10 h-10"
              >
                <Coins className="w-5 h-5" />
                <span className="font-mono font-bold">{quotaBalance ?? 0}</span>
              </Link>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
