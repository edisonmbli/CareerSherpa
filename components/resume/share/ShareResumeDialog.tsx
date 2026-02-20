'use client'

import { useState, useEffect, useRef, useTransition, useCallback } from 'react'
import { flushSync } from 'react-dom'
import { usePathname } from 'next/navigation'
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
import { loadLocalAvatar } from '@/lib/storage/avatar-client'

interface ShareResumeDialogProps {
  serviceId: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: React.ReactNode
}

const SHARE_CACHE_TTL = 60000
const shareCache = new Map<
  string,
  {
    data: {
      isEnabled: boolean
      shareKey: string | null
      expireAt: string | null
      avatarUrl: string | null
    } | null
    fetchedAt: number
  }
>()

export async function prefetchShareState(serviceId: string) {
  if (!serviceId) return
  const cached = shareCache.get(serviceId)
  if (cached && Date.now() - cached.fetchedAt <= SHARE_CACHE_TTL) return
  try {
    const res = await getResumeShareAction({ serviceId })
    if (!res.ok) return
    const payload = res.data
      ? {
          isEnabled: res.data.isEnabled,
          shareKey: res.data.shareKey ?? null,
          expireAt: res.data.expireAt ?? null,
          avatarUrl: res.data.avatarUrl ?? null,
        }
      : null
    shareCache.set(serviceId, { data: payload, fetchedAt: Date.now() })
  } catch {
    return
  }
}

