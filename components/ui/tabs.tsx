'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

type TabsContextType = {
  value: string
  setValue: (v: string) => void
}

const TabsContext = React.createContext<TabsContextType | null>(null)

export function Tabs({ defaultValue, value: controlled, onValueChange, className, children }: { defaultValue: string; value?: string; onValueChange?: (v: string) => void; className?: string; children: React.ReactNode }) {
  const [value, setValue] = React.useState(controlled ?? defaultValue)
  React.useEffect(() => {
    if (controlled && controlled !== value) setValue(controlled)
  }, [controlled, value])
  return (
    <div className={className}>
      <TabsContext.Provider value={{ value, setValue: (v) => { setValue(v); onValueChange?.(v) } }}>{children}</TabsContext.Provider>
    </div>
  )
}

export function TabsList({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('inline-grid gap-2 rounded-md bg-muted p-1', className)}>{children}</div>
}

export function TabsTrigger({ value, className, children }: { value: string; className?: string; children: React.ReactNode }) {
  const ctx = React.useContext(TabsContext)
  if (!ctx) return null
  const active = ctx.value === value
  return (
    <button
      type="button"
      onClick={() => ctx.setValue(value)}
      data-state={active ? 'active' : 'inactive'}
      className={cn(
        'px-3 py-2 rounded-md text-sm transition-colors',
        active ? 'bg-background text-foreground shadow' : 'text-muted-foreground hover:text-foreground',
        className
      )}
    >
      {children}
    </button>
  )
}

export function TabsContent({ value, className, children }: { value: string; className?: string; children: React.ReactNode }) {
  const ctx = React.useContext(TabsContext)
  if (!ctx) return null
  if (ctx.value !== value) return null
  return <div className={className}>{children}</div>
}