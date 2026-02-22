'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface ResumeAvatarProps {
    photoUrl?: string | null | undefined
    name?: string | undefined
    containerClassName?: string
    imageClassName?: string
    fallback?: React.ReactNode
}

export function ResumeAvatar({
    photoUrl,
    name = 'Avatar',
    containerClassName,
    imageClassName,
    fallback,
}: ResumeAvatarProps) {
    const [hasError, setHasError] = useState(false)

    // If there's no photoUrl or it failed to load, return the fallback if provided, else null.
    if (!photoUrl || hasError) {
        return fallback ? <>{fallback}</> : null
    }

    return (
        <div className={containerClassName}>
            {/* eslint-disable-next-line @next/next/no-img-element -- Print/PDF export requires native img */}
            <img
                src={photoUrl}
                alt={name}
                className={cn('object-cover', imageClassName)}
                onError={() => setHasError(true)}
            />
        </div>
    )
}
