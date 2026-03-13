'use client'

import { useEffect, useRef, useState } from 'react'
import posthog from 'posthog-js'
import { Check, Loader2, Send } from 'lucide-react'
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
import { cn } from '@/lib/utils'
import type { FeedbackType } from '@/lib/feedback/schema'
import { FeedbackFabButton } from '@/components/feedback/feedback-fab'
import { getLastSentryEventId } from '@/lib/sentry/browser'

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
  const [submitState, setSubmitState] = useState<
    'idle' | 'submitting' | 'success' | 'error'
  >('idle')
  const [inlineError, setInlineError] = useState<string | null>(null)
  const resetTimerRef = useRef<number | null>(null)

  const typeLabels = labels.types[type]

  const resetForm = () => {
    setMessage('')
    setType('bug')
    setIncludeAccountEmail(true)
    setInlineError(null)
    setSubmitState('idle')
  }

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

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current)
      }
    }
  }, [])

  const handleSubmit = async () => {
    const trimmed = message.trim()
    if (trimmed.length < 3) {
      setInlineError(labels.errorDesc)
      setSubmitState('error')
      return
    }

    setInlineError(null)
    setSubmitState('submitting')
    try {
      const sentryEventId = getLastSentryEventId()
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
          sentryEventId,
          sentryRuntime: sentryEventId ? 'web' : undefined,
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

      setSubmitState('success')
      resetTimerRef.current = window.setTimeout(() => {
        setOpen(false)
        resetForm()
        onSubmitted?.()
      }, 2200)
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
      setInlineError(messageKey)
      setSubmitState('error')
    } finally {
    }
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && resetTimerRef.current) {
      window.clearTimeout(resetTimerRef.current)
      resetTimerRef.current = null
    }
    setOpen(nextOpen)
    if (!nextOpen) {
      resetForm()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <FeedbackFabButton tooltip={labels.tooltip} className={className} />
        )}
      </DialogTrigger>
      <DialogContent className="max-w-[620px] rounded-[28px] border border-slate-200/80 bg-white px-7 py-6 shadow-[0_32px_80px_rgba(15,23,42,0.18)] sm:px-8">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-[2rem] font-semibold tracking-tight text-slate-950">
            {labels.title}
          </DialogTitle>
          <DialogDescription className="max-w-[460px] text-[15px] leading-7 text-slate-500">
            {labels.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <div className="space-y-3">
            <Label className="text-[15px] font-semibold text-slate-950">{labels.typeLabel}</Label>
            <div className="grid gap-3 sm:grid-cols-3">
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

          <div className="space-y-3">
            <Label
              htmlFor="founder-feedback-message"
              className="text-[15px] font-semibold text-slate-950"
            >
              {labels.messageLabel}
            </Label>
            <Textarea
              id="founder-feedback-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={typeLabels.placeholder}
              className="min-h-[152px] rounded-2xl border-slate-200 bg-slate-50/70 px-5 py-4 text-[15px] leading-7 placeholder:text-slate-400 focus-visible:ring-slate-300"
              maxLength={2000}
            />
            <p className="text-[13px] leading-6 text-slate-500">{labels.messageHint}</p>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/55 px-5 py-4">
            <div>
              <div className="text-[15px] font-semibold text-slate-950">{labels.includeEmail}</div>
              <div className="mt-1 text-[13px] leading-6 text-slate-500">
                {labels.includeEmailHint}
              </div>
            </div>
            <Switch
              checked={includeAccountEmail}
              onCheckedChange={setIncludeAccountEmail}
              aria-label={labels.includeEmail}
            />
          </div>

          {inlineError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm text-rose-700">
              {inlineError}
            </div>
          ) : null}
        </div>

        <DialogFooter className="mt-2 gap-2 border-t border-slate-100 pt-5">
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={submitState === 'submitting'}
            className="rounded-full px-5 text-[15px] text-slate-700 hover:bg-slate-100"
          >
            {labels.cancel}
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitState === 'submitting' || submitState === 'success'}
            className={cn(
              'min-w-[152px] rounded-full px-5 text-[15px] shadow-sm',
              submitState === 'success' &&
                'bg-emerald-400 text-slate-950 hover:bg-emerald-400',
            )}
          >
            {submitState === 'submitting' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : submitState === 'success' ? (
              <Check className="mr-2 h-4 w-4" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            {submitState === 'submitting'
              ? labels.submitting
              : submitState === 'success'
                ? labels.successTitle
                : labels.submit}
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
        'rounded-[22px] border px-5 py-4 text-left transition-colors',
        active
          ? 'border-slate-900 bg-slate-900 text-white shadow-[0_14px_32px_rgba(15,23,42,0.18)] dark:border-white dark:bg-white dark:text-slate-950'
          : 'border-slate-200 bg-slate-50/55 hover:bg-slate-100/80',
      )}
    >
      <div className="text-[15px] font-semibold leading-6">{title}</div>
      <div className={cn('mt-1.5 text-[13px] leading-6', active ? 'text-white/78 dark:text-slate-700' : 'text-slate-500')}>
        {description}
      </div>
    </button>
  )
}
