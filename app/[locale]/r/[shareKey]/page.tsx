import { notFound } from 'next/navigation'
import { getSharedResumeByKey } from '@/lib/dal/resumeShare'
import { PublicResumeViewer } from '@/components/resume/share/PublicResumeViewer'
import { PublicResumeHook } from '@/components/resume/share/PublicResumeHook'
import { ShareViewTracker } from '@/components/resume/share/ShareViewTracker'
import { Locale } from '@/i18n-config'
import { Metadata } from 'next'
import { getDictionary } from '@/lib/i18n/dictionaries'

interface PageProps {
  params: Promise<{
    locale: Locale
    shareKey: string
  }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const dict = await getDictionary(locale)
  return {
    title: dict.resume.share.public.metaTitle,
    description: dict.resume.share.public.metaDesc,
    robots: {
      index: false, // Don't index shared resumes by default to protect privacy
      follow: false,
    }
  }
}

export default async function SharedResumePage({ params }: PageProps) {
  const { locale, shareKey } = await params

  const dict = await getDictionary(locale)
  const data = await getSharedResumeByKey(shareKey)

  if (!data || !data.resume || !data.customizedResume) {
    notFound()
  }

  const { customizedResume } = data
  const { customizedResumeJson, editedResumeJson, sectionConfig, ops_json } = customizedResume

  // Determine which data to use (edited takes precedence)
  const finalResumeData = editedResumeJson || customizedResumeJson
  const finalSectionConfig = sectionConfig
  
  // Parse ops_json for styleConfig
  const ops = ops_json as any
  const styleConfig = ops?.styleConfig || {}
  const templateId = ops?.currentTemplate || 'standard'

  return (
    <div className="min-h-screen bg-slate-100/50 relative pb-20 print:bg-white print:pb-0">
      <ShareViewTracker shareKey={shareKey} templateId={templateId} />
      
      <main className="container mx-auto px-0 sm:px-4 py-8 print:p-0 print:max-w-none">
        <PublicResumeViewer 
          serviceId={data.id}
          resumeData={finalResumeData}
          sectionConfig={finalSectionConfig}
          styleConfig={styleConfig}
          templateId={templateId}
        />
      </main>

      <PublicResumeHook
        locale={locale}
        text={dict.resume.share.public}
      />
    </div>
  )
}
