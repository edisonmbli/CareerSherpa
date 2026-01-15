'use client'
import React from 'react'
import { useRouter } from 'next/navigation'
import { useWorkbenchStore } from '@/lib/stores/workbench.store'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  const { currentServiceId, status } = useWorkbenchStore()
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
    ? 'flex flex-col h-full border-0 dark:border dark:border-white/10 rounded-lg p-4 gap-4 bg-muted/70 dark:bg-muted/40 shadow-sm'
    : 'flex flex-col h-full border-0 dark:border dark:border-white/10 rounded-lg p-4 gap-4 bg-card shadow-sm'
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
              className={
                collapsed ? 'hover:bg-accent hover:text-accent-foreground' : ''
              }
            >
              <Menu className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
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
            className="w-full"
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
              >
                <PlusCircle className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{dict.workbench.sidebar.newService}</TooltipContent>
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
          <Button asChild className="w-32" variant="secondary">
            <Link href={`/${locale}/profile?tab=assets`}>
              {dict.workbench.sidebar.myCv}
            </Link>
          </Button>
          <Link
            href={`/${locale}/profile?tab=billing`}
            className="inline-flex items-center rounded-md border px-2 py-1 text-xs whitespace-nowrap"
          >
            {dict.workbench.sidebar.coins}: {quotaBalance ?? 0}
          </Link>
        </div>
      )}
    </div>
  )
}
