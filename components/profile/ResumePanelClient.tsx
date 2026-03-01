'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  AssetUploader,
  type AssetUploaderHandle,
} from '@/components/app/AssetUploader'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Check, Lock, Sparkles } from 'lucide-react'

type ParsedProfile = {
  career_persona: string
  experience_focus: string
  years_of_experience: number
  domain_expertise: string[]
  hard_skills: string[]
  signature_project: {
    project_name: string
    core_impact: string
  }
  core_strengths: Array<{
    trait: string
    evidence: string
  }>
}

type ResumePanelClientProps = {
  locale: 'en' | 'zh'
  resumeTitle: string
  resumeDescription: string
  requiredBadge: string
  detailedTitle: string
  uploaderDict: any
  pdfNotice?: string
  previewLabels: Record<string, string>
  quotaBalance: number
  statusTextDict?: any
  notificationDict?: any
  latestResumeStatus?: any
  latestResumeFileName?: string | null
  resumeSummaryJson?: any
  hasGeneral: boolean
  normalizedProfile: ParsedProfile | null
  profilePanel: {
    title: string
    emptyTitle: string
    emptyDesc: string
    lockHint: string
    cta: string
    updateResume: string
    backToProfile: string
  }
  workbenchHref: string
}

export function ResumePanelClient({
  locale,
  resumeTitle,
  resumeDescription,
  requiredBadge,
  detailedTitle,
  uploaderDict,
  pdfNotice,
  previewLabels,
  quotaBalance,
  statusTextDict,
  notificationDict,
  latestResumeStatus,
  latestResumeFileName,
  resumeSummaryJson,
  hasGeneral,
  normalizedProfile,
  profilePanel,
  workbenchHref,
}: ResumePanelClientProps) {
  const uploaderRef = useRef<AssetUploaderHandle | null>(null)
  const [resumeCompleted, setResumeCompleted] = useState(hasGeneral)
  const [clientProfile, setClientProfile] = useState<ParsedProfile | null>(
    normalizedProfile,
  )
  const [mode, setMode] = useState<'dual' | 'profile' | 'uploader'>(
    hasGeneral && normalizedProfile ? 'profile' : 'dual',
  )

  useEffect(() => {
    if (!resumeCompleted || !clientProfile) {
      setMode('dual')
      return
    }
    setMode((prev) => (prev === 'dual' ? 'profile' : prev))
  }, [resumeCompleted, clientProfile])

  useEffect(() => {
    setResumeCompleted(hasGeneral)
  }, [hasGeneral])

  useEffect(() => {
    setClientProfile(normalizedProfile)
  }, [normalizedProfile])

  const profileData = clientProfile

  const normalizeProfile = (data: any): ParsedProfile | null => {
    if (!data || typeof data !== 'object') return null
    return {
      career_persona: String(data?.career_persona || ''),
      experience_focus: String(data?.experience_focus || ''),
      years_of_experience: Number.isFinite(Number(data?.years_of_experience))
        ? Number(data?.years_of_experience)
        : 0,
      domain_expertise: Array.isArray(data?.domain_expertise)
        ? data.domain_expertise
        : [],
      hard_skills: Array.isArray(data?.hard_skills) ? data.hard_skills : [],
      signature_project:
        data?.signature_project && typeof data.signature_project === 'object'
          ? {
              project_name: String(data.signature_project.project_name || ''),
              core_impact: String(data.signature_project.core_impact || ''),
            }
          : { project_name: '', core_impact: '' },
      core_strengths: Array.isArray(data?.core_strengths)
        ? data.core_strengths
        : [],
    }
  }

  const renderImpact = (text: string) => {
    const parts = text.split(/(\d[\d.,%+]*)/g)
    return parts.map((part, idx) =>
      /\d/.test(part) ? (
        <span
          key={`impact-${idx}`}
          className="font-medium text-slate-900 dark:text-white"
        >
          {part}
        </span>
      ) : (
        <span key={`impact-${idx}`}>{part}</span>
      ),
    )
  }

  const handleSummaryJson = (json: any) => {
    if (!json) return
    setResumeCompleted(true)
    const parsed = json?.parsed_profile_json
    const normalized = normalizeProfile(parsed)
    if (normalized) {
      setClientProfile(normalized)
      setMode('profile')
    }
  }

  const uploaderNode = useMemo(
    () => (
      <AssetUploader
        ref={uploaderRef}
        className="flex-1"
        locale={locale}
        taskTemplateId="resume_summary"
        initialStatus={latestResumeStatus || 'IDLE'}
        initialFileName={latestResumeFileName ?? null}
        initialSummaryJson={resumeSummaryJson || null}
        dict={uploaderDict}
        labels={{
          ...previewLabels,
          actionPreview: uploaderDict.preview,
          actionReupload: uploaderDict.reupload,
        }}
        quotaBalance={quotaBalance}
        statusTextDict={statusTextDict}
        notificationDict={notificationDict}
        resumeTitle={resumeTitle}
        detailedTitle={detailedTitle}
        onSummaryJson={handleSummaryJson}
        hideActions
        {...(pdfNotice ? { pdfNotice } : {})}
      />
    ),
    [
      locale,
      latestResumeStatus,
      latestResumeFileName,
      resumeSummaryJson,
      uploaderDict,
      pdfNotice,
      previewLabels,
      quotaBalance,
      statusTextDict,
      notificationDict,
      resumeTitle,
      detailedTitle,
      handleSummaryJson,
    ],
  )

  const profilePanelNode = (
    <div
      className={cn(
        'h-full flex flex-col bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 rounded-xl p-6 relative overflow-hidden transition-all duration-500',
        hasGeneral
          ? 'bg-white ring-1 ring-slate-200 shadow-sm dark:bg-[#121212] dark:ring-white/10'
          : '',
      )}
    >
      {!hasGeneral && (
        <>
          <div className="opacity-40 blur-[2px] pointer-events-none select-none">
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse" />
                <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
              </div>
              <div className="space-y-2">
                <div className="h-3 w-full rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
                <div className="h-3 w-[80%] rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
                <div className="h-3 w-[65%] rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="h-6 w-16 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse" />
                <div className="h-6 w-20 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse" />
                <div className="h-6 w-14 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse" />
              </div>
            </div>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Lock className="w-8 h-8 text-slate-400 mb-3" />
            <div className="text-sm text-slate-500 dark:text-slate-400 max-w-[80%] text-center text-balance">
              {profilePanel.emptyDesc}
            </div>
          </div>
        </>
      )}
      <div className={cn(!hasGeneral && 'hidden')}>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-7 h-7 shrink-0 rounded-lg bg-slate-100 dark:bg-white/[0.06]">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <span className="text-lg font-semibold text-slate-900 dark:text-white">
            {profilePanel.title}
          </span>
        </div>
        {profileData && (
          <div className="mt-6 space-y-5 text-sm">
            <div
              className="animate-in fade-in slide-in-from-bottom-2"
              style={{ animationDelay: '0ms' }}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-600" />
                <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-transparent bg-clip-text">
                  {profileData.career_persona}
                </div>
              </div>
              <div className="text-sm text-slate-500 font-medium mt-1">
                {profileData.experience_focus}
              </div>
            </div>

            {(profileData.domain_expertise.length > 0 ||
              profileData.hard_skills.length > 0) && (
              <div
                className="animate-in fade-in slide-in-from-bottom-2"
                style={{ animationDelay: '100ms' }}
              >
                {profileData.domain_expertise.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {profileData.domain_expertise.map((tag, idx) => (
                      <span
                        key={`domain-${tag}-${idx}`}
                        className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-inset ring-blue-700/10"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {profileData.hard_skills.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {profileData.hard_skills.map((skill, idx) => (
                      <span
                        key={`skill-${skill}-${idx}`}
                        className="bg-white text-slate-600 px-2.5 py-1 rounded-full text-xs font-medium ring-1 ring-inset ring-slate-200"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {(profileData.signature_project.project_name ||
              profileData.signature_project.core_impact) && (
              <div
                className="animate-in fade-in slide-in-from-bottom-2"
                style={{ animationDelay: '200ms' }}
              >
                <div className="bg-slate-50 rounded-lg p-4 mt-1 ring-1 ring-slate-900/5">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    SIGNATURE PROJECT
                  </div>
                  {profileData.signature_project.project_name && (
                    <div className="text-sm font-semibold text-slate-900">
                      {profileData.signature_project.project_name}
                    </div>
                  )}
                  {profileData.signature_project.core_impact && (
                    <div className="text-sm text-slate-600 mt-1">
                      {renderImpact(profileData.signature_project.core_impact)}
                    </div>
                  )}
                </div>
              </div>
            )}

            {profileData.core_strengths.length > 0 && (
              <div
                className="animate-in fade-in slide-in-from-bottom-2"
                style={{ animationDelay: '300ms' }}
              >
                <div className="space-y-2">
                  {profileData.core_strengths.map((item, idx) => (
                    <div
                      key={`strength-${item.trait}-${idx}`}
                      className="flex gap-2"
                    >
                      <Check className="h-4 w-4 text-emerald-500 mt-0.5" />
                      <div className="text-sm">
                        <span className="font-semibold text-slate-900">
                          {item.trait}:
                        </span>{' '}
                        <span className="text-slate-500">{item.evidence}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {hasGeneral && (
              <Button asChild className="w-full">
                <Link href={workbenchHref}>{profilePanel.cta}</Link>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <>
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {resumeTitle}
          </h3>
          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-medium ring-1 ring-slate-900/5 dark:bg-white/10 dark:text-slate-300">
            {requiredBadge}
          </span>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {resumeDescription}
        </p>
      </div>

      {resumeCompleted && profileData ? (
        <div className="relative">
          <div className="absolute right-0 top-0 flex items-center gap-2">
            {mode === 'profile' && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => uploaderRef.current?.openPreview()}
              >
                {uploaderDict.preview}
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() =>
                setMode(mode === 'profile' ? 'uploader' : 'profile')
              }
            >
              {mode === 'profile'
                ? profilePanel.updateResume
                : profilePanel.backToProfile}
            </Button>
          </div>
          <div className="relative">
            <div
              className={cn(
                'transition-all duration-300 ease-out',
                mode === 'profile'
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-2 pointer-events-none absolute inset-0',
              )}
            >
              {profilePanelNode}
            </div>
            <div
              className={cn(
                'transition-all duration-300 ease-out',
                mode === 'uploader'
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-2 pointer-events-none absolute inset-0',
              )}
            >
              <div className="h-full flex">{uploaderNode}</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch lg:auto-rows-fr lg:[&>*]:h-full lg:[&>*]:self-stretch">
          <div className="h-full flex flex-col">{uploaderNode}</div>
          {profilePanelNode}
        </div>
      )}
    </>
  )
}
