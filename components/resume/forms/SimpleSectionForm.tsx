'use client'

import { useResumeStore } from '@/store/resume-store'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ResumeData } from '@/lib/types/resume-schema'

interface SimpleSectionFormProps {
  sectionKey: keyof Pick<ResumeData, 'skills' | 'certificates' | 'hobbies'>
  label: string
  placeholder?: string
}

export function SimpleSectionForm({ sectionKey, label, placeholder }: SimpleSectionFormProps) {
  const { resumeData, updateSimpleSection } = useResumeStore()
  
  if (!resumeData) return null
  
  const value = resumeData[sectionKey] || ''

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Textarea 
        value={value} 
        onChange={(e) => updateSimpleSection(sectionKey, e.target.value)}
        className="min-h-[150px]"
        placeholder={placeholder}
      />
      <p className="text-xs text-muted-foreground">
        提示：支持 Markdown 格式，使用 - 或 * 开头可生成列表。
      </p>
    </div>
  )
}
