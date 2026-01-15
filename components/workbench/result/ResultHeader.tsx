'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface ResultHeaderProps {
  score: number
  company?: string
  jobTitle?: string
  labels?: {
    matchDate?: string
    targetCompany?: string
    targetPosition?: string
    highlyMatched?: string
    goodFit?: string
    lowMatch?: string
  }
  actionButton?: React.ReactNode
}

export function ResultHeader({
  score,
  company,
  jobTitle,
  labels,
  actionButton,
}: ResultHeaderProps) {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    // Trigger animation on mount
    const timer = setTimeout(() => setMounted(true), 100)
    return () => clearTimeout(timer)
  }, [])

  // Score Assessment Logic
  const assessmentLabel =
    score >= 85
      ? labels?.highlyMatched || 'Highly Matched'
      : score >= 60
        ? labels?.goodFit || 'Good Fit'
        : labels?.lowMatch || 'Low Match'

  // Semantic Colors - Tuned for readability & comfort
  const getThemeColors = (s: number) => {
    if (s >= 85) return {
      text: 'text-emerald-600 dark:text-emerald-400',
      glow: 'bg-emerald-500',
      stop1: '#059669', // Emerald 600
      stop2: '#34d399'  // Emerald 400
    }
    if (s >= 60) return {
      text: 'text-amber-600 dark:text-amber-400',
      glow: 'bg-amber-500',
      stop1: '#d97706', // Amber 600
      stop2: '#fbbf24'  // Amber 400
    }
    return {
      text: 'text-rose-600 dark:text-rose-400',
      glow: 'bg-rose-500',
      stop1: '#e11d48', // Rose 600
      stop2: '#fb7185'  // Rose 400
    }
  }

  const theme = getThemeColors(score)

  // Radial Progress Config
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = mounted
    ? circumference - (score / 100) * circumference
    : circumference // Start empty

  return (
    <div className="flex flex-row justify-between items-center relative z-8 w-full py-1">
      {/* 1. Left: Identity Block */}
      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        {/* Company Name */}
        <h2 className="text-2xl md:text-3xl lg:text-4xl font-[family-name:var(--font-playfair),serif] font-bold tracking-tight text-slate-900 dark:text-slate-50 flex items-center gap-2 truncate">
          {company || labels?.targetCompany || 'Target Company'}
        </h2>
        {/* Job Title */}
        <div className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5 tracking-wide uppercase truncate">
          {jobTitle || labels?.targetPosition || 'Target Position'}
        </div>
      </div>

      {/* 2. Right: Score Block (Side-by-Side: Text + Ring) */}
      <div className="flex flex-row items-center gap-4 md:gap-6 shrink-0 relative">

        {/* Dynamic Assessment Label (Left of Ring) */}
        <span
          className={cn(
            "text-sm md:text-base lg:text-lg font-bold uppercase tracking-wider text-right",
            theme.text,
            "transition-all duration-700 delay-500 transform",
            mounted ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
          )}
        >
          {assessmentLabel}
        </span>

        {/* Score Ring Container */}
        <div className="relative w-16 h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 group cursor-default">

          {/* Glow (The 'Float' Element) - Centered on Ring */}
          <div
            className={cn(
              'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[160%] h-[160%] rounded-full blur-3xl transition-opacity duration-1000 ease-out pointer-events-none',
              mounted ? 'opacity-25 dark:opacity-20' : 'opacity-0',
              theme.glow
            )}
          />

          {/* SVG Chart */}
          <svg className="absolute w-0 h-0">
            <defs>
              <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={theme.stop1} />
                <stop offset="100%" stopColor={theme.stop2} />
              </linearGradient>
            </defs>
          </svg>

          <svg className="w-full h-full transform -rotate-90 drop-shadow-sm" viewBox="0 0 100 100">
            <circle
              className="text-slate-200 dark:text-slate-800"
              strokeWidth="8"
              stroke="currentColor"
              fill="transparent"
              r={radius} cx="50" cy="50"
            />
            <circle
              className="transition-all duration-[1500ms] cubic-bezier(0.34, 1.56, 0.64, 1)"
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              r={radius} cx="50" cy="50"
              stroke="url(#scoreGradient)"
            />
          </svg>

          {/* Center Score Number */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className={cn(
                'text-lg md:text-2xl font-bold tracking-tighter transition-all duration-700 delay-300',
                theme.text,
                mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
              )}
            >
              {score}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
