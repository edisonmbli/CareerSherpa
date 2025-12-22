'use client'

import { useEffect, useRef } from 'react'
import { useResumeStore } from '@/store/resume-store'
import type { ResumeData, SectionConfig } from '@/lib/types/resume-schema'
import { ResumeEditorLayout } from '@/components/resume/editor/ResumeEditorLayout'
import { Loader2 } from 'lucide-react'

interface StepCustomizeProps {
  serviceId: string
  initialData: ResumeData
  initialConfig?: SectionConfig
  originalData?: ResumeData
  optimizeSuggestion?: string | null
  initialOpsJson?: any
  ctaAction?: React.ReactNode
}

export function StepCustomize({
  serviceId,
  initialData,
  initialConfig,
  originalData,
  optimizeSuggestion,
  initialOpsJson,
  ctaAction,
}: StepCustomizeProps) {
  const { initStore, isSaving } = useResumeStore()

  const initialized = useRef(false)

  useEffect(() => {
    if (!initialized.current) {
      initStore(
        serviceId,
        initialData,
        originalData || null,
        initialConfig,
        optimizeSuggestion,
        initialOpsJson
      )
      initialized.current = true
    }
  }, [
    serviceId,
    initialData,
    originalData,
    initialConfig,
    optimizeSuggestion,
    initialOpsJson,
    initStore,
  ])

  return (
    <div className="h-full w-full relative">
      {/* Auto-save indicator overlay */}
      <div className="absolute top-4 right-20 z-50 pointer-events-none">
        {isSaving && (
          <div className="flex items-center gap-2 text-xs text-blue-600 bg-white/90 px-3 py-1.5 rounded-full shadow-sm border backdrop-blur-sm transition-all duration-200">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>自动保存中...</span>
          </div>
        )}
      </div>

      <ResumeEditorLayout ctaAction={ctaAction} />
    </div>
  )
}
