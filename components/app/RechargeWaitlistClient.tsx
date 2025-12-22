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
      trackTopupClickAction().catch(() => {})
    })
  }

  async function onSubmit() {
    const v = String(email).trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      toast.error(
        dict.waitlist?.invalidEmail ||
          (locale === 'zh' ? '邮箱格式不正确' : 'Invalid email'),
        { description: v }
      )
      return
    }
    setLoading(true)
    const r = await joinPaymentWaitlistAction({ email: v })
    setLoading(false)
    if (r && (r as any).ok) {
      toast.success(
        dict.waitlist?.success ||
          (locale === 'zh' ? '已登记' : 'Added to waitlist'),
        { description: v }
      )
      setOpen(false)
      setEmail('')
    } else {
      toast.error(
        dict.waitlist?.failed ||
          (locale === 'zh' ? '提交失败' : 'Submission failed')
      )
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
        {dict.billing?.recharge?.title || (locale === 'zh' ? '充值' : 'Top-up')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dict.billing?.waitlist?.title ||
                (locale === 'zh' ? '充值功能开发中' : 'Top-up coming soon')}
            </DialogTitle>
            <div className="sr-only">
              <DialogDescription>
                Join the waitlist for the top-up feature.
              </DialogDescription>
            </div>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div className="text-sm text-muted-foreground">
              {dict.billing?.waitlist?.desc ||
                (locale === 'zh'
                  ? '请留下邮箱，功能上线后我们会第一时间通知你'
                  : 'Leave your email and we will notify you once available')}
            </div>
            <Input
              type="email"
              autoFocus
              className="border-muted-foreground/25 focus-visible:ring-1 focus-visible:ring-amber-300/40 focus-visible:ring-offset-0"
              placeholder={dict.waitlist?.emailPlaceholder || 'you@example.com'}
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
              {dict.billing?.common?.cancel ||
                (locale === 'zh' ? '关闭' : 'Close')}
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={onSubmit}
              disabled={loading}
            >
              {dict.waitlist?.submit ||
                (locale === 'zh' ? '通知我' : 'Notify me')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
