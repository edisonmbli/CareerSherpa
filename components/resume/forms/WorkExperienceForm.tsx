'use client'

import { useResumeStore } from '@/store/resume-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2, ChevronDown, ChevronUp, Edit2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  formInputClass,
  formTextareaClass,
  formCardClass,
  formCardTitleClass,
  formAddButtonClass,
} from './styles'
import { SECTION_TITLES } from '../section-titles'
import { PageBreakSwitch } from './PageBreakSwitch'

export function WorkExperienceForm() {
  const {
    resumeData,
    updateSectionItem,
    addSectionItem,
    removeSectionItem,
    activeItemId,
    setActive,
    updateSectionTitle,
  } = useResumeStore()

  if (!resumeData) return null

  const items = resumeData.workExperiences || []
  const sectionTitles = resumeData.sectionTitles || {}
  const basics = resumeData.basics
  const defaultTitle = SECTION_TITLES['workExperiences'][basics.lang || 'zh']
  const currentTitle = sectionTitles['workExperiences'] || ''

  // If a specific item is active, show ONLY that item's form
  if (activeItemId) {
    const activeItem = items.find((i) => i.id === activeItemId)
    if (activeItem) {
      return (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>公司名称</Label>
              <Input
                value={activeItem.company || ''}
                onChange={(e) =>
                  updateSectionItem('workExperiences', activeItem.id, {
                    company: e.target.value,
                  })
                }
                className={formInputClass}
              />
            </div>
            <div className="space-y-2">
              <Label>职位</Label>
              <Input
                value={activeItem.position || ''}
                onChange={(e) =>
                  updateSectionItem('workExperiences', activeItem.id, {
                    position: e.target.value,
                  })
                }
                className={formInputClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>开始时间</Label>
                <Input
                  value={activeItem.startDate || ''}
                  onChange={(e) =>
                    updateSectionItem('workExperiences', activeItem.id, {
                      startDate: e.target.value,
                    })
                  }
                  placeholder="YYYY-MM"
                  className={formInputClass}
                />
              </div>
              <div className="space-y-2">
                <Label>结束时间</Label>
                <Input
                  value={activeItem.endDate || ''}
                  onChange={(e) =>
                    updateSectionItem('workExperiences', activeItem.id, {
                      endDate: e.target.value,
                    })
                  }
                  placeholder="至今 / YYYY-MM"
                  className={formInputClass}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>工作内容</Label>
              <Textarea
                value={activeItem.description || ''}
                onChange={(e) =>
                  updateSectionItem('workExperiences', activeItem.id, {
                    description: e.target.value,
                  })
                }
                className={formTextareaClass}
                placeholder="• 负责..."
              />
              <p className="text-xs text-muted-foreground">
                💡支持加粗、斜体等基础 Markdown 格式，可智能生成列表
              </p>
            </div>

            <PageBreakSwitch sectionKey={activeItem.id} />
          </div>
        </div>
      )
    }
  }

  const toggleExpand = (id: string) => {
    // In list mode, clicking expand enters detail mode
    setActive('workExperiences', id)
  }

  return (
    <div className="space-y-4">
      {/* Section Title Editor */}
      <div className="space-y-2 border-b pb-4 mb-4">
        <Label className="text-xs font-medium text-gray-500">
          自定义章节标题
        </Label>
        <Input
          value={currentTitle}
          onChange={(e) =>
            updateSectionTitle('workExperiences', e.target.value)
          }
          placeholder={defaultTitle}
          className={formInputClass}
        />
      </div>

      {items.map((item, index) => (
        <div
          key={item.id}
          className={`${formCardClass} cursor-pointer`}
          onClick={() => toggleExpand(item.id)}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className={formCardTitleClass}>
                {item.company || '新工作经历'}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {item.position || '职位'}
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
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  removeSectionItem('workExperiences', item.id)
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
        className={formAddButtonClass}
        onClick={() => addSectionItem('workExperiences')}
      >
        <Plus className="h-4 w-4 mr-2" />
        添加工作经历
      </Button>

      <PageBreakSwitch sectionKey="workExperiences" />
    </div>
  )
}
