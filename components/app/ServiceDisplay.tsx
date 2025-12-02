'use client'
import { useEffect, useTransition, useState, useRef, useMemo } from 'react'
import type { Locale } from '@/i18n-config'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import {
  AppCard,
  AppCardContent,
  AppCardHeader,
  AppCardTitle,
} from '@/components/app/AppCard'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { useWorkbenchStore } from '@/lib/stores/workbench.store'
import type { WorkbenchStatus } from '@/lib/stores/workbench.store'
import { useSseStream } from '@/lib/hooks/useSseStream'
import {
  customizeResumeAction,
  generateInterviewTipsAction,
} from '@/lib/actions/service.actions'
import { useRouter } from 'next/navigation'
import { MarkdownEditor } from '@/components/app/MarkdownEditor'
import { saveCustomizedResumeAction } from '@/lib/actions/service.actions'
import { toast } from '@/components/ui/use-toast'
import { StepperProgress } from '@/components/workbench/StepperProgress'
import { StatusConsole } from '@/components/workbench/StatusConsole'
import { StreamPanel } from '@/components/workbench/StreamPanel'
import { ResultCard } from '@/components/workbench/ResultCard'
import { Coins } from 'lucide-react'
import { getTaskCost } from '@/lib/constants'
import { cn } from '@/lib/utils'

