'use client'

import { useResumeStore } from '@/store/resume-store'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Accordion } from '@/components/ui/accordion'
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
} from '@dnd-kit/sortable'
import { SortableSectionItem } from './SortableSectionItem'

export function EditorSidebar() {
  const { sectionConfig, reorderSection, activeSectionKey, setActive } =
    useResumeStore()

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
    <div className="flex h-full flex-col">
      <div className="border-b px-6 py-4">
        <h2 className="text-lg font-semibold">简历内容</h2>
        <p className="text-sm text-muted-foreground">拖拽调整板块顺序</p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sectionConfig.order}
              strategy={verticalListSortingStrategy}
            >
              <Accordion
                type="single"
                collapsible
                value={activeSectionKey || ''}
                onValueChange={(val) => setActive(val || null)}
                className="space-y-2"
              >
                {sectionConfig.order.map((sectionKey) => (
                  <SortableSectionItem key={sectionKey} id={sectionKey} />
                ))}
              </Accordion>
            </SortableContext>
          </DndContext>
        </div>
      </ScrollArea>
    </div>
  )
}
