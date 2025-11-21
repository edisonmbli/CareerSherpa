'use client'
import { useEffect, useTransition, useState, useRef } from 'react'
import type { Locale } from '@/i18n-config'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AppCard,
  AppCardContent,
  AppCardHeader,
  AppCardTitle,
  AppCardDescription,
} from '@/components/app/AppCard'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { useWorkbenchStore } from '@/lib/stores/workbench.store'
import { useSseStream } from '@/lib/hooks/useSseStream'
import { useTaskPolling } from '@/lib/hooks/useTaskPolling'
import {
  customizeResumeAction,
  generateInterviewTipsAction,
} from '@/lib/actions/service.actions'
import { useRouter } from 'next/navigation'
import { MarkdownEditor } from '@/components/app/MarkdownEditor'
import { saveCustomizedResumeAction } from '@/lib/actions/service.actions'
import { toast } from '@/components/ui/use-toast'

export function ServiceDisplay({
  initialService,
  locale,
  dict,
  userId,
}: {
  initialService: any
  locale: Locale
  dict: any
  userId: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const { status, setStatus, startTask, streamingResponse, setError } =
    useWorkbenchStore()

  const serviceId: string = initialService.id
  const jobImage: string | null = initialService?.job?.originalImage ?? null
  const matchStatus: string = initialService?.match?.status ?? 'IDLE'
  const customizeStatus: string =
    initialService?.customizedResume?.status ?? 'IDLE'
  const interviewStatus: string = initialService?.interview?.status ?? 'IDLE'

  const isImageFlow = Boolean(jobImage)
  const matchTaskId = `match_${serviceId}`

  useEffect(() => {
    if (isImageFlow) {
      startTask(serviceId, 'OCR_PENDING')
    } else {
      startTask(serviceId, 'MATCH_PENDING')
    }
  }, [isImageFlow, serviceId, startTask])

  const shouldPollMatch = isImageFlow && (status === 'OCR_PENDING' || status === 'SUMMARY_PENDING')
  useTaskPolling({
    taskId: shouldPollMatch ? serviceId : null,
    taskType: 'service_match',
    enabled: shouldPollMatch,
    onSuccess: () => setStatus('MATCH_PENDING'),
    onError: () => setError('match_failed'),
  })

  const enableMatchStream = status === 'MATCH_PENDING' || status === 'MATCH_STREAMING'
  useSseStream(userId, enableMatchStream ? serviceId : '', enableMatchStream ? matchTaskId : '')

  const initialTab = (() => {
    if (String(matchStatus).toUpperCase() === 'COMPLETED') {
      if (String(customizeStatus).toUpperCase() !== 'COMPLETED') return 'customize'
      if (String(interviewStatus).toUpperCase() !== 'COMPLETED') return 'interview'
    }
    return 'match'
  })()
  const streamRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (status === 'MATCH_PENDING' || status === 'MATCH_STREAMING') {
      streamRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [status])

  const [customizeTaskId, setCustomizeTaskId] = useState<string | null>(null)
  const onCustomize = () => {
    startTransition(async () => {
      const res = await customizeResumeAction({ locale, serviceId })
      if (!res?.ok) {
        setError('customize_failed')
        return
      }
      setCustomizeTaskId(res.taskId ?? null)
      if (res.isFree) {
      }
    })
  }

  const shouldPollCustomize = Boolean(customizeTaskId) && customizeStatus !== 'COMPLETED'
  useTaskPolling({
    taskId: shouldPollCustomize ? customizeTaskId! : null,
    taskType: 'customize',
    enabled: shouldPollCustomize,
    onSuccess: () => router.refresh(),
    onError: () => setError('customize_failed'),
  })

  const [interviewTaskId, setInterviewTaskId] = useState<string | null>(null)
  const onInterview = () => {
    startTransition(async () => {
      const res = await generateInterviewTipsAction({ locale, serviceId })
      if (!res?.ok) {
        setError('interview_failed')
        return
      }
      setInterviewTaskId(`interview_${serviceId}`)
    })
  }

  const enableInterviewStream = Boolean(interviewTaskId) && interviewStatus !== 'COMPLETED'
  useSseStream(userId, enableInterviewStream ? serviceId : '', enableInterviewStream ? interviewTaskId! : '')

  const matchJson = initialService?.match?.matchSummaryJson || null
  let matchParsed: any = null
  try { matchParsed = matchJson ? (typeof matchJson === 'string' ? JSON.parse(matchJson) : matchJson) : null } catch {}
  const interviewJson = initialService?.interview?.interviewTipsJson || null
  let interviewParsed: any = null
  try { interviewParsed = interviewJson ? (typeof interviewJson === 'string' ? JSON.parse(interviewJson) : interviewJson) : null } catch {}

  const tabs = (dict.workbench?.tabs || { match: 'Match', customize: 'Customize', interview: 'Interview' })
  const stext = dict.workbench?.statusText || {}

  return (
    <Tabs defaultValue={initialTab} className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">当前状态</div>
        <div className="flex items-center gap-2">
          {status === 'OCR_PENDING' && <StatusBadge label={stext.ocrPending || 'OCR'} variant="warning" />}
          {status === 'SUMMARY_PENDING' && <StatusBadge label={stext.summaryPending || 'Summary'} variant="warning" />}
          {status === 'MATCH_PENDING' && <StatusBadge label={stext.matchStreaming || 'Streaming'} variant="default" />}
          {status === 'COMPLETED' && <StatusBadge label={stext.matchCompleted || 'Completed'} variant="success" />}
          {status === 'FAILED' && <StatusBadge label={stext.failed || 'Failed'} variant="destructive" />}
        </div>
      </div>
      <TabsList>
        <TabsTrigger value="match">{tabs.match}</TabsTrigger>
        <TabsTrigger value="customize">{tabs.customize}</TabsTrigger>
        <TabsTrigger value="interview">{tabs.interview}</TabsTrigger>
      </TabsList>

      <TabsContent value="match">
        {status === 'OCR_PENDING' && (
          <AppCard>
            <AppCardHeader>
              <AppCardTitle>{stext.ocrPending || 'Processing OCR...'}</AppCardTitle>
              <AppCardDescription> </AppCardDescription>
            </AppCardHeader>
            <AppCardContent>
              <Progress value={33} />
            </AppCardContent>
          </AppCard>
        )}
        {status === 'SUMMARY_PENDING' && (
          <AppCard>
            <AppCardHeader>
              <AppCardTitle>{stext.summaryPending || 'Summarizing...'}</AppCardTitle>
              <AppCardDescription> </AppCardDescription>
            </AppCardHeader>
            <AppCardContent>
              <Progress value={66} />
            </AppCardContent>
          </AppCard>
        )}
        {status === 'MATCH_PENDING' && (
          <AppCard>
            <AppCardHeader>
              <AppCardTitle>{stext.matchStreaming || 'Streaming...'}</AppCardTitle>
              <AppCardDescription> </AppCardDescription>
            </AppCardHeader>
            <AppCardContent>
              <div ref={streamRef} className="prose max-h-[60vh] overflow-y-scroll whitespace-pre-wrap transition-opacity duration-300 ease-in opacity-100">
                {streamingResponse}
              </div>
            </AppCardContent>
          </AppCard>
        )}
        {status === 'COMPLETED' && (
          <AppCard>
            <AppCardHeader>
              <AppCardTitle>{stext.matchCompleted || 'Completed'}</AppCardTitle>
            </AppCardHeader>
            <AppCardContent>
              {matchParsed ? (
                <div className="space-y-4">
                  {matchParsed.score !== undefined && (
                    <div className="text-lg font-semibold">Score: {matchParsed.score}</div>
                  )}
                  {Array.isArray(matchParsed.highlights) && matchParsed.highlights.length > 0 && (
                    <div>
                      <div className="text-sm text-muted-foreground mb-2">Highlights</div>
                      <ul className="list-disc pl-6 space-y-1">
                        {matchParsed.highlights.map((h: any, i: number) => (
                          <li key={i}>{String(h)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {Array.isArray(matchParsed.gaps) && matchParsed.gaps.length > 0 && (
                    <div>
                      <div className="text-sm text-muted-foreground mb-2">Gaps</div>
                      <ul className="list-disc pl-6 space-y-1">
                        {matchParsed.gaps.map((g: any, i: number) => (
                          <li key={i}>{String(g)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {matchParsed.dm_script && (
                    <div className="prose whitespace-pre-wrap">{String(matchParsed.dm_script)}</div>
                  )}
                  {matchParsed.markdown && (
                    <div className="prose whitespace-pre-wrap">{String(matchParsed.markdown)}</div>
                  )}
                </div>
              ) : (
                <div className="prose whitespace-pre-wrap">{streamingResponse}</div>
              )}
            </AppCardContent>
          </AppCard>
        )}
        {status === 'FAILED' && (
          <Alert variant="destructive">
            <AlertTitle>{stext.failed || 'Failed'}</AlertTitle>
            <AlertDescription> </AlertDescription>
          </Alert>
        )}
      </TabsContent>

      <TabsContent value="customize">
        {customizeStatus === 'COMPLETED' ? (
          <div className="space-y-6">
            <MarkdownEditor
              initialContent={
                initialService?.customizedResume?.markdownText || ''
              }
              labels={{
                save: dict.workbench.customize.saveButton,
                export: dict.workbench.customize.exportPdf,
                editTab: dict.workbench.customize.editTab,
                previewTab: dict.workbench.customize.previewTab,
                templateLabel: dict.workbench.customize.templateLabel,
              }}
              onSave={async (md) => {
                const res = await saveCustomizedResumeAction({ serviceId, markdown: md })
                if (res?.ok) toast.success(dict.workbench.customize.saveSuccess)
                else toast.error(dict.workbench.customize.saveFailed)
              }}
              onExport={async () => {}}
            />
            {Array.isArray(initialService?.customizedResume?.opsJson) && initialService.customizedResume.opsJson.length > 0 && (
              <AppCard>
                <AppCardHeader>
                  <AppCardTitle>{dict.workbench.customize.diffTitle}</AppCardTitle>
                </AppCardHeader>
                <AppCardContent>
                  <ul className="space-y-3">
                    {initialService.customizedResume.opsJson
                      .filter((op: any) => op.type === 'rewrite-lite')
                      .map((op: any, i: number) => (
                        <li key={i} className="text-sm">
                          <div className="text-muted-foreground">原句：</div>
                          <div className="whitespace-pre-wrap">{String(op.original)}</div>
                          <div className="text-muted-foreground mt-2">改句：</div>
                          <div className="whitespace-pre-wrap">{String(op.revised)}</div>
                        </li>
                      ))}
                  </ul>
                </AppCardContent>
              </AppCard>
            )}
          </div>
        ) : (
          <Button onClick={onCustomize} disabled={isPending}>
            生成定制化简历
          </Button>
        )}
      </TabsContent>

      <TabsContent value="interview">
        {interviewStatus === 'COMPLETED' ? (
          <AppCard>
            <AppCardHeader>
              <AppCardTitle>Interview Tips</AppCardTitle>
            </AppCardHeader>
            <AppCardContent>
              {interviewParsed ? (
                <div className="space-y-4">
                  {interviewParsed.intro && (
                    <div className="prose whitespace-pre-wrap">{String(interviewParsed.intro)}</div>
                  )}
                  {Array.isArray(interviewParsed.qa_items) && interviewParsed.qa_items.length > 0 && (
                    <div>
                      <div className="text-sm text-muted-foreground mb-2">Q&A</div>
                      <ul className="space-y-2">
                        {interviewParsed.qa_items.map((q: any, i: number) => (
                          <li key={i} className="space-y-1">
                            <div className="font-medium">{String(q.question)}</div>
                            <div className="text-xs text-muted-foreground">{String(q.framework)}</div>
                            {Array.isArray(q.hints) && (
                              <ul className="list-disc pl-6 text-sm">
                                {q.hints.map((h: any, j: number) => (
                                  <li key={j}>{String(h)}</li>
                                ))}
                              </ul>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {interviewParsed.markdown && (
                    <div className="prose whitespace-pre-wrap">{String(interviewParsed.markdown)}</div>
                  )}
                </div>
              ) : (
                <div className="prose whitespace-pre-wrap"> </div>
              )}
            </AppCardContent>
          </AppCard>
        ) : (
          <Button onClick={onInterview} disabled={isPending}>
            生成面试 Tips
          </Button>
        )}
      </TabsContent>
    </Tabs>
  )
}

function StatusBadge({ label, variant }: { label: string; variant: 'default' | 'success' | 'warning' | 'destructive' }) {
  const v = variant === 'success' ? 'success' : variant === 'warning' ? 'warning' : variant === 'destructive' ? 'destructive' : 'default'
  return <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs ${v === 'success' ? 'bg-green-100 text-green-700' : v === 'warning' ? 'bg-yellow-100 text-yellow-700' : v === 'destructive' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-800'}`}>{label}</span>
}
