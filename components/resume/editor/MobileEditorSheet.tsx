'use client'

import { useResumeStore } from '@/store/resume-store'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { EditorSidebar } from './EditorSidebar'

interface MobileEditorSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MobileEditorSheet({ open, onOpenChange }: MobileEditorSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] flex flex-col p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle>编辑简历</SheetTitle>
          <SheetDescription>
            在移动端仅支持内容编辑，排版请使用电脑端
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-hidden">
           <EditorSidebar />
        </div>
      </SheetContent>
    </Sheet>
  )
}
