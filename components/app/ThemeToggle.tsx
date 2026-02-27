'use client'

import * as React from 'react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Moon, Sun } from 'lucide-react'

interface ThemeToggleProps {
  className?: string
  size?: 'default' | 'sm' | 'lg' | 'icon'
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive'
}

/**
 * @desc Theme toggle button backed by next-themes.
 *  - Reads resolvedTheme (system preference resolved to actual light/dark)
 *  - useEffect + mounted guard prevents hydration mismatch flickering
 *  - setTheme persists the preference to localStorage automatically
 */
export function ThemeToggle({ className, size = 'icon', variant = 'ghost' }: ThemeToggleProps) {
  const { theme, systemTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // Only render after mount to avoid SSR/client mismatch
  React.useEffect(() => {
    setMounted(true)
  }, [])

  const resolvedTheme = theme === 'system' ? systemTheme : theme
  const isDark = resolvedTheme === 'dark'

  const toggleTheme = React.useCallback(() => {
    setTheme(isDark ? 'light' : 'dark')
  }, [isDark, setTheme])

  return (
    <Button
      aria-label={mounted ? (isDark ? 'Switch to light mode' : 'Switch to dark mode') : 'Toggle theme'}
      title={mounted ? (isDark ? '切换到浅色模式' : '切换到深色模式') : '切换主题'}
      onClick={toggleTheme}
      size={size}
      variant={variant}
      className={className}
    >
      {/* Render placeholder icon until mounted to avoid hydration mismatch */}
      {!mounted ? (
        <Sun className="h-4 w-4 opacity-0" aria-hidden />
      ) : isDark ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  )
}
