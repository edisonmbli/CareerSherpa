'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { X, Sparkles, ExternalLink, FileDown, Printer } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useReactToPrint } from 'react-to-print'
import { useResumeStore } from '@/store/resume-store'
import { uiLog } from '@/lib/ui/sse-debug-logger'
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
  const styleConfig = useResumeStore((state) => state.styleConfig)
  // printRef is resolved at click time (see handleExportPdfClick / handlePrintClick)
  // NOT in useEffect — the useEffect fires before PublicResumeViewer finishes
  // its own initialization (setReady(true)), so .resume-paper wouldn't exist yet.
  useEffect(() => {
    const container = scaleWrapperRef.current?.parentElement
    if (!container) return
    const updateScale = () => {
      const containerWidth = container.clientWidth
      const isMobile = window.innerWidth < RESUME_SCREEN_MOBILE_BREAKPOINT_PX
      let newScale = 1
      if (containerWidth < RESUME_SCREEN_BASE_WIDTH_PX) {
        const availableWidth = isMobile
          ? window.innerWidth - RESUME_SCREEN_MOBILE_PADDING_PX
          : containerWidth - RESUME_SCREEN_DESKTOP_PADDING_PX
        newScale = Math.max(
          RESUME_SCREEN_MIN_SCALE,
          availableWidth / RESUME_SCREEN_BASE_WIDTH_PX,
        )
      } else {
        newScale = RESUME_SCREEN_DESKTOP_SCALE
      }
      setScreenScale(newScale)
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

  const collectInlineVars = () => {
    const node = printRef.current
    if (!node) return null
    return {
      paddingX: node.style.getPropertyValue('--resume-padding-x'),
      paddingY: node.style.getPropertyValue('--resume-padding-y'),
      baseFontSize: node.style.getPropertyValue('--resume-base-font-size'),
      lineHeight: node.style.getPropertyValue('--resume-line-height'),
      paragraphSpacing: node.style.getPropertyValue(
        '--resume-paragraph-spacing',
      ),
      sectionSpacing: node.style.getPropertyValue('--resume-section-spacing'),
      itemSpacing: node.style.getPropertyValue('--resume-item-spacing'),
    }
  }

  const handleExportPdf = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'CareerShaper_Resume',
    ignoreGlobalStyles: false,
    pageStyle: printPageStyle,
    onBeforeGetContent: async () => {
      uiLog.info('share_export_style_state', {
        styleConfig,
        inlineVars: collectInlineVars(),
      })
      return Promise.resolve()
    },
  } as any)

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'CareerShaper_Print',
    ignoreGlobalStyles: false,
    pageStyle: printPageStyle,
    onBeforeGetContent: async () => {
      uiLog.info('share_print_style_state', {
        styleConfig,
        inlineVars: collectInlineVars(),
      })
      return Promise.resolve()
    },
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
        <div className="relative mx-auto w-full max-w-[210mm]">
          <div className="flex justify-center">
            <div
              ref={scaleWrapperRef}
              className="resume-scale-wrapper origin-top transition-transform duration-[800ms] ease-out print:transform-none"
              style={{
                transform: screenScale === 1 ? 'none' : `scale(${screenScale})`,
              }}
            >
              <div
                ref={wrapperRef}
                className="public-resume-content w-full max-w-[210mm]"
              >
                {children}
              </div>
            </div>
          </div>
          <div className="absolute top-0 left-1/2 hidden -translate-x-[calc(-105mm-48px)] md:flex flex-col gap-2 print:hidden">
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
          <div className="fixed right-4 top-4 z-40 flex items-center gap-2 md:hidden print:hidden">
            <button
              onClick={handleExportPdfClick}
              className="group flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/60 bg-white/90 text-slate-600 shadow-sm backdrop-blur-sm transition-all hover:border-slate-300 hover:text-slate-900 hover:shadow-md"
            >
              <FileDown className="h-4 w-4 text-slate-500 group-hover:text-slate-900 transition-colors" />
            </button>
            <button
              onClick={handlePrintClick}
              className="group flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/60 bg-white/90 text-slate-600 shadow-sm backdrop-blur-sm transition-all hover:border-slate-300 hover:text-slate-900 hover:shadow-md"
            >
              <Printer className="h-4 w-4 text-slate-500 group-hover:text-slate-900 transition-colors" />
            </button>
          </div>
        </div>
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
    </>
  )
}
