'use client'

import { useResumeStore } from '@/store/resume-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
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

export function EducationForm() {
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

  const items = resumeData.educations || []
  const sectionTitles = resumeData.sectionTitles || {}
  const basics = resumeData.basics
  const defaultTitle = SECTION_TITLES['educations'][basics.lang || 'zh']
  const currentTitle = sectionTitles['educations'] || ''

  // If a specific item is active, show ONLY that item's form
  if (activeItemId) {
    const activeItem = items.find((i) => i.id === activeItemId)
    if (activeItem) {
      return (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActive('educations', null)}
            className="mb-2 -ml-2 text-muted-foreground md:flex hidden"
          >
            <ChevronDown className="h-4 w-4 rotate-90 mr-1" />
            {dict.forms.backToList}
          </Button>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{dict.forms.schoolName}</Label>
              <Input
                value={activeItem.school || ''}
                onChange={(e) =>
                  updateSectionItem('educations', activeItem.id, {
                    school: e.target.value,
                  })
                }
                className={formInputClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{dict.forms.major}</Label>
                <Input
                  value={activeItem.major || ''}
                  onChange={(e) =>
                    updateSectionItem('educations', activeItem.id, {
                      major: e.target.value,
                    })
                  }
                  className={formInputClass}
                />
              </div>
              <div className="space-y-2">
                <Label>{dict.forms.degree}</Label>
                <Input
                  value={activeItem.degree || ''}
                  onChange={(e) =>
                    updateSectionItem('educations', activeItem.id, {
                      degree: e.target.value,
                    })
                  }
                  className={formInputClass}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{dict.forms.startDate}</Label>
                <Input
                  value={activeItem.startDate || ''}
                  onChange={(e) =>
                    updateSectionItem('educations', activeItem.id, {
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
                    updateSectionItem('educations', activeItem.id, {
                      endDate: e.target.value,
                    })
                  }
                  placeholder={dict.forms.dateFormat}
                  className={formInputClass}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{dict.forms.eduAchievements}</Label>
              <Textarea
                value={activeItem.description || ''}
                onChange={(e) =>
                  updateSectionItem('educations', activeItem.id, {
                    description: e.target.value,
                  })
                }
                className={formTextareaClass}
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
    setActive('educations', id)
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
          onChange={(e) => updateSectionTitle('educations', e.target.value)}
          placeholder={defaultTitle}
          className={formInputClass}
        />
      </div>

      {items.map((item, index) => (
        <div
          key={item.id}
          className={formCardClass + ' cursor-pointer'}
          onClick={() => toggleExpand(item.id)}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className={formCardTitleClass}>
                {item.school || dict.forms.newEducation}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {item.major || dict.forms.major}
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
                  removeSectionItem('educations', item.id)
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
        className="w-full border-dashed h-12 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-all"
        onClick={() => addSectionItem('educations')}
      >
        <Plus className="mr-2 h-4 w-4" />
        {dict.forms.addEducation}
      </Button>

      <PageBreakSwitch sectionKey="educations" />
    </div>
  )
}
