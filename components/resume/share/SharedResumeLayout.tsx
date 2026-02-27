'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { X, Sparkles, ExternalLink, FileDown, Printer } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useReactToPrint } from 'react-to-print'
import {
  RESUME_SCREEN_BASE_WIDTH_PX,
  RESUME_SCREEN_DESKTOP_PADDING_PX,
  RESUME_SCREEN_DESKTOP_SCALE,
  RESUME_SCREEN_MIN_SCALE,
  RESUME_SCREEN_MOBILE_BREAKPOINT_PX,
  RESUME_SCREEN_MOBILE_PADDING_PX,
} from '@/lib/constants'

interface SharedResumeLayoutProps {
  children: React.ReactNode
  locale: string
  showHook?: boolean
  text: {
    bannerText: string
    cta: string
    footerText: string
    printFooter: string
    exportPdf: string
    print: string
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
  const printRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const scaleWrapperRef = useRef<HTMLDivElement>(null)
  const [screenScale, setScreenScale] = useState(1)
  const [isMobileView, setIsMobileView] = useState(false)
  // printRef is resolved at click time (see handleExportPdfClick / handlePrintClick)
  // NOT in useEffect — the useEffect fires before PublicResumeViewer finishes
  // its own initialization (setReady(true)), so .resume-paper wouldn't exist yet.
  useEffect(() => {
    const container = scaleWrapperRef.current?.parentElement
    if (!container) return
    const updateScale = () => {
      const containerWidth = container.clientWidth
      const isMobile = window.innerWidth < RESUME_SCREEN_MOBILE_BREAKPOINT_PX
      setIsMobileView(isMobile)

      // On mobile, native CSS `@media (max-width: 768px)` will handle 100% width
      // so we only need to calculate scale for non-mobile screens.
      if (!isMobile) {
        const availableWidth = containerWidth - RESUME_SCREEN_DESKTOP_PADDING_PX
        // Calculate continuous scale to fit available width, capped at exactly 1.0 (794px base width).
        // This ensures mid-sized screens like iPad smoothly use available space.
        const newScale = Math.min(
          1.0,
          Math.max(
            RESUME_SCREEN_MIN_SCALE,
            availableWidth / RESUME_SCREEN_BASE_WIDTH_PX
          )
        )
        setScreenScale(newScale)
      } else {
        setScreenScale(1)
      }
    }
    updateScale()
    const observer = new ResizeObserver(updateScale)
    observer.observe(container)
    window.addEventListener('resize', updateScale)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateScale)
    }
  }, [])

  const printPageStyle = `
@page { margin: 10mm; }
@media print {
  body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
`

  const handleExportPdf = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'CareerSherpa_Resume',
    ignoreGlobalStyles: false,
    pageStyle: printPageStyle,
  } as any)

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'CareerSherpa_Print',
    ignoreGlobalStyles: false,
    pageStyle: printPageStyle,
  } as any)

  const handleExportPdfClick = useCallback(async () => {
    // Resolve .resume-paper at click time: PublicResumeViewer is guaranteed to
    // be in ready=true state when the user clicks, so .resume-paper is in DOM.
    const paper = wrapperRef.current?.querySelector<HTMLDivElement>('.resume-paper')
    printRef.current = paper ?? (wrapperRef.current as HTMLDivElement)
    await new Promise((resolve) => setTimeout(resolve, 300))
    handleExportPdf()
  }, [handleExportPdf])

  const handlePrintClick = useCallback(async () => {
    // Same: resolve .resume-paper at click time
    const paper = wrapperRef.current?.querySelector<HTMLDivElement>('.resume-paper')
    printRef.current = paper ?? (wrapperRef.current as HTMLDivElement)
    await new Promise((resolve) => setTimeout(resolve, 300))
    handlePrint()
  }, [handlePrint])

  const handleClose = useCallback(() => {
    if (!showBanner) return
    setIsClosing(true)
    setTimeout(() => {
      setShowBanner(false)
      setIsClosing(false)
    }, 500)
  }, [showBanner])

  return (
    <>
      {showHook && (
        <div
          className={cn(
            'fixed top-0 left-0 right-0 z-50 w-full border-b border-slate-200/60 bg-white/80 backdrop-blur-md print:hidden transition-all duration-500 ease-in-out transform',
            !showBanner && 'hidden',
            isClosing && '-translate-y-full opacity-0',
          )}
        >
          <div className="container mx-auto flex h-14 max-w-[210mm] items-center justify-between px-3 sm:px-0">
            <div className="flex items-center gap-2 sm:gap-2.5">
              <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 shadow-sm border border-slate-200/50">
                <Sparkles className="h-3.5 w-3.5 sm:h-4 w-4 text-slate-600" />
              </div>
              <span className="text-xs sm:text-sm font-medium text-slate-700 truncate max-w-[150px] sm:max-w-none">
                AI CareerSherpa<span className="hidden sm:inline">, {text.bannerText?.split('，')[1] || text.bannerText?.split(', ')[1] || '你的专属求职教练'}</span>
              </span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <Link href={`/${locale}`} target="_blank">
                <Button
                  size="sm"
                  className="h-7 px-3 sm:h-8 sm:px-4 text-[11px] sm:text-xs font-medium shadow-sm"
                >
                  {text.cta}
                </Button>
              </Link>
              <button
                onClick={handleClose}
                className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                aria-label="Close"
              >
                <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
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
        <div className="relative mx-auto flex justify-center w-full">
          <div
            ref={scaleWrapperRef}
            className={cn(
              'resume-scale-wrapper origin-top transition-transform duration-[800ms] ease-out print:transform-none',
              isMobileView ? 'w-full' : 'w-[210mm]'
            )}
            style={{
              transform: isMobileView ? 'none' : `scale(${screenScale})`,
              height: isMobileView ? 'auto' : undefined
            }}
          >
            <div
              ref={wrapperRef}
              className={cn(
                'public-resume-content',
                isMobileView ? 'w-full' : 'w-[210mm]'
              )}
            >
              {children}
            </div>
          </div>
          <div
            className="absolute top-0 left-1/2 flex-col gap-2 hidden xl:flex print:hidden"
            style={{
              transform: `translateX(calc(${396.85 * screenScale}px + 24px))`
            }}
          >
            <button
              onClick={handleExportPdfClick}
              className="group inline-flex items-center gap-2 self-start rounded-full border border-slate-200/60 bg-white/90 px-3 py-2 text-xs font-medium text-slate-600 shadow-sm backdrop-blur-sm transition-all hover:border-slate-300 hover:text-slate-900 hover:shadow-md"
            >
              <FileDown className="h-4 w-4 text-slate-500 group-hover:text-slate-900 transition-colors" />
              <span>{text.exportPdf}</span>
            </button>
            <button
              onClick={handlePrintClick}
              className="group inline-flex items-center gap-2 self-start rounded-full border border-slate-200/60 bg-white/90 px-3 py-2 text-xs font-medium text-slate-600 shadow-sm backdrop-blur-sm transition-all hover:border-slate-300 hover:text-slate-900 hover:shadow-md"
            >
              <Printer className="h-4 w-4 text-slate-500 group-hover:text-slate-900 transition-colors" />
              <span>{text.print}</span>
            </button>
          </div>
          <div className="fixed right-4 bottom-8 z-40 flex flex-col items-center gap-3 xl:hidden print:hidden">
            <button
              onClick={handleExportPdfClick}
              className="group flex h-11 w-11 items-center justify-center rounded-full border border-slate-200/30 bg-white/30 text-slate-400 shadow-sm backdrop-blur-md transition-all hover:bg-white/60 hover:text-slate-600 hover:border-slate-300/50 hover:shadow-md"
            >
              <FileDown className="h-5 w-5 transition-colors" strokeWidth={1.5} />
            </button>
            <button
              onClick={handlePrintClick}
              className="group flex h-11 w-11 items-center justify-center rounded-full border border-slate-200/30 bg-white/30 text-slate-400 shadow-sm backdrop-blur-md transition-all hover:bg-white/60 hover:text-slate-600 hover:border-slate-300/50 hover:shadow-md"
            >
              <Printer className="h-5 w-5 transition-colors" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </main>
    </>
  )
}
