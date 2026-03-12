'use client'

import { useEffect, useMemo, useState } from 'react'
import * as Sentry from '@sentry/nextjs'
import posthog from 'posthog-js'
import { MessageSquare, Send } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import type { FeedbackType } from '@/lib/feedback/schema'

type FeedbackLabels = {
  trigger: string
  tooltip: string
  title: string
  description: string
  typeLabel: string
  messageLabel: string
  messageHint: string
  includeEmail: string
  includeEmailHint: string
  contextTitle: string
  submit: string
  submitting: string
  cancel: string
  successTitle: string
  successDesc: string
  errorTitle: string
  errorDesc: string
  unavailable: string
  types: {
    bug: { title: string; desc: string; placeholder: string }
    feature: { title: string; desc: string; placeholder: string }
    confusion: { title: string; desc: string; placeholder: string }
  }
  contextLabels: {
    surface: string
    tab: string
    status: string
    serviceId: string
  }
}

type FeedbackContext = {
  locale: string
  surface: string
  tab?: string
  serviceId?: string
  taskId?: string
  taskTemplateId?: string
  status?: string
  tier?: 'free' | 'paid'
  taskTierHint?: 'free' | 'paid'
  queueType?: 'free' | 'paid'
  extras?: Record<string, string | number | boolean | null | undefined>
}

