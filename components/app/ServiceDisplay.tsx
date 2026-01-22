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
// V2 Components (conditionally imported for bundle optimization when V2 is disabled)
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
import { ResultCard } from '@/components/workbench/ResultCard'
import { getServiceErrorMessage } from '@/lib/utils/service-error-handler'
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

import { ServiceNotification } from '@/components/common/ServiceNotification'

import { StepCustomize } from '@/components/workbench/StepCustomize'
import { BatchProgressPanel } from '@/components/workbench/BatchProgressPanel'
import { deriveStage } from '@/lib/utils/workbench-stage'
import { CtaButton } from '@/components/workbench/CtaButton'
import { buildTaskId } from '@/lib/types/task-context'
import { useServiceGuard } from '@/lib/hooks/use-service-guard'

// V2 SSE Integration - Feature flag for gradual rollout
const USE_SSE_V2 = process.env['NEXT_PUBLIC_USE_SSE_V2'] === 'true' || true // Default to V2

// V2 Components (conditionally imported for bundle optimization when V2 is disabled)
import { useWorkbenchV2Bridge } from '@/lib/hooks/useWorkbenchV2Bridge'
import { type WorkbenchStatusV2 } from '@/lib/stores/workbench-v2.store'
import { StatusConsoleV2 } from '@/components/workbench/StatusConsoleV2'
import { StreamPanelV2 } from '@/components/workbench/StreamPanelV2'

