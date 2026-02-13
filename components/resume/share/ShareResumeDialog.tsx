'use client'

import { useState, useEffect, useRef, useTransition, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import {
  Loader2,
  Copy,
  Check,
  Share2,
  Globe,
  Clock,
  ExternalLink,
} from 'lucide-react'
import {
  generateShareLinkAction,
  disableShareLinkAction,
  getResumeShareAction,
} from '@/lib/actions/share.actions'
import { cn } from '@/lib/utils'
import { useResumeDict } from '@/components/resume/ResumeDictContext'

interface ShareResumeDialogProps {
  serviceId: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: React.ReactNode
}

export function ShareResumeDialog({
  serviceId,
  trigger,
}: ShareResumeDialogProps) {
  const dict = useResumeDict()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [, startTransition] = useTransition()
  const [isMutating, setIsMutating] = useState(false)

  // State
  const [isEnabled, setIsEnabled] = useState(false)
  const [shareKey, setShareKey] = useState<string | null>(null)
  const [expireAt, setExpireAt] = useState<Date | null>(null)
  const [duration, setDuration] = useState('7') // '7', '30', '9999'
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info'
    message: string
    scope?: 'toggle' | 'validity' | 'link' | 'global'
  } | null>(null)
  const hasLoadedRef = useRef(false)
  const lastFetchedAtRef = useRef(0)
  const feedbackTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) {
        window.clearTimeout(feedbackTimerRef.current)
      }
    }
  }, [])

  const showFeedback = useCallback(
    (
      type: 'success' | 'error' | 'info',
      message: string,
      scope: 'toggle' | 'validity' | 'link' | 'global' = 'global',
    ) => {
      setFeedback({ type, message, scope })
      if (feedbackTimerRef.current) {
        window.clearTimeout(feedbackTimerRef.current)
      }
      feedbackTimerRef.current = window.setTimeout(() => {
        setFeedback(null)
      }, 3000)
    },
    [],
  )

  const fetchShare = useCallback(
    async (showLoading: boolean) => {
      if (showLoading) setLoading(true)
      const startedAt = Date.now()
      console.info('share_ui_load_start', { serviceId })
      const res = await getResumeShareAction({ serviceId })
      if (res.ok) {
        if (res.data) {
          setIsEnabled(res.data.isEnabled)
          if (res.data.isEnabled) {
            setShareKey(res.data.shareKey)
            setExpireAt(res.data.expireAt ? new Date(res.data.expireAt) : null)
          } else {
            setShareKey(null)
            setExpireAt(null)
          }
        } else {
          setIsEnabled(false)
          setShareKey(null)
          setExpireAt(null)
        }
      } else {
        setIsEnabled(false)
        setShareKey(null)
        setExpireAt(null)
        showFeedback('error', res.error || dict.share.feedback.loadFailed)
      }
      hasLoadedRef.current = true
      lastFetchedAtRef.current = Date.now()
      console.info('share_ui_load_end', {
        serviceId,
        ok: res.ok,
        ms: Date.now() - startedAt,
      })
      if (showLoading) setLoading(false)
    },
    [dict.share.feedback.loadFailed, serviceId, showFeedback],
  )

  useEffect(() => {
    if (!open) return
    const isStale = Date.now() - lastFetchedAtRef.current > 60000
    if (!hasLoadedRef.current || isStale) {
      fetchShare(true)
    } else {
      setLoading(false)
    }
  }, [open, fetchShare])

  const handleSave = () => {
    if (!isEnabled || isMutating) return
    setIsMutating(true)
    startTransition(async () => {
      try {
        const days = duration === '9999' ? null : parseInt(duration)
        const res = await generateShareLinkAction({
          serviceId,
          durationDays: days,
        })
        if (res.ok) {
          setShareKey(res.data.shareKey)
          setExpireAt(res.data.expireAt ? new Date(res.data.expireAt) : null)
          const message = shareKey
            ? dict.share.feedback.saveSuccess
            : dict.share.feedback.createSuccess
          showFeedback('success', message, 'validity')
        } else {
          showFeedback(
            'error',
            res.error || dict.share.feedback.actionFailed,
            'validity',
          )
        }
      } finally {
        setIsMutating(false)
      }
    })
  }

  const handleCopy = () => {
    if (!shareKey) return
    const url = `${window.location.origin}/r/${shareKey}`
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true)
        showFeedback('success', dict.share.feedback.copySuccess, 'link')
        window.setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => {
        showFeedback('error', dict.share.feedback.actionFailed, 'link')
      })
  }

  const isExpired = expireAt && new Date() > expireAt
  const shareUrl = shareKey
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/r/${shareKey}`
    : ''
  const feedbackClasses =
    'bg-stone-100 text-stone-500 font-light dark:bg-stone-900/40 dark:text-stone-300'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Share2 className="w-4 h-4" />
            {dict.share.button}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <div className="px-5 pt-4 pb-4 border-b bg-gradient-to-b from-muted/80 via-muted/40 to-background rounded-t-lg">
          <DialogHeader className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-sm ring-1 ring-primary/15">
                    <Share2 className="h-4 w-4" />
                  </div>
                </div>
                <div className="space-y-0.5">
                  <DialogTitle className="text-lg tracking-tight">
                    {dict.share.header.title}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    {dict.share.header.description}
                  </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>
        </div>

        {loading ? (
          <div className="py-6 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 px-5 py-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between space-x-2">
                <div className="flex flex-col">
                  <Label htmlFor="share-mode" className="text-base font-medium">
                    {isEnabled
                      ? dict.share.toggle.disableTitle
                      : dict.share.toggle.enableTitle}
                  </Label>
                </div>
                <Switch
                  id="share-mode"
                  checked={isEnabled}
                  disabled={isMutating}
                  onCheckedChange={(next) => {
                    if (isMutating) return
                    setIsEnabled(next)
                    if (next) {
                      setDuration('7')
                      setIsMutating(true)
                      startTransition(async () => {
                        try {
                          const res = await generateShareLinkAction({
                            serviceId,
                            durationDays: 7,
                          })
                          if (res.ok) {
                            setShareKey(res.data.shareKey)
                            setExpireAt(
                              res.data.expireAt
                                ? new Date(res.data.expireAt)
                                : null,
                            )
                            showFeedback(
                              'success',
                              dict.share.feedback.createSuccess,
                              'link',
                            )
                          } else {
                            setIsEnabled(false)
                            showFeedback(
                              'error',
                              res.error || dict.share.feedback.actionFailed,
                              'toggle',
                            )
                          }
                        } finally {
                          setIsMutating(false)
                        }
                      })
                      return
                    }
                    setIsMutating(true)
                    startTransition(async () => {
                      try {
                        const res = await disableShareLinkAction({ serviceId })
                        if (res.ok) {
                          setShareKey(null)
                          setExpireAt(null)
                          showFeedback(
                            'success',
                            dict.share.feedback.disableSuccess,
                            'toggle',
                          )
                        } else {
                          setIsEnabled(true)
                          showFeedback(
                            'error',
                            res.error || dict.share.feedback.actionFailed,
                            'toggle',
                          )
                        }
                      } finally {
                        setIsMutating(false)
                      }
                    })
                  }}
                />
              </div>
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span className="leading-relaxed">
                  {isEnabled
                    ? dict.share.toggle.disableDesc
                    : dict.share.toggle.enableDesc}
                </span>
                {(feedback?.scope === 'toggle' ||
                  feedback?.scope === 'global') && (
                  <div
                    className={cn(
                      'inline-flex items-center rounded-md px-2 py-0.5 text-xs',
                      feedbackClasses,
                    )}
                  >
                    {feedback.message}
                  </div>
                )}
              </div>
            </div>

            {isEnabled && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">
                      {dict.share.validity.label}
                    </Label>
                    {feedback?.scope === 'validity' && (
                      <div
                        className={cn(
                          'inline-flex items-center rounded-md px-2 py-0.5 text-xs',
                          feedbackClasses,
                        )}
                      >
                        {feedback.message}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Select
                      value={duration}
                      onValueChange={setDuration}
                      disabled={isMutating}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={dict.share.validity.placeholder}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">
                          {dict.share.validity.options.days7}
                        </SelectItem>
                        <SelectItem value="30">
                          {dict.share.validity.options.days30}
                        </SelectItem>
                        <SelectItem value="9999">
                          {dict.share.validity.options.permanent}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleSave}
                      disabled={isMutating}
                      variant="default"
                      className="shrink-0"
                    >
                      {isMutating && (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      )}
                      {shareKey
                        ? dict.share.actions.renew
                        : dict.share.actions.create}
                    </Button>
                  </div>
                  {expireAt && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        {isExpired
                          ? dict.share.link.expired
                          : dict.share.link.expiresAt}
                        : {expireAt.toLocaleDateString()}{' '}
                        {expireAt.toLocaleTimeString()}
                      </span>
                    </div>
                  )}
                </div>

                {shareKey && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">
                        {dict.share.link.label}
                      </Label>
                      {feedback?.scope === 'link' && (
                        <div
                          className={cn(
                            'inline-flex items-center rounded-md px-2 py-0.5 text-xs',
                            feedbackClasses,
                          )}
                        >
                          {feedback.message}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="relative flex-1">
                        <Input
                          readOnly
                          value={shareUrl}
                          className="pr-10 font-mono text-sm bg-muted/50"
                        />
                        <Globe className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground opacity-50" />
                      </div>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={handleCopy}
                              className="shrink-0"
                            >
                              {copied ? (
                                <Check className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {dict.share.feedback.copyTooltip}
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="outline"
                              className="shrink-0"
                              asChild
                            >
                              <a
                                href={`/r/${shareKey}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {dict.share.link.preview}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
