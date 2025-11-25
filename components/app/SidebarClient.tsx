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

export function SidebarClient({
  locale,
  quotaBalance,
  services,
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
      <div className="flex items-center justify-between">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-label="Toggle sidebar"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {locale === 'zh'
              ? collapsed
                ? '展开'
                : '收起'
              : collapsed
              ? 'Expand'
              : 'Collapse'}
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="flex items-center">
        {!collapsed ? (
          <Button
            className="w-full"
            onClick={() => router.push(`/${locale}/workbench`)}
          >
            {locale === 'zh' ? '+ 新建服务' : '+ New Service'}
          </Button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push(`/${locale}/workbench`)}
                aria-label="Create"
                className="mx-auto"
              >
                <PlusCircle className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {locale === 'zh' ? '新建服务' : 'New Service'}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      {!collapsed && (
        <div className="flex-1 overflow-y-auto">
          <div className="text-xs text-muted-foreground mb-1">
            {locale === 'zh' ? '历史服务' : 'History'}
          </div>
          <ul className="space-y-2">
            {services.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/${locale}/workbench/${s.id}`}
                  className="block rounded-md px-2 py-1.5 hover:bg-muted"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="truncate max-w-[60%] sm:max-w-[70%] text-xs"
                      title={`${
                        s.title ??
                        (locale === 'zh' ? '新服务创建中' : 'Creating...')
                      }${
                        s.updatedAt
                          ? `，${formatShortDateTime(
                              new Date(s.updatedAt),
                              String(locale)
                            )}`
                          : ''
                      }`}
                    >
                      {s.title ??
                        (locale === 'zh' ? '新服务创建中' : 'Creating...')}
                    </span>
                    <span className="hidden sm:flex items-center gap-1.5">
                      {renderStatusBadge(
                        s.id === currentServiceId && status !== 'IDLE'
                          ? status
                          : aggregateStatus(s)
                      )}
                      {renderStatusBadge(s.customizeStatus)}
                      {renderStatusBadge(s.interviewStatus)}
                      {renderQueueBadge(s.queueType)}
                    </span>
                  </div>
                  <div className="mt-1 sm:hidden flex items-center gap-1.5">
                    {renderStatusBadge(
                      s.id === currentServiceId && status !== 'IDLE'
                        ? status
                        : aggregateStatus(s)
                    )}
                    {renderStatusBadge(s.customizeStatus)}
                    {renderStatusBadge(s.interviewStatus)}
                    {renderQueueBadge(s.queueType)}
                  </div>
                </Link>
              </li>
            ))}
            {services.length === 0 && (
              <li className="text-sm text-muted-foreground">
                {locale === 'zh' ? '暂无历史记录' : 'No history yet'}
              </li>
            )}
          </ul>
        </div>
      )}
      {!collapsed && (
        <div className="flex items-center justify-between gap-2">
          <Button asChild className="w-32" variant="secondary">
            <Link href={`/${locale}/profile?tab=assets`}>
              {locale === 'zh' ? '我的简历' : 'My CV'}
            </Link>
          </Button>
          <Link
            href={`/${locale}/profile?tab=billing`}
            className="inline-flex items-center rounded-md border px-2 py-1 text-xs whitespace-nowrap"
          >
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
  return (
    <Badge variant={variant as any} className="text-[10px] h-4 px-1.5 py-0">
      {label}
    </Badge>
  )
}

function mapStatusLabel(s: string) {
  const val = String(s).toUpperCase()
  if (val === 'PENDING' || val === 'MATCH_PENDING') return '排队中'
  if (val === 'OCR_PENDING') return 'OCR'
  if (val === 'SUMMARY_PENDING') return '提炼'
  if (val === 'MATCH_STREAMING') return '流式'
  if (val === 'IDLE') return '未开始'
  if (val === 'COMPLETED') return '完成'
  if (val === 'FAILED') return '失败'
  return null
}

function mapStatusVariant(s: string) {
  const val = String(s).toUpperCase()
  if (
    val === 'PENDING' ||
    val === 'MATCH_PENDING' ||
    val === 'OCR_PENDING' ||
    val === 'SUMMARY_PENDING' ||
    val === 'MATCH_STREAMING'
  )
    return 'warning'
  if (val === 'COMPLETED') return 'success'
  if (val === 'FAILED') return 'destructive'
  return 'outline'
}

function aggregateStatus(s: {
  currentStatus?: string | null
  jobStatus?: string | null
  matchStatus?: string | null
  customizeStatus?: string | null
  interviewStatus?: string | null
}): string | null {
  const svc = String(s.currentStatus || '').toUpperCase()
  if (svc === 'SUMMARY_FAILED' || svc === 'MATCH_FAILED') return 'FAILED'
  if (svc === 'SUMMARY_PENDING') return 'SUMMARY_PENDING'
  if (svc === 'MATCH_STREAMING') return 'MATCH_STREAMING'
  if (svc === 'MATCH_PENDING') return 'MATCH_PENDING'
  if (svc === 'MATCH_COMPLETED' || svc === 'SUMMARY_COMPLETED')
    return 'COMPLETED'
  const vals = [
    s.jobStatus,
    s.matchStatus,
    s.customizeStatus,
    s.interviewStatus,
  ].map((x) => String(x || '').toUpperCase())
  if (vals.includes('FAILED')) return 'FAILED'
  if (vals.includes('MATCH_STREAMING')) return 'MATCH_STREAMING'
  if (vals.includes('SUMMARY_PENDING')) return 'SUMMARY_PENDING'
  if (vals.includes('OCR_PENDING')) return 'OCR_PENDING'
  if (vals.includes('MATCH_PENDING') || vals.includes('PENDING'))
    return 'PENDING'
  if (vals.includes('COMPLETED')) return 'COMPLETED'
  if (vals.includes('IDLE')) return 'IDLE'
  return null
}

function renderQueueBadge(type?: 'paid' | 'free' | null) {
  if (!type) return null
  const label = type === 'paid' ? '付费' : '免费'
  const variant = type === 'paid' ? 'default' : 'outline'
  return (
    <Badge variant={variant as any} className="text-[10px] h-4 px-1.5 py-0">
      {label}
    </Badge>
  )
}

function formatShortDateTime(d: Date, locale: string) {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${mm}/${dd} ${hh}:${mi}`
}
