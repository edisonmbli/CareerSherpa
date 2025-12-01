'use client'
import React from 'react'

export function WorkbenchColumns({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = React.useState(false)
  React.useEffect(() => {
    const v =
      typeof window !== 'undefined'
        ? localStorage.getItem('sidebar_collapsed')
        : null
    setCollapsed(v === '1')
    const handler = () => {
      const nv =
        typeof window !== 'undefined'
          ? localStorage.getItem('sidebar_collapsed')
          : null
      setCollapsed(nv === '1')
    }
    if (typeof window !== 'undefined')
      window.addEventListener('sidebar:collapsed-changed', handler)
    return () => {
      if (typeof window !== 'undefined')
        window.removeEventListener('sidebar:collapsed-changed', handler)
    }
  }, [])
  const cols = collapsed
    ? 'lg:grid-cols-[48px_1fr]'
    : 'lg:grid-cols-[280px_1fr]'
  return (
    <div className={`grid grid-cols-1 ${cols} gap-6`}>
      <aside className="hidden lg:block lg:sticky lg:top-20 lg:h-[calc(100vh-8rem)]">
        {sidebar}
      </aside>
      <main className="flex flex-col min-h-[calc(100vh-8rem)] lg:h-[calc(100vh-8rem)] lg:overflow-hidden">
        {children}
      </main>
    </div>
  )
}
