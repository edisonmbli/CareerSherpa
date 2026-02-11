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
      <TabsList className="grid w-full grid-cols-2 rounded-xl border border-border/60 bg-card/50 p-1 shadow-[0_0_0_1px_rgba(255,255,255,0.4)_inset,0_1px_2px_rgba(0,0,0,0.04)] backdrop-blur-sm">
        <TabsTrigger
          value="assets"
          className="cursor-pointer text-[13px] font-medium transition-all data-[state=active]:bg-background/90 data-[state=active]:shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
        >
          {labels.assets}
        </TabsTrigger>
        <TabsTrigger
          value="billing"
          className="cursor-pointer text-[13px] font-medium transition-all data-[state=active]:bg-background/90 data-[state=active]:shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
        >
          {labels.billing}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