export function ServiceDisplay({
  initialService,
  locale,
  dict,
  userId,
  quotaBalance,
  lastCost,
  tierOverride,
}: {
  initialService: any
  locale: Locale
  dict: any
  userId: string
  quotaBalance?: number | null
  lastCost?: number | null
  tierOverride?: 'free' | 'paid'
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const {
    status: storeStatus,
    startTask,
    streamingResponse,
    setError,
    errorMessage,
    statusDetail,
    isConnected,
    ocrResult,
    summaryResult,
    matchResult,
  } = useWorkbenchStore()

  // Initialize store status from server state to ensure UI consistency
  useEffect(() => {
    if (initialService?.currentStatus) {
      const is = initialService.currentStatus.toUpperCase()
      let mapped: WorkbenchStatus = 'IDLE'

      if (is === 'OCR_PENDING') mapped = 'OCR_PENDING'
      else if (is === 'OCR_COMPLETED') mapped = 'OCR_COMPLETED'
      else if (is === 'SUMMARY_PENDING') mapped = 'SUMMARY_PENDING'
      else if (is === 'SUMMARY_COMPLETED') mapped = 'SUMMARY_COMPLETED'
      else if (is === 'MATCH_PENDING') mapped = 'MATCH_PENDING'
      else if (is === 'MATCH_STREAMING') mapped = 'MATCH_STREAMING'
      else if (is === 'MATCH_COMPLETED') mapped = 'COMPLETED'
      else if (is === 'MATCH_FAILED') mapped = 'MATCH_FAILED'
      else if (is === 'SUMMARY_FAILED') mapped = 'SUMMARY_FAILED'
      else if (is === 'OCR_FAILED') mapped = 'OCR_FAILED'

      // Only update if store is IDLE or service changed, to avoid overwriting active state
      const currentStoreId = useWorkbenchStore.getState().currentServiceId
      if (
        currentStoreId !== initialService.id ||
        useWorkbenchStore.getState().status === 'IDLE'
      ) {
        if (mapped !== 'IDLE') {
          startTask(initialService.id, mapped)
          // Sync error message from server state if failed
          if (
            mapped === 'MATCH_FAILED' ||
            mapped === 'SUMMARY_FAILED' ||
            mapped === 'OCR_FAILED'
          ) {
            let resolvedError =
              initialService.match?.error || initialService.job?.error

            // Use failureCode to derive a localized error message
            if (initialService.failureCode) {
              const codeKey = String(initialService.failureCode).toLowerCase()
              const dictMsg = dict.workbench?.statusText?.[codeKey]
              if (dictMsg) {
                resolvedError = dictMsg
              }
            }

            if (resolvedError) {
              useWorkbenchStore.getState().setError(resolvedError)
            }
          }
        }
      }
    }
  }, [initialService, startTask, dict?.workbench?.statusText])

  // Auto-refresh when COMPLETED to sync server state
  useEffect(() => {
    if (storeStatus === 'COMPLETED') {
      router.refresh()
    }
  }, [storeStatus, router])

  // Local state
  const [tabValue, setTabValue] = useState<'match' | 'customize' | 'interview'>(
    'match'
  )
  const [matchTaskId, setMatchTaskId] = useState<string | null>(null)
  const streamRef = useRef<HTMLDivElement>(null)

  // Derived state
  const serviceId = initialService?.id
  const customizeStatus = initialService?.customizedResume?.status || 'PENDING'
  const interviewStatus = initialService?.interview?.status || 'PENDING'

  // Parse match result
  const matchJson = initialService?.match?.matchSummaryJson
  let matchParsed = null
  try {
    if (matchJson && typeof matchJson === 'object') {
      matchParsed = matchJson
    } else if (typeof matchJson === 'string') {
      const clean = matchJson.replace(/```json\n?|\n?```/g, '').trim()
      matchParsed = JSON.parse(clean)
    }
  } catch {}

  const lastUpdatedMatch = initialService?.match?.updatedAt

  const status = storeStatus

  // Initialize matchTaskId from initialService if available
  useEffect(() => {
    if (!matchTaskId && initialService?.executionSessionId) {
      setMatchTaskId(`match_${serviceId}_${initialService.executionSessionId}`)
    }
  }, [initialService, matchTaskId, serviceId])

  // Restore SSE
  useSseStream(
    userId,
    serviceId,
    matchTaskId || '',
    status === 'COMPLETED' ||
      status === 'FAILED' ||
      status === 'OCR_FAILED' ||
      status === 'SUMMARY_FAILED' ||
      status === 'MATCH_FAILED'
  )

  // Handlers
  const onCustomize = () => {
    startTransition(async () => {
      const res = await customizeResumeAction({ serviceId, locale })
      if (res?.ok) {
        setTabValue('customize')
        router.refresh()
      } else {
        toast.error(
          dict.workbench.customize.createFailed ||
            'Failed to start customization'
        )
      }
    })
  }

  const onInterview = () => {
    startTransition(async () => {
      const res = await generateInterviewTipsAction({ serviceId, locale })
      if (res?.ok) {
        setTabValue('interview')
        router.refresh()
      } else {
        toast.error('Failed to generate interview tips')
      }
    })
  }

  const retryMatchAction = () => {
    startTransition(async () => {
      const { retryMatchAction: serverRetry } = await import(
        '@/lib/actions/service.actions'
      )
      const res = await serverRetry({ locale, serviceId })
      if (res?.ok) {
        if (res.executionSessionId) {
          setMatchTaskId(`match_${serviceId}_${String(res.executionSessionId)}`)
        }
        router.refresh()
      } else {
        setError(String(res?.error || 'retry_failed'))
      }
    })
  }

  // Refresh page when status becomes COMPLETED to ensure data consistency
  useEffect(() => {
    if (status === 'COMPLETED') {
      router.refresh()
    }
  }, [status, router])

  // Parse streaming response into live object
  const [matchLive, setMatchLive] = useState<any>(null)
  useEffect(() => {
    if (status === 'COMPLETED' || status === 'MATCH_STREAMING') {
      try {
        let txt = String(streamingResponse || '')
        // Strip markdown code blocks if present
        txt = txt.replace(/```json\n?|\n?```/g, '').trim()
        if (txt.startsWith('{') && txt.endsWith('}')) {
          const parsed = JSON.parse(txt)
          if (parsed && typeof parsed === 'object') {
            setMatchLive(parsed)
          }
        }
      } catch {}
    }
  }, [status, streamingResponse])
  const interviewJson = initialService?.interview?.interviewTipsJson || null
  let interviewParsed: any = null
  try {
    interviewParsed = interviewJson
      ? typeof interviewJson === 'string'
        ? JSON.parse(interviewJson)
        : interviewJson
      : null
  } catch {}

  const stext = dict.workbench?.statusText || {}

  const currentStep = (() => {
    if (tabValue === 'interview') return 3
    if (tabValue === 'customize') return 2
    return 1
  })()
  const maxUnlockedStep = (() => {
    const customizeDone = String(customizeStatus).toUpperCase() === 'COMPLETED'
    if (customizeDone) return 3
    return 1
  })()
  const statusMessage = (() => {
    const stext = dict.workbench?.statusText || {}
    if (statusDetail) {
      const key = String(statusDetail)
      const mapped = (dict.workbench?.statusText?.[key] as any) || null
      if (mapped) return String(mapped)
    }

    // e.g. ocrPending
    const camelKey = (status || '')
      .toLowerCase()
      .replace(/_([a-z])/g, (g) => (g[1] || '').toUpperCase())
      .replace(/_/, '')

    // Try to find in statusConsole first (new standard)
    const statusConsole = dict.workbench?.statusConsole as any
    const consoleMsg = statusConsole?.[camelKey as any]
    if (consoleMsg) return String(consoleMsg)

    // Fallback to statusText (legacy/error messages)
    const statusText = dict.workbench?.statusText as any
    const textMsg = statusText?.[camelKey as any]
    if (textMsg) return String(textMsg)

    if (status === 'MATCH_PENDING')
      return (
        dict.workbench?.statusConsole?.matchPending ||
        'Analyzing match degree...'
      )
    if (status === 'MATCH_STREAMING')
      return (
        dict.workbench?.statusConsole?.matchStreaming ||
        'Streaming analysis results...'
      )
    if (status === 'SUMMARY_PENDING')
      return (
        dict.workbench?.statusConsole?.summaryPending ||
        'Extracting job details...'
      )
    if (status === 'SUMMARY_COMPLETED')
      return (
        dict.workbench?.statusConsole?.summaryCompleted ||
        'Job Details Extracted'
      )
    if (status === 'OCR_PENDING')
      return (
        dict.workbench?.statusConsole?.ocrPending ||
        'Extracting text from image...'
      )
    if (status === 'OCR_COMPLETED')
      return (
        dict.workbench?.statusConsole?.ocrCompleted ||
        'OCR Extraction Completed'
      )
    if (status === 'COMPLETED')
      return (
        dict.workbench?.statusConsole?.matchCompleted ||
        'Match Analysis Completed'
      )
    if (status === 'OCR_FAILED')
      return dict.workbench?.statusConsole?.ocrFailed || 'OCR Extraction Failed'
    if (status === 'SUMMARY_FAILED')
      return (
        dict.workbench?.statusConsole?.summaryFailed ||
        'Job Summary Extraction Failed'
      )
    if (status === 'MATCH_FAILED')
      return (
        dict.workbench?.statusConsole?.matchFailed || 'Match Analysis Failed'
      )
    if (status === 'FAILED') return stext.failed || 'Failed'
    return stext.idle || 'Ready'
  })()
  const progressValue = (() => {
    if (status === 'OCR_PENDING') return 33
    if (status === 'OCR_COMPLETED') return 33
    if (status === 'SUMMARY_PENDING') return 66
    if (status === 'SUMMARY_COMPLETED') return 66
    if (status === 'MATCH_PENDING' || status === 'MATCH_STREAMING') return 80
    if (status === 'COMPLETED') return 100
    return 0
  })()
  const tier: 'free' | 'paid' =
    tierOverride ?? ((quotaBalance ?? 0) <= 0 ? 'free' : 'paid')
  const lastUpdated =
    (lastUpdatedMatch as any) ||
    (initialService?.match?.updatedAt as any) ||
    (initialService?.updatedAt as any) ||
    null

  // Parse title for company/job fallback
  const jobSummary = initialService?.job?.jobSummaryJson
  let displayCompany =
    matchResult?.company ||
    matchParsed?.company ||
    summaryResult?.company ||
    initialService?.company ||
    ''
  let displayJob =
    matchResult?.jobTitle ||
    matchParsed?.jobTitle ||
    summaryResult?.jobTitle ||
    initialService?.job_title ||
    ''

  if (!displayCompany && !displayJob && jobSummary) {
    try {
      const obj =
        typeof jobSummary === 'string' ? JSON.parse(jobSummary) : jobSummary
      displayCompany = obj?.company || obj?.company_name || obj?.org || ''
      displayJob = obj?.jobTitle || obj?.job_title || obj?.title || ''
    } catch {}
  }

  if (!displayCompany && !displayJob && initialService?.title) {
    const parts = initialService.title.split(' - ')
    if (parts.length >= 2) {
      displayCompany = parts[0]
      displayJob = parts.slice(1).join(' - ')
    } else {
      displayJob = initialService.title
    }
  }

  return (
    <div className="h-full flex flex-col space-y-6">
      <StepperProgress
        currentStep={currentStep as any}
        maxUnlockedStep={maxUnlockedStep as any}
        onStepClick={(s) => {
          if (s === 1) setTabValue('match')
          else if (s === 2) setTabValue('customize')
          else setTabValue('interview')
        }}
        labels={{
          step1: String(dict.workbench?.tabs?.match || 'Step 1'),
          step2: String(dict.workbench?.tabs?.customize || 'Step 2'),
          step3: String(dict.workbench?.tabs?.interview || 'Step 3'),
        }}
        className="shrink-0"
      />

      <StatusConsole
        status={
          status === 'FAILED' ||
          status === 'OCR_FAILED' ||
          status === 'SUMMARY_FAILED' ||
          status === 'MATCH_FAILED'
            ? 'error'
            : status === 'COMPLETED'
            ? 'completed'
            : status === 'MATCH_PENDING' ||
              status === 'MATCH_STREAMING' ||
              status === 'OCR_PENDING' ||
              status === 'SUMMARY_PENDING'
            ? 'streaming'
            : 'idle'
        }
        statusMessage={statusMessage}
        progress={progressValue}
        isConnected={isConnected}
        lastUpdated={lastUpdated ? new Date(lastUpdated) : null}
        tier={tier}
        cost={lastCost || 0}
        errorMessage={errorMessage || undefined}
      />

      <Tabs
        value={tabValue}
        defaultValue="match"
        onValueChange={(v) =>
          setTabValue(v as 'match' | 'customize' | 'interview')
        }
        className="flex-1 flex flex-col min-h-0 space-y-6"
      >
        <TabsContent value="match" className="flex-1 flex flex-col min-h-0">
          {(status === 'OCR_PENDING' ||
            status === 'OCR_COMPLETED' ||
            status === 'SUMMARY_PENDING' ||
            status === 'SUMMARY_COMPLETED' ||
            status === 'MATCH_PENDING' ||
            status === 'MATCH_STREAMING') && (
            <div ref={streamRef}>
              <StreamPanel
                mode={
                  status === 'OCR_PENDING' ||
                  status === 'OCR_COMPLETED' ||
                  status === 'SUMMARY_PENDING'
                    ? 'ocr'
                    : status === 'SUMMARY_COMPLETED'
                    ? 'summary'
                    : status === 'MATCH_PENDING'
                    ? 'summary'
                    : 'match'
                }
                ocrText={ocrResult || initialService?.job?.originalText}
                summaryJson={
                  summaryResult ||
                  (initialService?.job?.jobSummaryJson
                    ? typeof initialService.job.jobSummaryJson === 'string'
                      ? JSON.parse(initialService.job.jobSummaryJson)
                      : initialService.job.jobSummaryJson
                    : null)
                }
                content={String(streamingResponse || '')}
                timestamp={lastUpdatedMatch ? new Date(lastUpdatedMatch) : null}
                dict={dict}
                {...(errorMessage
                  ? { errorMessage: String(errorMessage) }
                  : {})}
                onRetry={retryMatchAction}
              />
            </div>
          )}
          {(status === 'COMPLETED' || matchResult || matchParsed) &&
            !(
              status === 'MATCH_PENDING' ||
              status === 'MATCH_STREAMING' ||
              status === 'OCR_PENDING' ||
              status === 'SUMMARY_PENDING'
            ) && (
              <ResultCard
                data={matchResult || matchParsed}
                company={displayCompany}
                jobTitle={displayJob}
                labels={{
                  title: dict.workbench?.resultCard?.title,
                  loading: dict.workbench?.resultCard?.loading,
                  empty: dict.workbench?.resultCard?.empty,
                  matchScore: dict.workbench?.resultCard?.matchScore,
                  overallAssessment:
                    dict.workbench?.resultCard?.overallAssessment,
                  highlights: dict.workbench?.resultCard?.highlights,
                  gapsAndSuggestions:
                    dict.workbench?.resultCard?.gapsAndSuggestions,
                  smartPitch: dict.workbench?.resultCard?.smartPitch,
                  copyTooltip: dict.workbench?.resultCard?.copyTooltip,
                  copy: dict.workbench?.resultCard?.copy,
                  copied: dict.workbench?.resultCard?.copied,
                  copySuccess: dict.workbench?.resultCard?.copySuccess,
                  highlyMatched: dict.workbench?.resultCard?.highlyMatched,
                  goodFit: dict.workbench?.resultCard?.goodFit,
                  lowMatch: dict.workbench?.resultCard?.lowMatch,
                  targetCompany: dict.workbench?.resultCard?.targetCompany,
                  targetPosition: dict.workbench?.resultCard?.targetPosition,
                  noHighlights: dict.workbench?.resultCard?.noHighlights,
                  noGaps: dict.workbench?.resultCard?.noGaps,
                  tip: dict.workbench?.resultCard?.tip,
                  expertVerdict: dict.workbench?.resultCard?.expertVerdict,
                }}
              />
            )}
          {(status === 'FAILED' ||
            status === 'OCR_FAILED' ||
            status === 'SUMMARY_FAILED' ||
            status === 'MATCH_FAILED') && (
            <div className="space-y-3">
              <StreamPanel
                mode="error"
                content={
                  errorMessage ||
                  dict?.workbench?.streamPanel?.error ||
                  'Task execution failed, please retry.'
                }
                locale={locale}
              />
              <div className="flex justify-start">
                <Button
                  onClick={() => {
                    startTransition(async () => {
                      const res = await (
                        await import('@/lib/actions/service.actions')
                      ).retryMatchAction({ locale, serviceId })
                      if (res?.ok) {
                        if (res.executionSessionId) {
                          setMatchTaskId(
                            `match_${serviceId}_${String(
                              res.executionSessionId
                            )}`
                          )
                        }
                        // Immediately update local status to hide retry button and show progress
                        const nextStatus =
                          res.step === 'summary'
                            ? 'SUMMARY_PENDING'
                            : 'MATCH_PENDING'
                        useWorkbenchStore.getState().setStatus(nextStatus)

                        router.refresh()
                      } else {
                        setError(String(res?.error || 'retry_failed'))
                      }
                    })
                  }}
                  disabled={isPending}
                >
                  {isPending
                    ? dict.workbench?.statusText?.retryMatch || 'Retrying...'
                    : dict.workbench?.statusText?.retryMatch || 'Retry Match'}
                </Button>
              </div>
            </div>
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
                  const res = await saveCustomizedResumeAction({
                    serviceId,
                    markdown: md,
                  })
                  if (res?.ok)
                    toast.success(dict.workbench.customize.saveSuccess)
                  else toast.error(dict.workbench.customize.saveFailed)
                }}
                onExport={async () => {}}
              />
              {Array.isArray(initialService?.customizedResume?.opsJson) &&
                initialService.customizedResume.opsJson.length > 0 && (
                  <AppCard>
                    <AppCardHeader>
                      <AppCardTitle>
                        {dict.workbench.customize.diffTitle}
                      </AppCardTitle>
                    </AppCardHeader>
                    <AppCardContent>
                      <ul className="space-y-3">
                        {initialService.customizedResume.opsJson
                          .filter((op: any) => op.type === 'rewrite-lite')
                          .map((op: any, i: number) => (
                            <li key={i} className="text-sm">
                              <div className="text-muted-foreground">
                                原句：
                              </div>
                              <div className="whitespace-pre-wrap">
                                {String(op.original)}
                              </div>
                              <div className="text-muted-foreground mt-2">
                                改句：
                              </div>
                              <div className="whitespace-pre-wrap">
                                {String(op.revised)}
                              </div>
                            </li>
                          ))}
                      </ul>
                    </AppCardContent>
                  </AppCard>
                )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              {dict.workbench.toast.lockedTitle}
            </div>
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
                      <div className="prose whitespace-pre-wrap">
                        {String(interviewParsed.intro)}
                      </div>
                    )}
                    {Array.isArray(interviewParsed.qa_items) &&
                      interviewParsed.qa_items.length > 0 && (
                        <div>
                          <div className="text-sm text-muted-foreground mb-2">
                            Q&A
                          </div>
                          <ul className="space-y-2">
                            {interviewParsed.qa_items.map(
                              (q: any, i: number) => (
                                <li key={i} className="space-y-1">
                                  <div className="font-medium">
                                    {String(q.question)}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {String(q.framework)}
                                  </div>
                                  {Array.isArray(q.hints) && (
                                    <ul className="list-disc pl-6 text-sm">
                                      {q.hints.map((h: any, j: number) => (
                                        <li key={j}>{String(h)}</li>
                                      ))}
                                    </ul>
                                  )}
                                </li>
                              )
                            )}
                          </ul>
                        </div>
                      )}
                    {interviewParsed.markdown && (
                      <div className="prose whitespace-pre-wrap">
                        {String(interviewParsed.markdown)}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="prose whitespace-pre-wrap"> </div>
                )}
              </AppCardContent>
            </AppCard>
          ) : (
            <Button onClick={onInterview} disabled={isPending}>
              {dict.workbench?.interviewUi?.start}
            </Button>
          )}
        </TabsContent>
      </Tabs>

      <div
        className={cn(
          // Mobile: Fixed bottom, blurred background, border top
          'fixed bottom-0 left-0 right-0 z-50 p-4 flex items-center justify-center gap-4',
          'bg-background/20 backdrop-blur-md border-t border-border/20',
          // Desktop: Static, transparent background, no border, aligned left
          'md:static md:transform-none md:w-full md:max-w-none md:rounded-none md:bg-transparent md:backdrop-blur-none md:shadow-none md:p-4 md:border-t-0 md:justify-start md:pb-4 shrink-0'
        )}
      >
        <div className="flex items-center gap-3 relative z-50">
          {(tabValue === 'match' || tabValue === 'customize') &&
            String(customizeStatus).toUpperCase() !== 'COMPLETED' && (
              <Button
                onClick={onCustomize}
                disabled={isPending || status !== 'COMPLETED'}
                aria-label={dict.workbench?.customize?.start}
              >
                {dict.workbench?.customize?.start}
              </Button>
            )}
          {tabValue === 'interview' &&
            String(interviewStatus).toUpperCase() !== 'COMPLETED' && (
              <Button
                onClick={onInterview}
                disabled={isPending}
                aria-label={dict.workbench?.interviewUi?.start}
              >
                {dict.workbench?.interviewUi?.start}
              </Button>
            )}
          <span
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground"
            title={(dict.workbench?.costTooltip || '').replace(
              '{cost}',
              String(
                getTaskCost(
                  tabValue === 'interview'
                    ? 'interview_prep'
                    : 'resume_customize'
                )
              )
            )}
          >
            <Coins className="w-3 h-3 text-yellow-500" />
            {getTaskCost(
              tabValue === 'interview' ? 'interview_prep' : 'resume_customize'
            )}
          </span>
        </div>
      </div>
    </div>
  )
}
