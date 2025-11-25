'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { CopyText } from '@/components/app/CopyText'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'

type CoinTxnType =
  | 'SERVICE_DEBIT'
  | 'FAILURE_REFUND'
  | 'SIGNUP_BONUS'
  | 'PURCHASE'

export interface LedgerItem {
  id: string
  type: CoinTxnType
  status: string
  delta: number
  balanceAfter: number
  serviceId?: string | null
  taskId?: string | null
  templateId?: string | null
  messageId?: string | null
  createdAt: string | Date
  usageSuccess?: boolean | null
  relatedId?: string | null
}

export function LedgerGroupList({
  items,
  locale,
  dict,
}: {
  items: LedgerItem[]
  locale: string
  dict: any
}) {
  const refundsByRelated: Record<string, LedgerItem[]> = {}
  const debitIds = new Set<string>()
  for (const it of items) {
    if (it.type === 'SERVICE_DEBIT') debitIds.add(it.id)
    if (it.type === 'FAILURE_REFUND' && it.relatedId) {
      const key = String(it.relatedId)
      if (!refundsByRelated[key]) refundsByRelated[key] = []
      refundsByRelated[key].push(it)
    }
  }
  for (const key of Object.keys(refundsByRelated)) {
    const arr = refundsByRelated[key] || []
    arr.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
    refundsByRelated[key] = arr
  }
  const matchedRefundIds = new Set<string>()
  for (const key of Object.keys(refundsByRelated)) {
    if (debitIds.has(key)) {
      const arr = refundsByRelated[key] || []
      for (const r of arr) matchedRefundIds.add(r.id)
    }
  }
  const groups: { parent: LedgerItem; children: LedgerItem[] }[] = []
  for (const it of items) {
    if (it.type === 'SERVICE_DEBIT') {
      const children = refundsByRelated[it.id] || []
      groups.push({ parent: it, children })
    } else if (!(it.type === 'FAILURE_REFUND' && matchedRefundIds.has(it.id))) {
      groups.push({ parent: it, children: [] })
    }
  }
  groups.sort((a, b) => {
    const ta = Math.max(
      new Date(a.parent.createdAt).getTime(),
      ...a.children.map((c) => new Date(c.createdAt).getTime())
    )
    const tb = Math.max(
      new Date(b.parent.createdAt).getTime(),
      ...b.children.map((c) => new Date(c.createdAt).getTime())
    )
    return tb - ta
  })

  function statusView(it: LedgerItem) {
    const success = it.usageSuccess === true
    const failed = it.usageSuccess === false
    const label = success
      ? dict.status.SUCCESS
      : failed
      ? dict.status.FAILED
      : dict.status.PENDING
    return (
      <>
        <span className="hidden md:inline">
          <Badge
            className="w-16 justify-center"
            variant={success ? 'default' : failed ? 'destructive' : 'secondary'}
          >
            {label}
          </Badge>
        </span>
        <span className="md:hidden inline-flex items-center w-16 justify-center">
          <span
            className={`inline-block size-2 rounded-full ${
              success ? 'bg-green-500' : failed ? 'bg-red-500' : 'bg-gray-400'
            }`}
          />
        </span>
      </>
    )
  }

  function serviceLabel(it: LedgerItem) {
    const rawKey = String(it.templateId || '')
    const key = rawKey === 'job_summary' ? 'job_match' : rawKey
    const labelLong = dict.templates[key] || rawKey || '-'
    const labelShort = dict.templatesShort?.[key] || labelLong
    return it.serviceId ? (
      <Link
        href={`/${locale}/workbench/${it.serviceId}`}
        className="underline underline-offset-2 text-muted-foreground"
      >
        <span className="sm:hidden truncate">{labelShort}</span>
        <span className="hidden sm:inline">{labelLong}</span>
      </Link>
    ) : (
      <span className="text-muted-foreground">
        <span className="sm:hidden truncate">{labelShort}</span>
        <span className="hidden sm:inline">{labelLong}</span>
      </span>
    )
  }

  function typeLabelDisplay(t: string) {
    const short = dict.typeShort?.[String(t)]
    if (short) return String(short)
    const raw = dict.type?.[String(t)] || String(t)
    if (locale === 'zh') return String(raw).slice(-2)
    const parts = String(raw).split(' ')
    return parts[parts.length - 1]
  }

  return (
    <div className="space-y-3 -mx-3 sm:mx-0">
      <div className="sticky top-0 z-10 bg-muted backdrop-blur supports-[backdrop-filter]:bg-muted border border-muted/30 rounded-md px-3 py-2 text-xs text-muted-foreground whitespace-nowrap font-medium shadow-sm">
        <div className="grid grid-cols-6 sm:grid-cols-7 gap-x-3 sm:gap-x-5 items-center">
          <div className="px-2">{dict.table?.type || '类型'}</div>
          <div className="px-2">{dict.table?.service || '服务名称'}</div>
          <div className="px-2 hidden sm:block text-center">
            {dict.table?.taskId || '任务ID'}
          </div>
          <div className="px-2 text-center">{dict.table?.status || '状态'}</div>
          <div className="px-2 text-right">{dict.table?.delta || '变化'}</div>
          <div className="px-2 text-right">{dict.table?.balance || '余额'}</div>
          <div className="px-2">{dict.table?.time || '时间'}</div>
        </div>
      </div>
      {groups.map(({ parent, children }) => {
        const success = parent.usageSuccess === true
        const failed = parent.usageSuccess === false
        const dotColor = success
          ? 'bg-green-500'
          : failed
          ? 'bg-red-500'
          : 'bg-gray-400'
        const typeLabel =
          dict.type?.[String(parent.type)] || String(parent.type)
        return (
          <div
            key={parent.id}
            className="relative rounded-lg border border-muted/30 bg-card shadow-sm divide-y divide-muted/20"
          >
            <div className="grid grid-cols-6 sm:grid-cols-7 gap-x-3 sm:gap-x-5 px-2 sm:px-3 py-0 items-center whitespace-nowrap h-12 text-xs">
              <div className="px-2 h-12 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {typeLabelDisplay(String(parent.type))}
                </span>
              </div>
              <div className="px-2 h-12 min-w-0 text-xs truncate flex items-center">
                {serviceLabel(parent)}
              </div>
              <div className="px-2 h-12 hidden sm:flex items-center justify-center">
                {parent.taskId && (
                  <CopyText
                    text={String(parent.taskId)}
                    dict={dict}
                    mode="compact"
                  />
                )}
              </div>
              <div className="px-2 h-12 flex items-center justify-center">
                {parent.type === 'SERVICE_DEBIT' ? (
                  statusView(parent)
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </div>
              <div
                className={`px-2 h-12 flex items-center justify-end font-mono ${
                  parent.delta > 0
                    ? 'text-emerald-600'
                    : parent.delta < 0
                    ? 'text-red-600'
                    : ''
                }`}
              >
                {parent.delta > 0 ? `+${parent.delta}` : String(parent.delta)}
              </div>
              <div className="px-2 h-12 flex items-center justify-end font-mono">
                {parent.balanceAfter}
              </div>
              <div className="px-2 h-12 min-w-0 truncate text-xs text-muted-foreground flex items-center">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>{formatShortDate(new Date(parent.createdAt))}</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {new Date(parent.createdAt).toLocaleString(locale)}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            {children.length > 0 && (
              <div className="pb-2">
                <div className="space-y-1 divide-y divide-muted/20">
                  {children.map((child) => {
                    const typeChild =
                      dict.type?.[String(child.type)] || String(child.type)
                    return (
                      <div
                        key={child.id}
                        className="grid grid-cols-6 sm:grid-cols-7 gap-x-3 sm:gap-x-5 px-2 sm:px-3 py-0 items-center rounded-md bg-muted/35 whitespace-nowrap h-12 text-xs"
                      >
                        <div className="px-2 h-12 flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {typeLabelDisplay(String(child.type))}
                          </span>
                        </div>
                        <div className="px-2 h-12 min-w-0 text-xs truncate flex items-center">
                          {serviceLabel(child)}
                        </div>
                        <div className="px-2 h-12 hidden sm:flex items-center justify-center">
                          {child.taskId && (
                            <CopyText
                              text={String(child.taskId)}
                              dict={dict}
                              mode="compact"
                            />
                          )}
                        </div>
                        <div className="px-2 h-12 text-muted-foreground flex items-center justify-center">
                          -
                        </div>
                        <div
                          className={`px-2 h-12 flex items-center justify-end font-mono ${
                            child.delta > 0
                              ? 'text-emerald-600'
                              : child.delta < 0
                              ? 'text-red-600'
                              : ''
                          }`}
                        >
                          {child.delta > 0
                            ? `+${child.delta}`
                            : String(child.delta)}
                        </div>
                        <div className="px-2 h-12 flex items-center justify-end font-mono">
                          {child.balanceAfter}
                        </div>
                        <div className="px-2 h-12 min-w-0 truncate text-xs text-muted-foreground flex items-center">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  {formatShortDate(new Date(child.createdAt))}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {new Date(child.createdAt).toLocaleString(
                                  locale
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
function formatShortDate(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${m}/${day}`
}
