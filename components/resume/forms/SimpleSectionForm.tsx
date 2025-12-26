'use client'

import { useResumeStore } from '@/store/resume-store'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { ResumeData } from '@/lib/types/resume-schema'
import { formTextareaClass, formInputClass } from './styles'
import { SECTION_TITLES, SectionKey } from '../section-titles'
import { PageBreakSwitch } from './PageBreakSwitch'

interface SimpleSectionFormProps {
  sectionKey: keyof Pick<ResumeData, 'skills' | 'certificates' | 'hobbies'>
  label: string
  placeholder?: string
}

export function SimpleSectionForm({
  sectionKey,
  label,
  placeholder,
}: SimpleSectionFormProps) {
  const { resumeData, updateSimpleSection, updateSectionTitle } =
    useResumeStore()

  if (!resumeData) return null

  const value = resumeData[sectionKey] || ''
  const sectionTitles = resumeData.sectionTitles || {}
  const basics = resumeData.basics
  const defaultTitle =
    SECTION_TITLES[sectionKey as SectionKey][basics.lang || 'zh']
  const currentTitle = sectionTitles[sectionKey] || ''

  return (
    <div className="space-y-4">
      {/* Section Title Editor */}
      <div className="space-y-2 border-b pb-4">
        <Label className="text-xs font-medium text-gray-500">
          自定义章节标题
        </Label>
        <Input
          value={currentTitle}
          onChange={(e) => updateSectionTitle(sectionKey, e.target.value)}
          placeholder={defaultTitle}
          className={formInputClass}
        />
      </div>

      <div className="space-y-2">
        {/* Label removed to avoid duplication with panel header */}
        <Textarea
          value={value}
          onChange={(e) => updateSimpleSection(sectionKey, e.target.value)}
          className={formTextareaClass}
          placeholder={placeholder}
        />
        <p className="text-xs text-muted-foreground">
          💡支持加粗、斜体等基础 Markdown 格式，可智能生成列表
        </p>
      </div>

      <PageBreakSwitch sectionKey={sectionKey} />
    </div>
  )
}
