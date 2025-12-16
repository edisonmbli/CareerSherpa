'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BasicsForm } from '../forms/BasicsForm'
import { SummaryForm } from '../forms/SummaryForm'
import { WorkExperienceForm } from '../forms/WorkExperienceForm'
import { ProjectExperienceForm } from '../forms/ProjectExperienceForm'
import { EducationForm } from '../forms/EducationForm'
import { CustomSectionForm } from '../forms/CustomSectionForm'
import { SimpleSectionForm } from '../forms/SimpleSectionForm'

const SECTION_LABELS: Record<string, string> = {
  basics: '基本信息',
  summary: '个人总结',
  workExperiences: '工作经历',
  projectExperiences: '项目经历',
  educations: '教育经历',
  skills: '技能特长',
  certificates: '证书奖项',
  hobbies: '兴趣爱好',
  customSections: '自定义板块'
}

export function SortableSectionItem({ id }: { id: string }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : undefined,
    position: isDragging ? 'relative' : undefined,
  } as React.CSSProperties

  const renderForm = () => {
    switch(id) {
      case 'basics': return <BasicsForm />
      case 'summary': return <SummaryForm />
      case 'workExperiences': return <WorkExperienceForm />
      case 'projectExperiences': return <ProjectExperienceForm />
      case 'educations': return <EducationForm />
      case 'skills': return <SimpleSectionForm sectionKey="skills" label="技能特长" placeholder="列出你的核心技能..." />
      case 'certificates': return <SimpleSectionForm sectionKey="certificates" label="证书奖项" placeholder="列出获得的证书或奖项..." />
      case 'hobbies': return <SimpleSectionForm sectionKey="hobbies" label="兴趣爱好" placeholder="列出你的兴趣爱好..." />
      case 'customSections': return <CustomSectionForm />
      default: return <div className="p-4 text-sm text-muted-foreground">暂不支持编辑</div>
    }
  }

  return (
    <div ref={setNodeRef} style={style} className={cn("bg-white mb-2", isDragging && "opacity-50")}>
      <AccordionItem value={id} className="border rounded-md px-2 shadow-sm bg-white">
        <div className="flex items-center">
          <button 
            {...attributes} 
            {...listeners} 
            className="p-2 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 rounded"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <AccordionTrigger className="flex-1 py-3 hover:no-underline px-2 font-medium text-gray-700">
             {SECTION_LABELS[id] || id}
          </AccordionTrigger>
        </div>
        <AccordionContent className="px-2 pb-4 pt-2">
          {renderForm()}
        </AccordionContent>
      </AccordionItem>
    </div>
  )
}
