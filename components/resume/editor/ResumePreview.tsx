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
import { SpacerContext } from '@/components/resume/SpacerContext'

interface ResumePreviewProps {
  templateId: TemplateId
  data: ResumeData | null
  config?: SectionConfig
}

export const ResumePreview = forwardRef<HTMLDivElement, ResumePreviewProps>(
  ({ templateId, data, config }, ref) => {
    const { styleConfig } = useResumeStore()
    const paperRef = useRef<HTMLDivElement | null>(null)

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

    const activeLineHeight = styleConfig?.lineHeight ?? 1.5
    const activeItemSpacing = styleConfig?.itemSpacing ?? 12
    const baseSectionSpacing = styleConfig?.sectionSpacing || 24

    const dynamicStyles = {
      '--resume-padding-x': finalPadding,
      '--resume-padding-y': finalPadding,
      '--resume-base-font-size': finalFontSize,
      '--resume-line-height': activeLineHeight,
      '--resume-paragraph-spacing': `${Math.round(activeItemSpacing)}px`,
      '--resume-section-spacing': `${Math.round(baseSectionSpacing)}px`,
      '--resume-item-spacing': `${Math.round(activeItemSpacing)}px`, // For work/project item gaps
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
          className="resume-paper"
          style={dynamicStyles}
        >
          <style
            dangerouslySetInnerHTML={{
              __html: `:root{--resume-page-margin:${activePageMargin}mm}`,
            }}
          />
          <SpacerContext.Provider value={{}}>
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
