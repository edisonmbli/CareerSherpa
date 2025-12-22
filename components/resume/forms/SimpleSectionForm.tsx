'use client'

import { useResumeStore } from '@/store/resume-store'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ResumeData } from '@/lib/types/resume-schema'
import { formTextareaClass } from './styles'

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
  const { resumeData, updateSimpleSection } = useResumeStore()

  if (!resumeData) return null

  const value = resumeData[sectionKey] || ''

  return (
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
  )
}
