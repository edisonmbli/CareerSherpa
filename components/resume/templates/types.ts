import { ResumeData, SectionConfig } from '@/lib/types/resume-schema'

export interface ResumeStyleConfig {
  themeColor: string
  fontFamily: string
  fontSize: number
  lineHeight: number
  pageMargin: number
  sectionSpacing: number
  itemSpacing: number
}

export interface TemplateProps {
  data: ResumeData
  config: SectionConfig
  styleConfig?: Partial<ResumeStyleConfig>
}
