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

interface ResumePreviewProps {
  templateId: TemplateId
  data: ResumeData | null
  config?: SectionConfig
}

export const ResumePreview = forwardRef<HTMLDivElement, ResumePreviewProps>(
  ({ templateId, data, config }, ref) => {
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

    const renderTemplate = () => {
      switch (templateId) {
        case 'professional':
          return <TemplateProfessional data={data} config={activeConfig} />
        case 'technical':
          return <TemplateTechnical data={data} config={activeConfig} />
        case 'corporate':
          return <TemplateCorporate data={data} config={activeConfig} />
        case 'elegant':
          return <TemplateElegant data={data} config={activeConfig} />
        case 'darkSidebar':
          return <TemplateDarkSidebar data={data} config={activeConfig} />
        case 'creative':
          // Placeholder: Reuse Elegant for now as it's more creative than Standard
          return <TemplateElegant data={data} config={activeConfig} />
        case 'standard':
        default:
          return <TemplateStandard data={data} config={activeConfig} />
      }
    }

    return (
      <div className="origin-top scale-[0.5] sm:scale-[0.6] md:scale-[0.75] lg:scale-[0.85] xl:scale-100 transition-transform duration-300 ease-in-out">
        <div
          ref={ref}
          className="w-[210mm] min-h-[297mm] bg-white shadow-xl"
          style={{
            // A4 Size
            width: '210mm',
            minHeight: '297mm',
          }}
        >
          {renderTemplate()}
        </div>
      </div>
    )
  }
)

ResumePreview.displayName = 'ResumePreview'
