'use client'

import { useResumeStore } from '@/store/resume-store'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { formTextareaClass, formInputClass } from './styles'
import { SECTION_TITLES } from '../section-titles'
import { PageBreakSwitch } from './PageBreakSwitch'

export function SummaryForm() {
  const { resumeData, updateBasics, updateSectionTitle } = useResumeStore()

  if (!resumeData) return null

  const basics = resumeData.basics
  const sectionTitles = resumeData.sectionTitles || {}
  const defaultTitle = SECTION_TITLES['summary'][basics.lang || 'zh']
  const currentTitle = sectionTitles['summary'] || ''

  return (
    <div className="space-y-4">
      {/* Section Title Editor */}
      <div className="space-y-2 border-b pb-4">
        <Label className="text-xs font-medium text-gray-500">
          自定义章节标题
        </Label>
        <Input
          value={currentTitle}
          onChange={(e) => updateSectionTitle('summary', e.target.value)}
          placeholder={defaultTitle}
          className={formInputClass}
        />
      </div>

      <div className="space-y-2">
        {/* Label removed to avoid duplication with panel header */}
        <Textarea
          value={basics.summary || ''}
          onChange={(e) => updateBasics({ summary: e.target.value })}
          className={formTextareaClass}
          placeholder="简要介绍你的核心优势、职业目标等..."
        />
        <p className="text-xs text-muted-foreground">
          💡支持加粗、斜体等基础 Markdown 格式，可智能生成列表
        </p>
      </div>

      <PageBreakSwitch sectionKey="summary" />
    </div>
  )
}
