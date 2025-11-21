'use client'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'

export const TooltipProvider = TooltipPrimitive.Provider
export const Tooltip = TooltipPrimitive.Root
export const TooltipTrigger = TooltipPrimitive.Trigger
export function TooltipContent({ children }: { children: React.ReactNode }) {
  return (
    <TooltipPrimitive.Content sideOffset={6} className="z-50 rounded-md bg-popover px-2 py-1 text-xs shadow">
      {children}
    </TooltipPrimitive.Content>
  )
}