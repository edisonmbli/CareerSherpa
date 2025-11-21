'use client'
import React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Locale } from '@/i18n-config'
import { Menu, PlusCircle } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export function SidebarClient({ locale, quotaBalance, services }: { locale: Locale; quotaBalance: number | null; services: Array<{ id: string; title: string | null; createdAt: Date; matchStatus?: string | null; customizeStatus?: string | null; interviewStatus?: string | null; queueType?: 'paid' | 'free' | null }> }) {
  const router = useRouter()
  const [collapsed, setCollapsed] = React.useState(false)
  React.useEffect(() => {
    const v = typeof window !== 'undefined' ? localStorage.getItem('sidebar_collapsed') : null
    setCollapsed(v === '1')
  }, [])
  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    if (typeof window !== 'undefined') localStorage.setItem('sidebar_collapsed', next ? '1' : '0')
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('sidebar:collapsed-changed'))
  }
  const containerClass = collapsed ? 'flex flex-col h-full border-0 dark:border dark:border-white/10 rounded-lg p-4 gap-4 bg-muted/70 dark:bg-muted/40 shadow-sm' : 'flex flex-col h-full border-0 dark:border dark:border-white/10 rounded-lg p-4 gap-4 bg-card shadow-sm'
  return (
    <div className={containerClass}>
      <div className="flex items-center justify-between">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle sidebar">
              <Menu className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{locale === 'zh' ? (collapsed ? '展开' : '收起') : (collapsed ? 'Expand' : 'Collapse')}</TooltipContent>
        </Tooltip>
      </div>
      <div className="flex items-center">
        {!collapsed ? (
          <Button className="w-full" onClick={() => router.push(`/${locale}/workbench`)}>
            {locale === 'zh' ? '+ 新建服务' : '+ New Service'}
          </Button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={() => router.push(`/${locale}/workbench`)} aria-label="Create" className="mx-auto">
                <PlusCircle className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{locale === 'zh' ? '新建服务' : 'New Service'}</TooltipContent>
          </Tooltip>
        )}
      </div>
      {!collapsed && (
      <div className="flex-1 overflow-y-auto">
        <div className="text-sm text-muted-foreground mb-2">{locale === 'zh' ? '历史服务' : 'History'}</div>
        <ul className="space-y-2">
          {services.map((s) => (
            <li key={s.id}>
              <Link href={`/${locale}/workbench/${s.id}`} className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-muted">
                <span className="truncate">{s.title ?? s.id}</span>
                <span className="flex items-center gap-2">
                  {renderStatusBadge(s.matchStatus)}
                  {renderStatusBadge(s.customizeStatus)}
                  {renderStatusBadge(s.interviewStatus)}
                  {renderQueueBadge(s.queueType)}
                  <span className="text-xs text-muted-foreground">{formatDate(s.createdAt)}</span>
                </span>
              </Link>
            </li>
          ))}
          {services.length === 0 && (
            <li className="text-sm text-muted-foreground">{locale === 'zh' ? '暂无历史记录' : 'No history yet'}</li>
          )}
        </ul>
      </div>
      )}
      {!collapsed && (
        <div className="flex items-center justify-between gap-2">
          <Button asChild className="w-32" variant="secondary">
            <Link href={`/${locale}/profile?tab=assets`}>{locale === 'zh' ? '我的简历' : 'My CV'}</Link>
          </Button>
          <Link href={`/${locale}/profile?tab=billing`} className="inline-flex items-center rounded-md border px-2 py-1 text-xs whitespace-nowrap">
            {locale === 'zh' ? '金币' : 'Coins'}: {quotaBalance ?? 0}
          </Link>
        </div>
      )}
    </div>
  )
}

function formatDate(d: Date): string {
  try {
    return new Date(d).toLocaleString()
  } catch {
    return ''
  }
}

function renderStatusBadge(status?: string | null) {
  if (!status) return null
  const label = mapStatusLabel(status)
  if (!label) return null
  const variant = mapStatusVariant(status)
  return <Badge variant={variant as any} className="text-xs">{label}</Badge>
}

function mapStatusLabel(s: string) {
  const val = String(s).toUpperCase()
  if (val === 'PENDING' || val === 'MATCH_PENDING') return '排队中'
  if (val === 'IDLE') return '未开始'
  if (val === 'COMPLETED') return '完成'
  if (val === 'FAILED') return '失败'
  return null
}

function mapStatusVariant(s: string) {
  const val = String(s).toUpperCase()
  if (val === 'PENDING' || val === 'MATCH_PENDING') return 'warning'
  if (val === 'COMPLETED') return 'success'
  if (val === 'FAILED') return 'destructive'
  return 'outline'
}

function renderQueueBadge(type?: 'paid' | 'free' | null) {
  if (!type) return null
  const label = type === 'paid' ? '付费' : '免费'
  const variant = type === 'paid' ? 'default' : 'outline'
  return <Badge variant={variant as any} className="text-xs">{label}</Badge>
}