'use client'

import { useResumeStore } from '@/store/resume-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'

export function CustomSectionForm() {
  const { resumeData, updateSectionItem, addSectionItem, removeSectionItem } = useResumeStore()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  
  if (!resumeData) return null
  
  const items = resumeData.customSections || []

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
              {item.title || '新自定义板块'}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleExpand(item.id)}>
                {expandedId === item.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 text-destructive hover:text-destructive"
                onClick={() => removeSectionItem('customSections', item.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {expandedId === item.id && (
            <div className="space-y-3 mt-2 border-t pt-3">
              <div className="space-y-2">
                <Label>板块标题</Label>
                <Input 
                  value={item.title || ''} 
                  onChange={(e) => updateSectionItem('customSections', item.id, { title: e.target.value })}
                  placeholder="e.g. 语言能力 / 志愿者经历" 
                />
              </div>
              <div className="space-y-2">
                <Label>内容描述</Label>
                <Textarea 
                  value={item.description || ''} 
                  onChange={(e) => updateSectionItem('customSections', item.id, { description: e.target.value })}
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
        onClick={() => addSectionItem('customSections')}
      >
        <Plus className="mr-2 h-4 w-4" /> 添加自定义板块
      </Button>
    </div>
  )
}
