'use client'

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerDescription,
} from '@/components/ui/drawer'
import { HelpCircle, Sparkles } from 'lucide-react'
import { ResumeExampleCard } from './ResumeExampleCard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { useMediaQuery } from '@/hooks/use-media-query'
import { useState } from 'react'

export interface ResumeExamplesData {
  label: string
  roles: {
    product: string
    ops: string
    tech: string
    design: string
  }
  items: {
    product: { label: string; content: string }[]
    ops: { label: string; content: string }[]
    tech: { label: string; content: string }[]
    design: { label: string; content: string }[]
  }
  tips?: {
    star: string
    detail: string
  }
}

interface ResumeGuidanceTooltipProps {
  children?: React.ReactNode
  triggerClassName?: string
  examples: ResumeExamplesData
}

export function ResumeGuidanceTooltip({
  children,
  triggerClassName,
  examples,
}: ResumeGuidanceTooltipProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const [open, setOpen] = useState(false)

  // Common Trigger Content
  const TriggerContent = (
    <span
      className={cn(
        'inline-flex items-center transition-all cursor-pointer',
        !children && 'text-muted-foreground hover:text-primary',
        triggerClassName
      )}
    >
      {children}
      <HelpCircle
        className={cn('h-3.5 w-3.5', children ? 'ml-1 opacity-70' : '')}
      />
    </span>
  )

  // Common Content Layout (Title -> Tabs -> Content)
  const ContentLayout = (
    <Tabs
      defaultValue="product"
      className="w-full flex flex-col h-full bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl"
    >
      {/* Header Section */}
      <div className="flex flex-col gap-4 px-4 sm:px-6 pt-6 pb-4 shrink-0 max-w-full">
        <div className="flex items-center text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          <div className="w-1 h-3.5 bg-blue-500 rounded-full mr-2.5" />
          {examples.label}
        </div>

        <TabsList className="w-full justify-start h-9 p-1 bg-zinc-100/80 dark:bg-zinc-900/50 rounded-lg flex flex-nowrap overflow-x-auto no-scrollbar">
          {Object.entries(examples.roles).map(([key, label]) => (
            <TabsTrigger
              key={key}
              value={key}
              className="
                  flex-1 px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap
                  data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 
                  data-[state=active]:text-zinc-900 dark:data-[state=active]:text-zinc-50 
                  data-[state=active]:shadow-sm
                  text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300
                  transition-all
              "
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {/* Content Section - Fixed Height to prevent layout shift */}
      <div className="flex-1 px-4 sm:px-6 pb-6 overflow-y-auto min-h-0 w-full">
        {Object.entries(examples.items).map(([key, items]) => (
          <TabsContent
            key={key}
            value={key}
            className="m-0 border-0 p-0 outline-none ring-0 focus-visible:ring-0 animate-in fade-in slide-in-from-bottom-2 duration-300 w-full"
          >
            <ResumeExampleCard
              items={items as { label: string; content: string }[]}
              tips={examples.tips || undefined}
            />
          </TabsContent>
        ))}
      </div>
    </Tabs>
  )

  if (isDesktop) {
    return (
      <HoverCard openDelay={100} closeDelay={200} onOpenChange={setOpen}>
        <HoverCardTrigger asChild>{TriggerContent}</HoverCardTrigger>
        <HoverCardContent
          // Fixed width and height to ensure stability
          className="w-[450px] h-[450px] p-0 overflow-hidden rounded-xl border-zinc-200/50 dark:border-zinc-800/50 shadow-2xl bg-transparent"
          align="start"
          side="right"
          sideOffset={24}
          alignOffset={-280} // Shift up significantly to center vertically relative to the trigger
          collisionPadding={20} // Keep some distance from screen edges
        >
          {ContentLayout}
        </HoverCardContent>
      </HoverCard>
    )
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>{TriggerContent}</DrawerTrigger>
      <DrawerContent className="max-h-[85vh] flex flex-col bg-zinc-50 dark:bg-zinc-950">
        <DrawerHeader className="hidden">
          <DrawerTitle>{examples.label}</DrawerTitle>
          <DrawerDescription>Examples</DrawerDescription>
        </DrawerHeader>
        <div className="flex-1 overflow-hidden">{ContentLayout}</div>
      </DrawerContent>
    </Drawer>
  )
}
