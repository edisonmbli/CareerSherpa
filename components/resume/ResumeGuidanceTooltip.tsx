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
    <Tabs defaultValue="product" className="w-full flex flex-col h-full">
      {/* Header Section */}
      <div className="flex flex-col gap-3 px-6 py-4 border-b bg-muted/30 shrink-0">
        <div className="flex items-center gap-2 text-base font-semibold text-foreground/90">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-amber-100 dark:bg-amber-900/30">
            <Sparkles className="h-3.5 w-3.5 text-amber-600 dark:text-amber-500" />
          </div>
          {examples.label}
        </div>

        <TabsList className="w-full justify-start h-auto p-1 bg-muted/50 rounded-lg flex flex-nowrap overflow-x-auto no-scrollbar">
          {Object.entries(examples.roles).map(([key, label]) => (
            <TabsTrigger
              key={key}
              value={key}
              className="
                                flex-1 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap
                                data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm
                                text-muted-foreground hover:text-foreground
                                transition-all
                            "
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {/* Content Section - Fixed Height to prevent layout shift */}
      <div className="flex-1 p-5 bg-card/50 overflow-y-auto min-h-0">
        {Object.entries(examples.items).map(([key, items]) => (
          <TabsContent
            key={key}
            value={key}
            className="m-0 border-0 p-0 outline-none ring-0 focus-visible:ring-0 animate-in fade-in slide-in-from-bottom-2 duration-300"
          >
            <ResumeExampleCard
              items={items as { label: string; content: string }[]}
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
          className="w-[500px] h-[650px] p-0 overflow-hidden border-border/40 shadow-2xl bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
          align="start"
          side="right"
          sideOffset={24}
          alignOffset={-350} // Shift up significantly to center vertically relative to the trigger
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
      <DrawerContent className="h-[85vh] flex flex-col">
        <DrawerHeader className="hidden">
          <DrawerTitle>{examples.label}</DrawerTitle>
          <DrawerDescription>Examples</DrawerDescription>
        </DrawerHeader>
        <div className="flex-1 overflow-hidden">{ContentLayout}</div>
      </DrawerContent>
    </Drawer>
  )
}
