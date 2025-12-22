'use client'

import { useResumeStore } from '@/store/resume-store'
import { cn } from '@/lib/utils'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical,
  Eye,
  EyeOff,
  X,
  ChevronRight,
  User,
  FileText,
  Briefcase,
  FolderGit2,
  GraduationCap,
  Wrench,
  Award,
  Heart,
  Layers,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const SECTION_LABELS: Record<string, string> = {
  basics: '基本信息',
  summary: '个人总结',
  workExperiences: '工作经历',
  projectExperiences: '项目经历',
  educations: '教育经历',
  skills: '技能特长',
  certificates: '证书奖项',
  hobbies: '兴趣爱好',
  customSections: '自定义板块',
}

const SECTION_ICONS: Record<string, any> = {
  basics: User,
  summary: FileText,
  workExperiences: Briefcase,
  projectExperiences: FolderGit2,
  educations: GraduationCap,
  skills: Wrench,
  certificates: Award,
  hobbies: Heart,
  customSections: Layers,
}

function SortableItem({
  id,
  label,
  isActive,
  isHidden,
  onClick,
  onToggle,
  isMobile,
}: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : undefined,
    position: isDragging ? 'relative' : undefined,
  } as React.CSSProperties

  const Icon = SECTION_ICONS[id] || Layers

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative flex items-center gap-3 rounded-md mb-1 transition-all group overflow-hidden select-none',
        isMobile
          ? 'py-3 px-3 border border-gray-100 bg-white dark:bg-zinc-900 dark:border-zinc-800'
          : 'p-2',
        isActive && !isMobile
          ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-medium'
          : 'hover:bg-gray-100 dark:hover:bg-zinc-800/50 text-gray-700 dark:text-gray-300',
        isDragging &&
          'opacity-50 bg-gray-50 dark:bg-zinc-800 ring-2 ring-blue-500/20 z-50 shadow-lg',
        isHidden && 'opacity-60 grayscale'
      )}
      onClick={onClick}
    >
      {/* Active Indicator Strip */}
      {isActive && !isMobile && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 rounded-l-md" />
      )}

      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className={cn(
          'cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded transition-opacity',
          isMobile
            ? 'p-1 opacity-100'
            : 'p-0.5 opacity-0 group-hover:opacity-100 focus:opacity-100'
        )}
      >
        <GripVertical className={cn('h-4 w-4', isMobile && 'h-5 w-5')} />
      </button>

      {/* Section Icon */}
      <div
        className={cn(
          'flex items-center justify-center rounded-md transition-colors',
          isActive && !isMobile
            ? 'text-blue-600 dark:text-blue-400'
            : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'
        )}
      >
        <Icon className={cn('h-4 w-4', isMobile && 'h-5 w-5')} />
      </div>

      <span
        className={cn(
          'flex-1 text-sm truncate',
          isMobile && 'text-base font-normal'
        )}
      >
        {label}
      </span>

      <Button
        variant="ghost"
        size="icon"
        type="button"
        className={cn(
          'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-opacity',
          isMobile
            ? 'h-8 w-8 opacity-100'
            : 'h-6 w-6 opacity-0 group-hover:opacity-100 focus:opacity-100'
        )}
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
      >
        {isHidden ? (
          <EyeOff className={cn('h-3.5 w-3.5', isMobile && 'h-5 w-5')} />
        ) : (
          <Eye className={cn('h-3.5 w-3.5', isMobile && 'h-5 w-5')} />
        )}
      </Button>

      {isMobile && (
        <div className="flex items-center text-gray-400">
          <ChevronRight className="h-5 w-5" />
        </div>
      )}
    </div>
  )
}

interface StructureOutlineProps {
  isMobile?: boolean
  onClose?: () => void
}

export function StructureOutline({ isMobile, onClose }: StructureOutlineProps) {
  const {
    sectionConfig,
    reorderSection,
    activeSectionKey,
    setActive,
    toggleSectionVisibility,
    setStructureOpen,
  } = useResumeStore()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = sectionConfig.order.indexOf(active.id as string)
      const newIndex = sectionConfig.order.indexOf(over.id as string)
      reorderSection(arrayMove(sectionConfig.order, oldIndex, newIndex))
    }
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-zinc-900 transition-colors">
      {!isMobile && (
        <div className="p-3 flex items-center justify-between sticky top-0 bg-white dark:bg-zinc-900 z-10 border-b border-transparent">
          <h3 className="font-medium text-sm text-muted-foreground pl-1">
            简历结构
          </h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => setStructureOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      <div
        className={cn(
          'flex-1 overflow-y-auto px-4 pb-2',
          isMobile ? 'pt-0' : 'pt-2 px-3'
        )}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sectionConfig.order}
            strategy={verticalListSortingStrategy}
          >
            <div className={cn('space-y-1', isMobile && 'space-y-3')}>
              {sectionConfig.order.map((sectionKey) => (
                <SortableItem
                  key={sectionKey}
                  id={sectionKey}
                  label={SECTION_LABELS[sectionKey] || sectionKey}
                  isActive={activeSectionKey === sectionKey}
                  isHidden={sectionConfig.hidden.includes(sectionKey)}
                  onClick={() => setActive(sectionKey)}
                  onToggle={() => toggleSectionVisibility(sectionKey)}
                  isMobile={isMobile}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  )
}
