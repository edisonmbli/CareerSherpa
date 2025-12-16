'use client'

import { useResumeStore } from '@/store/resume-store'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export function SummaryForm() {
  const { resumeData, updateBasics } = useResumeStore()
  
  if (!resumeData) return null
  
  const basics = resumeData.basics

  return (
    <div className="space-y-2">
      <Label>个人总结</Label>
      <Textarea 
        value={basics.summary || ''} 
        onChange={(e) => updateBasics({ summary: e.target.value })}
        className="min-h-[150px]"
        placeholder="简要介绍你的核心优势、职业目标等..."
      />
    </div>
  )
}
