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
import { uiLog } from '@/lib/ui/sse-debug-logger'

interface ResumePreviewProps {
  templateId: TemplateId
  data: ResumeData | null
  config?: SectionConfig
}

export const ResumePreview = forwardRef<HTMLDivElement, ResumePreviewProps>(
  ({ templateId, data, config }, ref) => {
    const { styleConfig, readOnly, serviceId } = useResumeStore()
    const paperRef = useRef<HTMLDivElement | null>(null)
    const lastLogKeyRef = useRef<string | null>(null)

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
      // CSS custom properties (consumed by child elements and globals.css rules)
      '--resume-padding-x': finalPadding,
      '--resume-padding-y': finalPadding,
      '--resume-base-font-size': finalFontSize,
      '--resume-line-height': activeLineHeight,
      '--resume-paragraph-spacing': `${Math.round(activeItemSpacing)}px`,
      '--resume-section-spacing': `${Math.round(baseSectionSpacing)}px`,
      '--resume-item-spacing': `${Math.round(activeItemSpacing)}px`,
    } as React.CSSProperties

    useEffect(() => {
      if (!paperRef.current) return
      const logKey = JSON.stringify({
        templateId,
        readOnly,
        styleConfig,
      })
      if (lastLogKeyRef.current === logKey) return
      lastLogKeyRef.current = logKey
      const node = paperRef.current
      const computed = getComputedStyle(node)
      const firstSection = node.querySelector('section')
      const firstItemGapChild = node.querySelector('.item-gap > *')
      const sectionComputed = firstSection
        ? getComputedStyle(firstSection)
        : null
      const itemGapComputed = firstItemGapChild
        ? getComputedStyle(firstItemGapChild)
        : null
      uiLog.info('resume_render_style_state', {
        serviceId,
        templateId,
        readOnly,
        styleConfig,
        inlineVars: {
          paddingX: node.style.getPropertyValue('--resume-padding-x'),
          paddingY: node.style.getPropertyValue('--resume-padding-y'),
          baseFontSize: node.style.getPropertyValue('--resume-base-font-size'),
          lineHeight: node.style.getPropertyValue('--resume-line-height'),
          paragraphSpacing: node.style.getPropertyValue(
            '--resume-paragraph-spacing',
          ),
          sectionSpacing: node.style.getPropertyValue(
            '--resume-section-spacing',
          ),
          itemSpacing: node.style.getPropertyValue('--resume-item-spacing'),
        },
        computedStyles: {
          fontSize: computed.fontSize,
          lineHeight: computed.lineHeight,
          paddingTop: computed.paddingTop,
          paddingRight: computed.paddingRight,
          paddingBottom: computed.paddingBottom,
          paddingLeft: computed.paddingLeft,
        },
        computedVars: {
          paddingX: computed.getPropertyValue('--resume-padding-x'),
          paddingY: computed.getPropertyValue('--resume-padding-y'),
          baseFontSize: computed.getPropertyValue('--resume-base-font-size'),
          lineHeight: computed.getPropertyValue('--resume-line-height'),
          paragraphSpacing: computed.getPropertyValue(
            '--resume-paragraph-spacing',
          ),
          sectionSpacing: computed.getPropertyValue('--resume-section-spacing'),
          itemSpacing: computed.getPropertyValue('--resume-item-spacing'),
        },
        sampleSpacing: {
          sectionCount: node.querySelectorAll('section').length,
          firstSectionMarginBottom: sectionComputed?.marginBottom,
          firstItemGapMarginTop: itemGapComputed?.marginTop,
        },
      })
    }, [templateId, readOnly, styleConfig, serviceId])

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
  },
)

ResumePreview.displayName = 'ResumePreview'
