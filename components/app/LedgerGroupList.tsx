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
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
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
      // Deduplicate children by ID to avoid double display if API returns duplicates
      const uniqueChildren = Array.from(
        new Map(children.map((c) => [c.id, c])).values(),
      )
      groups.push({ parent: it, children: uniqueChildren })
    } else if (!(it.type === 'FAILURE_REFUND' && matchedRefundIds.has(it.id))) {
      groups.push({ parent: it, children: [] })
    }
  }
  groups.sort((a, b) => {
    const ta = Math.max(
      new Date(a.parent.createdAt).getTime(),
      ...a.children.map((c) => new Date(c.createdAt).getTime()),
    )
    const tb = Math.max(
      new Date(b.parent.createdAt).getTime(),
      ...b.children.map((c) => new Date(c.createdAt).getTime()),
    )
    return tb - ta
  })

  function statusView(it: LedgerItem) {
    const failed = it.status === 'FAILED' || it.usageSuccess === false
    const success =
      !failed && (it.status === 'SUCCESS' || it.usageSuccess === true)
    const label = success
      ? dict.status.SUCCESS
      : failed
        ? dict.status.FAILED
        : dict.status.PENDING
    return (
      <>
        <span className="hidden md:inline-flex items-center">
          <span
            className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full border text-[11px] font-normal ${
              success
                ? 'text-emerald-700 border-emerald-200/70'
                : failed
                  ? 'text-rose-700 border-rose-200/70'
                  : 'text-muted-foreground border-border/40'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                success
                  ? 'bg-emerald-500'
                  : failed
                    ? 'bg-rose-500'
                    : 'bg-zinc-400'
              }`}
            />
            <span className="opacity-80">{label}</span>
          </span>
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

  function statusCompact(it: LedgerItem) {
    const failed = it.status === 'FAILED' || it.usageSuccess === false
    const success =
      !failed && (it.status === 'SUCCESS' || it.usageSuccess === true)
    const label = success
      ? dict.status.SUCCESS
      : failed
        ? dict.status.FAILED
        : dict.status.PENDING
    const tone = success
      ? 'text-emerald-700 border-emerald-200/70 bg-emerald-50/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]'
      : failed
        ? 'text-rose-700 border-rose-200/70 bg-rose-50/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]'
        : 'text-muted-foreground border-border/50 bg-muted/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]'
    return (
      <span
        className={`inline-flex items-center h-5 px-2 rounded-full border text-[10px] font-medium ${tone}`}
      >
        {label}
      </span>
    )
  }

  function serviceLabel(it: LedgerItem) {
    const rawKey = String(it.templateId || '')
    const key =
      rawKey === 'job_summary' || rawKey === 'ocr_extract'
        ? 'job_match'
        : rawKey
    const labelLong = dict.templates[key] || rawKey || '-'
    const labelShort = dict.templatesShort?.[key] || labelLong

    // For refund items, try to find the original serviceId from related debit if current serviceId is missing
    const targetServiceId =
      it.serviceId ||
      (it.type === 'FAILURE_REFUND' && it.relatedId
        ? items.find((i) => i.id === it.relatedId)?.serviceId
        : null)

    return targetServiceId ? (
      <Link
        href={`/${locale}/workbench/${targetServiceId}`}
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

  const headerGridClass =
    'grid grid-cols-[0.7fr_0.9fr_0.55fr_0.65fr_1.6fr] gap-x-3 items-center text-left'
  const rowGridClass =
    'grid grid-cols-[0.7fr_0.9fr_0.55fr_0.65fr_1.6fr] gap-x-3 py-0 items-center whitespace-nowrap text-xs text-left'
  const numberGroupClass =
    'grid grid-cols-[0.95fr_0.85fr_0.8fr] gap-x-3 items-center'

  // Mobile: Fintech-style compact list item
  // Row 1: [StatusDot] ServiceName ......... Delta
  // Row 2: Type · Date ..................... Balance
  function MobileListItem({ item }: { item: LedgerItem }) {
    const failed = item.status === 'FAILED' || item.usageSuccess === false
    const success =
      !failed && (item.status === 'SUCCESS' || item.usageSuccess === true)

    // Status dot color
    const dotColor = success
      ? 'bg-emerald-500 shadow-[0_0_0_1px_rgba(16,185,129,0.2)]'
      : failed
        ? 'bg-rose-500 shadow-[0_0_0_1px_rgba(244,63,94,0.2)]'
        : 'bg-zinc-400'

    return (
      <div className="sm:hidden py-3 px-1 border-b border-border/40 last:border-0">
        <div className="flex justify-between items-baseline mb-1">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            {item.type === 'SERVICE_DEBIT' && (
              <div
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`}
              />
            )}
            <span
              className={`text-[13px] font-medium truncate ${
                failed
                  ? 'text-muted-foreground line-through decoration-rose-500/50'
                  : 'text-foreground'
              }`}
            >
              {serviceLabel(item)}
            </span>
            {failed && (
              <span className="text-[10px] text-rose-600 bg-rose-50/80 px-1 py-0.5 rounded font-medium ml-1 shrink-0">
                {dict.status.FAILED}
              </span>
            )}
          </div>
          <div
            className={`text-[13px] font-mono font-medium shrink-0 tabular-nums tracking-tight ${
              item.delta > 0
                ? 'text-emerald-600'
                : item.delta < 0
                  ? 'text-foreground'
                  : 'text-muted-foreground'
            }`}
          >
            {item.delta > 0 ? `+${item.delta}` : item.delta}
          </div>
        </div>

        <div className="flex justify-between items-center text-[11px] text-muted-foreground/80">
          <div className="flex items-center gap-1.5">
            <span>{formatShortDate(new Date(item.createdAt))}</span>
            <span className="w-0.5 h-0.5 rounded-full bg-border" />
            <span>{typeLabelDisplay(String(item.type))}</span>
          </div>
          <div className="font-mono tracking-tight tabular-nums opacity-80">
            {dict.table?.balance || 'Bal'}: {item.balanceAfter}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 -mx-3 sm:mx-0">
      <div className="sm:rounded-xl sm:border sm:border-border/40 sm:bg-card/60 sm:shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
        {/* Desktop Header */}
        <div className="hidden sm:block sticky top-0 z-10 bg-muted/50 backdrop-blur supports-[backdrop-filter]:bg-muted/50 border-t border-border/20 border-b border-border/20 shadow-[inset_0_-1px_0_rgba(0,0,0,0.04)] px-3 py-1.5 text-[11px] uppercase tracking-[0.1em] text-muted-foreground/70 whitespace-nowrap">
          <div className={headerGridClass}>
            <div className="px-2 text-left w-full">
              {dict.table?.type || '类型'}
            </div>
            <div className="px-2 text-left w-full">
              {dict.table?.service || '服务名称'}
            </div>
            <div className="px-2 hidden sm:block text-center w-full">
              {dict.table?.taskId || '任务ID'}
            </div>
            <div className="px-2 text-center w-full">
              {dict.table?.status || '状态'}
            </div>
            <div className={numberGroupClass}>
              <div className="px-2 text-right w-full">
                {dict.table?.delta || '变化'}
              </div>
              <div className="px-1 text-right w-full">
                {dict.table?.balance || '余额'}
              </div>
              <div className="px-2 text-center w-full">
                {dict.table?.time || '时间'}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Header: Hidden to reduce noise, just list items */}

        <div className="sm:divide-y sm:divide-border/30 px-3 sm:px-0 bg-background/50 sm:bg-transparent">
          {groups.map(({ parent, children }) => {
            const orderedChildren = [...children].sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime(),
            )
            return (
              <div key={parent.id} className="sm:py-1.5">
                {orderedChildren.length > 0 && (
                  <div className="space-y-2 sm:px-3 sm:pb-1">
                    {orderedChildren.map((child) => (
                      <div key={child.id}>
                        <MobileListItem item={child} />
                        <div
                          className={`hidden sm:grid rounded-md bg-muted/30 h-11 ${rowGridClass}`}
                        >
                          <div className="px-2 h-12 flex items-center gap-2 text-left w-full justify-start">
                            <span className="text-xs text-muted-foreground">
                              {typeLabelDisplay(String(child.type))}
                            </span>
                          </div>
                          <div className="px-2 h-12 min-w-0 text-xs truncate flex items-center text-left w-full justify-start">
                            {serviceLabel(child)}
                          </div>
                          <div className="px-2 h-12 hidden sm:flex items-center justify-center w-full">
                            {child.taskId && (
                              <CopyText
                                text={String(child.taskId)}
                                dict={dict}
                                mode="compact"
                              />
                            )}
                          </div>
                          <div className="px-2 h-12 text-muted-foreground flex items-center justify-center w-full">
                            -
                          </div>
                          <div className={numberGroupClass}>
                            <div className="px-1 h-12 flex items-center justify-end font-mono">
                              <span
                                className={`inline-flex w-full justify-end px-2 py-0.5 rounded bg-muted/[0.03] tabular-nums tracking-[0.03em] ${
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
                              </span>
                            </div>
                            <div className="px-1 h-12 flex items-center justify-end font-mono">
                              <span className="inline-flex w-full justify-end px-2 py-0.5 rounded bg-muted/[0.03] tabular-nums tracking-[0.03em]">
                                {child.balanceAfter}
                              </span>
                            </div>
                            <div className="px-2 h-12 min-w-0 truncate text-xs text-muted-foreground flex items-center justify-center">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="w-full text-center">
                                      {formatShortDate(
                                        new Date(child.createdAt),
                                      )}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {new Date(child.createdAt).toLocaleString(
                                      locale,
                                    )}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="sm:px-3">
                  <MobileListItem item={parent} />
                  <div className={`hidden sm:grid h-11 ${rowGridClass}`}>
                    <div className="px-2 h-12 flex items-center gap-2 text-left w-full justify-start">
                      <span className="text-xs text-muted-foreground">
                        {typeLabelDisplay(String(parent.type))}
                      </span>
                    </div>
                    <div className="px-2 h-12 min-w-0 text-xs truncate flex items-center text-left w-full justify-start">
                      {serviceLabel(parent)}
                    </div>
                    <div className="px-2 h-12 hidden sm:flex items-center justify-center w-full">
                      {parent.taskId && (
                        <CopyText
                          text={String(parent.taskId)}
                          dict={dict}
                          mode="compact"
                        />
                      )}
                    </div>
                    <div className="px-2 h-12 flex items-center justify-center w-full">
                      {parent.type === 'SERVICE_DEBIT' ? (
                        statusView(parent)
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </div>
                    <div className={numberGroupClass}>
                      <div className="px-1 h-12 flex items-center justify-end font-mono">
                        <span
                          className={`inline-flex w-full justify-end px-2 py-0.5 rounded bg-muted/[0.03] tabular-nums tracking-[0.03em] ${
                            parent.delta > 0
                              ? 'text-emerald-600'
                              : parent.delta < 0
                                ? 'text-red-600'
                                : ''
                          }`}
                        >
                          {parent.delta > 0
                            ? `+${parent.delta}`
                            : String(parent.delta)}
                        </span>
                      </div>
                      <div className="px-1 h-12 flex items-center justify-end font-mono">
                        <span className="inline-flex w-full justify-end px-2 py-0.5 rounded bg-muted/[0.03] tabular-nums tracking-[0.03em]">
                          {parent.balanceAfter}
                        </span>
                      </div>
                      <div className="px-2 h-12 min-w-0 truncate text-xs text-muted-foreground flex items-center justify-center">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="w-full text-center">
                                {formatShortDate(new Date(parent.createdAt))}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {new Date(parent.createdAt).toLocaleString(
                                locale,
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function formatShortDate(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${m}/${day}`
}
