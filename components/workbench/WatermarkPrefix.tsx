'use client'

import React from 'react'
import { cn, getMatchThemeClass } from '@/lib/utils'

interface WatermarkPrefixProps {
  index: number
  className?: string
  themeColor?: 'emerald' | 'amber' | 'rose' | 'slate' | string
}

export function WatermarkPrefix({
  index,
  className,
  themeColor,
}: WatermarkPrefixProps) {
  const matchThemeClass = getMatchThemeClass(themeColor)

  return (
    <span
      className={cn(
        'absolute left-0 -translate-x-[85%] -top-3 sm:-left-4 sm:translate-x-0 sm:-top-3 text-[26px] sm:text-3xl font-semibold tabular-nums select-none pointer-events-none text-match-watermark z-10',
        matchThemeClass,
        className,
      )}
    >
      {index + 1}
    </span>
  )
}
