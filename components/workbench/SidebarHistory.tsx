'use client'
import React from 'react'
import Link from 'next/link'
import type { Locale } from '@/i18n-config'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

import { FileClock, MoreHorizontal } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface HistoryItem {
  id: string
  title: string | null
  createdAt: Date
  updatedAt?: Date
}

export function SidebarHistory({
  locale,
  services,
  initialLimit = 8,
  collapsed = false,
  collapsedLimit = 5,
  labels,
}: {
  locale: Locale
  services: HistoryItem[]
  initialLimit?: number
  collapsed?: boolean
  collapsedLimit?: number
  labels: {
    newService: string
    expandMore: string
    history: string
    creating: string
    noHistory: string
    loadMore: string
  }
}) {
  const [limit, setLimit] = React.useState<number>(initialLimit)
  const pathname = usePathname()

  const items = Array.isArray(services) ? services.slice(0, limit) : []
  const hasMore = (services?.length || 0) > limit

  // Helper to check active state
  const isActive = (id: string) => pathname?.includes(`/workbench/${id}`)

  if (collapsed) {
    // V2: Limit items to reduce clutter
    const collapsedItems = services.slice(0, collapsedLimit)
    const hasMoreCollapsed = services.length > collapsedLimit

    return (
      <div className="flex-1 overflow-visible mt-4 flex flex-col items-center">
        <ul className="space-y-3 w-full flex flex-col items-center">
          {collapsedItems.map((s) => (
            <li
              key={s.id}
              className="group w-full flex justify-center relative z-50"
            >
              {/* Active Indicator (Dot) */}
              {isActive(s.id) && (
                <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-sky-400/80" />
              )}

              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href={`/${locale}/workbench/${s.id}`}
                      className={cn(
                        'flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200',
                        isActive(s.id)
                          ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                      )}
                    >
                      <FileClock className="h-4 w-4" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent
                    side="right"
                    className="bg-slate-900 text-slate-50 border-slate-800 z-[100]"
                  >
                    <p className="text-xs">
                      {s.title || labels?.newService || 'New Service'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </li>
          ))}

          {/* Visual Indicator for hidden items */}
          {hasMoreCollapsed && (
            <li className="w-full flex justify-center py-2 relative z-50">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-default">
                      <MoreHorizontal className="w-4 h-4" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="z-[100]">
                    <p className="text-xs">
                      {labels?.expandMore || 'Expand to see more'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </li>
          )}
        </ul>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto mt-4 pr-2">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 px-2 flex items-center gap-2">
        <span>{labels?.history || 'History'}</span>
        <span className="bg-muted text-muted-foreground px-1.5 py-0.5 rounded text-[9px] min-w-[1.25rem] text-center">
          {services.length}
        </span>
      </div>

      <ul className="space-y-1">
        {items.map((s) => (
          <li key={s.id} className="group relative">
            {/* Active Indicator (Bar) - Changed to Zinc/Slate */}
            {isActive(s.id) && (
              <div className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-primary" />
            )}

            <Link
              href={`/${locale}/workbench/${s.id}`}
              className={cn(
                'block rounded-lg px-3 py-2.5 transition-all duration-200 ml-2', // ml-2 for indicator space
                isActive(s.id)
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/50 text-muted-foreground hover:text-foreground'
              )}
            >
              <div className="flex flex-col gap-0.5">
                <span
                  className={cn(
                    'truncate text-xs font-mono',
                    isActive(s.id) ? 'text-foreground font-medium' : ''
                  )}
                  title={String(s.title ?? (labels?.creating || 'Creating...'))}
                >
                  {s.title ?? (labels?.creating || 'Creating...')}
                </span>
                <span className="text-[10px] text-muted-foreground/70 font-light">
                  {formatShort(s.updatedAt || s.createdAt, String(locale))}
                </span>
              </div>
            </Link>
          </li>
        ))}
        {services.length === 0 && (
          <li className="text-sm text-muted-foreground px-4 py-8 text-center italic">
            {labels?.noHistory || 'No history yet'}
          </li>
        )}
      </ul>

      {hasMore && (
        <div className="flex items-center justify-center mt-4">
          <button
            type="button"
            className="group flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-accent transition-colors"
            onClick={() => setLimit((x) => x + initialLimit)}
            aria-label={labels?.loadMore || 'Load more'}
          >
            <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground">
              {labels?.loadMore || 'Load more'}
            </span>
            <MoreHorizontal className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
          </button>
        </div>
      )}
    </div>
  )
}

function formatShort(d: Date, locale: string) {
  try {
    const dt = new Date(d)
    const mm = String(dt.getMonth() + 1).padStart(2, '0')
    const dd = String(dt.getDate()).padStart(2, '0')
    const hh = String(dt.getHours()).padStart(2, '0')
    const mi = String(dt.getMinutes()).padStart(2, '0')
    return `${mm}/${dd} ${hh}:${mi}`
  } catch {
    return ''
  }
}
