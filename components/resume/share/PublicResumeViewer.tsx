'use client'

import { useEffect, useMemo, useState } from 'react'
import { useResumeStore } from '@/store/resume-store'
import { uiLog } from '@/lib/ui/sse-debug-logger'
import { ResumePreview } from '@/components/resume/editor/ResumePreview'
import { Loader2 } from 'lucide-react'

interface PublicResumeViewerProps {
  serviceId: string
  resumeData: any
  sectionConfig: any
  opsJson?: any
  avatarUrl?: string | null
}

export function PublicResumeViewer({
  serviceId,
  resumeData,
  sectionConfig,
  opsJson,
  avatarUrl,
}: PublicResumeViewerProps) {
  const { initStore } = useResumeStore()
  const storeStyleConfig = useResumeStore((state) => state.styleConfig)
  const storeTemplateId = useResumeStore((state) => state.currentTemplate)
  const [ready, setReady] = useState(false)
  const mergedResumeData = useMemo(() => {
    if (!resumeData) return resumeData
    if (!avatarUrl) return resumeData
    return {
      ...resumeData,
      basics: {
        ...(resumeData.basics || {}),
        photoUrl: avatarUrl,
      },
    }
  }, [resumeData, avatarUrl])

  useEffect(() => {
    // Initialize store in ReadOnly mode
    initStore(
      serviceId,
      mergedResumeData,
      null, // originalData
      sectionConfig,
      null, // suggestion
      opsJson,
      true, // readOnly
    )
    setReady(true)
  }, [
    serviceId,
    mergedResumeData,
    sectionConfig,
    opsJson,
    initStore,
  ])

  useEffect(() => {
    if (!ready) return
    uiLog.info('share_viewer_style_state', {
      serviceId,
      opsTemplateId: opsJson?.currentTemplate,
      storeTemplateId,
      opsStyleConfig: opsJson?.styleConfig,
      storeStyleConfig,
    })
  }, [
    ready,
    serviceId,
    storeTemplateId,
    opsJson,
    storeStyleConfig,
  ])

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
      </div>
    )
  }

  return (
    <div className="flex justify-center w-full">
      <div className="w-full max-w-[210mm] shadow-2xl print:shadow-none">
        <ResumePreview
          templateId={storeTemplateId as any}
          data={mergedResumeData}
          config={sectionConfig}
        />
      </div>
    </div>
  )
}
