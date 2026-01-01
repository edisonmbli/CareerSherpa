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
import { useResumeDict } from '../ResumeDictContext'

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

  const dict = useResumeDict()

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
              <Label>{dict.forms.companyName}</Label>
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
              <Label>{dict.forms.position}</Label>
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
                <Label>{dict.forms.startDate}</Label>
                <Input
                  value={activeItem.startDate || ''}
                  onChange={(e) =>
                    updateSectionItem('workExperiences', activeItem.id, {
                      startDate: e.target.value,
                    })
                  }
                  placeholder={dict.forms.dateFormat}
                  className={formInputClass}
                />
              </div>
              <div className="space-y-2">
                <Label>{dict.forms.endDate}</Label>
                <Input
                  value={activeItem.endDate || ''}
                  onChange={(e) =>
                    updateSectionItem('workExperiences', activeItem.id, {
                      endDate: e.target.value,
                    })
                  }
                  placeholder={`${dict.forms.present} / ${dict.forms.dateFormat}`}
                  className={formInputClass}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{dict.forms.workContent}</Label>
              <Textarea
                value={activeItem.description || ''}
                onChange={(e) =>
                  updateSectionItem('workExperiences', activeItem.id, {
                    description: e.target.value,
                  })
                }
                className={formTextareaClass}
                placeholder="• ..."
              />
              <p className="text-xs text-muted-foreground">
                {dict.editor.markdownTip}
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
          {dict.editor.customSectionTitle}
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
                {item.company || dict.forms.newWork}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {item.position || dict.forms.position}
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
        {dict.forms.addWork}
      </Button>

      <PageBreakSwitch sectionKey="workExperiences" />
    </div>
  )
}
