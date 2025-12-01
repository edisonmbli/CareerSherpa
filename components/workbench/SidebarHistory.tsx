'use client'
import React from 'react'
import Link from 'next/link'
import type { Locale } from '@/i18n-config'

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
}: {
  locale: Locale
  services: HistoryItem[]
  initialLimit?: number
}) {
  const [limit, setLimit] = React.useState<number>(initialLimit)
  const items = Array.isArray(services) ? services.slice(0, limit) : []
  const hasMore = (services?.length || 0) > limit

  return (
    <div className="flex-1 overflow-y-auto mt-3">
      <div className="text-xs text-muted-foreground mb-2 flex items-center gap-2">
        <span
          className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/40"
          aria-hidden="true"
        />
        <span>{locale === 'zh' ? '历史服务' : 'History'}</span>
      </div>
      <ul className="space-y-2">
        {items.map((s) => (
          <li key={s.id} className="group">
            <Link
              href={`/${locale}/workbench/${s.id}`}
              className="block rounded-md px-2 py-1.5 hover:bg-muted"
            >
              <div className="flex items-center justify-between">
                <span
                  className="truncate max-w-[80%] text-sm"
                  title={String(
                    s.title ??
                      (locale === 'zh' ? '新服务创建中' : 'Creating...')
                  )}
                >
                  {s.title ??
                    (locale === 'zh' ? '新服务创建中' : 'Creating...')}
                </span>
                <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-60 transition-opacity">
                  {formatShort(s.updatedAt || s.createdAt, String(locale))}
                </span>
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
      {hasMore && (
        <div className="flex items-center justify-start">
          <button
            type="button"
            className="mt-3 inline-flex items-center rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setLimit((x) => x + initialLimit)}
            aria-label={
              locale === 'zh' ? '加载更多历史服务' : 'Load more history'
            }
            title={locale === 'zh' ? '加载更多' : 'Load more'}
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="1" />
              <circle cx="5" cy="12" r="1" />
              <circle cx="19" cy="12" r="1" />
            </svg>
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