// Helper to check terminal status (Legacy V1 Status string)
const isTerminalStatus = (status: string | undefined | null) => {
  return status === 'COMPLETED' || status === 'FAILED'
}

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
  // Restore useTransition for actions
  const [isPending, startTransition] = useTransition()

  // Local state for task switching (e.g. customizations)
  const [matchTaskId, setMatchTaskId] = useState<string | null>(null)

  // Computed Task ID for connection
  const serviceId = initialService?.id || ''
  const initialTaskId = initialService?.executionSessionId
    ? `job_${serviceId}_${initialService.executionSessionId}`
    : undefined
  const taskIdToUse = matchTaskId || initialTaskId

  const v2Bridge = useWorkbenchV2Bridge({
    userId,
    serviceId,
    initialTaskId: taskIdToUse,
    tier: (tierOverride ||
      (quotaBalance && quotaBalance >= getTaskCost('job_match')
        ? 'paid'
        : 'free')) as 'free' | 'paid',
    initialStatus: initialService?.currentStatus,
    skip: !serviceId || isTerminalStatus(initialService?.currentStatus),
  })

  // Aliases and State Mapping
  const status = v2Bridge?.status || 'IDLE'
  // storeStatus alias for legacy compatibility
  const storeStatus = status

  // Content extraction
  let initialMatchJson: any = null
  try {
    const raw = initialService?.match?.matchSummaryJson
    initialMatchJson = raw
      ? typeof raw === 'string'
        ? JSON.parse(raw)
        : raw
      : null
  } catch {
    initialMatchJson = null
  }
  const matchResult = v2Bridge?.matchJson || initialMatchJson || null
  const matchParsed = matchResult

  const isConnected = v2Bridge?.isConnected || false
  const statusDetail = v2Bridge?.statusDetail || ''
  const summaryResult = v2Bridge?.summaryJson || null
  const errorMessage = v2Bridge?.errorMessage || null

  const { setError: setBridgeError, setStatus: setBridgeStatus } =
    v2Bridge || {}

  const setError = (msg: string) => {
    setBridgeError?.(msg)
  }

  // Localized error message computation using secure error handler
  const localizedError = useMemo(() => {
    if (!v2Bridge?.errorMessage) return undefined
    // Use getServiceErrorMessage to sanitize and localize the error
    // If it's a whitelisted code, we get a specific message
    // If it's a raw technical error (e.g. "Parse error..."), we get a generic "Service Unavailable" message
    const dicts = dict?.workbench || {}
    const { description } = getServiceErrorMessage(v2Bridge.errorMessage, dicts)
    console.log('[ServiceDisplay] localizedError:', {
      raw: v2Bridge.errorMessage,
      hasNotification: !!dicts.notification,
      serverErrorDesc: dicts.notification?.serverErrorDesc,
      result: description,
    })
    return description
  }, [v2Bridge?.errorMessage, dict?.workbench])

  // Server state sync: Detect mismatch between server state and V2 bridge
  // If server shows terminal state but V2 still shows active, force sync
  useEffect(() => {
    if (!USE_SSE_V2 || !v2Bridge) return

    const serverMatchStatus = initialService?.job?.matchAnalysisStatus
    const v2Status = v2Bridge.status

    // Skip if no server status available
    if (!serverMatchStatus) return

    // Check for server-V2 mismatch: server is terminal, V2 is still active
    const serverIsTerminal =
      serverMatchStatus === 'COMPLETED' || serverMatchStatus === 'FAILED'
    const v2IsActive =
      v2Status.includes('PENDING') || v2Status.includes('STREAMING')

    if (serverIsTerminal && v2IsActive) {
      console.log('[ServiceDisplay] Server-V2 mismatch detected:', {
        serverMatchStatus,
        v2Status,
        action: 'force_sync',
      })

      // Force V2 status to match server
      // Force V2 status to match server
      let mappedStatus: WorkbenchStatusV2 = 'MATCH_FAILED'

      if (serverMatchStatus === 'COMPLETED') {
        mappedStatus = 'MATCH_COMPLETED'
      } else {
        // Handle FAILURE cases: try to respect the current V2 phase
        if (v2Status.startsWith('SUMMARY')) mappedStatus = 'SUMMARY_FAILED'
        else if (v2Status.startsWith('JOB_VISION'))
          mappedStatus = 'JOB_VISION_FAILED'
        else if (v2Status.startsWith('OCR')) mappedStatus = 'OCR_FAILED'
        else if (v2Status.startsWith('PREMATCH'))
          mappedStatus = 'PREMATCH_FAILED'
        else mappedStatus = 'MATCH_FAILED'
      }

      setBridgeStatus?.(mappedStatus)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialService?.job?.matchAnalysisStatus, v2Bridge?.status])

  // Auto-refresh when COMPLETED to sync server state is now handled by hook

  // Local state
  const [tabValue, setTabValue] = useState<'match' | 'customize' | 'interview'>(
    () => {
      // Smart Default: Deepest completed step
      if (initialService?.interview?.status === 'COMPLETED') return 'interview'
      if (initialService?.customizedResume?.status === 'COMPLETED')
        return 'customize'
      return 'match'
    },
  )
  // Duplicate local state removed
  // streamRef removed

  const [notification, setNotification] = useState<{
    type: 'error' | 'success' | 'info'
    title: string
    description: string
  } | null>(null)

  const showError = (title: string, description: string) => {
    setNotification({ type: 'error', title, description })
  }

  // Track execution tier during customize lifecycle (persisted via localStorage for page refresh)
  const [executionTier, setExecutionTier] = useState<'free' | 'paid' | null>(
    () => {
      if (typeof window !== 'undefined' && initialService?.id) {
        const cached = localStorage.getItem(
          `executionTier_${initialService.id}`,
        )
        if (cached === 'free' || cached === 'paid') return cached
      }
      return null
    },
  )

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
  const hasReceivedSseConfirmation =
    storeStatus === 'CUSTOMIZE_PENDING' ||
    storeStatus === 'CUSTOMIZE_COMPLETED' ||
    storeStatus === 'CUSTOMIZE_FAILED'

  const isTransitionState =
    tabValue === 'customize' &&
    !hasReceivedSseConfirmation &&
    (isPending || customizeStatus === 'PENDING')

  const interviewStatus = initialService?.interview?.status || 'IDLE'

  // Note: isStarting state removed in favor of deriving transition state from isPending + customizeStatus

  // Local parsing logic removed (handled by V2 Bridge)
  const matchJson = initialService?.match?.matchSummaryJson

  const lastUpdatedMatch = initialService?.match?.updatedAt

  // Duplicate status decl removed

  // Calculate current task cost for determining tier
  const currentTaskCost = (() => {
    if (tabValue === 'customize') return getTaskCost('resume_customize')
    if (tabValue === 'interview') return getTaskCost('interview_prep')
    return getTaskCost('job_match')
  })()

  // Tier is 'free' if balance < task cost (will use free model)
  const tier: 'free' | 'paid' =
    tierOverride ?? ((quotaBalance ?? 0) < currentTaskCost ? 'free' : 'paid')

  // Dynamic task ID generation based on stage
  // OCR/Summary phases use "job_" prefix (Free tier vision summary)
  // Match phase uses "match_" prefix
  // Customize/Interview use their respective prefixes set via actions
  const computedTaskId = useMemo(() => {
    // If we have an explicit matchTaskId set (e.g. from customize/interview action), use it
    if (matchTaskId) return matchTaskId

    // If initialService provided a taskId (rare, usually transient), use it
    if (initialService?.taskId) return initialService.taskId

    // Fallback: Construct based on status and executionSessionId
    if (serviceId && initialService?.executionSessionId) {
      // Early stages -> job prefix
      if (
        status === 'IDLE' ||
        status === 'OCR_PENDING' ||
        status === 'OCR_COMPLETED' ||
        status === 'JOB_VISION_PENDING' ||
        status === 'JOB_VISION_STREAMING' ||
        status === 'SUMMARY_PENDING'
      ) {
        return `job_${serviceId}_${initialService.executionSessionId}`
      }
      // Match stages (including SUMMARY_COMPLETED transition) -> match prefix
      return `match_${serviceId}_${initialService.executionSessionId}`
    }
    return null
  }, [matchTaskId, initialService, serviceId, status])

  // Handlers
  // Core customize action (called after free tier confirmation if needed)
  const doCustomize = () => {
    setTabValue('customize') // Switch tab immediately for visual feedback
    setNotification(null)
    startTransition(async () => {
      try {
        const res = await customizeResumeAction({
          serviceId: serviceId!,
          locale,
        })
        console.log('[Frontend] customizeResumeAction result:', res)
        if (res?.ok) {
          if (res.executionSessionId) {
            // Use customize_ prefix (matches backend channel)
            const newTaskId = buildTaskId(
              'customize',
              serviceId!,
              res.executionSessionId,
            )
            console.log('[Frontend] Setting taskId to:', newTaskId)
            setMatchTaskId(newTaskId)
          }
          // Set status and start progress simulation immediately (before SSE confirms)
          setBridgeStatus?.('CUSTOMIZE_PENDING')
        } else {
          setTabValue('match') // Revert tab on failure
          const serviceError = getServiceErrorMessage((res as any).error, {
            statusText: dict.workbench?.statusText,
            notification: dict.workbench?.notification,
          })
          showError(serviceError.title, serviceError.description)
        }
      } catch (e) {
        setTabValue('match')
        console.error(e)
        showError(
          dict.workbench?.customize?.createFailed ||
            'Failed to start customization',
          'An unexpected error occurred.',
        )
      }
    })
  }

  // Guard for Customize
  const customizeGuard = useServiceGuard({
    quotaBalance,
    cost: getTaskCost('resume_customize'),
    dict: dict.workbench?.notification,
    onConfirm: doCustomize,
  })

  // Entry point for customize - shows dialog first if free tier
  const onCustomize = () => {
    const isFree = customizeGuard.isFreeTierMode
    const tierToUse = isFree ? 'free' : 'paid'

    // Persist execution tier for this session (survives page refresh)
    setExecutionTier(tierToUse)
    if (serviceId) {
      localStorage.setItem(`executionTier_${serviceId}`, tierToUse)
    }

    customizeGuard.execute()
  }

  // Core interview action
  const doInterview = () => {
    setNotification(null)
    startTransition(async () => {
      try {
        const res = await generateInterviewTipsAction({
          serviceId: serviceId!,
          locale,
        })
        if (res?.ok) {
          if (res.executionSessionId) {
            // Use interview_ prefix (matches backend channel)
            const newTaskId = buildTaskId(
              'interview',
              serviceId!,
              res.executionSessionId,
            )
            setMatchTaskId(newTaskId)
          }
          setTabValue('interview')
          // Set status and start progress simulation immediately (before SSE confirms)
          setBridgeStatus?.('INTERVIEW_PENDING')
        } else {
          const serviceError = getServiceErrorMessage((res as any).error, {
            statusText: dict.workbench?.statusText,
            notification: dict.workbench?.notification,
          })
          showError(serviceError.title, serviceError.description)
        }
      } catch (e) {
        console.error(e)
        showError(
          'Failed to generate interview tips',
          'An unexpected error occurred.',
        )
      }
    })
  }

  // Guard for Interview
  const interviewGuard = useServiceGuard({
    quotaBalance,
    cost: getTaskCost('interview_prep'),
    dict: dict.workbench?.notification,
    onConfirm: doInterview,
  })

  // Entry point for interview - shows dialog first if free tier
  const onInterview = () => {
    interviewGuard.execute()
  }

  const retryMatchAction = () => {
    startTransition(async () => {
      const { retryMatchAction: serverRetry } =
        await import('@/lib/actions/service.actions')
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
    if (isTerminalStatus(status)) {
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
    if (status === 'MATCH_COMPLETED' || status === 'MATCH_STREAMING') {
      try {
        let txt = String(v2Bridge?.matchContent || '')
        // Strip markdown code blocks if present
        txt = txt.replace(/```json\n?|\n?```/g, '').trim()
        if (txt.startsWith('{') && txt.endsWith('}')) {
          const parsed = JSON.parse(txt)
          if (parsed && typeof parsed === 'object') {
            setMatchLive(parsed)
          }
        }
      } catch {
        // non-fatal
      }
    }
  }, [status, v2Bridge?.matchContent])
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
  // Get simulated progress from V2 Bridge
  const simulatedProgress = v2Bridge?.progress || 0

  const { currentStep, maxUnlockedStep, cta, statusMessage, progressValue } =
    deriveStage(
      status as any,
      customizeStatus,
      interviewStatus,
      dict,
      isPending,
      tabValue,
      statusDetail,
      errorMessage,
      simulatedProgress,
      tier === 'paid',
    )

  // Display cost is 0 for free tier (no coins deducted)
  const displayCost = tier === 'free' ? 0 : currentTaskCost

  const lastUpdated =
    (lastUpdatedMatch as any) ||
    (initialService?.match?.updatedAt as any) ||
    (initialService?.updatedAt as any) ||
    null

  const hasRefreshedJobSummaryRef = useRef(false)

  const jobSummary = initialService?.job?.jobSummaryJson
  let displayCompany = ''
  let displayJob = ''

  if (jobSummary) {
    try {
      const obj =
        typeof jobSummary === 'string' ? JSON.parse(jobSummary) : jobSummary
      displayCompany = obj?.company || obj?.company_name || obj?.org || ''
      displayJob = obj?.jobTitle || obj?.job_title || obj?.title || ''
    } catch {
      displayCompany = ''
      displayJob = ''
    }
  }

  if ((!displayCompany || !displayJob) && v2Bridge) {
    const summaryCandidate = v2Bridge.summaryJson || v2Bridge.visionJson
    if (summaryCandidate && typeof summaryCandidate === 'object') {
      const obj = summaryCandidate as Record<string, unknown>
      const companyCandidate =
        obj['company'] || obj['company_name'] || obj['org']
      const jobCandidate = obj['jobTitle'] || obj['job_title'] || obj['title']

      if (!displayCompany && typeof companyCandidate === 'string') {
        displayCompany = companyCandidate
      }
      if (!displayJob && typeof jobCandidate === 'string') {
        displayJob = jobCandidate
      }
    }
  }

  const hasSummaryEvent = Boolean(v2Bridge?.summaryJson)
  const shouldRefreshJobSummary =
    (!jobSummary && hasSummaryEvent) ||
    (!jobSummary &&
      (status === 'SUMMARY_COMPLETED' ||
        status === 'PREMATCH_PENDING' ||
        status === 'PREMATCH_STREAMING' ||
        status === 'PREMATCH_COMPLETED' ||
        status === 'MATCH_PENDING' ||
        status === 'MATCH_STREAMING' ||
        status === 'MATCH_COMPLETED' ||
        status === 'MATCH_FAILED'))

  useEffect(() => {
    if (shouldRefreshJobSummary && !hasRefreshedJobSummaryRef.current) {
      hasRefreshedJobSummaryRef.current = true
      router.refresh()
    }
  }, [router, shouldRefreshJobSummary])

  const shouldHideConsole =
    (tabValue === 'match' &&
      (status === 'MATCH_COMPLETED' ||
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
    <div className="flex items-center gap-4">
      <CtaButton
        cta={cta}
        tabValue={tabValue}
        customizeStatus={customizeStatus}
        onCustomize={onCustomize}
        onInterview={onInterview}
        onRetryMatch={retryMatchAction}
        setTabValue={setTabValue}
      />
    </div>
  )

  // Determine where to embed the Action Button
  // Retry button should appear at the step that failed
  // Normal flow: customize completed → step 3 (interview), otherwise step 2 (customize)
  const isMatchFailed =
    status === 'OCR_FAILED' ||
    status === 'SUMMARY_FAILED' ||
    status === 'MATCH_FAILED' ||
    status === 'PREMATCH_FAILED' ||
    status === 'JOB_VISION_FAILED'
  const isCustomizeFailed = (customizeStatus as string) === 'FAILED'
  const isInterviewFailed = interviewStatus === 'FAILED'

  const activeActionStep: StepId = isMatchFailed
    ? 1 // Match retry at step 1
    : isInterviewFailed
      ? 3 // Interview retry at step 3
      : isCustomizeFailed || (customizeStatus as string) === 'COMPLETED'
        ? (customizeStatus as string) === 'COMPLETED'
          ? 3
          : 2 // Customize failed→step 2, completed→step 3
        : 2 // Default: step 2 (customize)

  const stepActionNode = cta?.show ? ctaNode : null
  const stepActions = stepActionNode
    ? { [activeActionStep]: stepActionNode }
    : undefined

  return (
    <>
      <div
        className={cn(
          'h-full flex flex-col space-y-4 md:space-y-2', // Increased mobile spacing to prevent overlap
        )}
      >
        {notification && (
          <div className="flex justify-center w-full px-1">
            <div className="w-auto max-w-xl animate-in slide-in-from-top-2 fade-in duration-300">
              <ServiceNotification
                type={notification.type}
                title={notification.title}
                description={notification.description}
                onClose={() => setNotification(null)}
                autoDismiss={3000}
                className="w-auto shadow-md"
              />
            </div>
          </div>
        )}

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
          {...(stepActions ? { stepActions } : {})}
          className="shrink-0"
        />

        {!shouldHideConsole &&
          USE_SSE_V2 &&
          v2Bridge &&
          tabValue === 'match' && (
            // V2 StatusConsole - cleaner props, real-time progress from V2 store
            <StatusConsoleV2
              status={v2Bridge.status}
              statusMessage={v2Bridge.statusMessage || statusMessage}
              progress={v2Bridge.progress || 0}
              tier={tier}
              cost={displayCost}
              isConnected={v2Bridge.isConnected}
              lastEventAt={v2Bridge.lastEventAt}
              errorMessage={localizedError}
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
          <TabsContent
            value="match"
            className="flex-1 flex flex-col min-h-0 overflow-y-auto"
          >
            {/* V2 StreamPanel - uses V2 store content for real-time streaming */}
            {USE_SSE_V2 &&
              v2Bridge &&
              (v2Bridge.status === 'IDLE' ||
                v2Bridge.status === 'OCR_PENDING' ||
                v2Bridge.status === 'OCR_STREAMING' ||
                v2Bridge.status === 'OCR_COMPLETED' ||
                v2Bridge.status === 'JOB_VISION_PENDING' ||
                v2Bridge.status === 'JOB_VISION_STREAMING' ||
                v2Bridge.status === 'JOB_VISION_COMPLETED' ||
                v2Bridge.status === 'PREMATCH_PENDING' ||
                v2Bridge.status === 'PREMATCH_STREAMING' ||
                v2Bridge.status === 'PREMATCH_COMPLETED' ||
                v2Bridge.status === 'SUMMARY_PENDING' ||
                v2Bridge.status === 'SUMMARY_STREAMING' ||
                v2Bridge.status === 'SUMMARY_COMPLETED' ||
                v2Bridge.status === 'MATCH_PENDING' ||
                v2Bridge.status === 'MATCH_STREAMING' ||
                // Also show on failure states to display error message
                v2Bridge.status === 'OCR_FAILED' ||
                v2Bridge.status === 'JOB_VISION_FAILED' ||
                v2Bridge.status === 'SUMMARY_FAILED' ||
                v2Bridge.status === 'PREMATCH_FAILED' ||
                v2Bridge.status === 'MATCH_FAILED') && (
                <div>
                  <StreamPanelV2
                    status={v2Bridge.status}
                    tier={v2Bridge.tier}
                    // Free tier content
                    visionContent={v2Bridge.visionContent}
                    visionJson={v2Bridge.visionJson}
                    // Paid tier content
                    ocrContent={v2Bridge.ocrContent}
                    ocrJson={v2Bridge.ocrJson}
                    summaryContent={v2Bridge.summaryContent}
                    summaryJson={v2Bridge.summaryJson}
                    preMatchContent={v2Bridge.preMatchContent}
                    preMatchJson={v2Bridge.preMatchJson}
                    // Both tiers
                    matchContent={v2Bridge.matchContent}
                    matchJson={v2Bridge.matchJson}
                    errorMessage={localizedError}
                    dict={dict?.workbench?.streamPanel}
                    onRetry={retryMatchAction}
                  />
                </div>
              )}

            {(status === 'MATCH_COMPLETED' || matchResult || matchParsed) &&
              !(
                status === 'MATCH_PENDING' ||
                status === 'MATCH_STREAMING' ||
                status === 'OCR_PENDING' ||
                status === 'JOB_VISION_PENDING' ||
                status === 'JOB_VISION_STREAMING' ||
                status === 'JOB_VISION_COMPLETED' ||
                status === 'PREMATCH_PENDING' ||
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
                    smartPitch: dict.workbench?.resultCard?.smartPitch?.label,
                    copyTooltip:
                      dict.workbench?.resultCard?.smartPitch?.copyTooltip,
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
                    recommendations:
                      dict.workbench?.resultCard?.recommendations,
                    resumeTweak: dict.workbench?.analysis?.resumeTweak,
                    interviewPrep: dict.workbench?.analysis?.interviewPrep,
                    cleanCopied:
                      dict.workbench?.resultCard?.smartPitch?.cleanCopied,
                    definitions: dict.workbench?.resultCard?.definitions,
                    smartPitchDefs:
                      dict.workbench?.resultCard?.smartPitch?.definitions,
                  }}
                />
              )}
            {/* Error-state StreamPanelV2 is now handled by the main panel at L786-828 */}
          </TabsContent>

          <TabsContent
            value="customize"
            className="flex-1 flex flex-col min-h-0"
          >
            {/* Customize Tab Content */}
            {(customizeStatus as string) === 'COMPLETED' &&
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
                {(customizeStatus as string) === 'PENDING' ||
                isTransitionState ? (
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
                ) : (customizeStatus as string) === 'CUSTOMIZE_FAILED' ||
                  (customizeStatus as string) === 'FAILED' ? (
                  <BatchProgressPanel
                    mode="error"
                    title={
                      dict.workbench?.statusConsole?.customizeFailed ||
                      '简历定制失败'
                    }
                    description={
                      // Use executionTier to show correct message based on failed task's tier
                      executionTier === 'free'
                        ? dict?.workbench?.statusConsole?.customizeFailedFree ||
                          '免费模型暂时繁忙，请稍后重试'
                        : dict?.workbench?.statusConsole?.customizeRefunded ||
                          '金币已自动返还，请点击重试'
                    }
                    onRetry={onCustomize}
                    isRetryLoading={isTransitionState || isPending}
                    retryLabel={dict.workbench?.customize?.start || '定制简历'}
                  />
                ) : (customizeStatus as string) === 'COMPLETED' ? (
                  // COMPLETED but data not yet loaded - show loading while router refreshes
                  <BatchProgressPanel
                    title={dict.workbench?.statusText?.loading || '加载中...'}
                    description={
                      dict.workbench?.statusText?.loadingDesc ||
                      '简历定制完成，正在加载...'
                    }
                    progress={100}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 space-y-6 border rounded-md bg-card min-h-[300px]">
                    <div className="text-center space-y-2">
                      <h3 className="text-lg font-semibold">
                        {cta?.disabled
                          ? dict.workbench?.statusConsole?.customizeStarting ||
                            '正在启动定制服务...'
                          : dict.workbench?.statusText?.readyToCustomize ||
                            'Ready to Customize'}
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
                                ),
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
            'md:hidden',
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
                      : 'resume_customize',
                  ),
                ),
              )}
            >
              <Coins className="w-3 h-3 text-yellow-500" />
              {getTaskCost(
                tabValue === 'interview'
                  ? 'interview_prep'
                  : 'resume_customize',
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Lightweight Free Tier Warning Dialogs */}
      {customizeGuard.GuardDialog}
      {interviewGuard.GuardDialog}
    </>
  )
}
