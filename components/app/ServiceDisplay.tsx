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
import { Coins, PenLine, Loader2 } from 'lucide-react'
import { getTaskCost } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import { StepCustomize } from '@/components/workbench/StepCustomize'
import { BatchProgressPanel } from '@/components/workbench/BatchProgressPanel'
import { deriveStage } from '@/lib/utils/workbench-stage'
import { useServiceStatus, isTerminalStatus } from '@/lib/hooks/useServiceStatus'
import { CtaButton } from '@/components/workbench/CtaButton'
import { buildTaskId } from '@/lib/types/task-context'

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

  // Use centralized status hook for server→store sync
  const { status: syncedStatus, serviceId } = useServiceStatus({
    initialService,
    dict,
  })

  // Auto-refresh when COMPLETED to sync server state is now handled by hook

  // Local state
  const [tabValue, setTabValue] = useState<'match' | 'customize' | 'interview'>(
    'match'
  )
  const [matchTaskId, setMatchTaskId] = useState<string | null>(null)
  const streamRef = useRef<HTMLDivElement>(null)
  const [freeTierDialog, setFreeTierDialog] = useState(false)
  const [pendingAction, setPendingAction] = useState<'customize' | 'interview' | null>(null)

  // Track execution tier during customize lifecycle (persisted via localStorage for page refresh)
  const [executionTier, setExecutionTier] = useState<'free' | 'paid' | null>(() => {
    if (typeof window !== 'undefined' && initialService?.id) {
      const cached = localStorage.getItem(`executionTier_${initialService.id}`)
      if (cached === 'free' || cached === 'paid') return cached
    }
    return null
  })

  // Derived state - serviceId now comes from useServiceStatus hook

  // Derive customizeStatus from store AND server (store takes precedence for active states)
  const customizeStatus =
    storeStatus === 'CUSTOMIZE_PENDING'
      ? 'PENDING'
      : storeStatus === 'CUSTOMIZE_COMPLETED'
        ? 'COMPLETED'
        : storeStatus === 'CUSTOMIZE_FAILED'
          ? 'FAILED'
          : initialService?.customizedResume?.status || 'IDLE'

  // Transition state: customize tab selected but SSE hasn't confirmed task started yet
  // Once store shows CUSTOMIZE_PENDING from SSE, we're no longer in transition
  const hasReceivedSseConfirmation = storeStatus === 'CUSTOMIZE_PENDING' ||
    storeStatus === 'CUSTOMIZE_COMPLETED' ||
    storeStatus === 'CUSTOMIZE_FAILED'

  const isTransitionState = tabValue === 'customize' &&
    !hasReceivedSseConfirmation &&
    (isPending || customizeStatus === 'PENDING')

  const interviewStatus = initialService?.interview?.status || 'IDLE'

  // Note: isStarting state removed in favor of deriving transition state from isPending + customizeStatus

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
  } catch {
    // non-fatal: malformed matchJson should not crash render
  }

  const lastUpdatedMatch = initialService?.match?.updatedAt

  const status = storeStatus

  // Initialize matchTaskId from initialService ONLY if not already set
  // This prevents overwriting taskId set by doCustomize/doInterview
  useEffect(() => {
    if (initialService?.executionSessionId && !matchTaskId) {
      const newTaskId = `match_${serviceId}_${initialService.executionSessionId}`
      setMatchTaskId(newTaskId)
    }
  }, [initialService, matchTaskId, serviceId])

  // SSE taskId: Use matchTaskId (which may have customize/interview prefix)
  // Only fallback to initialService?.taskId if matchTaskId not set
  const currentTaskId = matchTaskId || initialService?.taskId

  useSseStream(
    userId,
    serviceId || '',
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

  // Progress simulation timer: update every 5s during batch task execution
  useEffect(() => {
    const isPendingBatchTask = status === 'CUSTOMIZE_PENDING' || status === 'INTERVIEW_PENDING'
    if (!isPendingBatchTask) return

    const interval = setInterval(() => {
      useWorkbenchStore.getState().updateSimulatedProgress()
    }, 3000) // Updated to 3s for smoother progress

    return () => clearInterval(interval)
  }, [status])

  // Handlers
  // Helper: Check if user will enter free tier for a given task
  const willBeFree = (taskCost: number) => {
    const balance = quotaBalance ?? 0
    return balance < taskCost
  }

  // Core customize action (called after free tier confirmation if needed)
  const doCustomize = () => {
    setTabValue('customize') // Switch tab immediately for visual feedback
    startTransition(async () => {
      const res = await customizeResumeAction({ serviceId: serviceId!, locale })
      console.log('[Frontend] customizeResumeAction result:', res)
      if (res?.ok) {
        if (res.executionSessionId) {
          // Set task context first for state tracking
          useWorkbenchStore.getState().startTaskContext('customize', res.executionSessionId)

          // Use customize_ prefix (matches backend channel)
          const newTaskId = buildTaskId('customize', serviceId!, res.executionSessionId)
          console.log('[Frontend] Setting taskId to:', newTaskId)
          setMatchTaskId(newTaskId)
        }
        // Set status and start progress simulation immediately (before SSE confirms)
        // This prevents the 10% → 0% → 10% flash using atomic update
        useWorkbenchStore.getState().setStatusAndStartProgress('CUSTOMIZE_PENDING')
        // NOTE: Removed router.refresh() - let SSE stream handle status updates
        // This prevents useServiceStatus from overwriting our CUSTOMIZE_PENDING
      } else {
        setTabValue('match') // Revert tab on failure
        toast.error(
          dict.workbench.customize.createFailed ||
          'Failed to start customization'
        )
      }
    })
  }

  // Entry point for customize - shows dialog first if free tier
  const onCustomize = () => {
    const cost = getTaskCost('resume_customize')
    const willUseFree = willBeFree(cost)
    const tierToUse = willUseFree ? 'free' : 'paid'

    // Persist execution tier for this session (survives page refresh)
    setExecutionTier(tierToUse)
    if (serviceId) {
      localStorage.setItem(`executionTier_${serviceId}`, tierToUse)
    }

    if (willUseFree) {
      setPendingAction('customize')
      setFreeTierDialog(true)
    } else {
      doCustomize()
    }
  }

  // Core interview action
  const doInterview = () => {
    startTransition(async () => {
      const res = await generateInterviewTipsAction({ serviceId: serviceId!, locale })
      if (res?.ok) {
        if (res.executionSessionId) {
          // Set task context first for state tracking
          useWorkbenchStore.getState().startTaskContext('interview', res.executionSessionId)

          // Use interview_ prefix (matches backend channel)
          const newTaskId = buildTaskId('interview', serviceId!, res.executionSessionId)
          setMatchTaskId(newTaskId)
        }
        setTabValue('interview')
        // Set status and start progress simulation immediately (before SSE confirms)
        useWorkbenchStore.getState().setStatusAndStartProgress('INTERVIEW_PENDING')
        // NOTE: Removed router.refresh() - let SSE stream handle status updates
      } else {
        toast.error('Failed to generate interview tips')
      }
    })
  }

  // Entry point for interview - shows dialog first if free tier
  const onInterview = () => {
    const cost = getTaskCost('interview_prep')
    if (willBeFree(cost)) {
      setPendingAction('interview')
      setFreeTierDialog(true)
    } else {
      doInterview()
    }
  }

  const retryMatchAction = () => {
    startTransition(async () => {
      const { retryMatchAction: serverRetry } = await import(
        '@/lib/actions/service.actions'
      )
      const res = await serverRetry({ locale, serviceId: serviceId! })
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

  // Clear executionTier only on success
  // On failure, keep it so error panel can show correct message
  // Tier will be recalculated on retry (onCustomize sets it fresh)
  useEffect(() => {
    if (customizeStatus === 'COMPLETED') {
      setExecutionTier(null)
      if (serviceId) {
        localStorage.removeItem(`executionTier_${serviceId}`)
      }
    }
  }, [customizeStatus, serviceId])

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
      } catch {
        // non-fatal: malformed streaming JSON should not crash
      }
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
  } catch {
    // non-fatal: malformed interviewJson should not crash render
  }

  // Get simulated progress from store
  const simulatedProgress = useWorkbenchStore((s) => s.progressSimulation.currentProgress)

  const { currentStep, maxUnlockedStep, cta, statusMessage, progressValue } =
    deriveStage(
      status,
      customizeStatus,
      interviewStatus,
      dict,
      isPending,
      tabValue,
      statusDetail,
      errorMessage,
      simulatedProgress
    )

  // Calculate current task cost for determining tier
  const currentTaskCost = (() => {
    if (tabValue === 'customize') return getTaskCost('resume_customize')
    if (tabValue === 'interview') return getTaskCost('interview_prep')
    return getTaskCost('job_match')
  })()

  // Tier is 'free' if balance < task cost (will use free model)
  const tier: 'free' | 'paid' =
    tierOverride ?? ((quotaBalance ?? 0) < currentTaskCost ? 'free' : 'paid')

  // Display cost is 0 for free tier (no coins deducted)
  const displayCost = tier === 'free' ? 0 : currentTaskCost

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
    } catch {
      // non-fatal: malformed jobSummary should not crash render
    }
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

  // CTA Node for Desktop Headers - now uses extracted component
  const ctaNode = (
    <CtaButton
      cta={cta}
      tabValue={tabValue}
      customizeStatus={customizeStatus}
      onCustomize={onCustomize}
      onInterview={onInterview}
      onRetryMatch={retryMatchAction}
      setTabValue={setTabValue}
    />
  )

  return (
    <>
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
                : isTransitionState
                  ? 'streaming'  // Transition state: show as streaming
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
            statusMessage={
              // Override status message during transition state
              isTransitionState
                ? (dict.workbench?.statusConsole?.customizeStarting || '正在启动定制服务...')
                : statusMessage
            }
            progress={
              // Hide progress during transition state
              isTransitionState
                ? 0
                : progressValue
            }
            isConnected={isConnected}
            lastUpdated={lastUpdated ? new Date(lastUpdated) : null}
            tier={
              // Use executionTier during customize lifecycle
              tabValue === 'customize'
                ? (customizeStatus === 'PENDING' || isTransitionState)
                  ? executionTier ?? undefined  // Show actual tier used for this execution
                  : customizeStatus === 'FAILED'
                    ? undefined  // Don't show tier on failure (next attempt may differ)
                    : tier  // IDLE: show potential tier
                : tier
            }
            cost={
              // Use correct cost based on execution tier during customize
              tabValue === 'customize'
                ? (customizeStatus === 'PENDING' || isTransitionState)
                  ? (executionTier === 'free' ? 0 : currentTaskCost)  // Show actual cost
                  : customizeStatus === 'FAILED'
                    ? 0  // Don't show cost on failure
                    : displayCost  // IDLE: show potential cost
                : displayCost
            }
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
                    onRetry={retryMatchAction}
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
                dict={dict.resume}
              />
            ) : (
              <>
                {customizeStatus === 'PENDING' || isTransitionState ? (
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
                  <BatchProgressPanel
                    mode="error"
                    title={
                      dict.workbench?.statusConsole?.customizeFailed ||
                      '简历定制失败'
                    }
                    description={
                      // Use executionTier to show correct message based on failed task's tier
                      executionTier === 'free'
                        ? (dict?.workbench?.statusConsole?.customizeFailedFree ||
                          '免费模型暂时繁忙，请稍后重试')
                        : (dict?.workbench?.statusConsole?.customizeRefunded ||
                          '金币已自动返还，请点击重试')
                    }
                    onRetry={onCustomize}
                    isRetryLoading={isTransitionState || isPending}
                    retryLabel={dict.workbench?.customize?.start || '定制简历'}
                  />
                ) : customizeStatus === 'COMPLETED' ? (
                  // COMPLETED but data not yet loaded - show loading while router refreshes
                  <BatchProgressPanel
                    title={dict.workbench?.statusText?.loading || '加载中...'}
                    description={dict.workbench?.statusText?.loadingDesc || '简历定制完成，正在加载...'}
                    progress={100}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 space-y-6 border rounded-md bg-card min-h-[300px]">
                    <div className="text-center space-y-2">
                      <h3 className="text-lg font-semibold">
                        {cta?.disabled
                          ? (dict.workbench?.statusConsole?.customizeStarting || '正在启动定制服务...')
                          : (dict.workbench?.statusText?.readyToCustomize || 'Ready to Customize')}
                      </h3>
                      {/* Only show guide text when button is clickable */}
                      {!cta?.disabled && (
                        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                          {dict.workbench?.statusText?.readyToCustomizeDesc ||
                            'Click "Start Customization" below to generate a tailored resume based on the job description.'}
                        </p>
                      )}
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
      </div >

      {/* Lightweight Free Tier Warning Dialog */}
      < Dialog open={freeTierDialog} onOpenChange={(open) => {
        setFreeTierDialog(open)
        if (!open) setPendingAction(null)
      }
      }>
        <DialogContent
          className="sm:max-w-[360px] p-4"
          overlayClassName="bg-zinc-300/20 dark:bg-zinc-800/20 backdrop-blur-xs"
        >
          <DialogHeader className="pb-2">
            <DialogTitle className="text-base font-medium flex items-center gap-2">
              <PenLine className="w-4 h-4 text-blue-500" />
              {dict.workbench?.freeTierDialog?.title || '免费体验模式'}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground pt-1">
              {dict.workbench?.freeTierDialog?.description ||
                '当前使用免费模型，建议充值获得更深入的定制服务'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2 flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFreeTierDialog(false)
                setPendingAction(null)
              }}
              className="text-xs"
            >
              {dict.workbench?.freeTierDialog?.cancel || '取消'}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setFreeTierDialog(false)
                // Immediately switch to target tab for perceived responsiveness
                if (pendingAction === 'customize') {
                  setTabValue('customize')
                  doCustomize()
                } else if (pendingAction === 'interview') {
                  setTabValue('interview')
                  doInterview()
                }
                setPendingAction(null)
              }}
              className="text-xs"
            >
              {dict.workbench?.freeTierDialog?.continue || '继续'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog >
    </>
  )
}

