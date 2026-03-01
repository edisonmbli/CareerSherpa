'use client'
import {
  useState,
  useTransition,
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react'
import { estimateEtaMinutes } from '@/lib/llm/config'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Upload, FileCheck, FileText } from 'lucide-react'
import { toast } from '@/components/ui/use-toast'
import { useTaskPolling } from '@/lib/hooks/useTaskPolling'
import { uploadAssetFormDataAction } from '@/lib/actions/asset.actions'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  getLatestResumeSummaryAction,
  getLatestDetailedSummaryAction,
} from '@/lib/actions/resume.actions'
import { Info } from 'lucide-react'
import { AssetPreview } from './AssetPreview'
import { useServiceGuard } from '@/lib/hooks/use-service-guard'
import { getServiceErrorMessage } from '@/lib/utils/service-error-handler'
import { uiLog } from '@/lib/ui/sse-debug-logger'
import { ServiceNotification } from '@/components/common/ServiceNotification'
import { getTaskCost } from '@/lib/constants'

type UploaderStatus = 'IDLE' | 'UPLOADING' | 'PENDING' | 'COMPLETED' | 'FAILED'

export type AssetUploaderHandle = {
  openPreview: () => void
}

type AssetUploaderProps = {
  locale: 'en' | 'zh'
  taskTemplateId: 'resume_summary' | 'detailed_resume_summary'
  initialStatus: UploaderStatus
  initialFileName: string | null
  initialSummaryJson?: any
  dict: {
    button: string
    buttonProcessing: string
    status: {
      pending: string
      completed: string
      failed: string
      uploadSuccess?: string
      parseComplete?: string
    }
    // This usage is incorrect for replace_file_content, must use multi_replace...
    // Switching to multi_replace_file_content tool logic below.
    preview: string
    reupload: string
    chooseFile: string
    noFileSelected: string
    placeholderHintResume: string
    placeholderHintDetailed: string
    suggestionTextResume: string
    suggestionTextDetailed: string
    dropzoneResumeTitle?: string
    dropzoneDetailedTitle?: string
    dropzoneHintResume?: string
    dropzoneHintDetailed?: string
    requiredLabel?: string
    processingMarquee: string
    etaMarqueeMinTemplate: string
    lastUpdatedLabel: string
    toast: {
      uploadSuccess: string
      queueFree: string
      queueError: string
      pollSuccess: string
      pollFailed: string
      pollFailedRefund?: string
      copiedJson?: string
      copiedMd?: string
    }
    time?: {
      secAgo: string
      minAgo: string
      hrAgo: string
    }
    timeline: {
      uploaded: string
      queued: string
      parsing: string
      finalizing: string
      completed: string
      failed: string
    }
    fileTooLarge2MB?: string
    fileTooLarge4MB?: string
    modelOverloaded?: string
    resume?: { title: string }
    detailed?: { title: string }
  }
  pdfNotice?: string
  labels?: {
    previewTitle?: string
    header?: string
    summary?: string
    summaryPoints?: string
    specialties?: string
    experience?: string
    projects?: string
    education?: string
    skills?: string
    certifications?: string
    languages?: string
    awards?: string
    openSource?: string
    extras?: string
    stack?: string
    capabilities?: string
    contributions?: string
    courses?: string
    link?: string
    metric?: string
    task?: string
    action?: string
    result?: string
    actionPreview?: string
    actionReupload?: string
  }
  quotaBalance: number
  statusTextDict?: any
  notificationDict?: any
  resumeTitle?: string
  detailedTitle?: string
  dimmed?: boolean
  className?: string
  onSummaryJson?: (json: any) => void
  hideActions?: boolean
}

export const AssetUploader = forwardRef<
  AssetUploaderHandle,
  AssetUploaderProps
