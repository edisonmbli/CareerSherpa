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
    // Reset page when switching tabs
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
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="assets" className="cursor-pointer transition-all">{labels.assets}</TabsTrigger>
        <TabsTrigger value="billing" className="cursor-pointer transition-all">{labels.billing}</TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
