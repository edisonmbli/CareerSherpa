'use client'

import { forwardRef } from 'react'
import { ResumeData, SectionConfig } from '@/lib/types/resume-schema'
import { TemplateId } from '../constants'
import { TemplateStandard } from '../templates/TemplateStandard'
import { TemplateProfessional } from '../templates/TemplateProfessional'
import { TemplateTechnical } from '../templates/TemplateTechnical'
import { TemplateCorporate } from '../templates/TemplateCorporate'
import { TemplateElegant } from '../templates/TemplateElegant'
import { TemplateDarkSidebar } from '../templates/TemplateDarkSidebar'
import { TemplateDesign } from '../templates/TemplateDesign'
import { useResumeStore } from '@/store/resume-store'

interface ResumePreviewProps {
  templateId: TemplateId
  data: ResumeData | null
  config?: SectionConfig
}

export const ResumePreview = forwardRef<HTMLDivElement, ResumePreviewProps>(
  ({ templateId, data, config }, ref) => {
    const { styleConfig } = useResumeStore()

    if (!data) {
      return (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          暂无数据
        </div>
      )
    }

    // Default fallback config if somehow missing
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

    // Inject style config
    const props = { data, config: activeConfig, styleConfig }

    const basePageMarginMm = styleConfig?.pageMargin ?? 10
    const isMobileViewport =
      typeof window !== 'undefined' && window.innerWidth < 768
    const pageMarginMm = isMobileViewport
      ? Math.max(3, basePageMarginMm * 0.3)
      : basePageMarginMm

    const renderTemplate = () => {
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
        case 'standard':
        default:
          return <TemplateStandard {...props} />
      }
    }

    return (
      <div className="origin-top transition-transform duration-[800ms] ease-in-out">
        <div
          ref={ref}
          className="min-h-[297mm] bg-white shadow-xl w-full"
          style={{
            width:
              typeof window !== 'undefined' && window.innerWidth < 768
                ? '100%'
                : '210mm',
            maxWidth: '210mm',
            minHeight: '297mm',
            padding: `${pageMarginMm}mm`,
          }}
        >
          {renderTemplate()}
        </div>
      </div>
    )
  }
)

ResumePreview.displayName = 'ResumePreview'