export function ShareResumeDialog({
  serviceId,
  trigger,
}: ShareResumeDialogProps) {
  const dict = useResumeDict()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [, startTransition] = useTransition()
  const [isMutating, setIsMutating] = useState(false)

  // State
  const [isEnabled, setIsEnabled] = useState(false)
  const [shareKey, setShareKey] = useState<string | null>(null)
  const [expireAt, setExpireAt] = useState<Date | null>(null)
  const [shareAvatarUrl, setShareAvatarUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState('3')
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

  const getFreshCache = useCallback(() => {
    if (!serviceId) return null
    const entry = shareCache.get(serviceId)
    if (!entry) return null
    if (Date.now() - entry.fetchedAt > SHARE_CACHE_TTL) return null
    return entry
  }, [serviceId])

  const applyShareData = useCallback(
    (
      data: {
        isEnabled: boolean
        shareKey: string | null
        expireAt: string | null
        avatarUrl: string | null
      } | null,
    ) => {
      if (!data) {
        setIsEnabled(false)
        setShareKey(null)
        setExpireAt(null)
        setShareAvatarUrl(null)
        return
      }
      setIsEnabled(data.isEnabled)
      if (data.isEnabled) {
        setShareKey(data.shareKey)
        setExpireAt(data.expireAt ? new Date(data.expireAt) : null)
        setShareAvatarUrl(data.avatarUrl ?? null)
      } else {
        setShareKey(null)
        setExpireAt(null)
        setShareAvatarUrl(null)
      }
    },
    [],
  )

  const fetchShare = useCallback(
    async (showLoading: boolean) => {
      if (showLoading) setLoading(true)
      const res = await getResumeShareAction({ serviceId })
      if (res.ok) {
        const payload = res.data
          ? {
              isEnabled: res.data.isEnabled,
              shareKey: res.data.shareKey ?? null,
              expireAt: res.data.expireAt ?? null,
              avatarUrl: res.data.avatarUrl ?? null,
            }
          : null
        applyShareData(payload)
        if (serviceId) {
          shareCache.set(serviceId, { data: payload, fetchedAt: Date.now() })
        }
      } else {
        applyShareData(null)
        showFeedback('error', res.error || dict.share.feedback.loadFailed)
      }
      hasLoadedRef.current = true
      lastFetchedAtRef.current = Date.now()
      if (showLoading) setLoading(false)
    },
    [applyShareData, dict.share.feedback.loadFailed, serviceId, showFeedback],
  )

  useEffect(() => {
    if (!serviceId) return
    const cached = getFreshCache()
    if (!cached) return
    if (!hasLoadedRef.current) {
      applyShareData(cached.data)
      hasLoadedRef.current = true
      lastFetchedAtRef.current = cached.fetchedAt
    }
  }, [serviceId, getFreshCache, applyShareData])

  useEffect(() => {
    if (!open) return
    const cached = getFreshCache()
    if (cached) {
      applyShareData(cached.data)
      hasLoadedRef.current = true
      lastFetchedAtRef.current = cached.fetchedAt
      setLoading(false)
      return
    }
    const isStale = Date.now() - lastFetchedAtRef.current > SHARE_CACHE_TTL
    if (!hasLoadedRef.current || isStale) {
      fetchShare(true)
    } else {
      setLoading(false)
    }
  }, [open, fetchShare, getFreshCache, applyShareData])

  useEffect(() => {
    if (!serviceId || open) return
    const cached = getFreshCache()
    if (cached || hasLoadedRef.current) return
    fetchShare(false)
  }, [serviceId, open, fetchShare, getFreshCache])

  const handleSave = () => {
    if (!isEnabled || isMutating) return
    setIsMutating(true)
    const avatarBase64 = shareAvatarUrl ? null : loadLocalAvatar()
    startTransition(async () => {
      try {
        const days = parseInt(duration)
        const res = await generateShareLinkAction({
          serviceId,
          durationDays: days,
          ...(avatarBase64 ? { avatarBase64 } : {}),
        })
        if (res.ok) {
          setShareKey(res.data.shareKey)
          setExpireAt(res.data.expireAt ? new Date(res.data.expireAt) : null)
          if (serviceId) {
            shareCache.set(serviceId, {
              data: {
                isEnabled: true,
                shareKey: res.data.shareKey,
                expireAt: res.data.expireAt ?? null,
                avatarUrl: res.data.avatarUrl ?? null,
              },
              fetchedAt: Date.now(),
            })
            lastFetchedAtRef.current = Date.now()
          }
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

  const localeMatch = pathname?.match(/^\/(en|zh)(?:\/|$)/)
  const currentLocale = localeMatch?.[1] ?? 'en'
  const sharePath = shareKey ? `/${currentLocale}/r/${shareKey}` : ''

  const handleCopy = () => {
    if (!shareKey) return
    const url = `${window.location.origin}${sharePath}`
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
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}${sharePath}`
    : ''
  const feedbackClasses =
    feedback?.type === 'error'
      ? 'bg-red-50 text-red-700 border border-red-100/80 font-medium dark:bg-red-950/30 dark:text-red-200 dark:border-red-900/40'
      : 'bg-blue-50 text-blue-500/80 border border-blue-100/80 font-medium dark:bg-blue-950/80 dark:text-blue-200 dark:border-blue-900/40'

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
        <div className="px-5 pt-4 pb-4 border-b border-slate-200/80 bg-gradient-to-b from-slate-100/95 via-slate-100/80 to-slate-50/70 dark:border-zinc-800/80 dark:from-zinc-900/90 dark:via-zinc-900/75 dark:to-zinc-900/60 rounded-t-lg">
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
          <div className="px-5 py-5 space-y-4 bg-slate-200/40 dark:bg-zinc-900/50">
            <div className="rounded-xl border border-slate-300/70 dark:border-zinc-700/70 bg-slate-200/70 dark:bg-zinc-800/60 p-3 shadow-sm animate-pulse">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-28 rounded-md bg-slate-300/80 dark:bg-zinc-700/70" />
                  <div className="h-3 w-48 rounded-md bg-slate-300/70 dark:bg-zinc-700/60" />
                </div>
                <div className="h-6 w-11 rounded-full bg-slate-300/80 dark:bg-zinc-700/70" />
              </div>
              <div className="mt-3 h-3 w-56 rounded-md bg-slate-300/70 dark:bg-zinc-700/60" />
            </div>

            <div className="rounded-xl border border-slate-300/70 dark:border-zinc-700/70 bg-slate-200/70 dark:bg-zinc-800/60 p-3 shadow-sm space-y-3 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="h-4 w-20 rounded-md bg-slate-300/80 dark:bg-zinc-700/70" />
                <div className="h-4 w-16 rounded-md bg-slate-300/70 dark:bg-zinc-700/60" />
              </div>
              <div className="flex gap-2">
                <div className="h-9 flex-1 rounded-lg bg-slate-300/80 dark:bg-zinc-700/70" />
                <div className="h-9 w-24 rounded-lg bg-slate-300/80 dark:bg-zinc-700/70" />
              </div>
              <div className="h-3 w-36 rounded-md bg-slate-300/70 dark:bg-zinc-700/60" />
            </div>

            <div className="rounded-xl border border-slate-300/70 dark:border-zinc-700/70 bg-slate-200/70 dark:bg-zinc-800/60 p-3 shadow-sm space-y-3 animate-pulse">
              <div className="h-4 w-20 rounded-md bg-slate-300/80 dark:bg-zinc-700/70" />
              <div className="flex items-center gap-2">
                <div className="h-9 flex-1 rounded-lg bg-slate-300/80 dark:bg-zinc-700/70" />
                <div className="h-9 w-9 rounded-lg bg-slate-300/80 dark:bg-zinc-700/70" />
                <div className="h-9 w-9 rounded-lg bg-slate-300/80 dark:bg-zinc-700/70" />
              </div>
            </div>
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
                    if (next) {
                      setIsEnabled(true)
                      setDuration('3')
                      const avatarBase64 = shareAvatarUrl
                        ? null
                        : loadLocalAvatar()
                      setIsMutating(true)
                      startTransition(async () => {
                        try {
                          const res = await generateShareLinkAction({
                            serviceId,
                            durationDays: 3,
                            ...(avatarBase64 ? { avatarBase64 } : {}),
                          })
                          if (res.ok) {
                            setShareKey(res.data.shareKey)
                            setExpireAt(
                              res.data.expireAt
                                ? new Date(res.data.expireAt)
                                : null,
                            )
                            if (serviceId) {
                              shareCache.set(serviceId, {
                                data: {
                                  isEnabled: true,
                                  shareKey: res.data.shareKey,
                                  expireAt: res.data.expireAt ?? null,
                                  avatarUrl: res.data.avatarUrl ?? null,
                                },
                                fetchedAt: Date.now(),
                              })
                              lastFetchedAtRef.current = Date.now()
                            }
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
                    flushSync(() => {
                      setIsEnabled(false)
                      setIsMutating(true)
                      showFeedback(
                        'success',
                        dict.share.feedback.disableSuccess,
                        'toggle',
                      )
                    })
                    startTransition(async () => {
                      try {
                        const res = await disableShareLinkAction({ serviceId })
                        if (res.ok) {
                          setShareKey(null)
                          setExpireAt(null)
                          if (serviceId) {
                            shareCache.set(serviceId, {
                              data: {
                                isEnabled: false,
                                shareKey: null,
                                expireAt: null,
                                avatarUrl: null,
                              },
                              fetchedAt: Date.now(),
                            })
                            lastFetchedAtRef.current = Date.now()
                          }
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
                        <SelectItem value="3">
                          {dict.share.validity.options.days3}
                        </SelectItem>
                        <SelectItem value="7">
                          {dict.share.validity.options.days7}
                        </SelectItem>
                        <SelectItem value="15">
                          {dict.share.validity.options.days15}
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
                                href={sharePath}
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
