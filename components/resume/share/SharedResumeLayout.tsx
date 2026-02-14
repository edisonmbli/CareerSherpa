'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { X, Sparkles, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface SharedResumeLayoutProps {
  children: React.ReactNode
  locale: string
  showHook?: boolean
  text: {
    bannerText: string
    cta: string
    footerText: string
    printFooter: string
  }
}

export function SharedResumeLayout({
  children,
  locale,
  showHook = true,
  text,
}: SharedResumeLayoutProps) {
  const [showBanner, setShowBanner] = useState(showHook)
  const [isClosing, setIsClosing] = useState(false)

  const handleClose = useCallback(() => {
    if (!showBanner) return
    setIsClosing(true)
    setTimeout(() => {
      setShowBanner(false)
      setIsClosing(false)
    }, 500)
  }, [showBanner])

  useEffect(() => {
    if (!showHook) return
    const timer = setTimeout(() => {
      handleClose()
    }, 8000)

    return () => clearTimeout(timer)
  }, [showHook, handleClose])

  return (
    <>
      {showHook && (
        <div
          className={cn(
            'fixed top-0 left-0 right-0 z-50 h-14 w-full border-b border-slate-200/60 bg-white/80 backdrop-blur-md print:hidden transition-all duration-500 ease-in-out transform',
            !showBanner && 'hidden',
            isClosing && '-translate-y-full opacity-0',
          )}
        >
          <div className="container mx-auto flex h-full max-w-[210mm] items-center justify-between px-4 sm:px-0">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 shadow-sm border border-slate-200/50">
                <Sparkles className="h-4 w-4 text-slate-600" />
              </div>
              <span className="text-sm font-medium text-slate-700">
                {text.bannerText}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Link href={`/${locale}`} target="_blank">
                <Button
                  size="sm"
                  className="h-8 px-4 text-xs font-medium shadow-sm"
                >
                  {text.cta}
                </Button>
              </Link>
              <button
                onClick={handleClose}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <main
        className={cn(
          'container mx-auto px-0 sm:px-4 pb-8 print:p-0 print:max-w-none transition-all duration-500 ease-in-out',
          showHook && showBanner && !isClosing ? 'pt-20' : 'pt-8',
        )}
      >
        {children}
      </main>

      {showHook && (
        <div className="fixed bottom-6 right-6 z-40 print:hidden">
          <Link href={`/${locale}`} target="_blank">
            <div className="group flex items-center gap-2 rounded-lg border border-slate-200/60 bg-white/90 px-3 py-2 shadow-sm backdrop-blur-sm transition-all hover:border-slate-300 hover:shadow-md">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-slate-100 text-[10px] font-bold text-slate-600 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                AI
              </span>
              <span className="text-xs font-medium text-slate-500 group-hover:text-slate-900 transition-colors">
                {text.footerText}
              </span>
              <ExternalLink className="h-3 w-3 text-slate-300 group-hover:text-slate-500 transition-colors" />
            </div>
          </Link>
        </div>
      )}

      <div className="hidden print:block fixed bottom-0 left-0 right-0 text-center py-2 text-xs text-gray-400 font-mono">
        {text.printFooter}
      </div>
    </>
  )
}
