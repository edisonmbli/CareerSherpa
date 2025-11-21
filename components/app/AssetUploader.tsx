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
              <Loader2 className={`mr-2 h-4 w-4 ${step==='finalizing' ? 'text-green-600 animate-pulse' : 'animate-spin'}`} />
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
                <span className="truncate">{fileName || (taskTemplateId === 'resume_summary' ? (locale==='zh'?'个人通用简历':'General Resume') : (locale==='zh'?'个人详细履历':'Detailed Resume'))} - {dict.status.completed}</span>
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
                      const arr = Array.isArray(d.skills) ? d.skills : [...(d.skills.technical||[]), ...(d.skills.soft||[]), ...(d.skills.tools||[])]
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
                    <div className="space-y-3">
                      <div className="h-6 w-40 bg-muted animate-pulse rounded" />
                      <div className="h-4 w-full bg-muted animate-pulse rounded" />
                      <div className="h-4 w-5/6 bg-muted animate-pulse rounded" />
                      <div className="h-4 w-4/6 bg-muted animate-pulse rounded" />
                    </div>
                  ) : null}
                  {(() => {
                    const d = summaryJson || {}
                    return (
                      <div className="space-y-4 text-sm rounded-lg border bg-card shadow-xl p-4">
                        {Array.isArray(d.experiences) && d.experiences.length > 0 ? (
                          <div>
                            <div className="font-medium">{locale==='zh'?'详细经历':'Detailed Experiences'} <span className="text-muted-foreground text-xs">({d.experiences.length})</span></div>
                            <div className="h-0.5 bg-gradient-to-r from-blue-400 to-blue-100 rounded-full mt-1" />
                            <ul className="list-disc pl-5 text-muted-foreground">
                              {d.experiences.map((e: any, i: number) => (
                                <li key={i}>
                                  <div className="font-medium">{[e.company, e.product_or_team, e.role, e.duration].filter(Boolean).join(' · ')}</div>
                                  {Array.isArray(e.keywords) && e.keywords.length>0 ? (
                                    <div className="text-xs mt-1">{(locale==='zh'?'关键词':'Keywords')}: {e.keywords.join(', ')}</div>
                                  ) : null}
                                  {Array.isArray(e.highlights) && e.highlights.length>0 ? (
                                    <ul className="list-disc pl-5 mt-1">
                                      {e.highlights.map((h: string, j: number) => (<li key={j}>{h}</li>))}
                                    </ul>
                                  ) : null}
                                  {Array.isArray(e.projects) && e.projects.length>0 ? (
                                    <div className="mt-2">
                                      <div className="text-sm font-medium">{locale==='zh'?'项目经历':'Projects'}</div>
                                      <ul className="list-disc pl-5 mt-1">
                                        {e.projects.map((p: any, k: number) => (
                                          <li key={k}>
                                            <div className="font-medium">{[p.name, p.link].filter(Boolean).join(' · ')}</div>
                                            {p.description ? (<div className="mt-1">{p.description}</div>) : null}
                                            {Array.isArray(p.task) && p.task.length>0 ? (
                                              <div className="mt-1">
                                                <div className="text-sm font-medium">{locale==='zh'?'任务':'Tasks'}</div>
                                                <ul className="list-disc pl-5">{p.task.map((t: string, ti: number)=>(<li key={ti}>{t}</li>))}</ul>
                                              </div>
                                            ) : null}
                                            {Array.isArray(p.actions) && p.actions.length>0 ? (
                                              <div className="mt-1">
                                                <div className="text-sm font-medium">{locale==='zh'?'行动':'Actions'}</div>
                                                <ul className="list-disc pl-5">{p.actions.map((a: string, ai: number)=>(<li key={ai}>{a}</li>))}</ul>
                                              </div>
                                            ) : null}
                                            {Array.isArray(p.results) && p.results.length>0 ? (
                                              <div className="mt-1">
                                                <div className="text-sm font-medium">{locale==='zh'?'成果':'Results'}</div>
                                                <ul className="list-disc pl-5">{p.results.map((r: string, ri: number)=>(<li key={ri}>{r}</li>))}</ul>
                                              </div>
                                            ) : null}
                                            {Array.isArray(p.metrics) && p.metrics.length>0 ? (
                                              <div className="mt-1 text-xs text-muted-foreground">{locale==='zh'?'指标':'Metrics'}: {p.metrics.map((m: any)=>`${m.label}:${m.value}${m.unit?(' '+m.unit):''}`).join('; ')}</div>
                                            ) : null}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  ) : null}
                                  {Array.isArray(e.contributions) && e.contributions.length>0 ? (
                                    <div className="mt-2">
                                      <div className="text-sm font-medium">{locale==='zh'?'重要产出':'Contributions'}</div>
                                      <ul className="list-disc pl-5 mt-1">{e.contributions.map((c: string, ci: number)=>(<li key={ci}>{c}</li>))}</ul>
                                    </div>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {Array.isArray(d.capabilities) && d.capabilities.length>0 ? (
                          <div>
                            <div className="font-medium">{locale==='zh'?'能力':'Capabilities'} <span className="text-muted-foreground text-xs">({d.capabilities.length})</span></div>
                            <div className="h-0.5 bg-gradient-to-r from-blue-400 to-blue-100 rounded-full mt-1" />
                            <ul className="list-disc pl-5 text-muted-foreground">
                              {d.capabilities.map((c: any, i: number)=> (
                                <li key={i}>
                                  <div className="font-medium">{c.name}</div>
                                  {Array.isArray(c.points) && c.points.length>0 ? (
                                    <ul className="list-disc pl-5 mt-1">{c.points.map((pt: string, pi: number)=>(<li key={pi}>{pt}</li>))}</ul>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {d.header ? (
                          <div>
                            <div className="font-medium">{L.header}</div>
                            <div className="h-0.5 bg-gradient-to-r from-blue-400 to-blue-100 rounded-full mt-1" />
                            <div className="text-muted-foreground mt-1">{[d.header.name, d.header.email, d.header.phone].filter(Boolean).join(' · ')}</div>
                            {Array.isArray(d.header?.links) && d.header.links.length > 0 ? (
                              <ul className="list-disc pl-5 text-muted-foreground mt-1">
                                {d.header.links.map((l: any, i: number) => (
                                  <li key={i}>{[l.label, l.url].filter(Boolean).join(': ')}</li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        ) : null}
                        {Array.isArray(d.education) && d.education.length > 0 ? (
                          <div>
                            <div id="sec-education" className="font-medium">{L.education} <span className="text-muted-foreground text-xs">({d.education.length})</span></div>
                            <div className="h-0.5 bg-gradient-to-r from-blue-400 to-blue-100 rounded-full mt-1" />
                            <ul className="list-disc pl-5 text-muted-foreground">
                              {d.education.map((e: any, i: number) => (
                                <li key={i}>
                                  <div className="font-medium">{[e.degree, e.school, e.duration].filter(Boolean).join(' · ')}</div>
                                  {e.gpa ? (<div className="text-xs mt-1">GPA: {e.gpa}</div>) : null}
                                  {Array.isArray(e.courses) && e.courses.length > 0 ? (
                                    <div className="text-xs text-muted-foreground mt-1">{locale === 'zh' ? '课程' : 'Courses'}: {e.courses.join(', ')}</div>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        
                        {Array.isArray(d.summary_points) && d.summary_points.length > 0 ? (
                          <div>
                            <div className="font-medium">{L.summaryPoints} <span className="text-muted-foreground text-xs">({d.summary_points.length})</span></div>
                            <div className="h-0.5 bg-gradient-to-r from-blue-400 to-blue-100 rounded-full mt-1" />
                            <ul className="list-disc pl-5 text-muted-foreground">
                              {d.summary_points.map((s: string, i: number) => (
                                <li key={i}>{s}</li>
                              ))}
                            </ul>
                          </div>
                        ) : d.summary ? (
                          <div>
                            <div className="font-medium">{L.summary}</div>
                            <div className="h-0.5 bg-gradient-to-r from-blue-400 to-blue-100 rounded-full mt-1" />
                            <div className="text-muted-foreground break-words">{String(d.summary)}</div>
                          </div>
                        ) : null}
                        {Array.isArray(d.specialties_points) && d.specialties_points.length > 0 ? (
                          <div>
                            <div className="font-medium">{L.specialties} <span className="text-muted-foreground text-xs">({d.specialties_points.length})</span></div>
                            <div className="h-0.5 bg-gradient-to-r from-blue-400 to-blue-100 rounded-full mt-1" />
                            <ul className="list-disc pl-5 text-muted-foreground">
                              {d.specialties_points.map((s: string, i: number) => (
                                <li key={i}>{s}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {Array.isArray(d.experience) && d.experience.length > 0 ? (
                          <div>
                            <div className="font-medium">{L.experience} <span className="text-muted-foreground text-xs">({d.experience.length})</span></div>
                            <div className="h-0.5 bg-gradient-to-r from-blue-400 to-blue-100 rounded-full mt-1" />
                            <ul className="list-disc pl-5 text-muted-foreground">
                              {d.experience.map((e: any, i: number) => (
                                <li key={i}>
                                  <div className="font-medium">{[e.role, e.company, e.duration].filter(Boolean).join(' · ')}</div>
                                  {Array.isArray(e.highlights) && e.highlights.length > 0 ? (
                                    <ul className="list-disc pl-5 mt-1">
                                      {e.highlights.map((h: string, j: number) => (
                                        <li key={j}>{h}</li>
                                      ))}
                                    </ul>
                                  ) : null}
                                  {Array.isArray(e.stack) && e.stack.length > 0 ? (
                                    <div className="text-xs text-muted-foreground mt-1">{L.stack}: {e.stack.join(', ')}</div>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {Array.isArray(d.projects) && d.projects.length > 0 ? (
                          <div>
                            <div className="font-medium">{L.projects} <span className="text-muted-foreground text-xs">({d.projects.length})</span></div>
                            <div className="h-0.5 bg-gradient-to-r from-blue-400 to-blue-100 rounded-full mt-1" />
                            <ul className="list-disc pl-5 text-muted-foreground">
                              {d.projects.map((p: any, i: number) => (
                                <li key={i}>
                                  <div className="font-medium">{[p.name, p.link].filter(Boolean).join(' · ')}</div>
                                  {p.description ? (
                                    <div className="mt-1">{p.description}</div>
                                  ) : null}
                                  {Array.isArray(p.highlights) && p.highlights.length > 0 ? (
                                    <ul className="list-disc pl-5 mt-1">
                                      {p.highlights.map((h: string, j: number) => (
                                        <li key={j}>{h}</li>
                                      ))}
                                    </ul>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        
                        {d.skills ? (
                          <div>
                            <div className="font-medium">{L.skills} <span className="text-muted-foreground text-xs">({Array.isArray(d.skills) ? d.skills.length : ((d.skills.technical?.length || 0) + (d.skills.soft?.length || 0) + (d.skills.tools?.length || 0))})</span></div>
                            <div className="h-0.5 bg-gradient-to-r from-blue-400 to-blue-100 rounded-full mt-1" />
                            <div className="text-muted-foreground">
                              {Array.isArray(d.skills)
                                ? d.skills.join(', ')
                                : [
                                    ...(d.skills.technical || []),
                                    ...(d.skills.soft || []),
                                    ...(d.skills.tools || []),
                                  ].join(', ')}
                            </div>
                          </div>
                        ) : null}
                        {Array.isArray(d.certifications) && d.certifications.length > 0 ? (
                          <div>
                            <div className="font-medium">{L.certifications} <span className="text-muted-foreground text-xs">({d.certifications.length})</span></div>
                            <div className="h-0.5 bg-gradient-to-r from-blue-400 to-blue-100 rounded-full mt-1" />
                            <ul className="list-disc pl-5 text-muted-foreground">
                              {d.certifications.map((c: any, i: number) => (
                                <li key={i}>{[c.name, c.issuer, c.date].filter(Boolean).join(' · ')}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {Array.isArray(d.languages) && d.languages.length > 0 ? (
                          <div>
                            <div className="font-medium">{L.languages} <span className="text-muted-foreground text-xs">({d.languages.length})</span></div>
                            <div className="h-0.5 bg-gradient-to-r from-blue-400 to-blue-100 rounded-full mt-1" />
                            <ul className="list-disc pl-5 text-muted-foreground">
                              {d.languages.map((l: any, i: number) => (
                                <li key={i}>{[l.name, l.level, l.proof].filter(Boolean).join(' · ')}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {Array.isArray(d.awards) && d.awards.length > 0 ? (
                          <div>
                            <div className="font-medium">{L.awards} <span className="text-muted-foreground text-xs">({d.awards.length})</span></div>
                            <div className="h-0.5 bg-gradient-to-r from-primary/30 to-blue-400/30 rounded-full mt-1" />
                            <ul className="list-disc pl-5 text-muted-foreground">
                              {d.awards.map((a: any, i: number) => (
                                <li key={i}>{[a.name, a.issuer, a.date].filter(Boolean).join(' · ')}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {Array.isArray(d.openSource) && d.openSource.length > 0 ? (
                          <div>
                            <div className="font-medium">{L.openSource} <span className="text-muted-foreground text-xs">({d.openSource.length})</span></div>
                            <div className="h-0.5 bg-gradient-to-r from-primary/30 to-blue-400/30 rounded-full mt-1" />
                            <ul className="list-disc pl-5 text-muted-foreground">
                              {d.openSource.map((o: any, i: number) => (
                                <li key={i}>{[o.name, o.link].filter(Boolean).join(' · ')}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {Array.isArray(d.extras) && d.extras.length > 0 ? (
                          <div>
                            <div className="font-medium">{L.extras} <span className="text-muted-foreground text-xs">({d.extras.length})</span></div>
                            <div className="h-0.5 bg-gradient-to-r from-primary/30 to-blue-400/30 rounded-full mt-1" />
                            <ul className="list-disc pl-5 text-muted-foreground">
                              {d.extras.map((x: string, i: number) => (
                                <li key={i}>{x}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {Array.isArray(d.rawSections) && d.rawSections.length>0 ? (
                          <div>
                            <div className="font-medium">{locale==='zh'?'原文分节':'Raw Sections'} <span className="text-muted-foreground text-xs">({d.rawSections.length})</span></div>
                            <div className="h-0.5 bg-gradient-to-r from-blue-400 to-blue-100 rounded-full mt-1" />
                            <ul className="list-disc pl-5 text-muted-foreground">
                              {d.rawSections.map((rs: any, i: number)=> (
                                <li key={i}>
                                  <div className="font-medium">{rs.title}</div>
                                  {Array.isArray(rs.points) && rs.points.length>0 ? (
                                    <ul className="list-disc pl-5 mt-1">{rs.points.map((pt: string, pi: number)=>(<li key={pi}>{pt}</li>))}</ul>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    )
                  })()}
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
