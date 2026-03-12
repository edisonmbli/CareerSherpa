import { forwardRef } from 'react'
import { MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const feedbackFabButtonClassName =
  'rounded-full border border-slate-200 bg-slate-100/95 text-slate-700 shadow-[0_12px_32px_rgba(15,23,42,0.12)] backdrop-blur-sm hover:bg-slate-200 hover:text-slate-800 active:bg-slate-300 cursor-pointer'

export const utilityFabButtonClassName =
  'border border-slate-200 bg-slate-100/95 text-slate-700 shadow-[0_12px_32px_rgba(15,23,42,0.12)] backdrop-blur-sm hover:bg-slate-200 hover:text-slate-800 active:bg-slate-300 cursor-pointer'

export const feedbackFabDesktopSlotClassName =
  'hidden md:block fixed xl:left-[calc(50%+(var(--workbench-sidebar-width,0px)/2)+0.75rem+440px+4rem)] right-6 xl:right-auto bottom-8 z-[80] print:hidden pointer-events-auto'

export const feedbackFabMobileSlotClassName =
  'md:hidden fixed right-4 bottom-[85px] z-[80] print:hidden pointer-events-auto'

type FeedbackFabButtonProps = React.ComponentPropsWithoutRef<typeof Button> & {
  tooltip: string
}

export const FeedbackFabButton = forwardRef<
  React.ElementRef<typeof Button>,
  FeedbackFabButtonProps
>(function FeedbackFabButton(
  { tooltip, className, type = 'button', ...props },
  ref,
) {
  return (
    <Button
      ref={ref}
      type={type}
      size="icon"
      className={cn(feedbackFabButtonClassName, className)}
      aria-label={tooltip}
      title={tooltip}
      {...props}
    >
      <MessageSquare className="h-4 w-4" />
    </Button>
  )
})
