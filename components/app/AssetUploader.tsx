'use client'
import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { estimateEtaMinutes } from '@/lib/llm/config'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Upload, FileCheck, FileX, Loader2 } from 'lucide-react'
import { toast } from '@/components/ui/use-toast'
import { useTaskPolling } from '@/lib/hooks/useTaskPolling'
import { uploadAssetFormDataAction } from '@/lib/actions/asset.actions'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { getLatestResumeSummaryAction, getLatestDetailedSummaryAction } from '@/lib/actions/resume.actions'
import { Info } from 'lucide-react'
import { AssetPreview } from './AssetPreview'

type UploaderStatus = 'IDLE' | 'UPLOADING' | 'PENDING' | 'COMPLETED' | 'FAILED'

export function AssetUploader({
  locale,
  taskTemplateId,
  initialStatus,
  initialFileName,
  initialSummaryJson,
  dict,
  pdfNotice,
  labels,
}: {
  locale: 'en' | 'zh'
  taskTemplateId: 'resume_summary' | 'detailed_resume_summary'
  initialStatus: UploaderStatus
  initialFileName: string | null
  initialSummaryJson?: any
  dict: {
    button: string
    buttonProcessing: string
    status: { pending: string; completed: string; failed: string }
    toast: {
      uploadSuccess: string
      queueFree: string
      queueError: string
      pollSuccess: string
      pollFailed: string
    }
    preview: string
    reupload: string
    chooseFile: string
    noFileSelected: string
    placeholderHintResume: string
    placeholderHintDetailed: string
    suggestionTextResume: string
    suggestionTextDetailed: string
    processingMarquee: string
    etaMarqueeMinTemplate: string
    lastUpdatedLabel: string
    timeline: {
      uploaded: string
      queued: string
      parsing: string
      finalizing: string
      completed: string
      failed: string
    }
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
    actionPreview?: string
    actionReupload?: string
  }
}) {
  const router = useRouter()
  const [status, setStatus] = useState<UploaderStatus>(initialStatus)
  const [fileName, setFileName] = useState<string | null>(initialFileName)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [showPreview, setShowPreview] = useState(false)
  const [summaryJson, setSummaryJson] = useState<any>(initialSummaryJson || null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [startTs, setStartTs] = useState<number | null>(null)
  const [isFree, setIsFree] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const L = {
    previewTitle: labels?.previewTitle ?? (locale === 'zh' ? '简历结构化预览' : 'Resume Preview'),
    header: labels?.header ?? (locale === 'zh' ? '抬头' : 'Header'),
    summary: labels?.summary ?? (locale === 'zh' ? '摘要' : 'Summary'),
    summaryPoints: labels?.summaryPoints ?? (locale === 'zh' ? '摘要要点' : 'Summary Points'),
    specialties: labels?.specialties ?? (locale === 'zh' ? '专业特长' : 'Specialties'),
    experience: labels?.experience ?? (locale === 'zh' ? '工作经历' : 'Experience'),
    projects: labels?.projects ?? (locale === 'zh' ? '项目' : 'Projects'),
    education: labels?.education ?? (locale === 'zh' ? '教育经历' : 'Education'),
    skills: labels?.skills ?? (locale === 'zh' ? '技能' : 'Skills'),
    certifications: labels?.certifications ?? (locale === 'zh' ? '证书' : 'Certifications'),
    languages: labels?.languages ?? (locale === 'zh' ? '语言' : 'Languages'),
    awards: labels?.awards ?? (locale === 'zh' ? '奖项' : 'Awards'),
    openSource: labels?.openSource ?? (locale === 'zh' ? '开源' : 'Open Source'),
    extras: labels?.extras ?? (locale === 'zh' ? '其他' : 'Extras'),
    stack: labels?.stack ?? (locale === 'zh' ? '技术栈' : 'Stack'),
  }

  const { status: pollStatus, lastUpdated, attempts } = useTaskPolling({
    taskId,
    taskType:
      taskTemplateId === 'resume_summary' ? 'resume' : 'detailed_resume',
    enabled: status === 'PENDING',
    onSuccess: () => {
      setStatus('COMPLETED')
      startTransition(async () => {
        try {
          setLoadingPreview(true)
          const res = taskTemplateId === 'resume_summary'
            ? await getLatestResumeSummaryAction()
            : await getLatestDetailedSummaryAction()
          if ((res as any)?.ok) {
            setSummaryJson((res as any)?.data || null)
          }
          toast.success(dict.toast.pollSuccess)
          router.refresh()
        } finally {
          setLoadingPreview(false)
        }
      })
    },
    onError: () => {
      setStatus('FAILED')
      toast.error(dict.toast.pollFailed)
      router.refresh()
    },
  })

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
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const file = formData.get('assetFile') as File | null
    if (!file) {
      toast.error('请选择 PDF 文件')
      return
    }
    if (file.type !== 'application/pdf') {
      toast.warning('目前仅支持文本型 PDF')
      return
    }

    setFileName(file.name)
    setStatus('UPLOADING')
    startTransition(async () => {
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
        toast.success(dict.toast.uploadSuccess)
        if (res.isFree) toast.warning(dict.toast.queueFree)
      } else {
        setStatus('FAILED')
        toast.error(res.error || dict.toast.queueError)
      }
    })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) setFileName(f.name)
    // 进入重新上传流程时，清理上一次失败提示与任务状态
    if (status === 'FAILED') {
      setStatus('IDLE')
      setTaskId(null)
    }
  }

  const triggerFileSelect = () => {
    fileInputRef.current?.click()
  }

  const ensurePreviewData = async () => {
    if (summaryJson) return
    setLoadingPreview(true)
    try {
      const res = taskTemplateId === 'resume_summary'
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
  }

  type TimelineStep = 'uploaded' | 'queued' | 'parsing' | 'finalizing' | 'completed' | 'failed'
  function getCurrentStep(s: UploaderStatus, att: number): TimelineStep {
    if (s === 'FAILED') return 'failed'
    if (s === 'COMPLETED') return 'completed'
    if (s === 'UPLOADING') return 'uploaded'
    if (s === 'PENDING') {
      if (att < 2) return 'queued'
      if (att < 4) return 'parsing'
      return 'finalizing'
    }
    return 'uploaded'
  }
  function getProgress(step: TimelineStep): number {
    if (step === 'uploaded') return 15
    if (step === 'queued') return 30
    if (step === 'parsing') return 66
    if (step === 'finalizing') return 85
    if (step === 'completed') return 100
    return 0
  }

  const renderStatus = () => {
    const s = status === 'PENDING' ? (pollStatus === 'IDLE' ? 'PENDING' : pollStatus) : status
    const estimateTotalMin = (() => {
      try { return estimateEtaMinutes(taskTemplateId, Boolean(isFree)) } catch { return taskTemplateId === 'resume_summary' ? 2 : 3 }
    })()
    const elapsedMin = startTs ? Math.max(0, Math.floor((Date.now() - startTs) / 60000)) : 0
    const remainingMin = Math.max(1, estimateTotalMin - elapsedMin)
    const marquee = String(dict.etaMarqueeMinTemplate).replace('{minutes}', String(remainingMin))
    const step = getCurrentStep(status, attempts)
    const progressValue = getProgress(step)
    switch (s) {
      case 'UPLOADING':
      case 'PENDING':
        return (
          <div className="space-y-2">
            <Progress value={progressValue} className="w-full" />
            <div className="flex items-center text-sm text-muted-foreground">
              <Loader2 className={`mr-2 h-4 w-4 ${step === 'finalizing' ? 'text-green-600 animate-pulse' : 'animate-spin'}`} />
              {fileName} - {dict.timeline[step]}
              <span className="ml-2 text-xs">· {marquee}</span>
            </div>
            {lastUpdated ? (
              <div className="text-xs text-muted-foreground">
                {dict.lastUpdatedLabel}: {formatLastUpdated(lastUpdated, locale)}
              </div>
            ) : null}
          </div>
        )
      case 'COMPLETED':
        return (
          <div className="flex items-center gap-3 mb-4">
            <div className="flex w-full rounded-md border bg-card px-3 py-2 hover:bg-muted transition flex-col sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center text-green-600 min-w-0">
                <FileCheck className="mr-2 h-4 w-4" />
                <span className="truncate">{fileName || (taskTemplateId === 'resume_summary' ? (locale === 'zh' ? '个人通用简历' : 'General Resume') : (locale === 'zh' ? '个人详细履历' : 'Detailed Resume'))} - {dict.status.completed}</span>
              </div>
              <div className="mt-2 sm:mt-0 flex items-center gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={async () => { setShowPreview(true); await ensurePreviewData(); }}>
                  {labels?.actionPreview ?? dict.preview}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={handleReupload}>
                  {labels?.actionReupload ?? dict.reupload}
                </Button>
              </div>
            </div>

            <Sheet open={showPreview} onOpenChange={setShowPreview}>
              <SheetContent className="sm:max-w-2xl">
                <SheetHeader className="flex flex-row items-center justify-between p-4 pr-12">
                  <SheetTitle>{L.previewTitle}</SheetTitle>
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" size="sm" className="hover:bg-muted" onClick={() => {
                      const txt = JSON.stringify(summaryJson || {}, null, 2)
                      navigator.clipboard.writeText(txt)
                      toast.success(locale === 'zh' ? '已复制 JSON 到剪贴板' : 'Copied JSON to clipboard')
                    }}>JSON</Button>
                    <Button type="button" variant="ghost" size="sm" className="hover:bg-muted" onClick={() => {
                      const d = summaryJson || {}
                      const sections: string[] = []
                      if (d.header) {
                        sections.push(`## ${L.header}`, [d.header.name, d.header.email, d.header.phone].filter(Boolean).join(' · '))
                      }
                      if (Array.isArray(d.education) && d.education.length) {
                        sections.push(`## ${L.education}`)
                        sections.push(...d.education.map((e: any) => `- ${[e.degree, e.school, e.duration].filter(Boolean).join(' · ')}`))
                      }
                      if (Array.isArray(d.summary_points) && d.summary_points.length) {
                        sections.push(`## ${L.summaryPoints}`)
                        sections.push(...d.summary_points.map((s: string) => `- ${s}`))
                      } else if (d.summary) {
                        sections.push(`## ${L.summary}`, String(d.summary))
                      }
                      if (Array.isArray(d.specialties_points) && d.specialties_points.length) {
                        sections.push(`## ${L.specialties}`)
                        sections.push(...d.specialties_points.map((s: string) => `- ${s}`))
                      }
                      if (Array.isArray(d.experience) && d.experience.length) {
                        sections.push(`## ${L.experience}`)
                        sections.push(...d.experience.map((e: any) => `- ${[e.role, e.company, e.duration].filter(Boolean).join(' · ')}`))
                      }
                      if (Array.isArray(d.projects) && d.projects.length) {
                        sections.push(`## ${L.projects}`)
                        sections.push(...d.projects.map((p: any) => `- ${[p.name, p.link].filter(Boolean).join(' · ')}`))
                      }
                      if (d.skills) {
                        const arr = Array.isArray(d.skills) ? d.skills : [...(d.skills.technical || []), ...(d.skills.soft || []), ...(d.skills.tools || [])]
                        sections.push(`## ${L.skills}`, `- ${arr.join(', ')}`)
                      }
                      if (Array.isArray(d.languages) && d.languages.length) {
                        sections.push(`## ${L.languages}`)
                        sections.push(...d.languages.map((l: any) => `- ${[l.name, l.level, l.proof].filter(Boolean).join(' · ')}`))
                      }
                      if (Array.isArray(d.extras) && d.extras.length) {
                        sections.push(`## ${L.extras}`)
                        sections.push(...d.extras.map((x: string) => `- ${x}`))
                      }
                      const md = sections.join('\n')
                      navigator.clipboard.writeText(md)
                      toast.success(locale === 'zh' ? '已复制 Markdown 到剪贴板' : 'Copied Markdown to clipboard')
                    }}>MD</Button>
                  </div>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto p-4">
                  {loadingPreview ? (
                    <div className="space-y-4 p-4">
                      <div className="h-8 w-48 bg-muted animate-pulse rounded" />
                      <div className="h-4 w-full bg-muted animate-pulse rounded" />
                      <div className="h-4 w-5/6 bg-muted animate-pulse rounded" />
                      <div className="h-4 w-4/6 bg-muted animate-pulse rounded" />
                    </div>
                  ) : null}
                  <AssetPreview data={summaryJson} locale={locale} labels={L} />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        )
      case 'FAILED':
        return (
          <Badge variant="destructive">
            <FileX className="mr-2 h-4 w-4" />
            {fileName} - {dict.status.failed}
          </Badge>
        )
      default:
        return null
    }
  }

  function formatLastUpdated(ts: string, loc: 'zh' | 'en') {
    try {
      const dt = new Date(ts).getTime()
      const diff = Math.max(0, Date.now() - dt)
      const mins = Math.floor(diff / 60000)
      if (mins <= 0) {
        const secs = Math.max(1, Math.floor(diff / 1000))
        return loc === 'zh' ? `${secs} 秒前` : `${secs} sec ago`
      }
      if (mins < 60) {
        return loc === 'zh' ? `${mins} 分钟前` : `${mins} min ago`
      }
      const hours = Math.floor(mins / 60)
      return loc === 'zh' ? `${hours} 小时前` : `${hours} hr ago`
    } catch {
      return ts
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {null}
      {status !== 'COMPLETED' ? (
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
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
          <div className="flex-1 rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground">
            {fileName
              ? fileName
              : `${taskTemplateId === 'resume_summary' ? dict.placeholderHintResume : dict.placeholderHintDetailed}`}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={triggerFileSelect} disabled={isPending || status === 'UPLOADING'}>
              {dict.chooseFile}
            </Button>
            <Button
              type="submit"
              disabled={isPending || status === 'UPLOADING'}
              size="sm"
            >
              {isPending || status === 'PENDING' || status === 'UPLOADING' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {isPending ? dict.buttonProcessing : dict.button}
            </Button>
          </div>
        </div>
      ) : null}
      <div className="mt-2">{renderStatus()}</div>
    </form>
  )
}
