'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  AssetUploader,
  type AssetUploaderHandle,
} from '@/components/app/AssetUploader'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Eye, RotateCw, UserRound, Lock } from 'lucide-react'

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
  const [isReuploading, setIsReuploading] = useState(false)

  const normalizeProfile = useCallback((data: any): ParsedProfile | null => {
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
  }, [])

  useEffect(() => {
    if (!resumeCompleted || !clientProfile) {
      setIsReuploading(false)
      setMode('dual')
      return
    }
    setMode(isReuploading ? 'uploader' : 'profile')
  }, [resumeCompleted, clientProfile, isReuploading])

  useEffect(() => {
    setResumeCompleted(hasGeneral)
  }, [hasGeneral])

  useEffect(() => {
    setClientProfile(normalizedProfile)
  }, [normalizedProfile])

  useEffect(() => {
    if (!normalizedProfile && resumeSummaryJson?.parsed_profile_json) {
      const normalized = normalizeProfile(resumeSummaryJson.parsed_profile_json)
      if (normalized) setClientProfile(normalized)
    }
  }, [normalizedProfile, resumeSummaryJson, normalizeProfile])

  const profileData = clientProfile

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

  const handleSummaryJson = useCallback(
    (json: any) => {
      if (!json) return
      setResumeCompleted(true)
      setIsReuploading(false)
      const parsed = json?.parsed_profile_json
      const normalized = normalizeProfile(parsed)
      if (normalized) {
        setClientProfile(normalized)
        setMode('profile')
      }
    },
    [normalizeProfile],
  )

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
        hideActions={!isReuploading}
        neutralComplete
        hidePreviewAction
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
      isReuploading,
    ],
  )

  const profilePanelNode = (
    <div
      className={cn(
        'h-full flex flex-col rounded-xl p-6 relative overflow-hidden transition-all duration-500',
        resumeCompleted
          ? 'bg-white/60 dark:bg-white/5 border border-slate-200/60 dark:border-white/10'
          : 'bg-white/60 dark:bg-white/5 border border-slate-200/60 dark:border-white/10',
      )}
    >
      {!resumeCompleted && (
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
      <div className={cn(!resumeCompleted && 'hidden')}>
        {profileData && (
          <div className="mt-2 space-y-5 text-sm">
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
                        className="bg-blue-500/10 text-blue-300 border border-blue-500/20 rounded-full px-3 py-1 text-xs"
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
                        className="bg-blue-500/10 text-blue-300 border border-blue-500/20 rounded-full px-3 py-1 text-xs"
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
                <div className="bg-white/40 dark:bg-white/5 rounded-lg p-4 mt-1 border border-slate-200/60 dark:border-white/10">
                  <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                    SIGNATURE PROJECT
                  </div>
                  {profileData.signature_project.project_name && (
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                      {profileData.signature_project.project_name}
                    </div>
                  )}
                  {profileData.signature_project.core_impact && (
                    <div className="mt-2 space-y-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      <div className="flex items-start gap-2">
                        <span className="mt-1 h-2 w-2 rounded-full bg-emerald-400/90 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                        <span className="flex-1">
                          {renderImpact(
                            profileData.signature_project.core_impact,
                          )}
                        </span>
                      </div>
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
                      <span className="mt-1 h-2 w-2 rounded-full bg-blue-400/90 shadow-[0_0_8px_rgba(96,165,250,0.55)]" />
                      <div className="text-sm">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {item.trait}:
                        </span>{' '}
                        <span className="text-slate-500 dark:text-slate-300">
                          {item.evidence}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {resumeCompleted && (
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
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="text-xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                {profileData.career_persona}
              </div>
              <div className="text-zinc-400 italic text-sm mt-1">
                {profileData.experience_focus}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-sm text-zinc-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/10 transition-colors"
                onClick={() => uploaderRef.current?.openPreview()}
              >
                <Eye className="h-3.5 w-3.5 mr-1" />
                {uploaderDict.preview}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-base text-zinc-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/10 transition-colors"
                onClick={() => setIsReuploading((prev) => !prev)}
              >
                {isReuploading ? (
                  <UserRound className="h-3.5 w-3.5 mr-1" />
                ) : (
                  <RotateCw className="h-3.5 w-3.5 mr-1" />
                )}
                {isReuploading
                  ? profilePanel.backToProfile
                  : profilePanel.updateResume}
              </Button>
            </div>
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
