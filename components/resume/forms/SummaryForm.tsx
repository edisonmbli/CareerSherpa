'use client'

import { useResumeStore } from '@/store/resume-store'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formTextareaClass } from './styles'

export function SummaryForm() {
  const { resumeData, updateBasics } = useResumeStore()

  if (!resumeData) return null

  const basics = resumeData.basics

  return (
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
  )
}
