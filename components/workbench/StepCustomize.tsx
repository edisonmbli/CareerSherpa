'use client'

import { useEffect, useRef } from 'react'
import { useResumeStore } from '@/store/resume-store'
import type { ResumeData, SectionConfig } from '@/lib/types/resume-schema'
import { ResumeEditorLayout } from '@/components/resume/editor/ResumeEditorLayout'
import { useExitProtection } from '@/hooks/use-exit-protection'
import { SaveIndicator } from '@/components/ui/SaveIndicator'

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
  const { initStore } = useResumeStore()

  // Enable exit protection for unsaved changes
  useExitProtection()

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
      <ResumeEditorLayout ctaAction={ctaAction} />

      {/* Mobile floating save button - hidden on desktop (toolbar has inline version) */}
      <div className="md:hidden">
        <SaveIndicator variant="floating" />
      </div>
    </div>
  )
}