>(function AssetUploader(
  {
    locale,
    taskTemplateId,
    initialStatus,
    initialFileName,
    initialSummaryJson,
    dict,
    labels,
    quotaBalance,
    statusTextDict,
    notificationDict,
    resumeTitle,
    detailedTitle,
    dimmed,
    className,
    onSummaryJson,
    hideActions,
  },
  ref,
) {
  const [status, setStatus] = useState<UploaderStatus>(initialStatus)
  const [fileName, setFileName] = useState<string | null>(initialFileName)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [showPreview, setShowPreview] = useState(false)
  const [summaryJson, setSummaryJson] = useState<any>(
    initialSummaryJson || null,
  )
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [startTs, setStartTs] = useState<number | null>(null)
  const [isFree, setIsFree] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [progressValue, setProgressValue] = useState(0)
  const [isFinishing, setIsFinishing] = useState(false)
  const [notification, setNotification] = useState<{
    type: 'error' | 'success' | 'info'
    title: string
    description: string
  } | null>(null)
  const [pollError, setPollError] = useState<string | null>(null)
  const [isDragActive, setIsDragActive] = useState(false)

  const showError = (title: string, description: string) => {
    setNotification({ type: 'error', title, description })
  }

  // --- Service Guard Integration ---
  const executeUpload = (formData: FormData) => {
    setFileName((formData.get('assetFile') as File).name)
    setStatus('UPLOADING')
    setNotification(null) // Clear previous errors

    startTransition(async () => {
      try {
        const res = await uploadAssetFormDataAction({
          formData,
          locale,
          taskTemplateId,
        })
        if (res.success) {
          setTaskId(res.taskId ?? null)
          setStatus('PENDING')
          setStartTs(Date.now())
          setIsFree(Boolean(res.isFree))
          setProgressValue(5) // Initial jump

          if (res.isFree) {
            // Toast removed as per feedback
          }
          // Toast success removed as per feedback
        } else {
          setStatus('IDLE')
          const err = getServiceErrorMessage(res.error || 'unknown_error', {
            statusText: statusTextDict,
            notification: notificationDict,
          })
          showError(err.title, err.description)
        }
      } catch (e) {
        setStatus('IDLE')
        showError(dict.toast.queueError, '')
      }
    })
  }

  const { execute, GuardDialog } = useServiceGuard({
    quotaBalance,
    cost: getTaskCost(
      taskTemplateId === 'resume_summary'
        ? 'resume_summary'
        : 'detailed_resume_summary',
    ),
    dict: notificationDict,
    onConfirm: () => {
      // logic handled locally via ref
    },
  })

  // --- Progress Simulation ---
  // Standard time: Resume ~1.5m (90s), Detailed ~2.5m (150s)
  const expectedDurationSec = taskTemplateId === 'resume_summary' ? 90 : 150

  useEffect(() => {
    if (status !== 'PENDING' || isFinishing) return

    // Update every 15 seconds
    const interval = setInterval(() => {
      setProgressValue((prev) => {
        if (prev >= 95) return 95
        // Linear increment based on 15s checks
        const step = Math.ceil(90 / (expectedDurationSec / 15))
        return Math.min(95, prev + step)
      })
    }, 15000)

    return () => clearInterval(interval)
  }, [status, expectedDurationSec, isFinishing])

  useEffect(() => {
    if (status === 'COMPLETED') setProgressValue(100)
  }, [status])

  // Use Ref to store current form data for the callback
  const pendingFormRef = useRef<FormData | null>(null)

  // Re-declare execute with correct binding
  const { execute: executeGuard, GuardDialog: DialogNode } = useServiceGuard({
    quotaBalance,
    cost: getTaskCost(
      taskTemplateId === 'resume_summary'
        ? 'resume_summary'
        : 'detailed_resume_summary',
    ),
    dict: notificationDict,
    onConfirm: () => {
      if (pendingFormRef.current) {
        executeUpload(pendingFormRef.current)
        pendingFormRef.current = null
      }
    },
    // Note: useServiceGuard in its current definition might not support passing autoDismiss directly
    // if it handles the dialog only. The ServiceNotification component handles autoDismiss.
    // However, the error display (showError) uses ServiceNotification directly below, which allows us to set autoDismiss.
    // The rate limit notification from useServiceGuard is internal to it.
    // We should check useServiceGuard implementation.
    // IF useServiceGuard doesn't support custom autoDismiss, we might be limited.
    // BUT for now, let's fix what we control in AssetUploader.
  })

  const [copyFeedback, setCopyFeedback] = useState<'json' | 'md' | null>(null)

  const handleCopy = (type: 'json' | 'md', text: string) => {
    navigator.clipboard.writeText(text)
    setCopyFeedback(type)
    setTimeout(() => setCopyFeedback(null), 2000)
  }

  // Use props 'labels' strictly, fallback to empty string if missing to avoid hardcoded English
  const L = {
    header: labels?.header ?? 'Header',
    summary: labels?.summary ?? 'Summary',
    summaryPoints: labels?.summaryPoints ?? 'Summary Points',
    specialties: labels?.specialties ?? 'Specialties',
    experience: labels?.experience ?? 'Experience',
    projects: labels?.projects ?? 'Projects',
    education: labels?.education ?? 'Education',
    skills: labels?.skills ?? 'Skills',
    certifications: labels?.certifications ?? 'Certifications',
    languages: labels?.languages ?? 'Languages',
    awards: labels?.awards ?? 'Awards',
    openSource: labels?.openSource ?? 'Open Source',
    extras: labels?.extras ?? 'Extras',
    stack: labels?.stack ?? 'Stack',
    capabilities: labels?.capabilities ?? 'Capabilities',
    contributions: labels?.contributions ?? 'Contributions',
    courses: labels?.courses ?? 'Courses',
    link: labels?.link ?? 'Link',
    metric: labels?.metric ?? 'Metric',
    task: labels?.task ?? 'TASK',
    action: labels?.action ?? 'ACTION',
    result: labels?.result ?? 'RESULT',
    previewTitle: labels?.previewTitle ?? 'Preview',
    actionPreview: labels?.actionPreview ?? 'Preview',
    actionReupload: labels?.actionReupload ?? 'Reupload',
    ...labels,
  }

  const {
    status: pollStatus,
    lastUpdated,
    attempts,
  } = useTaskPolling({
    taskId,
    taskType:
      taskTemplateId === 'resume_summary' ? 'resume' : 'detailed_resume',
    enabled: status === 'PENDING' && !isFinishing,
    onSuccess: () => {
      // Logic for smooth transition:
      // 1. Show 100% progress
      // 2. Show "Parse Complete" text
      // 3. Wait 1.5s then switch to COMPLETED view
      setIsFinishing(true)
      setProgressValue(100)

      startTransition(async () => {
        try {
          // Pre-fetch data while showing success state
          const res =
            taskTemplateId === 'resume_summary'
              ? await getLatestResumeSummaryAction()
              : await getLatestDetailedSummaryAction()
          if ((res as any)?.ok) {
            const nextData = (res as any)?.data || null
            setSummaryJson(nextData)
            onSummaryJson?.(nextData)
            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('resume:summary', {
                  detail: { taskTemplateId, summaryJson: nextData },
                }),
              )
            }
          }

          setTimeout(() => {
            setStatus('COMPLETED')
            setIsFinishing(false)
            // Toast removed as per feedback (inline message used instead)
          }, 1500)
        } catch {
          setStatus('COMPLETED') // Fallback
          setIsFinishing(false)
        }
      })
    },
    onError: (errMsg?: string) => {
      setStatus('FAILED')
      // Determine error text
      let displayError = errMsg

      // If "Model overloaded" (checked loosely matches 503 message from backend or mapped one)
      if (errMsg && (errMsg.includes('503') || errMsg.includes('overloaded'))) {
        displayError = dict.modelOverloaded || 'Model Overloaded'
      } else if (!displayError || (errMsg && /^[a-z_]+$/.test(errMsg))) {
        // If it looks like a raw error code (e.g. "enqueue_failed") or is empty, use generic message
        uiLog.error('asset_uploader_raw_error', { error: errMsg })
        displayError = isFree
          ? dict.toast.pollFailed
          : dict.toast.pollFailedRefund || dict.toast.pollFailed
      }

      setPollError(displayError)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('resume:summary', {
            detail: { taskTemplateId, summaryJson: null, error: displayError },
          }),
        )
      }
    },
  })

  // Restoring helper functions
  const getProgressStatusText = () => {
    if (status === 'UPLOADING') return dict.timeline.uploaded
    if (isFinishing) return dict.status.parseComplete

    // But user wants "Upload Success, Starting Parse" initially.
    // If progressValue is low (<10) and attempts is 0, we can say "Upload Success".
    if (status === 'PENDING' && attempts === 0 && progressValue < 15) {
      return dict.status.uploadSuccess
    }

    return dict.timeline.parsing
  }

  const getSuggestionText = () => {
    return taskTemplateId === 'resume_summary'
      ? dict.suggestionTextResume
      : dict.suggestionTextDetailed
  }

  const handleReupload = () => {
    setStatus('IDLE')
    setFileName(null)
    setTaskId(null)
    setSummaryJson(null)
    setProgressValue(0)
    setNotification(null)
    setIsFinishing(false)
  }

  const processFile = (file: File) => {
    const maxSize =
      taskTemplateId === 'resume_summary' ? 2 * 1024 * 1024 : 4 * 1024 * 1024
    if (file.size > maxSize) {
      showError(
        dict.status.failed,
        taskTemplateId === 'resume_summary'
          ? dict.fileTooLarge2MB || 'File too large (> 2MB)'
          : dict.fileTooLarge4MB || 'File too large (> 4MB)',
      )
      return
    }
    setFileName(file.name)
    const formData = new FormData()
    formData.append('assetFile', file)
    pendingFormRef.current = formData
    executeGuard()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) {
      processFile(f)
    }
    if (status === 'FAILED') {
      setStatus('IDLE')
      setTaskId(null)
      setNotification(null)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragActive(false)
    const f = e.dataTransfer.files?.[0]
    if (f) {
      processFile(f)
    }
  }

  const triggerFileSelect = () => {
    fileInputRef.current?.click()
  }

  const ensurePreviewData = useCallback(async () => {
    if (summaryJson) return
    setLoadingPreview(true)
    try {
      const res =
        taskTemplateId === 'resume_summary'
          ? await getLatestResumeSummaryAction()
          : await getLatestDetailedSummaryAction()
      if ((res as any)?.ok) {
        const data = (res as any)?.data || null
        setSummaryJson(data || initialSummaryJson || null)
      } else {
        setSummaryJson(initialSummaryJson || null)
      }
    } finally {
      setLoadingPreview(false)
    }
  }, [initialSummaryJson, summaryJson, taskTemplateId])

  useImperativeHandle(
    ref,
    () => ({
      openPreview: async () => {
        setShowPreview(true)
        await ensurePreviewData()
      },
    }),
    [ensurePreviewData],
  )

  const renderStatus = () => {
    const s = isFinishing
      ? 'PENDING'
      : status === 'PENDING'
        ? pollStatus === 'IDLE'
          ? 'PENDING'
          : pollStatus
        : status

    const dropzoneTitle =
      taskTemplateId === 'resume_summary'
        ? dict.dropzoneResumeTitle || resumeTitle || '通用简历'
        : dict.dropzoneDetailedTitle || detailedTitle || '详细履历'
    const dropzoneHint =
      taskTemplateId === 'resume_summary'
        ? dict.dropzoneHintResume || dict.placeholderHintResume
        : dict.dropzoneHintDetailed || dict.placeholderHintDetailed

    if (s === 'COMPLETED') {
      return (
        <div className="h-full w-full flex flex-col justify-center rounded-2xl border border-emerald-200/60 dark:border-emerald-500/20 bg-white/70 dark:bg-white/[0.03] p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
                <FileCheck className="h-6 w-6 text-emerald-500" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {fileName ||
                    (taskTemplateId === 'resume_summary'
                      ? resumeTitle || 'General Resume'
                      : detailedTitle || 'Detailed Resume')}
                </div>
                <div className="text-xs text-emerald-600/80 dark:text-emerald-300">
                  {dict.status.completed}
                </div>
              </div>
            </div>
            {!hideActions && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={async () => {
                    setShowPreview(true)
                    await ensurePreviewData()
                  }}
                >
                  {labels?.actionPreview ?? dict.preview}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={() => {
                    handleReupload()
                    triggerFileSelect()
                  }}
                >
                  {labels?.actionReupload ?? dict.reupload}
                </Button>
              </div>
            )}
          </div>
          <Sheet open={showPreview} onOpenChange={setShowPreview}>
            <SheetContent className="sm:max-w-2xl w-full">
              <SheetHeader className="flex flex-row items-center justify-between p-4 pr-12 space-y-0">
                <SheetTitle>{L.previewTitle}</SheetTitle>
                <div className="flex gap-2">
                  <div className="flex flex-col items-end relative">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 hover:bg-muted font-mono text-xs"
                      onClick={() => {
                        const txt = JSON.stringify(summaryJson || {}, null, 2)
                        handleCopy('json', txt)
                      }}
                    >
                      JSON
                    </Button>
                    {copyFeedback === 'json' && (
                      <span className="text-[10px] text-muted-foreground absolute top-full mt-0.5 right-0 whitespace-nowrap animate-in fade-in slide-in-from-top-1">
                        {dict.toast?.copiedJson || 'Copied'}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col items-end relative">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 hover:bg-muted font-mono text-xs"
                      onClick={() => {
                        const d = summaryJson || {}
                        const sections: string[] = []
                        if (d.header) {
                          sections.push(
                            `## ${L.header}`,
                            [d.header.name, d.header.email, d.header.phone]
                              .filter(Boolean)
                              .join(' · '),
                          )
                        }
                        if (Array.isArray(d.education) && d.education.length) {
                          sections.push(`## ${L.education}`)
                          sections.push(
                            ...d.education.map(
                              (e: any) =>
                                `- ${[e.degree, e.school, e.duration]
                                  .filter(Boolean)
                                  .join(' · ')}`,
                            ),
                          )
                        }
                        if (
                          Array.isArray(d.summary_points) &&
                          d.summary_points.length
                        ) {
                          sections.push(`## ${L.summaryPoints}`)
                          sections.push(
                            ...d.summary_points.map((s: string) => `- ${s}`),
                          )
                        } else if (d.summary) {
                          sections.push(`## ${L.summary}`, String(d.summary))
                        }
                        if (
                          Array.isArray(d.specialties_points) &&
                          d.specialties_points.length
                        ) {
                          sections.push(`## ${L.specialties}`)
                          sections.push(
                            ...d.specialties_points.map(
                              (s: string) => `- ${s}`,
                            ),
                          )
                        }
                        if (
                          Array.isArray(d.experience) &&
                          d.experience.length
                        ) {
                          sections.push(`## ${L.experience}`)
                          sections.push(
                            ...d.experience.map(
                              (e: any) =>
                                `- ${[e.role, e.company, e.duration]
                                  .filter(Boolean)
                                  .join(' · ')}`,
                            ),
                          )
                        }
                        if (Array.isArray(d.projects) && d.projects.length) {
                          sections.push(`## ${L.projects}`)
                          sections.push(
                            ...d.projects.map(
                              (p: any) =>
                                `- ${[p.name, p.link]
                                  .filter(Boolean)
                                  .join(' · ')}`,
                            ),
                          )
                        }
                        if (d.skills) {
                          const arr = Array.isArray(d.skills)
                            ? d.skills
                            : [
                                ...(d.skills.technical || []),
                                ...(d.skills.soft || []),
                                ...(d.skills.tools || []),
                              ]
                          sections.push(`## ${L.skills}`, `- ${arr.join(', ')}`)
                        }
                        if (
                          Array.isArray(d.certifications) &&
                          d.certifications.length
                        ) {
                          sections.push(`## ${L.certifications}`)
                          sections.push(
                            ...d.certifications.map(
                              (c: any) =>
                                `- ${[c.name, c.issuer, c.date]
                                  .filter(Boolean)
                                  .join(' · ')}`,
                            ),
                          )
                        }
                        if (Array.isArray(d.languages) && d.languages.length) {
                          sections.push(`## ${L.languages}`)
                          sections.push(
                            ...d.languages.map(
                              (l: any) =>
                                `- ${[l.name, l.level, l.proof]
                                  .filter(Boolean)
                                  .join(' · ')}`,
                            ),
                          )
                        }
                        if (Array.isArray(d.awards) && d.awards.length) {
                          sections.push(`## ${L.awards}`)
                          sections.push(
                            ...d.awards.map(
                              (a: any) =>
                                `- ${[a.name, a.issuer, a.date]
                                  .filter(Boolean)
                                  .join(' · ')}`,
                            ),
                          )
                        }
                        if (
                          Array.isArray(d.open_source) &&
                          d.open_source.length
                        ) {
                          sections.push(`## ${L.openSource}`)
                          sections.push(
                            ...d.open_source.map(
                              (o: any) =>
                                `- ${[o.name, o.link]
                                  .filter(Boolean)
                                  .join(' · ')}`,
                            ),
                          )
                        }
                        if (Array.isArray(d.extras) && d.extras.length) {
                          sections.push(`## ${L.extras}`)
                          sections.push(
                            ...d.extras.map((x: string) => `- ${x}`),
                          )
                        }
                        if (Array.isArray(d.stack) && d.stack.length) {
                          sections.push(`## ${L.stack}`)
                          sections.push(...d.stack.map((s: string) => `- ${s}`))
                        }
                        const md = sections.join('\n')
                        handleCopy('md', md)
                      }}
                    >
                      MD
                    </Button>
                    {copyFeedback === 'md' && (
                      <span className="text-[10px] text-muted-foreground absolute top-full mt-0.5 right-0 whitespace-nowrap animate-in fade-in slide-in-from-top-1">
                        {dict.toast?.copiedMd || 'Copied'}
                      </span>
                    )}
                  </div>
                </div>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto p-4">
                {loadingPreview ? (
                  <div className="space-y-4 p-4">
                    <div className="h-8 w-48 bg-muted animate-pulse rounded" />
                    <div className="h-4 w-full bg-muted animate-pulse rounded" />
                  </div>
                ) : null}
                <AssetPreview data={summaryJson} locale={locale} labels={L} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      )
    }

    if (s === 'UPLOADING' || s === 'PENDING') {
      const statusText = getProgressStatusText()
      return (
        <div className="h-full w-full flex flex-col justify-center rounded-2xl border border-black/5 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] p-5 sm:p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-slate-100/70 dark:bg-white/[0.06] flex items-center justify-center">
              {isFinishing ? (
                <FileCheck className="h-6 w-6 text-emerald-500" />
              ) : (
                <FileText className="h-6 w-6 text-slate-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                {fileName || dropzoneTitle}
              </div>
              <div className="text-xs text-muted-foreground">{statusText}</div>
            </div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              {progressValue}%
            </div>
          </div>
          <div className="mt-4">
            <Progress
              value={progressValue}
              className="h-2 transition-all duration-500"
            />
          </div>
        </div>
      )
    }

    return (
      <div className="h-full w-full flex-1 rounded-xl border-2 border-dashed border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.03] px-6 py-8 transition-colors hover:border-slate-400 dark:hover:border-white/20 hover:bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center text-center group">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-900/5 dark:bg-white/[0.06] dark:ring-white/10 mx-auto transition-transform group-hover:scale-110">
            <Upload className="h-6 w-6 text-slate-600 dark:text-slate-300" />
          </div>
          <div className="font-medium text-slate-900 dark:text-white">
            {dropzoneTitle}
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            {dropzoneHint}
          </div>
          {s === 'FAILED' && pollError && (
            <div className="text-xs text-destructive font-medium mt-2">
              {pollError}
            </div>
          )}
        </div>
      </div>
    )
  }

  function formatLastUpdated(ts: string) {
    try {
      const dt = new Date(ts).getTime()
      const diff = Math.max(0, Date.now() - dt)
      const mins = Math.floor(diff / 60000)

      const t = dict.time || {
        secAgo: '{secs} sec ago',
        minAgo: '{mins} min ago',
        hrAgo: '{hours} hr ago',
      }

      if (mins <= 0) {
        const secs = Math.max(1, Math.floor(diff / 1000))
        return t.secAgo.replace('{secs}', String(secs))
      }
      if (mins < 60) {
        return t.minAgo.replace('{mins}', String(mins))
      }
      const hours = Math.floor(mins / 60)
      return t.hrAgo.replace('{hours}', String(hours))
    } catch {
      return ts
    }
  }

  return (
    <>
      <div
        className={`h-full flex flex-col ${dimmed ? 'opacity-60' : ''}${className ? ` ${className}` : ''}`}
      >
        {notification && (
          <ServiceNotification
            type={notification.type}
            title={notification.title}
            description={notification.description}
            onClose={() => setNotification(null)}
            autoDismiss={3000}
          />
        )}
        <div
          className="relative flex-1 flex"
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragActive(true)
          }}
          onDragLeave={() => setIsDragActive(false)}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            name="assetFile"
            type="file"
            accept="application/pdf"
            required
            disabled={isPending || status === 'UPLOADING'}
            onChange={handleFileChange}
            className="sr-only"
          />
          <div
            onClick={triggerFileSelect}
            className={`transition-all duration-300 ${isDragActive ? 'ring-2 ring-cyan-300/60' : ''} flex-1 flex h-full w-full`}
          >
            {renderStatus()}
          </div>
        </div>
      </div>
      {DialogNode}
    </>
  )
})
