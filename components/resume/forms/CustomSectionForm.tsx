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

export function CustomSectionForm() {
  const {
    resumeData,
    updateSectionItem,
    addSectionItem,
    removeSectionItem,
    updateSectionTitle,
  } = useResumeStore()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const dict = useResumeDict()

  if (!resumeData) return null

  const items = resumeData.customSections || []
  const sectionTitles = resumeData.sectionTitles || {}
  const basics = resumeData.basics
  const defaultTitle = SECTION_TITLES['customSections'][basics.lang || 'zh']
  const currentTitle = sectionTitles['customSections'] || ''

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
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
          onChange={(e) => updateSectionTitle('customSections', e.target.value)}
          placeholder={defaultTitle}
          className={formInputClass}
        />
      </div>

      {items.map((item, index) => (
        <div key={item.id} className={formCardClass}>
          <div className="flex items-center justify-between mb-2">
            <div
              className={`${formCardTitleClass} truncate flex-1 cursor-pointer`}
              onClick={() => toggleExpand(item.id)}
            >
              {item.title || dict.forms.newCustom}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-blue-600"
                onClick={(e) => {
                  e.stopPropagation()
                  toggleExpand(item.id)
                }}
              >
                {expandedId === item.id ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  removeSectionItem('customSections', item.id)
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {expandedId === item.id && (
            <div className="space-y-3 mt-2 border-t pt-3">
              <div className="space-y-2">
                <Label>{dict.forms.sectionTitle}</Label>
                <Input
                  value={item.title || ''}
                  onChange={(e) =>
                    updateSectionItem('customSections', item.id, {
                      title: e.target.value,
                    })
                  }
                  className={formInputClass}
                />
              </div>
              <div className="space-y-2">
                <Label>{dict.forms.sectionContent}</Label>
                <Textarea
                  value={item.description || ''}
                  onChange={(e) =>
                    updateSectionItem('customSections', item.id, {
                      description: e.target.value,
                    })
                  }
                  className={formTextareaClass}
                />
                <p className="text-xs text-muted-foreground">
                  {dict.editor.markdownTip}
                </p>
              </div>

              <PageBreakSwitch sectionKey={item.id} />
            </div>
          )}
        </div>
      ))}

      <Button
        variant="outline"
        className={formAddButtonClass}
        onClick={() => addSectionItem('customSections')}
      >
        <Plus className="mr-2 h-4 w-4" />
        {dict.forms.addCustom}
      </Button>

      <PageBreakSwitch sectionKey="customSections" />
    </div>
  )
}
