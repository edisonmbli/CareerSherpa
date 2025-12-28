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
import {
  useResumeLayout,
  getPageDividerPositionPx,
  getVisualPageHeightPx,
} from '@/hooks/use-resume-layout'
import { SpacerContext } from '@/components/resume/SpacerContext'

interface ResumePreviewProps {
  templateId: TemplateId
  data: ResumeData | null
  config?: SectionConfig
}

// Visual Page Divider for WYSIWYG
// 分页预览线 - 定位在每页 297mm 结束处
const PageDivider = ({ pageIndex }: { pageIndex: number }) => {
  const topPx = getPageDividerPositionPx(pageIndex)
  return (
    <div
      className="absolute left-0 w-full pointer-events-none flex justify-center items-center px-2 z-50 no-print"
      style={{ top: `${topPx}px` }}
    >
      {/* Dashed Line - Gray & Subtle */}
      <div className="absolute left-0 w-full border-t border-dashed border-gray-300 opacity-60" />

      {/* Disclaimer Tag - Outside Canvas */}
      <div className="absolute right-[-140px] top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-medium whitespace-nowrap bg-white/50 backdrop-blur-sm px-2 py-1 rounded border border-gray-100 hidden xl:block">
        Page {pageIndex} End (近似参考)
      </div>
    </div>
  )
}

export const ResumePreview = forwardRef<HTMLDivElement, ResumePreviewProps>(
  ({ templateId, data, config }, ref) => {
    const { styleConfig, viewMode } = useResumeStore()
    const paperRef = useRef<HTMLDivElement | null>(null)
    const [autoScale, setAutoScale] = useState(1)

    // 1. Hook into the layout engine
    const { spacers, totalPages, pureContentHeight } = useResumeLayout(paperRef)
    const { setLayoutInfo } = useResumeStore()

    // Sync pureContentHeight to store for Smart Fill calculation
    useEffect(() => {
      setLayoutInfo({ contentHeight: pureContentHeight })
    }, [pureContentHeight, setLayoutInfo])

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
    const activePageMargin = styleConfig?.pageMargin ?? 16
    const finalPadding = `${activePageMargin}mm`
    // 使用视觉页高度用于 minHeight
    const visualPageHeightPx = getVisualPageHeightPx()

    const isCompact = styleConfig?.compactMode

    const activeLineHeight = styleConfig?.lineHeight ?? 1.5
    const activeItemSpacing = styleConfig?.itemSpacing ?? 12
    const baseSectionSpacing = styleConfig?.sectionSpacing || 24

    const dynamicStyles = {
      '--resume-padding-x': finalPadding,
      '--resume-padding-y': finalPadding,
      '--resume-base-font-size': finalFontSize,
      // Use config directly - Compact Mode logic now lives in the Toolbar (preset)
      '--resume-line-height': activeLineHeight,
      '--resume-paragraph-spacing': `${Math.round(activeItemSpacing)}px`,
      '--resume-section-spacing': `${Math.round(baseSectionSpacing)}px`,
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
            // Enforce minimum height to match total pages for the background gradient to look right
            minHeight:
              viewMode === 'print'
                ? `${totalPages * visualPageHeightPx}px`
                : undefined,
          }}
        >
          <style
            dangerouslySetInnerHTML={{
              __html: `:root{--resume-page-margin:${activePageMargin}mm}`,
            }}
          />
          {/* Render Page Dividers (Visual Only) */}
          {viewMode === 'print' &&
            Array.from({ length: totalPages - 1 }).map((_, i) => (
              <PageDivider key={i} pageIndex={i + 1} />
            ))}

          <SpacerContext.Provider value={spacers}>
            {data ? (
              renderTemplate(data)
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                暂无数据
              </div>
            )}
          </SpacerContext.Provider>
        </div>
      </div>
    )
  }
)

ResumePreview.displayName = 'ResumePreview'
