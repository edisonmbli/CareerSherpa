'use client'

import { useState, useRef } from 'react'
import { useResumeStore } from '@/store/resume-store'
import { EditorSidebar } from './EditorSidebar'
import { ResumePreview } from './ResumePreview'
import { Button } from '@/components/ui/button'
import { useReactToPrint } from 'react-to-print'
import { Download, LayoutTemplate, RotateCcw, ChevronLeft, ChevronRight, Edit2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RESUME_TEMPLATES, TemplateId } from '../constants'
import { cn } from '@/lib/utils'
import { MobileEditorSheet } from './MobileEditorSheet'

export function ResumeEditorLayout() {
  const { isSidebarOpen, setSidebarOpen, resumeData, sectionConfig } = useResumeStore()
  const [currentTemplate, setCurrentTemplate] = useState<TemplateId>('standard')
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `${resumeData?.basics?.name || 'resume'}_CareerShaper`,
  })

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full overflow-hidden bg-gray-50/50 relative">
      {/* Sidebar - Form Editor (Desktop) */}
      <div
        className={cn(
          'hidden md:block flex-shrink-0 border-r bg-white transition-all duration-300 ease-in-out',
          isSidebarOpen ? 'w-[400px]' : 'w-0 overflow-hidden border-none'
        )}
      >
        <EditorSidebar />
      </div>

      {/* Main Content - Preview Area */}
      <div className="flex flex-1 flex-col overflow-hidden relative">
        {/* Toggle Sidebar Button (Desktop Only) */}
        <Button
          variant="ghost"
          size="icon"
          className="hidden md:flex absolute left-4 top-4 z-10 h-8 w-8 rounded-full border bg-white shadow-sm hover:bg-gray-100"
          onClick={() => setSidebarOpen(!isSidebarOpen)}
        >
          {isSidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>

        {/* Toolbar */}
        <header className="flex h-14 items-center justify-between border-b bg-white px-4 md:px-6 shadow-sm z-10">
          <div className="flex items-center gap-2 md:gap-4 md:pl-10">
            {/* Template Selector */}
            <Select
              value={currentTemplate}
              onValueChange={(v) => setCurrentTemplate(v as TemplateId)}
            >
              <SelectTrigger className="w-[140px] md:w-[180px] h-9">
                <LayoutTemplate className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="选择模板" />
              </SelectTrigger>
              <SelectContent>
                {RESUME_TEMPLATES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="hidden md:flex" onClick={() => window.location.reload()}>
              <RotateCcw className="mr-2 h-4 w-4" />
              重置
            </Button>
            <Button size="sm" onClick={() => handlePrint && handlePrint()}>
              <Download className="mr-2 h-4 w-4" />
              <span className="hidden md:inline">导出 PDF</span>
              <span className="md:hidden">PDF</span>
            </Button>
          </div>
        </header>

        {/* Preview Canvas */}
        <main className="flex-1 overflow-auto bg-gray-100 p-4 md:p-8">
          <div className="mx-auto flex justify-center pb-20">
            <ResumePreview
              ref={printRef}
              templateId={currentTemplate}
              data={resumeData}
              config={sectionConfig}
            />
          </div>
        </main>

        {/* Mobile Edit FAB */}
        <Button
          className="md:hidden absolute bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
          onClick={() => setIsMobileSheetOpen(true)}
        >
          <Edit2 className="h-6 w-6" />
        </Button>

        {/* Mobile Editor Sheet */}
        <MobileEditorSheet 
          open={isMobileSheetOpen} 
          onOpenChange={setIsMobileSheetOpen} 
        />
      </div>
    </div>
  )
}
