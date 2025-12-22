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
import {
  StepperProgress,
  type StepId,
} from '@/components/workbench/StepperProgress'
import { StatusConsole } from '@/components/workbench/StatusConsole'
import { StreamPanel } from '@/components/workbench/StreamPanel'
import { ResultCard } from '@/components/workbench/ResultCard'
import { Coins, Loader2 } from 'lucide-react'
import { getTaskCost } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'

import { StepCustomize } from '@/components/workbench/StepCustomize'
import { BatchProgressPanel } from '@/components/workbench/BatchProgressPanel'

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

  // Auto-refresh when COMPLETED to sync server state
  useEffect(() => {
    if (storeStatus === 'COMPLETED' || storeStatus === 'MATCH_COMPLETED') {
      router.refresh()
    }
  }, [storeStatus, router])

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
      else if (is === 'MATCH_COMPLETED') mapped = 'MATCH_COMPLETED'
      else if (is === 'MATCH_FAILED') mapped = 'MATCH_FAILED'
      else if (is === 'SUMMARY_FAILED') mapped = 'SUMMARY_FAILED'
      else if (is === 'OCR_FAILED') mapped = 'OCR_FAILED'
      else if (is === 'CUSTOMIZE_PENDING') mapped = 'CUSTOMIZE_PENDING'
      else if (is === 'CUSTOMIZE_FAILED') mapped = 'CUSTOMIZE_FAILED'
      else if (is === 'CUSTOMIZE_COMPLETED') mapped = 'CUSTOMIZE_COMPLETED'
      else if (is === 'INTERVIEW_PENDING') mapped = 'INTERVIEW_PENDING'
      else if (is === 'INTERVIEW_FAILED') mapped = 'INTERVIEW_FAILED'
      else if (is === 'INTERVIEW_COMPLETED') mapped = 'INTERVIEW_COMPLETED'

      // Only update if store is IDLE or service changed, to avoid overwriting active state
      // OR if the new state is a terminal state (COMPLETED/FAILED) which should override pending states
      const currentStoreId = useWorkbenchStore.getState().currentServiceId
      const currentStatus = useWorkbenchStore.getState().status
      
      const isTerminalState = (s: WorkbenchStatus) => 
        s.endsWith('_COMPLETED') || s.endsWith('_FAILED') || s === 'COMPLETED' || s === 'FAILED'

      if (
        currentStoreId !== initialService.id ||
        currentStatus === 'IDLE' ||
        (isTerminalState(mapped) && mapped !== currentStatus)
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

  // Local state
  const [tabValue, setTabValue] = useState<'match' | 'customize' | 'interview'>(
    'match'
  )
  const [matchTaskId, setMatchTaskId] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const streamRef = useRef<HTMLDivElement>(null)

  // Derived state
  const serviceId = initialService?.id

  // Use store status or isStarting to prevent flashing "Ready" state
  const customizeStatus =
    storeStatus === 'CUSTOMIZE_PENDING' || isStarting
      ? 'PENDING'
      : initialService?.customizedResume?.status || 'IDLE'

  const interviewStatus = initialService?.interview?.status || 'IDLE'

  // Polling for customize status - REMOVED per user request

  // Reset isStarting when confirmed pending
  useEffect(() => {
    if (customizeStatus === 'PENDING') {
      setIsStarting(false)
    }
  }, [customizeStatus])

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
    if (initialService?.executionSessionId) {
      const newTaskId = `match_${serviceId}_${initialService.executionSessionId}`
      if (matchTaskId !== newTaskId) {
        setMatchTaskId(newTaskId)
      }
    }
  }, [initialService, matchTaskId, serviceId])

  // Restore SSE
  // Use current taskId if available, else matchTaskId
  const currentTaskId = initialService?.taskId || matchTaskId

  useSseStream(
    userId,
    serviceId,
    currentTaskId || '',
    status === 'COMPLETED' ||
      status === 'MATCH_COMPLETED' ||
      status === 'CUSTOMIZE_COMPLETED' ||
      status === 'INTERVIEW_COMPLETED' ||
      status === 'FAILED' ||
      status === 'OCR_FAILED' ||
      status === 'SUMMARY_FAILED' ||
      status === 'MATCH_FAILED' ||
      status === 'CUSTOMIZE_FAILED' ||
      status === 'INTERVIEW_FAILED'
  )

  // Handlers
  const onCustomize = () => {
    setIsStarting(true)
    startTransition(async () => {
      const res = await customizeResumeAction({ serviceId, locale })
      console.log('[Frontend] customizeResumeAction result:', res)
      if (res?.ok) {
        if (res.executionSessionId) {
          const newTaskId = `match_${serviceId}_${String(
            res.executionSessionId
          )}`
          console.log('[Frontend] Setting matchTaskId to:', newTaskId)
          setMatchTaskId(newTaskId)
        }
        setTabValue('customize')
        // Optimistically set status to CUSTOMIZE_PENDING
        useWorkbenchStore.getState().setStatus('CUSTOMIZE_PENDING')
        router.refresh()
      } else {
        setIsStarting(false)
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
        if (res.executionSessionId) {
          const newTaskId = `match_${serviceId}_${String(
            res.executionSessionId
          )}`
          setMatchTaskId(newTaskId)
        }
        setTabValue('interview')
        // Optimistically set status
        useWorkbenchStore.getState().setStatus('INTERVIEW_PENDING')
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

  // Auto-collapse sidebar when customization is completed OR when switching to Customize tab
  useEffect(() => {
    if (tabValue === 'customize') {
      // Check if we should auto-collapse (if completed or just by default for editor space)
      // User mentioned "Step 2 tab... sidebar automatically collapses", so we enforce it here
      // to ensure consistent behavior.
      const shouldCollapse =
        customizeStatus === 'COMPLETED' || customizeStatus === 'PENDING'

      if (shouldCollapse) {
        const isCollapsed = localStorage.getItem('sidebar_collapsed') === '1'
        if (!isCollapsed) {
          localStorage.setItem('sidebar_collapsed', '1')
          window.dispatchEvent(new CustomEvent('sidebar:collapsed-changed'))
        }
      }
    }
  }, [customizeStatus, tabValue])

  // Refresh page when status becomes COMPLETED or FAILED to ensure data consistency
  useEffect(() => {
    if (
      status === 'COMPLETED' ||
      status === 'MATCH_COMPLETED' ||
      status === 'CUSTOMIZE_COMPLETED' ||
      status === 'INTERVIEW_COMPLETED' ||
      status === 'FAILED' ||
      status === 'MATCH_FAILED' ||
      status === 'SUMMARY_FAILED' ||
      status === 'OCR_FAILED' ||
      status === 'CUSTOMIZE_FAILED' ||
      status === 'INTERVIEW_FAILED'
    ) {
      router.refresh()
    }
  }, [status, router])

  // Parse streaming response into live object
  const [matchLive, setMatchLive] = useState<any>(null)
  useEffect(() => {
    if (
      status === 'COMPLETED' ||
      status === 'MATCH_COMPLETED' ||
      status === 'MATCH_STREAMING'
    ) {
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

  const { currentStep, maxUnlockedStep, cta, statusMessage, progressValue } =
    deriveStage(
      status,
      customizeStatus,
      interviewStatus,
      dict,
      isPending,
      tabValue,
      statusDetail,
      errorMessage
    )

  const displayCost = (() => {
    if (tabValue === 'customize') return getTaskCost('resume_customize')
    if (tabValue === 'interview') return getTaskCost('interview_prep')
    return getTaskCost('job_match')
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

  const shouldHideConsole =
    (tabValue === 'match' &&
      (status === 'COMPLETED' ||
        status === 'MATCH_COMPLETED' ||
        status === 'CUSTOMIZE_PENDING' ||
        status === 'CUSTOMIZE_COMPLETED' ||
        status === 'CUSTOMIZE_FAILED' ||
        status === 'INTERVIEW_PENDING' ||
        status === 'INTERVIEW_COMPLETED' ||
        status === 'INTERVIEW_FAILED')) ||
    (tabValue === 'customize' && customizeStatus === 'COMPLETED') ||
    (tabValue === 'interview' && interviewStatus === 'COMPLETED')

  // Auto-expand sidebar when on Match or Interview tab (restore navigation)
  useEffect(() => {
    const syncSidebarState = () => {
      if (tabValue === 'match' || tabValue === 'interview') {
        const isCollapsed = localStorage.getItem('sidebar_collapsed') === '1'
        if (isCollapsed) {
          localStorage.removeItem('sidebar_collapsed')
          // Dispatch event to force sidebar re-render if it's listening
          window.dispatchEvent(new CustomEvent('sidebar:collapsed-changed'))
        }
      }
    }

    // Sync immediately
    syncSidebarState()

    // No timer needed with useLayoutEffect as it blocks paint
  }, [tabValue])

  // CTA Node for Desktop Headers
  const ctaNode = (
    <div className="flex items-center gap-2">
      {cta && (
        <Button
          onClick={() => {
            if (cta.action === 'customize') onCustomize()
            else if (cta.action === 'interview') {
              setTabValue('interview')
              onInterview()
            } else if (cta.action === 'retry_match') retryMatchAction()
          }}
          disabled={cta.disabled}
          aria-label={cta.label}
          size="sm"
          className="font-semibold shadow-sm h-8 px-4 gap-2"
        >
          {cta.label}
          <div className="h-3 w-px bg-white/20 mx-1" />
          <div className="flex items-center gap-1 opacity-90">
            <Coins className="w-3.5 h-3.5 text-yellow-500" />
            <span className="text-xs font-mono">
              {getTaskCost(
                tabValue === 'interview' ||
                  (tabValue === 'customize' && customizeStatus === 'COMPLETED')
                  ? 'interview_prep'
                  : 'resume_customize'
              )}
            </span>
          </div>
        </Button>
      )}
    </div>
  )

  return (
    <div
      className={cn(
        'h-full flex flex-col space-y-4 md:space-y-2' // Increased mobile spacing to prevent overlap
      )}
    >
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

      {!shouldHideConsole && (
        <StatusConsole
          status={
            status === 'FAILED' ||
            status === 'OCR_FAILED' ||
            status === 'SUMMARY_FAILED' ||
            status === 'MATCH_FAILED' ||
            (tabValue === 'customize' && customizeStatus === 'FAILED')
              ? 'error'
              : (status === 'COMPLETED' || status === 'MATCH_COMPLETED') &&
                (tabValue !== 'customize' || customizeStatus === 'COMPLETED')
              ? 'completed'
              : status === 'MATCH_PENDING' ||
                status === 'MATCH_STREAMING' ||
                status === 'OCR_PENDING' ||
                status === 'SUMMARY_PENDING' ||
                customizeStatus === 'PENDING'
              ? 'streaming'
              : 'idle'
          }
          statusMessage={statusMessage}
          progress={progressValue}
          isConnected={isConnected}
          lastUpdated={lastUpdated ? new Date(lastUpdated) : null}
          tier={tier}
          cost={displayCost}
          errorMessage={errorMessage || undefined}
        />
      )}

      <Tabs
        value={tabValue}
        defaultValue="match"
        onValueChange={(v) =>
          setTabValue(v as 'match' | 'customize' | 'interview')
        }
        className="flex-1 flex flex-col min-h-0 space-y-2 mb-0"
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
          {(status === 'COMPLETED' ||
            status === 'MATCH_COMPLETED' ||
            matchResult ||
            matchParsed) &&
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
                actionButton={ctaNode}
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
            </div>
          )}
        </TabsContent>

        <TabsContent value="customize" className="flex-1 flex flex-col min-h-0">
          {customizeStatus === 'COMPLETED' &&
          initialService?.customizedResume?.customizedResumeJson ? (
            <StepCustomize
              serviceId={initialService.id}
              initialData={
                initialService.customizedResume.editedResumeJson ||
                initialService.customizedResume.customizedResumeJson
              }
              initialConfig={
                initialService.customizedResume.sectionConfig || undefined
              }
              originalData={
                initialService.customizedResume.customizedResumeJson ||
                undefined
              }
              optimizeSuggestion={
                initialService.customizedResume.optimizeSuggestion || null
              }
              initialOpsJson={
                initialService.customizedResume.ops_json || undefined
              }
              ctaAction={ctaNode}
            />
          ) : (
            <>
              {customizeStatus === 'PENDING' || isStarting ? (
                <BatchProgressPanel
                  title={
                    dict.workbench?.statusText?.analyzing ||
                    'AI is analyzing...'
                  }
                  description={
                    dict.workbench?.statusText?.analyzingDesc ||
                    'Analyzing your profile against the JD and applying professional resume writing strategies. This usually takes 30-60 seconds.'
                  }
                  progress={66}
                />
              ) : customizeStatus === 'CUSTOMIZE_FAILED' ||
                customizeStatus === 'FAILED' ? (
                <div className="space-y-3">
                  <StreamPanel
                    mode="error"
                    content={
                      errorMessage ||
                      dict?.workbench?.streamPanel?.error ||
                      'Task execution failed, please retry.'
                    }
                    locale={locale}
                    onRetry={onCustomize}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 space-y-6 border rounded-md bg-card min-h-[300px]">
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-semibold">
                      {dict.workbench?.statusText?.readyToCustomize ||
                        'Ready to Customize'}
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                      {dict.workbench?.statusText?.readyToCustomizeDesc ||
                        'Click "Start Customization" below to generate a tailored resume based on the job description.'}
                    </p>
                  </div>
                  {/* Desktop CTA for Ready State */}
                  <div className="hidden md:block">{ctaNode}</div>
                </div>
              )}
            </>
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
            <div className="flex flex-col items-center justify-center py-12 space-y-6 border rounded-md bg-card min-h-[300px]">
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold">
                  {dict.workbench?.interviewUi?.ready ||
                    'Ready to Generate Interview Tips'}
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  {dict.workbench?.interviewUi?.readyDesc ||
                    'Generate personalized interview Q&A and tips based on your customized resume.'}
                </p>
              </div>
              {/* Desktop CTA for Ready State */}
              <div className="hidden md:block">{ctaNode}</div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <div
        className={cn(
          // Mobile: Fixed bottom, blurred background, border top
          'fixed bottom-0 left-0 right-0 z-50 px-4 py-3 flex items-center justify-center gap-3',
          // Increased opacity and darkened color for better visibility
          // Light mode: Neutral gray background for contrast (not white)
          // Dark mode: Dark zinc background
          // Opacity reduced to 20% to allow content to be visible underneath
          'bg-zinc-300/20 dark:bg-zinc-800/30 backdrop-blur-xs border-t border-border/10 shadow-[0_-4px_20px_rgba(0,0,0,0.12)]',
          // Desktop: Static, transparent background, no border, aligned left, HIDDEN because we moved CTA to header
          'md:hidden'
        )}
      >
        <div className="flex items-center gap-3 relative z-50">
          {cta && (
            <Button
              onClick={() => {
                if (cta.action === 'customize') onCustomize()
                else if (cta.action === 'interview') {
                  setTabValue('interview')
                  onInterview()
                } else if (cta.action === 'retry_match') retryMatchAction()
              }}
              disabled={cta.disabled}
              aria-label={cta.label}
            >
              {cta.label}
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

function deriveStage(
  status: WorkbenchStatus,
  customizeStatus: string,
  interviewStatus: string,
  dict: any,
  isPending: boolean,
  tabValue: string,
  statusDetail: string | null,
  errorMessage: string | null
): {
  currentStep: StepId
  maxUnlockedStep: StepId
  cta: {
    show: boolean
    label: string
    action: 'customize' | 'interview' | 'retry_match' | 'none'
    disabled: boolean
  } | null
  statusMessage: string
  progressValue: number
} {
  let currentStep: StepId = 1
  let maxUnlockedStep: StepId = 1
  let cta: {
    show: boolean
    label: string
    action: 'customize' | 'interview' | 'retry_match' | 'none'
    disabled: boolean
  } | null = null

  // 1. Status Normalization
  // ------------------------------------------------------------------
  const isMatchDone = status === 'COMPLETED' || status === 'MATCH_COMPLETED'
  const isMatchFailed =
    status === 'FAILED' ||
    status === 'MATCH_FAILED' ||
    status === 'OCR_FAILED' ||
    status === 'SUMMARY_FAILED'

  // Mapping Table Note: "PENDING" in DB covers both "Wait to start" and "Doing"
  const isCustomizePending = customizeStatus === 'PENDING'
  const isCustomizeDone = customizeStatus === 'COMPLETED'
  const isCustomizeFailed = customizeStatus === 'FAILED'
  const isCustomizeIdle = customizeStatus === 'IDLE'

  // Mapping Table Note: "PENDING" in DB covers both "Wait to start" and "Doing"
  const isInterviewPending = interviewStatus === 'PENDING'
  const isInterviewDone = interviewStatus === 'COMPLETED'
  const isInterviewFailed = interviewStatus === 'FAILED'
  const isInterviewIdle = interviewStatus === 'IDLE'

  // 2. Step Calculation (Status Driven)
  // ------------------------------------------------------------------
  // Logic aligns with Mapping Table: "所在 Stage" column
  if (!isInterviewIdle) {
    currentStep = 3
  } else if (!isCustomizeIdle) {
    currentStep = 2
  } else if (isMatchDone) {
    currentStep = 2 // Transitioning to Step 2
  } else {
    currentStep = 1
  }

  // Override: If user manually selected a tab, we might want to respect it for *viewing*
  // but the Stepper's "active ring" usually indicates the *process* stage.
  // However, the previous requirement was "Status Driven".
  // If we want the Stepper ring to follow the Tab (as user navigation), we use tabValue.
  // Based on "ServiceDisplay.tsx" L339 (previous), currentStep was derived from tabValue.
  // Let's stick to the Tab Value for visual consistency with the content area,
  // BUT the *Unlock* status is driven by execution status.
  if (tabValue === 'interview') currentStep = 3
  else if (tabValue === 'customize') currentStep = 2
  else currentStep = 1

  // 3. Max Unlocked Calculation (Locking Logic)
  // ------------------------------------------------------------------
  if (isInterviewPending || isInterviewDone || isInterviewFailed) {
    maxUnlockedStep = 3
  } else if (isCustomizeDone && isInterviewIdle) {
    // Gap Analysis: Mapping table says Step 3 is "visible" in INTERVIEW_PENDING.
    // Here we lock Step 3 if Interview hasn't started (IDLE), even if Customize is done.
    // This matches the "Unlock on Action" pattern requested by user.
    maxUnlockedStep = 2
  } else if (
    isCustomizePending ||
    isCustomizeDone ||
    isCustomizeFailed ||
    isMatchDone
  ) {
    maxUnlockedStep = 2
  } else {
    maxUnlockedStep = 1
  }

  // 4. CTA Calculation
  // ------------------------------------------------------------------
  // Logic aligns with Mapping Table: "CTA Button" column

  if (isMatchFailed) {
    // MATCH_FAILED -> Retry
    cta = {
      show: true,
      label: dict.workbench?.statusText?.retryMatch || 'Retry Match',
      action: 'retry_match',
      disabled: isPending,
    }
  } else if (isMatchDone && isCustomizeIdle) {
    // MATCH_COMPLETED -> Start Customize
    cta = {
      show: true,
      label: dict.workbench?.customize?.start || 'Start Customization',
      action: 'customize',
      disabled: isPending,
    }
  } else if (isCustomizePending) {
    // CUSTOMIZE_PENDING/DOING -> Show Progress (Disabled CTA)
    // Gap: Mapping table says "Hidden" for DOING. We use "Disabled" for better UX.
    cta = {
      show: true,
      label: dict.workbench?.statusConsole?.customizing || 'Customizing...',
      action: 'none',
      disabled: true,
    }
  } else if (isCustomizeFailed) {
    // CUSTOMIZE_FAILED -> Retry
    cta = {
      show: true,
      label: dict.workbench?.customize?.start || 'Retry Customization',
      action: 'customize',
      disabled: isPending,
    }
  } else if (isCustomizeDone && isInterviewIdle) {
    // CUSTOMIZE_COMPLETED -> Generate Tips
    cta = {
      show: true,
      label: dict.workbench?.interviewUi?.start || 'Generate Interview Tips',
      action: 'interview',
      disabled: isPending,
    }
  } else if (isInterviewPending) {
    // INTERVIEW_PENDING/DOING -> Show Progress (Disabled CTA)
    cta = {
      show: true,
      label: 'Generating Tips...',
      action: 'none',
      disabled: true,
    }
  } else if (isInterviewFailed) {
    // INTERVIEW_FAILED -> Retry
    cta = {
      show: true,
      label: dict.workbench?.interviewUi?.start || 'Retry Generation',
      action: 'interview',
      disabled: isPending,
    }
  } else if (isInterviewDone) {
    // INTERVIEW_COMPLETED -> Hidden (or View Results which is default UI)
    cta = null
  }

  // 5. Status Message & Progress
  // ------------------------------------------------------------------
  let statusMessage = ''
  let progressValue = 0

  // ... (Logic from previous statusMessage/progressValue)

  if (tabValue === 'customize') {
    if (isCustomizePending) {
      statusMessage =
        dict.workbench?.statusConsole?.customizing || 'AI is customizing...'
      progressValue = 66
    } else if (isCustomizeFailed) {
      statusMessage =
        dict.workbench?.statusConsole?.customizeFailed || 'Customization Failed'
      progressValue = 0
    } else if (isCustomizeDone) {
      statusMessage =
        dict.workbench?.statusConsole?.customizeCompleted ||
        'Customization Completed'
      progressValue = 100
    }
  } else if (tabValue === 'interview') {
    if (isInterviewPending) {
      statusMessage = 'Generating Interview Tips...'
      progressValue = 66
    } else if (isInterviewDone) {
      statusMessage = 'Interview Tips Generated'
      progressValue = 100
    }
  }

  if (!statusMessage) {
    // Fallback to global status
    const stext = dict.workbench?.statusText || {}
    if (statusDetail) {
      const key = String(statusDetail)
      const mapped = (dict.workbench?.statusText?.[key] as any) || null
      if (mapped) statusMessage = String(mapped)
    }

    if (!statusMessage) {
      // e.g. ocrPending
      const camelKey = (status || '')
        .toLowerCase()
        .replace(/_([a-z])/g, (g) => (g[1] || '').toUpperCase())
        .replace(/_/, '')

      // Try to find in statusConsole first (new standard)
      const statusConsole = dict.workbench?.statusConsole as any
      const consoleMsg = statusConsole?.[camelKey as any]
      if (consoleMsg) statusMessage = String(consoleMsg)

      if (!statusMessage) {
        const statusText = dict.workbench?.statusText as any
        const textMsg = statusText?.[camelKey as any]
        if (textMsg) statusMessage = String(textMsg)
      }
    }

    if (!statusMessage) {
      if (status === 'MATCH_PENDING')
        statusMessage =
          dict.workbench?.statusConsole?.matchPending ||
          'Analyzing match degree...'
      else if (status === 'MATCH_STREAMING')
        statusMessage =
          dict.workbench?.statusConsole?.matchStreaming ||
          'Streaming analysis results...'
      else if (status === 'SUMMARY_PENDING')
        statusMessage =
          dict.workbench?.statusConsole?.summaryPending ||
          'Extracting job details...'
      else if (status === 'SUMMARY_COMPLETED')
        statusMessage =
          dict.workbench?.statusConsole?.summaryCompleted ||
          'Job Details Extracted'
      else if (status === 'OCR_PENDING')
        statusMessage =
          dict.workbench?.statusConsole?.ocrPending ||
          'Extracting text from image...'
      else if (status === 'OCR_COMPLETED')
        statusMessage =
          dict.workbench?.statusConsole?.ocrCompleted ||
          'OCR Extraction Completed'
      else if (status === 'COMPLETED' || status === 'MATCH_COMPLETED')
        statusMessage =
          dict.workbench?.statusConsole?.matchCompleted ||
          'Match Analysis Completed'
      else if (status === 'OCR_FAILED')
        statusMessage =
          dict.workbench?.statusConsole?.ocrFailed || 'OCR Extraction Failed'
      else if (status === 'SUMMARY_FAILED')
        statusMessage =
          dict.workbench?.statusConsole?.summaryFailed ||
          'Job Summary Extraction Failed'
      else if (status === 'MATCH_FAILED')
        statusMessage =
          dict.workbench?.statusConsole?.matchFailed || 'Match Analysis Failed'
      else if (status === 'FAILED') statusMessage = stext.failed || 'Failed'
      else statusMessage = stext.idle || 'Ready'
    }

    // Progress for match
    if (status === 'OCR_PENDING') progressValue = 33
    else if (status === 'OCR_COMPLETED') progressValue = 33
    else if (status === 'SUMMARY_PENDING') progressValue = 66
    else if (status === 'SUMMARY_COMPLETED') progressValue = 66
    else if (status === 'MATCH_PENDING' || status === 'MATCH_STREAMING')
      progressValue = 80
    else if (status === 'COMPLETED' || status === 'MATCH_COMPLETED')
      progressValue = 100
  }

  return {
    currentStep,
    maxUnlockedStep,
    cta,
    statusMessage,
    progressValue,
  }
}
