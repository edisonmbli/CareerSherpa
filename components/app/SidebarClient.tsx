'use client'
import React from 'react'
import { useRouter } from 'next/navigation'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Locale } from '@/i18n-config'
import { Menu, PlusCircle } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { SidebarHistory } from '@/components/workbench/SidebarHistory'

export function SidebarClient({
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
    lastUpdatedAt?: Date
    currentStatus?: string | null
    matchStatus?: string | null
    customizeStatus?: string | null
    interviewStatus?: string | null
    jobStatus?: string | null
    queueType?: 'paid' | 'free' | null
  }>
  dict: any
}) {
  const router = useRouter()
  const [collapsed, setCollapsed] = React.useState(false)
  React.useEffect(() => {
    const v =
      typeof window !== 'undefined'
        ? localStorage.getItem('sidebar_collapsed')
        : null
    setCollapsed(v === '1')

    // Solution A: Event Bus Synchronization
    // Listen for global sidebar change events to keep state in sync
    const handleStorageChange = () => {
      const nv = localStorage.getItem('sidebar_collapsed')
      setCollapsed(nv === '1')
    }

    window.addEventListener('sidebar:collapsed-changed', handleStorageChange)
    return () => {
      window.removeEventListener(
        'sidebar:collapsed-changed',
        handleStorageChange
      )
    }
  }, [])
  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    if (typeof window !== 'undefined')
      localStorage.setItem('sidebar_collapsed', next ? '1' : '0')
    if (typeof window !== 'undefined')
      window.dispatchEvent(new CustomEvent('sidebar:collapsed-changed'))
  }
  const containerClass = collapsed
    ? 'flex flex-col h-full border-0 dark:border dark:border-white/10 rounded-lg p-4 gap-4 bg-sidebar shadow-sm'
    : 'flex flex-col h-full border-0 dark:border dark:border-white/10 rounded-lg p-4 gap-4 bg-sidebar shadow-sm'
  return (
    <div className={containerClass}>
      <div
        className={
          collapsed
            ? 'flex items-center justify-center'
            : 'flex items-center justify-between'
        }
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-label="Toggle sidebar"
              className={cn(
                'cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors',
                collapsed ? 'hover:bg-zinc-100 dark:hover:bg-zinc-800' : ''
              )}
            >
              <Menu className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="z-[100]">
            {collapsed
              ? dict.workbench.sidebar.expand
              : dict.workbench.sidebar.collapse}
          </TooltipContent>
        </Tooltip>
      </div>
      <div
        className={
          collapsed ? 'flex items-center justify-center' : 'flex items-center'
        }
      >
        {!collapsed ? (
          <Button
            className="w-full relative inline-flex items-center justify-center font-bold overflow-hidden z-10 bg-gradient-to-b from-slate-800 to-slate-900 text-white hover:from-slate-700 hover:to-slate-800 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_4px_14px_rgba(0,0,0,0.15)] dark:from-slate-100 dark:to-slate-300 dark:text-slate-900 dark:hover:from-white dark:hover:to-slate-200 dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_4px_20px_rgba(0,0,0,0.3)] border border-slate-900/10 dark:border-white/10 active:scale-[0.98] transition-all duration-300 ease-out backdrop-blur-md cursor-pointer"
            onClick={() => router.push(`/${locale}/workbench`)}
          >
            + {dict.workbench.sidebar.newService}
          </Button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push(`/${locale}/workbench`)}
                aria-label="Create"
                className="cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <PlusCircle className="h-4 w-4 text-muted-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="z-[100]">{dict.workbench.sidebar.newService}</TooltipContent>
          </Tooltip>
        )}
      </div>
      <SidebarHistory
        locale={locale}
        collapsed={collapsed}
        labels={dict.workbench.sidebar}
        services={services.map((s) => ({
          id: s.id,
          title: s.title,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt || new Date(s.createdAt),
        }))}
      />
      {!collapsed && (
        <div className="flex items-center justify-between gap-2">
          <Button asChild className="w-32 bg-white/50 dark:bg-white/[0.04] border-[0.5px] border-black/5 dark:border-white/10 text-slate-700 dark:text-white hover:bg-white/80 dark:hover:bg-white/[0.08] shadow-sm transition-all duration-300" variant="outline">
            <Link href={`/${locale}/profile?tab=assets`}>
              {dict.workbench.sidebar.myCv}
            </Link>
          </Button>
          <Link
            href={`/${locale}/profile?tab=billing`}
            className="inline-flex items-center rounded-md border-[0.5px] border-black/5 dark:border-white/10 bg-white/50 dark:bg-white/[0.02] backdrop-blur-md text-slate-700 dark:text-slate-300 px-2 py-1 text-xs whitespace-nowrap shadow-sm transition-all duration-300 hover:bg-white/80 dark:hover:bg-white/[0.06]"
          >
            {dict.workbench.sidebar.coins}: {quotaBalance ?? 0}
          </Link>
        </div>
      )}
    </div>
  )
}
