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
import Image from 'next/image'
import { useResumeDict } from '../ResumeDictContext'

export function TemplateSelector() {
  const { currentTemplate, setTemplate, setStatusMessage } = useResumeStore()
  const dict = useResumeDict()
  const [isOpen, setIsOpen] = useState(false)
  const [hoveredTemplate, setHoveredTemplate] = useState<
    (typeof RESUME_TEMPLATES)[number] | null
  >(null)

  // Helper to get template name/description from dictionary
  const getTemplateInfo = (id: string) => {
    return dict.templates[id] || { name: id, description: '' }
  }

  const handleSelectTemplate = (id: TemplateId) => {
    setTemplate(id)
    const templateName = getTemplateInfo(id).name
    setStatusMessage({
      text: `${templateName}`,
      type: 'success',
    })
    setIsOpen(false)
  }

  // Use active template as default preview when not hovering
  const activeTemplateData =
    RESUME_TEMPLATES.find((t) => t.id === currentTemplate) ??
    RESUME_TEMPLATES[0]
  const previewTemplate = hoveredTemplate ?? activeTemplateData

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-2 text-muted-foreground hover:text-foreground shrink-0 px-2"
        >
          <LayoutTemplate className="h-4 w-4" />
          <span className="hidden lg:inline">{dict.toolbar.template}</span>
        </Button>
      </DialogTrigger>
      <DialogContent
        className={cn(
          "p-0 gap-0 overflow-hidden",
          // Responsive container sizing
          "w-[95vw] max-w-[1200px]",
          "h-[85vh] max-h-[720px]",
          // Enhanced dark mode styling
          "dark:ring-1 dark:ring-white/10",
          "dark:bg-background/95 dark:backdrop-blur-xl"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header - Fixed height */}
          <DialogHeader className="shrink-0 px-6 pt-6 pb-4 border-b border-border/50">
            <DialogTitle className="text-lg font-semibold">{dict.editor.selectTemplate}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {dict.editor.templateDesc}
            </p>
          </DialogHeader>

          {/* Content - Fills remaining height */}
          <div className="flex-1 flex min-h-0">
            {/* Left: Template Grid (2/3 width on desktop) */}
            <div className="flex-1 md:w-2/3 md:flex-none flex items-center justify-center p-6 overflow-y-auto">
              <div className="w-full h-full flex items-center justify-center">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 content-center">
                  {RESUME_TEMPLATES.map((template) => {
                    const isActive = currentTemplate === template.id
                    const isHovered = hoveredTemplate?.id === template.id
                    const templateInfo = getTemplateInfo(template.id)
                    return (
                      <div
                        key={template.id}
                        className={cn(
                          'group relative flex flex-col gap-2 rounded-lg p-2 transition-all cursor-pointer',
                          'hover:bg-accent/50',
                          isHovered && 'bg-accent/50'
                        )}
                        onClick={() =>
                          handleSelectTemplate(template.id as TemplateId)
                        }
                        onMouseEnter={() => setHoveredTemplate(template)}
                        onMouseLeave={() => setHoveredTemplate(null)}
                      >
                        {/* Thumbnail Container - Responsive sizing */}
                        <div
                          className={cn(
                            'relative aspect-[210/297] w-full overflow-hidden rounded-md transition-all',
                            // Responsive thumbnail width
                            'min-w-[80px] md:min-w-[100px] lg:min-w-[120px]',
                            'shadow-md hover:shadow-xl',
                            'ring-1 ring-black/5 dark:ring-white/10',
                            isActive && 'ring-2 ring-blue-600'
                          )}
                        >
                          {/* Skeleton Placeholder */}
                          <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-zinc-800 dark:to-zinc-900" />

                          {/* Template Preview Image */}
                          {template.thumbnail && (
                            <Image
                              src={template.thumbnail}
                              alt={templateInfo.name}
                              fill
                              placeholder="blur"
                              className="object-cover object-top"
                              sizes="(max-width: 768px) 45vw, 140px"
                            />
                          )}

                          {/* Active Indicator */}
                          {isActive && (
                            <div className="absolute inset-0 bg-blue-600/10 flex items-center justify-center">
                              <div className="bg-blue-600 text-white rounded-full p-1.5 shadow-lg">
                                <Check className="h-4 w-4" />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Template Info */}
                        <div className="space-y-0.5 px-0.5">
                          <span
                            className={cn(
                              'text-xs font-medium line-clamp-1',
                              isActive ? 'text-blue-700 dark:text-blue-400' : ''
                            )}
                          >
                            {templateInfo.name}
                          </span>
                          <p className="text-[10px] text-muted-foreground line-clamp-1">
                            {templateInfo.description}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Right: Preview Panel (1/3 width, Desktop Only) */}
            <div
              className={cn(
                "hidden md:flex w-1/3 border-l border-border/50",
                "items-center justify-center p-6",
                "bg-muted/30 dark:bg-muted/10"
              )}
            >
              <div className="w-full h-full flex flex-col items-center justify-center">
                {/* Preview Image - Fills available height while maintaining aspect ratio */}
                {previewTemplate?.thumbnail && (
                  <div
                    className={cn(
                      "relative w-full max-w-[280px] aspect-[210/297]",
                      "rounded-lg overflow-hidden",
                      "shadow-2xl",
                      "ring-1 ring-black/10 dark:ring-white/10"
                    )}
                    style={{
                      // Limit height to ensure text fits below
                      maxHeight: 'calc(100% - 80px)',
                    }}
                  >
                    <Image
                      src={previewTemplate.thumbnail}
                      alt={getTemplateInfo(previewTemplate.id).name}
                      fill
                      placeholder="blur"
                      className="object-cover object-top"
                      sizes="280px"
                    />
                  </div>
                )}

                {/* Preview Info */}
                <div className="mt-4 text-center shrink-0">
                  <h3 className="font-semibold text-sm">{getTemplateInfo(previewTemplate?.id || 'standard').name}</h3>
                  <p className="text-xs text-muted-foreground mt-1 text-balance max-w-[240px]">
                    {getTemplateInfo(previewTemplate?.id || 'standard').description}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

