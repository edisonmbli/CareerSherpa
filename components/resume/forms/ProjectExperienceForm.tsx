'use client'

import { useResumeStore } from '@/store/resume-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import {
  formInputClass as inputClass,
  formTextareaClass as textareaClass,
  formCardClass,
  formCardTitleClass,
  formAddButtonClass,
} from './styles'

export function ProjectExperienceForm() {
  const {
    resumeData,
    updateSectionItem,
    addSectionItem,
    removeSectionItem,
    activeItemId,
    setActive,
  } = useResumeStore()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (!resumeData) return null

  const items = resumeData.projectExperiences || []

  // If a specific item is active, show ONLY that item's form
  if (activeItemId) {
    const activeItem = items.find((i) => i.id === activeItemId)
    if (activeItem) {
      return (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>项目名称</Label>
              <Input
                value={activeItem.projectName || ''}
                onChange={(e) =>
                  updateSectionItem('projectExperiences', activeItem.id, {
                    projectName: e.target.value,
                  })
                }
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <Label>担任角色</Label>
              <Input
                value={activeItem.role || ''}
                onChange={(e) =>
                  updateSectionItem('projectExperiences', activeItem.id, {
                    role: e.target.value,
                  })
                }
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <Label>GitHub 链接 (可选)</Label>
              <Input
                value={activeItem.githubUrl || ''}
                onChange={(e) =>
                  updateSectionItem('projectExperiences', activeItem.id, {
                    githubUrl: e.target.value,
                  })
                }
                className={inputClass}
                placeholder="https://github.com/..."
              />
            </div>
            <div className="space-y-2">
              <Label>作品/演示链接 (可选)</Label>
              <Input
                value={activeItem.demoUrl || ''}
                onChange={(e) =>
                  updateSectionItem('projectExperiences', activeItem.id, {
                    demoUrl: e.target.value,
                  })
                }
                className={inputClass}
                placeholder="https://..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>开始时间</Label>
                <Input
                  value={activeItem.startDate || ''}
                  onChange={(e) =>
                    updateSectionItem('projectExperiences', activeItem.id, {
                      startDate: e.target.value,
                    })
                  }
                  placeholder="YYYY-MM"
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <Label>结束时间</Label>
                <Input
                  value={activeItem.endDate || ''}
                  onChange={(e) =>
                    updateSectionItem('projectExperiences', activeItem.id, {
                      endDate: e.target.value,
                    })
                  }
                  placeholder="至今 / YYYY-MM"
                  className={inputClass}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>项目描述</Label>
              <Textarea
                value={activeItem.description || ''}
                onChange={(e) =>
                  updateSectionItem('projectExperiences', activeItem.id, {
                    description: e.target.value,
                  })
                }
                className={textareaClass}
              />
              <p className="text-xs text-muted-foreground">
                💡支持加粗、斜体等基础 Markdown 格式，可智能生成列表
              </p>
            </div>
          </div>
        </div>
      )
    }
  }

  const toggleExpand = (id: string) => {
    // In list mode, clicking expand enters detail mode
    setActive('projectExperiences', id)
  }

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div
          key={item.id}
          className="border rounded-md p-4 bg-white hover:border-blue-400 transition-colors group cursor-pointer"
          onClick={() => toggleExpand(item.id)}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-gray-900">
                {item.projectName || '新项目经历'}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {item.role || '角色'}
                {(item.startDate || item.endDate) &&
                  ` • ${item.startDate || ''} - ${item.endDate || ''}`}
              </div>
            </div>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-blue-600"
                onClick={(e) => {
                  e.stopPropagation()
                  toggleExpand(item.id)
                }}
              >
                <ChevronDown className="h-4 w-4 -rotate-90" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  removeSectionItem('projectExperiences', item.id)
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ))}

      <Button
        variant="outline"
        className="w-full border-dashed h-12 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 dark:hover:bg-blue-900/20 dark:hover:border-blue-700 dark:hover:text-blue-400 transition-all"
        onClick={() => addSectionItem('projectExperiences')}
      >
        <Plus className="mr-2 h-4 w-4" /> 添加项目经历
      </Button>
    </div>
  )
}
