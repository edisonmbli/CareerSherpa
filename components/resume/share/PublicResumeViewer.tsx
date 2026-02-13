'use client'

import { useEffect, useState } from 'react'
import { useResumeStore } from '@/store/resume-store'
import { ResumePreview } from '@/components/resume/editor/ResumePreview'
import { Loader2 } from 'lucide-react'

interface PublicResumeViewerProps {
  serviceId: string
  resumeData: any
  sectionConfig: any
  styleConfig: any
  templateId: string
}

export function PublicResumeViewer({
  serviceId,
  resumeData,
  sectionConfig,
  styleConfig,
  templateId,
}: PublicResumeViewerProps) {
  const { initStore } = useResumeStore()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Initialize store in ReadOnly mode
    initStore(
      serviceId,
      resumeData,
      null, // originalData
      sectionConfig,
      null, // suggestion
      { styleConfig, currentTemplate: templateId }, // opsJson (mock)
      true // readOnly
    )
    setReady(true)
  }, [serviceId, resumeData, sectionConfig, styleConfig, templateId, initStore])

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
            templateId={templateId as any} 
            data={resumeData} 
            config={sectionConfig} 
          />
       </div>
    </div>
  )
}
