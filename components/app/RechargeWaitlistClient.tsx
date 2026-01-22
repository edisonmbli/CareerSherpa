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
        className="gap-1 opacity-80 w-24 justify-center"
        onClick={onOpen}
      >
        <Coins className="h-4 w-4 text-amber-500/80" />
        {dict.billing?.recharge?.title || 'Top-up'}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dict.billing?.recharge?.waitlist?.title || 'Top-up coming soon'}
            </DialogTitle>
            <div className="sr-only">
              <DialogDescription>
                Join the waitlist for the top-up feature.
              </DialogDescription>
            </div>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div className="text-sm text-muted-foreground">
              {dict.billing?.recharge?.waitlist?.desc}
            </div>
            <Input
              type="email"
              autoFocus
              className="border-muted-foreground/25 focus-visible:ring-1 focus-visible:ring-amber-300/40 focus-visible:ring-offset-0"
              placeholder={
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
              onClick={() => setOpen(false)}
            >
              {dict.billing?.recharge?.common?.cancel || 'Close'}
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={onSubmit}
              disabled={loading}
            >
              {dict.billing?.recharge?.waitlist?.submit || 'Notify me'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

