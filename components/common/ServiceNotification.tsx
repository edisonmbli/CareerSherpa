'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ServiceNotificationProps {
  type?: 'error' | 'success' | 'info'
  title: string
  description?: string
  className?: string
  onClose?: () => void
  autoDismiss?: number // ms, e.g. 3000
}

export function ServiceNotification({
  type = 'error',
  title,
  description,
  className,
  onClose,
  autoDismiss,
}: ServiceNotificationProps) {
  const [isClosing, setIsClosing] = useState(false)

  useEffect(() => {
    if (!autoDismiss || autoDismiss <= 0) return

    const timer = setTimeout(() => {
      setIsClosing(true)
      if (onClose) setTimeout(onClose, 220)
    }, autoDismiss)
    return () => clearTimeout(timer)
  }, [autoDismiss, onClose])

  if (!title) return null

  const isError = type === 'error'
  const isSuccess = type === 'success'
  // info or default fallback

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-3 py-2 text-sm leading-snug rounded-md border backdrop-blur-sm transition-[opacity,transform] duration-200 ease-out transform-gpu',
        isClosing ? 'opacity-0 -translate-y-1' : 'opacity-100 translate-y-0',
        'bg-white/75 border-white/60 text-zinc-700 shadow-[0_6px_20px_rgba(0,0,0,0.08)]',
        'dark:bg-white/[0.04] dark:border-white/10 backdrop-blur-2xl dark:shadow-2xl dark:text-zinc-200',
        isError && 'text-zinc-700 dark:text-zinc-200',
        isSuccess && 'text-emerald-700 dark:text-emerald-300',
        className,
      )}
    >
      <div className="min-w-0 flex flex-col items-center text-center sm:flex-row sm:items-center sm:gap-2 sm:text-left">
        <div className="flex items-center gap-2">
          {isError && (
            <AlertCircle className="h-4 w-4 shrink-0 text-zinc-500" />
          )}
          {isSuccess && <CheckCircle2 className="h-4 w-4 shrink-0" />}
          <span className="font-medium break-words">{title}</span>
        </div>
        {description && (
          <span className="font-normal opacity-90 break-words">
            {description}
          </span>
        )}
      </div>
    </div>
  )
}
