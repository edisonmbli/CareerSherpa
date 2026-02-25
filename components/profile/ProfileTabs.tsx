'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function ProfileTabs({
  defaultValue,
  labels,
}: {
  defaultValue: string
  labels: { assets: string; billing: string }
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams)
    params.set('tab', value)
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <Tabs
      defaultValue={defaultValue}
      value={defaultValue}
      onValueChange={handleTabChange}
      className="w-full"
    >
      <TabsList className="grid w-full grid-cols-2 rounded-xl bg-slate-100/50 dark:bg-zinc-800/30 p-1 backdrop-blur-xl">
        <TabsTrigger
          value="assets"
          className="cursor-pointer text-[13px] font-medium transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 data-[state=active]:text-foreground dark:data-[state=active]:text-white data-[state=active]:bg-white dark:data-[state=active]:bg-white/10 data-[state=active]:shadow-sm"
        >
          {labels.assets}
        </TabsTrigger>
        <TabsTrigger
          value="billing"
          className="cursor-pointer text-[13px] font-medium transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 data-[state=active]:text-foreground dark:data-[state=active]:text-white data-[state=active]:bg-white dark:data-[state=active]:bg-white/10 data-[state=active]:shadow-sm"
        >
          {labels.billing}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
