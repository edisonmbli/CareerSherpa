'use client'
import { useState, startTransition } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/use-toast'
import {
  trackTopupClickAction,
  joinPaymentWaitlistAction,
} from '@/lib/actions/billing.actions'
import { Coins } from 'lucide-react'

export function RechargeWaitlistClient({
  locale,
  dict,
}: {
  locale: string
  dict: any
}) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  async function onOpen() {
    setOpen(true)
    startTransition(() => {
      trackTopupClickAction().catch(() => { })
    })
  }

  async function onSubmit() {
    const v = String(email).trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      toast.error(
        dict.billing?.recharge?.invalidEmail || 'Invalid configuration',
        { description: v }
      )
      return
    }
    setLoading(true)
    const r = await joinPaymentWaitlistAction({ email: v })
    setLoading(false)
    if (r && (r as any).ok) {
      toast.success(dict.billing?.recharge?.success || 'Success', {
        description: v,
      })
      setOpen(false)
      setEmail('')
    } else {
      toast.error(dict.billing?.recharge?.failed || 'Failed')
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1 w-24 justify-center text-xs font-medium text-muted-foreground border-muted/40 hover:text-foreground hover:border-border/60"
        onClick={onOpen}
      >
        <Coins className="h-3.5 w-3.5 text-amber-500/70" />
        {dict.recharge?.title || dict.billing?.recharge?.title || 'Top-up'}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[420px] border-border/40 bg-card/95 shadow-[0_12px_28px_rgba(0,0,0,0.12)]">
          <DialogHeader>
            <DialogTitle className="text-base font-medium tracking-tight">
              {dict.waitlist?.title || dict.billing?.recharge?.waitlist?.title || 'Top-up coming soon'}
            </DialogTitle>
            <div className="sr-only">
              <DialogDescription>
                Join the waitlist for the top-up feature.
              </DialogDescription>
            </div>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div className="text-xs text-muted-foreground/80">
              {dict.waitlist?.desc || dict.billing?.recharge?.waitlist?.desc}
            </div>
            <Input
              type="email"
              autoFocus
              className="border-border/40 focus-visible:ring-1 focus-visible:ring-amber-200/50 focus-visible:ring-offset-0"
              placeholder={
                dict.waitlist?.emailPlaceholder ||
                dict.billing?.recharge?.waitlist?.emailPlaceholder ||
                'you@example.com'
              }
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs font-medium"
              onClick={() => setOpen(false)}
            >
              {dict.common?.cancel || dict.billing?.recharge?.common?.cancel || 'Close'}
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              className="text-xs font-medium"
              onClick={onSubmit}
              disabled={loading}
            >
              {dict.waitlist?.submit || dict.billing?.recharge?.waitlist?.submit || 'Notify me'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
