'use client'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useState } from 'react'
import { create } from 'zustand'
// inline collapsible panel instead of sheet
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { toast } from '@/components/ui/use-toast'
import { Filter, X, Check, Calendar } from 'lucide-react'

const useFiltersOpenStore = create<{ open: boolean; setOpen: (v: boolean) => void }>((set) => ({
  open: false,
  setOpen: (v: boolean) => set({ open: v }),
}))

export function BillingFiltersClient({ locale, dict, mode = 'panel' }: { locale: string; dict: any; mode?: 'button' | 'panel' }) {
  const sp = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const type = sp.get('type') || ''
  const status = sp.get('status') || ''
  const tpl = sp.get('tpl') || ''
  const after = sp.get('after') || ''
  const before = sp.get('before') || ''
  const isOpenParam = false

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(sp.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    params.set('tab', 'billing')
    params.set('page', '1')
    router.push(`${pathname}?${params.toString()}`)
  }

  function clearAll() {
    const params = new URLSearchParams(sp.toString())
    ;['type','status','tpl','after','before','svc','page','filters'].forEach(k => params.delete(k))
    params.set('tab', 'billing')
    router.push(`${pathname}?${params.toString()}`)
  }

  function setDateRangeDays(days: number) {
    const params = new URLSearchParams(sp.toString())
    const end = new Date()
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const fmt = (d: Date) => d.toISOString().slice(0, 10)
    params.set('after', fmt(start))
    params.set('before', fmt(end))
    params.set('tab', 'billing')
    params.set('page', '1')
    router.push(`${pathname}?${params.toString()}`)
  }

  const active = [type && dict.type[type], status && dict.status[status], tpl && dict.templates[tpl]].filter(Boolean)

  const open = useFiltersOpenStore((s) => s.open)
  const setOpen = useFiltersOpenStore((s) => s.setOpen)
  const [nextType, setNextType] = useState(type)
  const [nextStatus, setNextStatus] = useState(status)
  const [nextTpl, setNextTpl] = useState(tpl)
  const [nextAfter, setNextAfter] = useState(after)
  const [nextBefore, setNextBefore] = useState(before)
  function clearDateRange() {
    const params = new URLSearchParams(sp.toString())
    params.delete('after')
    params.delete('before')
    params.set('tab', 'billing')
    params.set('page', '1')
    setNextAfter('')
    setNextBefore('')
    router.push(`${pathname}?${params.toString()}`)
  }
  // use shadcn Calendar (react-day-picker)

  function applyAll() {
    setOpen(false)
    const params = new URLSearchParams(sp.toString())
    if (nextType) params.set('type', nextType); else params.delete('type')
    if (nextStatus) params.set('status', nextStatus); else params.delete('status')
    if (nextTpl) params.set('tpl', nextTpl); else params.delete('tpl')
    if (nextAfter) params.set('after', nextAfter); else params.delete('after')
    if (nextBefore) params.set('before', nextBefore); else params.delete('before')
    params.set('tab', 'billing')
    params.set('page', '1')
    const count = (nextType ? 1 : 0) + (nextStatus ? 1 : 0) + (nextTpl ? 1 : 0) + ((nextAfter || nextBefore) ? 1 : 0)
    const zh = locale === 'zh'
    if (count > 0) {
      toast.success(zh ? `已应用 ${count} 条筛选条件` : `Applied ${count} filters`)
    } else {
      toast.success(zh ? '已应用筛选' : 'Filters applied')
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  function openPanel() {
    setNextType(type)
    setNextStatus(status)
    setNextTpl(tpl)
    setNextAfter(after)
    setNextBefore(before)
    setOpen(!open)
  }

  if (mode === 'button') {
    return (
      <div className="flex items-center gap-2">
        {active.length > 0 && (
          <div className="hidden sm:flex items-center gap-2">
            {active.map((a: string, i: number) => (
              <Badge key={i} variant="secondary">{a}</Badge>
            ))}
          </div>
        )}
        <Button variant="outline" size="sm" className="gap-1 w-24 justify-center" onClick={openPanel}>
          <Filter className="h-4 w-4" />
          {`${dict.filters.toggle}${active.length ? `(${active.length})` : ''}`}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {active.length > 0 && (
        <div className="hidden sm:flex items-center gap-2">
          {active.map((a: string, i: number) => (
            <Badge key={i} variant="secondary">{a}</Badge>
          ))}
        </div>
      )}
      {open && (
        <div className="w-full sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-3 p-2 sm:p-3 border border-muted/30 rounded-lg bg-muted/20 shadow-sm">
            <div className="md:col-span-3 sm:hidden">
              <Accordion type="multiple">
                <AccordionItem value="type">
                  <AccordionTrigger className="pl-2">{dict.filters.type}</AccordionTrigger>
                  <AccordionContent>
                    <div className="flex flex-wrap gap-2 pl-2 pb-2">
                      {Object.keys(dict.type).map((k) => (
                        <Button key={k} variant={'ghost'} size="sm" className={`text-xs font-normal ${nextType === k ? 'bg-muted/30' : ''}`} onClick={() => setNextType(nextType === k ? '' : k)}>
                          {nextType === k && <Check className="h-3 w-3 mr-1" />}
                          {dict.type[k]}
                        </Button>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="status">
                  <AccordionTrigger className="pl-2">{dict.filters.status}</AccordionTrigger>
                  <AccordionContent>
                    <div className="flex flex-wrap gap-2 pl-2 pb-2">
                      {Object.keys(dict.status).map((k) => (
                        <Button key={k} variant={'ghost'} size="sm" className={`text-xs font-normal ${nextStatus === k ? 'bg-muted/30' : ''}`} onClick={() => setNextStatus(nextStatus === k ? '' : k)}>
                          {nextStatus === k && <Check className="h-3 w-3 mr-1" />}
                          {dict.status[k]}
                        </Button>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="tpl">
                  <AccordionTrigger className="pl-2">{dict.filters.template}</AccordionTrigger>
                  <AccordionContent>
                    <div className="flex flex-wrap gap-2 pl-2 pb-2">
                      {Object.keys(dict.templates).map((k) => (
                        <Button key={k} variant={'ghost'} size="sm" className={`text-xs font-normal ${nextTpl === k ? 'bg-muted/30' : ''}`} onClick={() => setNextTpl(nextTpl === k ? '' : k)}>
                          {nextTpl === k && <Check className="h-3 w-3 mr-1" />}
                          {dict.templates[k]}
                        </Button>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            <div className="hidden sm:block">
              <div className="text-xs text-muted-foreground mb-2 border-b border-border pb-1 pl-3">{dict.filters.type}</div>
              <div className="flex flex-wrap gap-2 justify-start pl-3">
                {Object.keys(dict.type).map((k) => (
                  <Button key={k} variant={'ghost'} size="sm" className={`text-xs font-normal ${nextType === k ? 'bg-muted/30' : ''}`} onClick={() => setNextType(nextType === k ? '' : k)}>
                    {nextType === k && <Check className="h-3 w-3 mr-1" />}
                    {dict.type[k]}
                  </Button>
                ))}
              </div>
            </div>
            <div className="hidden sm:block">
              <div className="text-xs text-muted-foreground mb-2 border-b border-border pb-1 pl-3">{dict.filters.status}</div>
              <div className="flex flex-wrap gap-2 justify-start pl-3">
                {Object.keys(dict.status).map((k) => (
                  <Button key={k} variant={'ghost'} size="sm" className={`text-xs font-normal ${nextStatus === k ? 'bg-muted/30' : ''}`} onClick={() => setNextStatus(nextStatus === k ? '' : k)}>
                    {nextStatus === k && <Check className="h-3 w-3 mr-1" />}
                    {dict.status[k]}
                  </Button>
                ))}
              </div>
            </div>
            <div className="hidden sm:block">
              <div className="text-xs text-muted-foreground mb-2 border-b border-border pb-1 pl-3">{dict.filters.template}</div>
              <div className="flex flex-wrap gap-2 justify-start pl-3">
                {Object.keys(dict.templates).map((k) => (
                  <Button key={k} variant={'ghost'} size="sm" className={`text-xs font-normal ${nextTpl === k ? 'bg-muted/30' : ''}`} onClick={() => setNextTpl(nextTpl === k ? '' : k)}>
                    {nextTpl === k && <Check className="h-3 w-3 mr-1" />}
                    {dict.templates[k]}
                  </Button>
                ))}
              </div>
            </div>

            <div className="md:col-span-3">
              <div className="hidden sm:block text-xs text-muted-foreground mb-2 border-b border-border pb-1 pl-3">{dict.filters.date}</div>
              <div className="hidden sm:flex items-center gap-2 pl-3">
                <Input aria-label={locale === 'zh' ? '开始日期' : 'Start date'} type="date" value={nextAfter || ''} onChange={(e) => setNextAfter(e.target.value)} className="h-7 text-xs w-32" />
                <span className="text-xs">—</span>
                <Input aria-label={locale === 'zh' ? '结束日期' : 'End date'} type="date" value={nextBefore || ''} onChange={(e) => setNextBefore(e.target.value)} className="h-7 text-xs w-32" />
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="text-xs font-normal" onClick={() => setDateRangeDays(0)}>{dict.filters.today}</Button>
                  <Button variant="ghost" size="sm" className="text-xs font-normal" onClick={() => setDateRangeDays(7)}>{dict.filters.last7}</Button>
                  <Button variant="ghost" size="sm" className="text-xs font-normal" onClick={() => setDateRangeDays(30)}>{dict.filters.last30}</Button>
                  <Button variant="ghost" size="sm" className="text-xs font-normal" onClick={() => setDateRangeDays(90)}>{dict.filters.last90}</Button>
                  <Button variant="ghost" size="sm" className="text-xs font-normal" onClick={clearDateRange}>{dict.filters.clearDate}</Button>
                </div>
              </div>
              <div className="sm:hidden flex items-center gap-3 pl-1 mt-0 mb-2">
                <Input aria-label={locale === 'zh' ? '开始日期' : 'Start date'} type="date" value={nextAfter || ''} onChange={(e) => setNextAfter(e.target.value)} className="h-7 text-[11px] w-[105px] shrink-0 px-2 pr-1" />
                <span className="text-xs">—</span>
                <Input aria-label={locale === 'zh' ? '结束日期' : 'End date'} type="date" value={nextBefore || ''} onChange={(e) => setNextBefore(e.target.value)} className="h-7 text-[11px] w-[105px] shrink-0 px-2 pr-1" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button aria-label={locale === 'zh' ? '快捷选择' : 'Quick'} variant="outline" size="icon" className="shrink-0">
                      <Calendar className="h-2 w-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem className="text-[10px]" onClick={() => setDateRangeDays(0)}>{dict.filters.today}</DropdownMenuItem>
                    <DropdownMenuItem className="text-[10px]" onClick={() => setDateRangeDays(7)}>{dict.filters.last7}</DropdownMenuItem>
                    <DropdownMenuItem className="text-[10px]" onClick={() => setDateRangeDays(30)}>{dict.filters.last30}</DropdownMenuItem>
                    <DropdownMenuItem className="text-[10px]" onClick={() => setDateRangeDays(90)}>{dict.filters.last90}</DropdownMenuItem>
                    <DropdownMenuItem className="text-[10px]" onClick={clearDateRange}>{dict.filters.clearDate}</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <div className="md:col-span-3 flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => { clearAll(); }} className="gap-1"><X className="h-4 w-4" />{dict.filters.clear}</Button>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => { setOpen(false) }}>{dict.common?.cancel ?? '关闭'}</Button>
                <Button variant="default" size="sm" onClick={applyAll}>{dict.filters.apply}</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}