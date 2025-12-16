'use client'

import { useResumeStore } from '@/store/resume-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'

export function ProjectExperienceForm() {
  const { resumeData, updateSectionItem, addSectionItem, removeSectionItem } = useResumeStore()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  
  if (!resumeData) return null
  
  const items = resumeData.projectExperiences || []

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
  }

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div key={item.id} className="border rounded-md p-3 bg-gray-50/50">
          <div className="flex items-center justify-between mb-2">
            <div 
              className="font-medium text-sm truncate flex-1 cursor-pointer"
              onClick={() => toggleExpand(item.id)}
            >
              {item.projectName || '新项目经历'}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleExpand(item.id)}>
                {expandedId === item.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 text-destructive hover:text-destructive"
                onClick={() => removeSectionItem('projectExperiences', item.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {expandedId === item.id && (
            <div className="space-y-3 mt-2 border-t pt-3">
              <div className="space-y-2">
                <Label>项目名称</Label>
                <Input 
                  value={item.projectName || ''} 
                  onChange={(e) => updateSectionItem('projectExperiences', item.id, { projectName: e.target.value })} 
                />
              </div>
              <div className="space-y-2">
                <Label>担任角色</Label>
                <Input 
                  value={item.role || ''} 
                  onChange={(e) => updateSectionItem('projectExperiences', item.id, { role: e.target.value })} 
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>开始时间</Label>
                  <Input 
                    value={item.startDate || ''} 
                    onChange={(e) => updateSectionItem('projectExperiences', item.id, { startDate: e.target.value })}
                    placeholder="YYYY-MM"
                  />
                </div>
                <div className="space-y-2">
                  <Label>结束时间</Label>
                  <Input 
                    value={item.endDate || ''} 
                    onChange={(e) => updateSectionItem('projectExperiences', item.id, { endDate: e.target.value })}
                    placeholder="至今 / YYYY-MM"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>项目描述</Label>
                <Textarea 
                  value={item.description || ''} 
                  onChange={(e) => updateSectionItem('projectExperiences', item.id, { description: e.target.value })}
                  className="min-h-[100px]"
                />
              </div>
            </div>
          )}
        </div>
      ))}

      <Button 
        variant="outline" 
        className="w-full border-dashed" 
        onClick={() => addSectionItem('projectExperiences')}
      >
        <Plus className="mr-2 h-4 w-4" /> 添加项目经历
      </Button>
    </div>
  )
}
