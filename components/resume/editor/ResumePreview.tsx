'use client'

import { forwardRef, useEffect, useRef, useState } from 'react'
import { ResumeData, SectionConfig } from '@/lib/types/resume-schema'
import { TemplateId } from '../constants'
import { TemplateStandard } from '../templates/TemplateStandard'
import { TemplateProfessional } from '../templates/TemplateProfessional'
import { TemplateTechnical } from '../templates/TemplateTechnical'
import { TemplateCorporate } from '../templates/TemplateCorporate'
import { TemplateElegant } from '../templates/TemplateElegant'
import { TemplateDarkSidebar } from '../templates/TemplateDarkSidebar'
import { TemplateDesign } from '../templates/TemplateDesign'
import { TemplateProduct } from '../templates/TemplateProduct'
import { useResumeStore } from '@/store/resume-store'
import { cn } from '@/lib/utils'

interface ResumePreviewProps {
  templateId: TemplateId
  data: ResumeData | null
  config?: SectionConfig
}

export const ResumePreview = forwardRef<HTMLDivElement, ResumePreviewProps>(
  ({ templateId, data, config }, ref) => {
    const { styleConfig, viewMode } = useResumeStore()
    const paperRef = useRef<HTMLDivElement | null>(null)
    const [autoScale, setAutoScale] = useState(1)

    useEffect(() => {
      if (
        !paperRef.current ||
        viewMode !== 'print' ||
        !styleConfig?.smartFill
      ) {
        if (autoScale !== 1) setAutoScale(1)
        return
      }

      const measure = () => {
        const el = paperRef.current
        if (!el) return

        // Measure current height
        const currentHeight = el.scrollHeight
        // Estimate original (unscaled) height to avoid oscillation loop
        // If we are currently scaled by X, the original height is roughly Height / X
        // This is an approximation but helps stability
        const originalHeight = currentHeight / autoScale

        const mmToPx = (mm: number) => (mm * 96) / 25.4
        const pageHeightPx = mmToPx(297)
        const totalPages = originalHeight / pageHeightPx
        const integerPages = Math.floor(totalPages)
        const decimalPart = totalPages - integerPages

        let targetScale = 1

        // Strategy: "Fit to Page"
        // If slightly over (e.g. 1.05 pages), shrink to 1 page
        if (decimalPart > 0 && decimalPart < 0.15) {
          // Target: integerPages
          // We need to shrink from totalPages to integerPages
          // Scale factor = integerPages / totalPages
          // Example: 1.05 -> 1.0. Scale = 1/1.05 = 0.95
          targetScale = Math.max(integerPages / totalPages, 0.9)
        }
        // If slightly under (e.g. 0.9 pages), expand to 1 page?
        // Or if 1.9 pages, expand to 2 pages?
        // Usually "Smart Fill" means "Expand to fill whitespace".
        else if (decimalPart > 0.85) {
          // Target: integerPages + 1
          // We need to expand from totalPages to integerPages + 1
          // Scale factor = (integerPages + 1) / totalPages
          // Example: 1.9 -> 2.0. Scale = 2.0/1.9 = 1.05
          targetScale = Math.min((integerPages + 1) / totalPages, 1.1)
        }

        // Only update if difference is significant to prevent jitter
        if (Math.abs(targetScale - autoScale) > 0.01) {
          setAutoScale(targetScale)
        }
      }

      // Debounce the measurement slightly
      const timer = setTimeout(measure, 100)
      const ro = new ResizeObserver(() => {
        // Debounce resize events
        setTimeout(measure, 100)
      })
      ro.observe(paperRef.current)

      return () => {
        clearTimeout(timer)
        ro.disconnect()
      }
    }, [viewMode, styleConfig, data, autoScale])

    const activeConfig = config || {
      order: [
        'basics',
        'summary',
        'workExperiences',
        'projectExperiences',
        'educations',
        'skills',
        'certificates',
        'hobbies',
        'customSections',
      ],
      hidden: [],
    }

    // Calculate final CSS variables for Print Physics
    const fontSizeMultiplier = styleConfig?.fontSize || 1
    const baseFontSize = styleConfig?.baseFontSize || 14
    const finalFontSize = `${baseFontSize * fontSizeMultiplier}px`
    const marginMm = styleConfig?.pageMargin ?? 10
    const finalPadding = `${marginMm}mm`

    const isCompact = styleConfig?.compactMode

    // Previous "useEffect" for simple measure is replaced by the smart fill logic above

    const baseLineHeight = styleConfig?.lineHeight || 1.5
    const baseItemSpacing = styleConfig?.itemSpacing || 12
    const baseSectionSpacing = styleConfig?.sectionSpacing || 24
    const smartScale = autoScale

    const dynamicStyles = {
      '--resume-padding-x': finalPadding,
      '--resume-padding-y': finalPadding,
      '--resume-base-font-size': finalFontSize,
      '--resume-line-height': isCompact ? 1.3 : baseLineHeight * smartScale,
      '--resume-paragraph-spacing': isCompact
        ? '6px'
        : `${Math.round(
            baseItemSpacing * (styleConfig?.smartFill ? smartScale : 1)
          )}px`,
      '--resume-section-spacing': isCompact
        ? '16px'
        : `${Math.round(
            baseSectionSpacing * (styleConfig?.smartFill ? smartScale : 1)
          )}px`,
    } as React.CSSProperties

    const renderTemplate = (d: ResumeData) => {
      const props = { data: d, config: activeConfig, styleConfig }
      switch (templateId) {
        case 'professional':
          return <TemplateProfessional {...props} />
        case 'technical':
          return <TemplateTechnical {...props} />
        case 'corporate':
          return <TemplateCorporate {...props} />
        case 'elegant':
          return <TemplateElegant {...props} />
        case 'darkSidebar':
          return <TemplateDarkSidebar {...props} />
        case 'creative':
          return <TemplateDesign {...props} />
        case 'product':
          return <TemplateProduct {...props} />
        case 'standard':
        default:
          return <TemplateStandard {...props} />
      }
    }

    return (
      <div className="origin-top transition-transform duration-[800ms] ease-in-out print:transform-none">
        <style
          dangerouslySetInnerHTML={{
            __html: `:root{--resume-page-margin:${marginMm}mm}`,
          }}
        />
        <div
          ref={(node) => {
            paperRef.current = node
            if (typeof ref === 'function') ref(node as HTMLDivElement)
            else if (ref && 'current' in (ref as any))
              (ref as any).current = node
          }}
          className={cn(
            'resume-paper',
            viewMode === 'print' && 'shadow-2xl ring-1 ring-border'
          )}
          style={{
            ...dynamicStyles,
            backgroundImage:
              viewMode === 'print'
                ? 'linear-gradient(to bottom, #ffffff 0mm, #ffffff 297mm, #e5e5e5 297mm, #e5e5e5 307mm)'
                : 'none',
            backgroundSize: '100% 307mm',
          }}
        >
          {data ? (
            renderTemplate(data)
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              暂无数据
            </div>
          )}
        </div>
      </div>
    )
  }
)

ResumePreview.displayName = 'ResumePreview'
