'use client'

import { useResumeStore } from '@/store/resume-store'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Check, LayoutTemplate } from 'lucide-react'
import { RESUME_TEMPLATES, TemplateId } from '../constants'
import { cn } from '@/lib/utils'
import { useState } from 'react'

export function TemplateSelector() {
  const { currentTemplate, setTemplate, updateStyleConfig } = useResumeStore()
  const [isOpen, setIsOpen] = useState(false)

  const handleSelectTemplate = (id: TemplateId) => {
    setTemplate(id)

    // Apply default styles for Corporate template
    if (id === 'corporate') {
      updateStyleConfig({
        themeColor: '#0284c7', // Sky 600
        fontFamily: 'roboto',
        fontSize: 1, // 1.00x
        lineHeight: 1.5,
        itemSpacing: 12, // Paragraph Spacing (px)
        pageMargin: 12, // Page Margin (mm)
      })
    } else if (id === 'elegant') {
      // Apply default styles for Elegant template
      updateStyleConfig({
        themeColor: '#84A59D', // Muted Sage
        fontFamily: 'lato',
        fontSize: 1.05, // 1.05x
        lineHeight: 1.2,
        itemSpacing: 12, // Paragraph Spacing (px)
        pageMargin: 12, // Page Margin (mm)
      })
    } else if (id === 'professional') {
      // Apply default styles for Professional template
      updateStyleConfig({
        themeColor: '#7F1D1D', // Burgundy
        fontFamily: 'roboto',
        fontSize: 1, // 1.00x
        lineHeight: 1.4,
        itemSpacing: 12, // Paragraph Spacing (px)
        pageMargin: 10, // Page Margin (mm)
      })
    } else if (id === 'darkSidebar') {
      // Apply default styles for Dark Sidebar template
      updateStyleConfig({
        themeColor: '#4B5563', // Volcanic Ash
        fontFamily: 'jetbrains',
        fontSize: 1.05, // 1.05x
        lineHeight: 1.4,
        itemSpacing: 12, // Paragraph Spacing (px)
        pageMargin: 10, // Page Margin (mm)
      })
    } else if (id === 'product') {
      // Apply default styles for Product template
      updateStyleConfig({
        themeColor: '#0F172A', // Slate 900
        fontFamily: 'inter',
        fontSize: 1, // 1.00x
        lineHeight: 1.5,
        itemSpacing: 14, // Relaxed Spacing
        pageMargin: 15, // Standard Margin
      })
    }

    setIsOpen(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-2 text-muted-foreground hover:text-foreground"
        >
          <LayoutTemplate className="h-4 w-4" />
          <span className="hidden sm:inline">模板</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>选择简历模板</DialogTitle>
          <p className="text-sm text-muted-foreground">
            所有模板均支持 A4 打印与 PDF 导出，自动适配内容排版
          </p>
        </DialogHeader>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-4">
          {RESUME_TEMPLATES.map((template) => {
            const isActive = currentTemplate === template.id
            return (
              <div
                key={template.id}
                className={cn(
                  'group relative flex flex-col gap-3 rounded-xl border-2 p-3 transition-all hover:border-blue-500/50 hover:shadow-lg cursor-pointer bg-white dark:bg-zinc-900',
                  isActive
                    ? 'border-transparent'
                    : 'border-transparent hover:bg-accent/50'
                )}
                onClick={() => handleSelectTemplate(template.id as TemplateId)}
              >
                {/* Preview Image Container */}
                <div className="relative aspect-[210/297] w-full overflow-hidden rounded-lg border bg-muted shadow-sm group-hover:shadow-md transition-all">
                  {/* Placeholder Gradient & Skeleton */}
                  <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-zinc-800 dark:to-zinc-900 p-4">
                    <div className="w-full h-full flex flex-col gap-2 opacity-40">
                      {/* Skeleton Header */}
                      <div className="flex gap-3 mb-4">
                        <div className="w-12 h-12 rounded-full bg-current opacity-20" />
                        <div className="flex-1 space-y-2 py-1">
                          <div className="h-3 bg-current rounded w-3/4 opacity-20" />
                          <div className="h-2 bg-current rounded w-1/2 opacity-20" />
                        </div>
                      </div>
                      {/* Skeleton Body */}
                      <div className="h-2 bg-current rounded w-full opacity-10" />
                      <div className="h-2 bg-current rounded w-full opacity-10" />
                      <div className="h-2 bg-current rounded w-5/6 opacity-10" />
                      <div className="mt-4 h-3 bg-current rounded w-1/3 opacity-20" />
                      <div className="h-2 bg-current rounded w-full opacity-10" />
                      <div className="h-2 bg-current rounded w-full opacity-10" />
                      <div className="mt-4 h-3 bg-current rounded w-1/3 opacity-20" />
                      <div className="h-2 bg-current rounded w-full opacity-10" />
                    </div>
                  </div>

                  {/* Hover Overlay Button */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/5 dark:bg-black/20 backdrop-blur-[1px]">
                    <Button
                      size="sm"
                      className="shadow-lg pointer-events-none bg-white text-black hover:bg-white/90 dark:bg-zinc-900 dark:text-white"
                    >
                      使用此模板
                    </Button>
                  </div>

                  {isActive && (
                    <div className="absolute inset-0 bg-blue-600/10 flex items-center justify-center ring-inset ring-2 ring-blue-600">
                      <div className="bg-blue-600 text-white rounded-full p-2 shadow-lg scale-110">
                        <Check className="h-5 w-5" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-1 px-1">
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        'text-sm font-medium',
                        isActive ? 'text-blue-700 dark:text-blue-400' : ''
                      )}
                    >
                      {template.name}
                    </span>
                  </div>

                  {/* Description with Marquee Effect on Hover */}
                  <div className="relative h-4 w-full overflow-hidden group/desc text-xs text-muted-foreground">
                    <div className="absolute left-0 flex whitespace-nowrap transition-transform duration-0 ease-linear group-hover/desc:-translate-x-1/2 group-hover/desc:duration-[4000ms]">
                      <span>{template.description}</span>
                      <span className="inline-block w-8"></span>
                      <span>{template.description}</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
