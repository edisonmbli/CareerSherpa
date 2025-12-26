import { ResumeData, SectionConfig } from '@/lib/types/resume-schema'

export interface ResumeStyleConfig {
  themeColor: string
  fontFamily: string
  fontSize: number
  baseFontSize?: number
  lineHeight: number
  pageMargin: number
  sectionSpacing: number
  itemSpacing: number
  compactMode?: boolean
}

export type TemplateConfig = ResumeStyleConfig

export interface TemplateProps {
  data: ResumeData
  config: SectionConfig
  styleConfig?: Partial<ResumeStyleConfig>
}
