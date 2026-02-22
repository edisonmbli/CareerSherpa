import { notFound } from 'next/navigation'
import { getSharedResumeByKey } from '@/lib/dal/resumeShare'
import { PublicResumeViewer } from '@/components/resume/share/PublicResumeViewer'
import { SharedResumeLayout } from '@/components/resume/share/SharedResumeLayout'
import { ShareViewTracker } from '@/components/resume/share/ShareViewTracker'
import { Locale } from '@/i18n-config'
import { Metadata } from 'next'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { stackServerApp } from '@/stack/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Clock, Ban } from 'lucide-react'

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
  const result = await getSharedResumeByKey(shareKey)
  const user = await stackServerApp.getUser()

  if (result.status === 'not_found') {
    notFound()
  }

  if (result.status === 'expired' || result.status === 'disabled') {
    const isExpired = result.status === 'expired'
    const statusCopy = dict.resume.share.public.status
    return (
      <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 right-[-10%] h-80 w-80 rounded-full bg-sky-200/60 blur-3xl" />
          <div className="absolute -bottom-40 left-[-10%] h-80 w-80 rounded-full bg-amber-100/70 blur-3xl" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-transparent to-white/80" />
        </div>
        <div className="relative mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200/70 bg-white/90 shadow-[0_30px_80px_-60px_rgba(15,23,42,0.35)] backdrop-blur">
            <div className="flex flex-col items-center gap-6 px-8 py-10">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                {isExpired ? statusCopy.expiredBadge : statusCopy.disabledBadge}
              </span>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-[0_16px_40px_-24px_rgba(15,23,42,0.7)]">
                {isExpired ? <Clock className="h-7 w-7" /> : <Ban className="h-7 w-7" />}
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                  {isExpired ? statusCopy.expiredTitle : statusCopy.disabledTitle}
                </h1>
                <p className="text-sm leading-relaxed text-slate-500">
                  {isExpired ? statusCopy.expiredDesc : statusCopy.disabledDesc}
                </p>
              </div>
              <div className="w-full space-y-3">
                <Button asChild className="w-full">
                  <Link href={`/${locale}`}>{statusCopy.cta}</Link>
                </Button>
                <p className="text-xs text-slate-400">{statusCopy.ctaHint}</p>
              </div>
            </div>
          </div>
          <div className="mt-8 text-xs text-slate-400">
            {dict.resume.share.public.footerText}
          </div>
        </div>
      </div>
    )
  }

  const data = result.data
  const { customizedResume } = data
  const { customizedResumeJson, editedResumeJson, sectionConfig, ops_json } = customizedResume

  // Determine which data to use (edited takes precedence)
  const finalResumeData = editedResumeJson || customizedResumeJson
  const finalSectionConfig = sectionConfig
  
  // Parse ops_json for styleConfig
  const ops = ops_json as any
  const templateId = ops?.currentTemplate || 'standard'
  const isOwner = user?.id && data.userId && user.id === data.userId
  const avatarUrl = data.share?.avatarUrl ?? null

  return (
    <div className="min-h-screen bg-slate-100/50 relative pb-20 print:bg-white print:pb-0">
      <ShareViewTracker shareKey={shareKey} templateId={templateId} />
      
      <SharedResumeLayout
        locale={locale}
        showHook={!isOwner}
        text={dict.resume.share.public}
      >
        <PublicResumeViewer 
          serviceId={data.id}
          resumeData={finalResumeData}
          sectionConfig={finalSectionConfig}
          opsJson={ops}
          avatarUrl={avatarUrl}
        />
      </SharedResumeLayout>
    </div>
  )
}
