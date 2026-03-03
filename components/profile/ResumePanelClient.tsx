'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  AssetUploader,
  type AssetUploaderHandle,
} from '@/components/app/AssetUploader'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Eye, RotateCw, UserRound, Lock, Star, CheckCircle2 } from 'lucide-react'

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
  actions: {
    preview: string
    reupload: string
  }
  profilePanel: {
    title: string
    emptyTitle: string
    emptyDesc: string
    lockHint: string
    cta: string
    updateResume: string
    backToProfile: string
    projectLabel?: string
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
  actions,
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
  const [isTagsExpanded, setIsTagsExpanded] = useState(false)

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
        'h-full flex flex-col rounded-2xl p-5 md:p-7 relative overflow-hidden transition-all duration-500',
        resumeCompleted
          ? 'bg-slate-50/60 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5'
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
            <div className="relative w-8 h-8 text-slate-400 mb-3">
              <UserRound className="w-8 h-8" />
              <Lock className="w-3.5 h-3.5 absolute -right-0.5 -bottom-0.5 rounded-full bg-white/80 dark:bg-black/60 p-0.5" />
            </div>
            <div className="text-sm font-medium text-slate-500 dark:text-slate-400 max-w-[80%] text-center text-balance">
              {profilePanel.emptyDesc}
            </div>
          </div>
        </>
      )}
      <div className={cn(!resumeCompleted && 'hidden')}>
        {profileData && (
          <div className="space-y-5 text-sm">
            <div className="mb-4">
              <div className="text-xl md:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-slate-400 text-balance mb-2">
                {profileData.career_persona}
              </div>
              {profileData.experience_focus && (
                <div className="text-sm text-slate-500 font-medium">
                  {profileData.experience_focus}
                </div>
              )}
            </div>

            {(profileData.domain_expertise.length > 0 ||
              profileData.hard_skills.length > 0) && (() => {
                const allTags = [
                  ...profileData.domain_expertise.map(t => ({ text: t, type: 'domain' })),
                  ...profileData.hard_skills.map(t => ({ text: t, type: 'skill' }))
                ]
                return (
                  <div
                    className="animate-in fade-in slide-in-from-bottom-2 mb-6"
                    style={{ animationDelay: '100ms' }}
                  >
                    <div className="flex flex-wrap gap-2">
                      {allTags.map((tag, idx) => (
                        <span
                          key={`${tag.type}-${tag.text}-${idx}`}
                          className={cn(
                            "bg-slate-100 dark:bg-zinc-700/50 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-md text-xs font-medium border border-transparent hover:border-slate-200 transition-colors",
                            !isTagsExpanded && idx >= 6 && "hidden md:inline-flex",
                            !isTagsExpanded && idx >= 10 && "md:hidden"
                          )}
                        >
                          {tag.text}
                        </span>
                      ))}
                      {!isTagsExpanded && allTags.length > 6 && (
                        <button
                          onClick={() => setIsTagsExpanded(true)}
                          className="bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 px-2.5 py-1 rounded-md text-xs font-medium border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900 transition-all md:hidden"
                        >
                          +{allTags.length - 6} 更多
                        </button>
                      )}
                      {!isTagsExpanded && allTags.length > 10 && (
                        <button
                          onClick={() => setIsTagsExpanded(true)}
                          className="hidden md:inline-flex bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 px-2.5 py-1 rounded-md text-xs font-medium border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900 transition-all"
                        >
                          +{allTags.length - 10} 更多
                        </button>
                      )}
                      {isTagsExpanded && allTags.length > 6 && (
                        <button
                          onClick={() => setIsTagsExpanded(false)}
                          className={cn(
                            "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 px-2.5 py-1 rounded-md text-xs font-medium border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900 transition-all",
                            allTags.length <= 10 && "md:hidden"
                          )}
                        >
                          收起
                        </button>
                      )}
                    </div>
                  </div>
                )
              })()}

            {(profileData.signature_project.project_name ||
              profileData.signature_project.core_impact) && (
                <div
                  className="animate-in fade-in slide-in-from-bottom-2 mt-6"
                  style={{ animationDelay: '200ms' }}
                >
                  <div className="bg-gradient-to-br from-indigo-50/50 to-white dark:from-indigo-900/10 dark:to-[#1A1A1A] rounded-xl p-5 border border-indigo-100/50 dark:border-indigo-500/10 shadow-sm relative overflow-hidden">
                    <div className="text-[11px] font-bold text-sky-500/50 dark:text-sky-400/50 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 text-sky-500/50 dark:text-sky-400/50" /> {profilePanel.projectLabel || 'SIGNATURE PROJECT'}
                    </div>
                    {profileData.signature_project.project_name && (
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {profileData.signature_project.project_name}
                      </div>
                    )}
                    {profileData.signature_project.core_impact && (
                      <div className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                        {renderImpact(
                          profileData.signature_project.core_impact,
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

            {profileData.core_strengths.length > 0 && (
              <div
                className="animate-in fade-in slide-in-from-bottom-2 mt-6 space-y-4"
                style={{ animationDelay: '300ms' }}
              >
                {profileData.core_strengths.map((item, idx) => (
                  <div
                    key={`strength-${item.trait}-${idx}`}
                    className="flex items-start gap-3"
                  >
                    <CheckCircle2 className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div className="text-sm">
                      <span className="font-semibold text-slate-900 dark:text-white mr-1.5">
                        {item.trait}:
                      </span>
                      <span className="text-slate-600 dark:text-slate-400 leading-relaxed text-pretty">
                        {item.evidence}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <>
      <div className="mb-6">
        <div className="flex flex-row items-start justify-between gap-4 mb-2">
          <div className="flex items-center gap-3 min-w-0">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white truncate">
              {resumeTitle}
            </h3>
            <span className="shrink-0 bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-medium ring-1 ring-slate-900/5 dark:bg-white/10 dark:text-slate-300">
              {requiredBadge}
            </span>
          </div>

          {resumeCompleted && profileData && (
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-sm text-zinc-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/10 transition-colors"
                onClick={() => uploaderRef.current?.openPreview()}
              >
                <Eye className="h-3.5 w-3.5 sm:mr-1" />
                <span className="hidden sm:inline">{actions.preview}</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-sm text-zinc-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/10 transition-colors"
                onClick={() => setIsReuploading((prev) => !prev)}
              >
                {isReuploading ? (
                  <UserRound className="h-3.5 w-3.5 sm:mr-1" />
                ) : (
                  <RotateCw className="h-3.5 w-3.5 sm:mr-1" />
                )}
                <span className="hidden sm:inline">
                  {isReuploading ? profilePanel.backToProfile : actions.reupload}
                </span>
              </Button>
            </div>
          )}
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-3xl">
          {resumeDescription}
        </p>
      </div>

      {resumeCompleted && profileData ? (
        <div className="relative">
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
