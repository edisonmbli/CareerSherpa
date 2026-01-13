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
    const [isVisible, setIsVisible] = useState(true)

    useEffect(() => {
        if (autoDismiss && autoDismiss > 0) {
            const timer = setTimeout(() => {
                setIsVisible(false)
                if (onClose) setTimeout(onClose, 300) // waiting for animation
            }, autoDismiss)
            return () => clearTimeout(timer)
        }
    }, [autoDismiss, onClose])

    if (!title || !isVisible) return null

    const isError = type === 'error'
    const isSuccess = type === 'success'
    // info or default fallback

    return (
        <div
            className={cn(
                'flex items-center gap-2 px-3 py-2 text-sm rounded-md animate-in fade-in slide-in-from-bottom-1 duration-300',
                // User requested gray/neutral for errors instead of strong red
                isError && 'text-zinc-600 bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300',
                isSuccess && 'text-green-600 bg-green-50 dark:bg-green-900/10 dark:text-green-400',
                !isError && !isSuccess && 'text-zinc-600 bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300',
                className
            )}
        >
            {isError && <AlertCircle className="h-4 w-4 shrink-0 text-zinc-500" />}
            {isSuccess && <CheckCircle2 className="h-4 w-4 shrink-0" />}

            {/* Removed truncation constraints as requested */}
            <span className="font-medium">
                {title}
                {description && <span className="ml-1 font-normal opacity-90">- {description}</span>}
            </span>
        </div>
    )
}