export function FounderFeedbackDialog({
  labels,
  context,
  trigger,
  className,
  onSubmitted,
}: {
  labels: FeedbackLabels
  context: FeedbackContext
  trigger?: React.ReactNode
  className?: string
  onSubmitted?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<FeedbackType>('bug')
  const [message, setMessage] = useState('')
  const [includeAccountEmail, setIncludeAccountEmail] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const typeLabels = labels.types[type]
  const contextPreview = useMemo(
    () => [
      `${labels.contextLabels.surface}: ${context.surface}`,
      `${labels.contextLabels.tab}: ${context.tab || '-'}`,
      `${labels.contextLabels.status}: ${context.status || '-'}`,
      `${labels.contextLabels.serviceId}: ${context.serviceId || '-'}`,
    ],
    [context.serviceId, context.status, context.surface, context.tab, labels.contextLabels.serviceId, labels.contextLabels.status, labels.contextLabels.surface, labels.contextLabels.tab],
  )

  useEffect(() => {
    if (!open) return
    try {
      posthog.capture('FOUNDER_FEEDBACK_OPENED', {
        surface: context.surface,
        tab: context.tab,
        serviceId: context.serviceId,
        status: context.status,
      })
    } catch {}
  }, [context.serviceId, context.status, context.surface, context.tab, open])

  const handleSubmit = async () => {
    const trimmed = message.trim()
    if (trimmed.length < 3) {
      toast.error(labels.errorTitle, { description: labels.errorDesc })
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        type,
        message: trimmed,
        includeAccountEmail,
        context: {
          locale: context.locale,
          surface: context.surface,
          ...(context.tab ? { tab: context.tab } : {}),
          ...(context.serviceId ? { serviceId: context.serviceId } : {}),
          ...(context.taskId ? { taskId: context.taskId } : {}),
          ...(context.taskTemplateId
            ? { taskTemplateId: context.taskTemplateId }
            : {}),
          ...(context.status ? { status: context.status } : {}),
          ...(context.tier ? { tier: context.tier } : {}),
          ...(context.taskTierHint ? { taskTierHint: context.taskTierHint } : {}),
          ...(context.queueType ? { queueType: context.queueType } : {}),
          currentUrl: typeof window !== 'undefined' ? window.location.href : undefined,
          pathname: typeof window !== 'undefined' ? window.location.pathname : undefined,
          title: typeof document !== 'undefined' ? document.title : undefined,
          sentryEventId: Sentry.lastEventId() || undefined,
          posthogDistinctId:
            typeof posthog.get_distinct_id === 'function'
              ? posthog.get_distinct_id()
              : undefined,
          posthogSessionId:
            typeof posthog.get_session_id === 'function'
              ? posthog.get_session_id() || undefined
              : undefined,
          posthogReplayUrl:
            typeof posthog.get_session_replay_url === 'function'
              ? posthog.get_session_replay_url({
                  withTimestamp: true,
                  timestampLookBack: 30,
                }) || undefined
              : undefined,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          userAgent:
            typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
          occurredAt: new Date().toISOString(),
          viewport:
            typeof window !== 'undefined'
              ? {
                  width: Math.max(1, window.innerWidth || 0),
                  height: Math.max(1, window.innerHeight || 0),
                }
              : undefined,
          extras: sanitizeExtras(context.extras),
        },
      }

      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.ok) {
        const isUnavailable = result?.error === 'feedback_delivery_not_configured'
        throw new Error(isUnavailable ? 'feedback_delivery_not_configured' : 'feedback_submit_failed')
      }

      try {
        posthog.capture('FOUNDER_FEEDBACK_SUBMITTED', {
          surface: context.surface,
          tab: context.tab,
          serviceId: context.serviceId,
          status: context.status,
          type,
          queued: Boolean(result?.queued),
        })
      } catch {}

      toast.success(labels.successTitle, { description: labels.successDesc })
      setOpen(false)
      setMessage('')
      setType('bug')
      setIncludeAccountEmail(true)
      onSubmitted?.()
    } catch (error) {
      const messageKey =
        error instanceof Error && error.message === 'feedback_delivery_not_configured'
          ? labels.unavailable
          : labels.errorDesc
      try {
        posthog.capture('FOUNDER_FEEDBACK_SUBMIT_FAILED', {
          surface: context.surface,
          tab: context.tab,
          serviceId: context.serviceId,
          status: context.status,
          type,
        })
      } catch {}
      toast.error(labels.errorTitle, { description: messageKey })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            type="button"
            size="icon"
            className={cn(
              'h-11 w-11 rounded-full border border-amber-200 bg-amber-400/90 text-slate-950 shadow-lg hover:bg-amber-300',
              className,
            )}
            aria-label={labels.tooltip}
            title={labels.tooltip}
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{labels.title}</DialogTitle>
          <DialogDescription>{labels.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{labels.typeLabel}</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              <FeedbackTypeCard
                active={type === 'bug'}
                title={labels.types.bug.title}
                description={labels.types.bug.desc}
                onClick={() => setType('bug')}
              />
              <FeedbackTypeCard
                active={type === 'feature'}
                title={labels.types.feature.title}
                description={labels.types.feature.desc}
                onClick={() => setType('feature')}
              />
              <FeedbackTypeCard
                active={type === 'confusion'}
                title={labels.types.confusion.title}
                description={labels.types.confusion.desc}
                onClick={() => setType('confusion')}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="founder-feedback-message">{labels.messageLabel}</Label>
            <Textarea
              id="founder-feedback-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={typeLabels.placeholder}
              className="min-h-[140px]"
              maxLength={2000}
            />
            <p className="text-xs text-muted-foreground">{labels.messageHint}</p>
          </div>

          <div className="rounded-xl border bg-muted/30 p-3">
            <div className="mb-2 text-sm font-medium">{labels.contextTitle}</div>
            <div className="space-y-1 text-xs text-muted-foreground">
              {contextPreview.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          </div>

          <div className="flex items-start justify-between gap-3 rounded-xl border p-3">
            <div>
              <div className="text-sm font-medium">{labels.includeEmail}</div>
              <div className="text-xs text-muted-foreground">
                {labels.includeEmailHint}
              </div>
            </div>
            <Switch
              checked={includeAccountEmail}
              onCheckedChange={setIncludeAccountEmail}
              aria-label={labels.includeEmail}
            />
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            {labels.cancel}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
            <Send className="mr-2 h-4 w-4" />
            {isSubmitting ? labels.submitting : labels.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function sanitizeExtras(
  extras: FeedbackContext['extras'],
): Record<string, string | number | boolean | null> | undefined {
  if (!extras) return undefined
  const cleaned = Object.fromEntries(
    Object.entries(extras)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, value ?? null]),
  ) as Record<string, string | number | boolean | null>
  return Object.keys(cleaned).length ? cleaned : undefined
}

function FeedbackTypeCard({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-xl border px-3 py-3 text-left transition-colors',
        active
          ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-950'
          : 'border-border bg-background hover:bg-muted/50',
      )}
    >
      <div className="text-sm font-medium">{title}</div>
      <div className={cn('mt-1 text-xs', active ? 'text-white/80 dark:text-slate-700' : 'text-muted-foreground')}>
        {description}
      </div>
    </button>
  )
}
