'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { X, Sparkles, ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface PublicResumeHookProps {
  locale: string
  text: {
    bannerText: string
    cta: string
    footerText: string
    printFooter: string
  }
}

export function PublicResumeHook({ locale, text }: PublicResumeHookProps) {
  const [showBanner, setShowBanner] = useState(true)

  return (
    <>
      {/* Top Banner - Dismissible */}
      {showBanner && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 shadow-md animate-in slide-in-from-top duration-500 print:hidden">
          <div className="container mx-auto flex items-center justify-between max-w-4xl">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="w-4 h-4 text-yellow-300" />
              <span>{text.bannerText}</span>
            </div>
            <div className="flex items-center gap-4">
              <Link href={`/${locale}`} target="_blank">
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 text-xs px-3 hover:bg-white/90 border-0"
                >
                  {text.cta}
                </Button>
              </Link>
              <button
                onClick={() => setShowBanner(false)}
                className="text-white/80 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Floating Badge (Watermark) */}
      <div className="fixed bottom-6 right-6 z-40 print:hidden">
        <Link href={`/${locale}`} target="_blank">
          <div className="group flex items-center gap-2 bg-white/80 backdrop-blur-md border border-gray-200/50 shadow-lg hover:shadow-xl rounded-full px-4 py-2 transition-all duration-300 hover:scale-105 cursor-pointer">
            <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold">
              AI
            </div>
            <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
              {text.footerText}
            </span>
            <ArrowRight className="w-3 h-3 text-gray-400 group-hover:text-blue-500 transition-colors" />
          </div>
        </Link>
      </div>

      {/* Print-only Footer */}
      <div className="hidden print:block fixed bottom-0 left-0 right-0 text-center py-2 text-xs text-gray-300 font-mono">
        {text.printFooter}
      </div>
    </>
  )
}
