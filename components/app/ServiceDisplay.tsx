'use client'
import {
  useEffect,
  useTransition,
  useState,
  useRef,
  useMemo,
  useCallback,
} from 'react'
import type { Locale } from '@/i18n-config'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import {
  AppCard,
  AppCardContent,
  AppCardHeader,
  AppCardTitle,
} from '@/components/app/AppCard'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
// V2 Components (conditionally imported for bundle optimization when V2 is disabled)
import {
  customizeResumeAction,
  generateInterviewTipsAction,
} from '@/lib/actions/service.actions'
import { useRouter } from 'next/navigation'
import { MarkdownEditor } from '@/components/app/MarkdownEditor'
import { saveCustomizedResumeAction } from '@/lib/actions/service.actions'
import { uiLog } from '@/lib/ui/sse-debug-logger'
import {
  StepperProgress,
  type StepId,
} from '@/components/workbench/StepperProgress'
import {
  ResultCard,
  buildMatchResultCopyText,
} from '@/components/workbench/ResultCard'
import {
  InterviewBattlePlan,
  buildInterviewBattlePlanCopyText,
} from '@/components/workbench/interview/InterviewBattlePlan'
import { getServiceErrorMessage } from '@/lib/utils/service-error-handler'
import {
  Coins,
  PenLine,
  Loader2,
  Menu,
  Printer,
  Copy,
  Check,
  ChevronUp,
  ChevronDown,
  ListOrdered,
} from 'lucide-react'
import { getTaskCost } from '@/lib/constants'
import { cn, getMatchScore, getMatchThemeColor } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'
import { createPortal } from 'react-dom'
import { ThemeToggle } from '@/components/app/ThemeToggle'
import { I18nToggleCompact } from '@/components/app/I18nToggleCompact'
import { UserMenu } from '@/components/app/UserMenu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import { ServiceNotification } from '@/components/common/ServiceNotification'

import { StepCustomize } from '@/components/workbench/StepCustomize'
import { BatchProgressPanel } from '@/components/workbench/BatchProgressPanel'
import { deriveStage } from '@/lib/utils/workbench-stage'
import { CtaButton } from '@/components/workbench/CtaButton'
import { buildTaskId } from '@/lib/types/task-context'
import { useServiceGuard } from '@/lib/hooks/use-service-guard'
import { getTaskPrefix, mapToStatus } from '@/lib/ui/sse-event-processor'
import {
  WORKBENCH_CUSTOMIZE_REFRESH_DELAY_MS,
  WORKBENCH_CUSTOMIZE_REFRESH_RETRY_MAX,
  WORKBENCH_CUSTOMIZE_REFRESH_RETRY_MS,
  WORKBENCH_REFRESH_GUARD_MS,
} from '@/lib/constants'

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

const getStatusRank = (status: WorkbenchStatusV2 | null | undefined) => {
  if (!status || status === 'IDLE') return 0
  if (status.startsWith('INTERVIEW')) return 3
  if (status.startsWith('CUSTOMIZE')) return 2
  return 1
}

const pickEffectiveStatus = (
  rawStatus: WorkbenchStatusV2,
  serverStatus: WorkbenchStatusV2 | null,
  dataStatus: WorkbenchStatusV2 | null,
  trustRawStatus: boolean,
): WorkbenchStatusV2 => {
  if (trustRawStatus && rawStatus && rawStatus !== 'IDLE') return rawStatus
  const fallbackStatus = serverStatus || dataStatus || 'IDLE'
  const candidates = [
    trustRawStatus ? rawStatus : null,
    serverStatus,
    dataStatus,
  ].filter(Boolean) as WorkbenchStatusV2[]
  if (!candidates.length) return fallbackStatus
  const maxRank = Math.max(...candidates.map(getStatusRank))
  if (trustRawStatus && getStatusRank(rawStatus) === maxRank) return rawStatus
  if (serverStatus && getStatusRank(serverStatus) === maxRank)
    return serverStatus
  if (dataStatus && getStatusRank(dataStatus) === maxRank) return dataStatus
  return fallbackStatus
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
  const refreshGuardRef = useRef(0)
  const requestRefresh = useCallback(() => {
    const now = Date.now()
    if (now - refreshGuardRef.current < WORKBENCH_REFRESH_GUARD_MS) return
    refreshGuardRef.current = now
    router.refresh()
  }, [router])

  // Local state for task switching (e.g. customizations)
  const [matchTaskId, setMatchTaskId] = useState<string | null>(null)
  // Computed Task ID for connection
  const serviceId = initialService?.id || ''
  const initialStatusV2 = initialService?.currentStatus
    ? mapToStatus(initialService.currentStatus)
    : null
  const initialTaskPrefix = initialStatusV2
    ? getTaskPrefix(initialStatusV2)
    : 'job'
  const initialTaskId = initialService?.executionSessionId
    ? `${initialTaskPrefix}_${serviceId}_${initialService.executionSessionId}`
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

  const matchBase = initialService?.match ?? null
  const customizedResumeBase = initialService?.customizedResume ?? null
  const interviewBase = initialService?.interview ?? null
  const trustRawStatus = v2Bridge?.bridgeServiceId === serviceId
  const rawStatus = v2Bridge?.status || 'IDLE'
  const serverStatus = initialService?.currentStatus
    ? mapToStatus(initialService.currentStatus)
    : null
  const dataStatus: WorkbenchStatusV2 | null = (() => {
    if (interviewBase?.status === 'COMPLETED') return 'INTERVIEW_COMPLETED'
    if (interviewBase?.status === 'FAILED') return 'INTERVIEW_FAILED'
    if (customizedResumeBase?.status === 'COMPLETED')
      return 'CUSTOMIZE_COMPLETED'
    if (customizedResumeBase?.status === 'FAILED') return 'CUSTOMIZE_FAILED'
    if (matchBase?.status === 'COMPLETED') return 'MATCH_COMPLETED'
    if (matchBase?.status === 'FAILED') return 'MATCH_FAILED'
    return null
  })()
  const hasInterviewData = Boolean(interviewBase?.interviewTipsJson)
  const baseStatus = pickEffectiveStatus(
    rawStatus,
    serverStatus,
    dataStatus,
    trustRawStatus,
  )
  const status =
    hasInterviewData && !baseStatus.startsWith('INTERVIEW')
      ? 'INTERVIEW_COMPLETED'
      : baseStatus
  const storeStatus = trustRawStatus ? rawStatus : 'IDLE'

  // Content extraction
  let initialMatchJson: any = null
  try {
    const raw = matchBase?.matchSummaryJson
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
    if (process.env.NODE_ENV === 'development') {
      uiLog.debug('ServiceDisplay localizedError', {
        raw: v2Bridge.errorMessage,
        hasNotification: !!dicts.notification,
        serverErrorDesc: dicts.notification?.serverErrorDesc,
        result: description,
      })
    }
    return description
  }, [v2Bridge?.errorMessage, dict?.workbench])

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
  const lastServiceIdRef = useRef<string | null>(null)
  const lastExecutionSessionIdRef = useRef<string | null>(null)
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

  const [interviewExecutionTier, setInterviewExecutionTier] = useState<
    'free' | 'paid' | null
  >(() => {
    if (typeof window !== 'undefined' && initialService?.id) {
      const cached = localStorage.getItem(
        `executionTier_interview_${initialService.id}`,
      )
      if (cached === 'free' || cached === 'paid') return cached
    }
    return null
  })

  // Derived state - serviceId now comes from useServiceStatus hook

  const customizeStatus = (() => {
    if (status.startsWith('CUSTOMIZE')) {
      if (status === 'CUSTOMIZE_PENDING') return 'PENDING'
      if (status === 'CUSTOMIZE_FAILED') return 'FAILED'
      return 'COMPLETED'
    }
    if (status.startsWith('INTERVIEW')) return 'COMPLETED'
    return customizedResumeBase?.status || 'IDLE'
  })()

  const hasReceivedSseConfirmation =
    storeStatus === 'CUSTOMIZE_PENDING' ||
    storeStatus === 'CUSTOMIZE_COMPLETED' ||
    storeStatus === 'CUSTOMIZE_FAILED'

  const isTransitionState =
    tabValue === 'customize' &&
    !hasReceivedSseConfirmation &&
    (isPending || customizeStatus === 'PENDING')

  const interviewStatus = (() => {
    if (status.startsWith('INTERVIEW')) {
      if (status === 'INTERVIEW_PENDING' || status === 'INTERVIEW_STREAMING')
        return 'PENDING'
      if (status === 'INTERVIEW_FAILED') return 'FAILED'
      if (status === 'INTERVIEW_COMPLETED') return 'COMPLETED'
    }
    return interviewBase?.status || 'IDLE'
  })()

  const isInterviewTransitionState =
    tabValue === 'interview' && interviewStatus === 'IDLE' && isPending
  const isInterviewGenerating =
    interviewStatus === 'PENDING' || isInterviewTransitionState

  // Note: isStarting state removed in favor of deriving transition state from isPending + customizeStatus

  // Local parsing logic removed (handled by V2 Bridge)
  const matchJson = matchBase?.matchSummaryJson

  const lastUpdatedMatch = matchBase?.updatedAt

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
    if (matchTaskId) return matchTaskId

    if (initialService?.taskId) return initialService.taskId

    const sessionId = initialService?.executionSessionId
    if (!serviceId || !sessionId) return null

    const statusSource =
      status !== 'IDLE' ? status : initialService?.currentStatus
    const statusText = String(statusSource || '')

    if (
      statusText.startsWith('CUSTOMIZE') ||
      statusText.startsWith('INTERVIEW')
    ) {
      const prefix = statusText.startsWith('CUSTOMIZE')
        ? 'customize'
        : 'interview'
      return `${prefix}_${serviceId}_${sessionId}`
    }

    if (
      statusText.startsWith('MATCH') ||
      statusText === 'SUMMARY_COMPLETED' ||
      statusText.startsWith('PREMATCH')
    ) {
      return `match_${serviceId}_${sessionId}`
    }

    return `job_${serviceId}_${sessionId}`
  }, [matchTaskId, initialService, serviceId, status])

  // Handlers
  // Core customize action (called after free tier confirmation if needed)
  const doCustomize = () => {
    setNotification(null)
    setTabValue('customize')
    startTransition(async () => {
      try {
        const res = await customizeResumeAction({
          serviceId: serviceId!,
          locale,
        })
        if (process.env.NODE_ENV === 'development') {
          uiLog.debug('customizeResumeAction result', { result: res })
        }
        if (res?.ok) {
          if (res.executionSessionId) {
            // Use customize_ prefix (matches backend channel)
            const newTaskId = buildTaskId(
              'customize',
              serviceId!,
              res.executionSessionId,
            )
            if (process.env.NODE_ENV === 'development') {
              uiLog.debug('customize setTaskId', { taskId: newTaskId })
            }
            setMatchTaskId(newTaskId)
          }
          setTabValue('customize')
          // Set status and start progress simulation immediately (before SSE confirms)
          setBridgeStatus?.('CUSTOMIZE_PENDING')
        } else {
          const serviceError = getServiceErrorMessage((res as any).error, {
            statusText: dict.workbench?.statusText,
            notification: dict.workbench?.notification,
          })
          showError(serviceError.title, serviceError.description)
        }
      } catch (e) {
        if (process.env.NODE_ENV === 'development') {
          uiLog.error('customize action error', { error: e })
        }
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
    const isFree = (quotaBalance ?? 0) < getTaskCost('interview_prep')
    const tierToUse = isFree ? 'free' : 'paid'
    setInterviewExecutionTier(tierToUse)
    if (serviceId) {
      localStorage.setItem(`executionTier_interview_${serviceId}`, tierToUse)
    }
    setNotification(null)
    setTabValue('interview')
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
        if (process.env.NODE_ENV === 'development') {
          uiLog.error('interview action error', { error: e })
        }
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
    setBridgeStatus?.('MATCH_PENDING')
    setTabValue('match')
    startTransition(async () => {
      const { retryMatchAction: serverRetry } =
        await import('@/lib/actions/service.actions')
      const res = await serverRetry({ locale, serviceId: serviceId! })
      if (res?.ok) {
        if (res.executionSessionId) {
          setMatchTaskId(`match_${serviceId}_${String(res.executionSessionId)}`)
        }
        requestRefresh()
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
      requestRefresh()
    }
  }, [requestRefresh, status])

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

  useEffect(() => {
    if (interviewStatus === 'COMPLETED') {
      setInterviewExecutionTier(null)
      if (serviceId) {
        localStorage.removeItem(`executionTier_interview_${serviceId}`)
      }
    }
  }, [interviewStatus, serviceId])

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
  const interviewJson =
    interviewBase?.interviewTipsJson || v2Bridge?.interviewJson || null
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
  const shouldShowInterviewPlan =
    Boolean(interviewParsed) && !isInterviewGenerating
  const shouldShowInterviewLoading =
    interviewStatus === 'COMPLETED' && !interviewParsed

  const interviewBattlePlanLabels = useMemo(
    () => ({
      title: dict.workbench?.interviewBattlePlan?.title || '面试作战手卡',
      print: dict.workbench?.interviewBattlePlan?.print || '打印',
      copy: dict.workbench?.interviewBattlePlan?.copy || '复制全文',
      copied: dict.workbench?.interviewBattlePlan?.copied || '已复制',
      regenerate: dict.workbench?.interviewBattlePlan?.regenerate || '重新生成',
      radar: {
        title: dict.workbench?.interviewBattlePlan?.radar?.title || '情报透视',
        coreChallenges:
          dict.workbench?.interviewBattlePlan?.radar?.coreChallenges ||
          '核心挑战',
        challenge:
          dict.workbench?.interviewBattlePlan?.radar?.challenge || '挑战',
        whyImportant:
          dict.workbench?.interviewBattlePlan?.radar?.whyImportant ||
          '为何重要',
        yourAngle:
          dict.workbench?.interviewBattlePlan?.radar?.yourAngle || '你的切入点',
        interviewRounds:
          dict.workbench?.interviewBattlePlan?.radar?.interviewRounds ||
          '面试链路',
        round:
          dict.workbench?.interviewBattlePlan?.radar?.round || '第{round}轮',
        focus: dict.workbench?.interviewBattlePlan?.radar?.focus || '考察重点',
        hiddenRequirements:
          dict.workbench?.interviewBattlePlan?.radar?.hiddenRequirements ||
          '隐藏要求',
      },
      hook: {
        title: dict.workbench?.interviewBattlePlan?.hook?.title || '开场定调',
        ppfScript:
          dict.workbench?.interviewBattlePlan?.hook?.ppfScript ||
          'P-P-F 自我介绍脚本',
        keyHooks:
          dict.workbench?.interviewBattlePlan?.hook?.keyHooks || '关键钩子',
        hook: dict.workbench?.interviewBattlePlan?.hook?.hook || '钩子',
        evidenceSource:
          dict.workbench?.interviewBattlePlan?.hook?.evidenceSource || '来源',
        deliveryTips:
          dict.workbench?.interviewBattlePlan?.hook?.deliveryTips || '演讲技巧',
        copy: dict.workbench?.interviewBattlePlan?.copy || '复制',
        copied: dict.workbench?.interviewBattlePlan?.copied || '已复制',
      },
      evidence: {
        title:
          dict.workbench?.interviewBattlePlan?.evidence?.title || '核心论据',
        storyTitle:
          dict.workbench?.interviewBattlePlan?.evidence?.storyTitle ||
          '故事标题',
        storyLabel:
          dict.workbench?.interviewBattlePlan?.evidence?.storyLabel || '故事',
        storyCount:
          dict.workbench?.interviewBattlePlan?.evidence?.storyCount ||
          '{count} 个故事',
        matchedPainPoint:
          dict.workbench?.interviewBattlePlan?.evidence?.matchedPainPoint ||
          '对应 JD 痛点',
        situation:
          dict.workbench?.interviewBattlePlan?.evidence?.situation || '背景',
        task: dict.workbench?.interviewBattlePlan?.evidence?.task || '任务',
        action: dict.workbench?.interviewBattlePlan?.evidence?.action || '行动',
        result: dict.workbench?.interviewBattlePlan?.evidence?.result || '结果',
        impact:
          dict.workbench?.interviewBattlePlan?.evidence?.impact || '量化影响',
        source: dict.workbench?.interviewBattlePlan?.evidence?.source || '来源',
        sourceResume:
          dict.workbench?.interviewBattlePlan?.evidence?.sourceResume || '简历',
        sourceDetailedResume:
          dict.workbench?.interviewBattlePlan?.evidence?.sourceDetailedResume ||
          '详细履历',
      },
      defense: {
        title:
          dict.workbench?.interviewBattlePlan?.defense?.title || '弱项演练',
        weakness:
          dict.workbench?.interviewBattlePlan?.defense?.weakness || '弱点',
        anticipatedQuestion:
          dict.workbench?.interviewBattlePlan?.defense?.anticipatedQuestion ||
          '预判追问',
        defenseScript:
          dict.workbench?.interviewBattlePlan?.defense?.defenseScript ||
          '防御话术',
        supportingEvidence:
          dict.workbench?.interviewBattlePlan?.defense?.supportingEvidence ||
          '支撑证据',
        weaknessCount:
          dict.workbench?.interviewBattlePlan?.defense?.weaknessCount ||
          '{count} 个弱点',
      },
      reverse: {
        title:
          dict.workbench?.interviewBattlePlan?.reverse?.title || '提问利器',
        question:
          dict.workbench?.interviewBattlePlan?.reverse?.question || '问题',
        askIntent:
          dict.workbench?.interviewBattlePlan?.reverse?.askIntent || '提问意图',
        listenFor:
          dict.workbench?.interviewBattlePlan?.reverse?.listenFor || '倾听重点',
      },
      knowledgeRefresh: {
        title:
          dict.workbench?.interviewBattlePlan?.knowledgeRefresh?.title ||
          '知识补课',
      },
    }),
    [dict],
  )

  const interviewScrollRef = useRef<HTMLDivElement | null>(null)
  const ibpTocItems = useMemo(() => {
    if (!interviewParsed) return [] as Array<{ id: string; label: string }>

    const items: Array<{ id: string; label: string }> = []
    if (interviewParsed?.radar)
      items.push({
        id: 'ibp-radar',
        label: interviewBattlePlanLabels.radar.title,
      })
    if (interviewParsed?.hook)
      items.push({
        id: 'ibp-hook',
        label: interviewBattlePlanLabels.hook.title,
      })
    if (interviewParsed?.evidence?.length)
      items.push({
        id: 'ibp-evidence',
        label: interviewBattlePlanLabels.evidence.title,
      })
    if (interviewParsed?.defense?.length)
      items.push({
        id: 'ibp-defense',
        label: interviewBattlePlanLabels.defense.title,
      })
    if (interviewParsed?.reverse_questions?.length)
      items.push({
        id: 'ibp-reverse',
        label: interviewBattlePlanLabels.reverse.title,
      })
    if (interviewParsed?.knowledge_refresh?.length)
      items.push({
        id: 'ibp-knowledge',
        label: interviewBattlePlanLabels.knowledgeRefresh.title,
      })
    return items
  }, [interviewParsed, interviewBattlePlanLabels])
  const [activeIbpSection, setActiveIbpSection] = useState<string>('')
  const [tocOpen, setTocOpen] = useState(false)
  const ibpRecalcRef = useRef<(() => void) | null>(null)

  const scrollToIbpSection = (id: string) => {
    const root = interviewScrollRef.current
    const el = root?.querySelector(`#${id}`) as HTMLElement | null
    if (root && el) {
      const rootRect = root.getBoundingClientRect()
      const elRect = el.getBoundingClientRect()
      root.scrollTo({
        top: root.scrollTop + (elRect.top - rootRect.top) - 16,
        behavior: 'smooth',
      })
    }
    const fallback = document.getElementById(id)
    if (!root || !el || root.scrollHeight <= root.clientHeight + 4) {
      fallback?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const handleIbpTop = () => {
    if (tabValue !== 'interview') setTabValue('interview')
    const scrollToTop = () => {
      const root = interviewScrollRef.current
      if (root) root.scrollTo({ top: 0, behavior: 'smooth' })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    scrollToTop()
    window.setTimeout(scrollToTop, 240)
  }

  const handleIbpToc = (id: string) => {
    if (tabValue !== 'interview') setTabValue('interview')
    const run = () => scrollToIbpSection(id)
    window.requestAnimationFrame(run)
    window.setTimeout(run, 240)
  }

  useEffect(() => {
    if (tabValue !== 'interview') {
      setActiveIbpSection('')
      return
    }
    if (ibpTocItems[0]?.id) setActiveIbpSection(ibpTocItems[0].id)
  }, [tabValue, ibpTocItems])

  useEffect(() => {
    if (tabValue !== 'interview') return
    if (interviewStatus !== 'COMPLETED') return
    let root: HTMLDivElement | null = null
    let raf = 0
    let initRaf = 0
    let retryRaf = 0
    let timeoutId: number | undefined
    let resizeObserver: ResizeObserver | null = null
    let mutationObserver: MutationObserver | null = null
    let handleScroll: (() => void) | null = null
    let handleResize: (() => void) | null = null

    const setup = () => {
      root = interviewScrollRef.current
      if (!root) {
        retryRaf = window.requestAnimationFrame(setup)
        return
      }
      if (ibpTocItems.length === 0) return

      if (ibpTocItems[0]?.id) {
        setActiveIbpSection(ibpTocItems[0].id)
      }

      const getSections = () => {
        const rootRect = root!.getBoundingClientRect()
        const isScrollWindow = root!.scrollHeight <= root!.clientHeight + 4
        return ibpTocItems
          .map((item) => {
            const el = root!.querySelector(`#${item.id}`) as HTMLElement | null
            if (!el) return null
            const rect = el.getBoundingClientRect()
            return {
              id: item.id,
              top: isScrollWindow ? rect.top + window.scrollY - 100 : rect.top - rootRect.top + root!.scrollTop,
            }
          })
          .filter((s) => s != null) as Array<{ id: string; top: number }>
      }

      const onScroll = () => {
        if (raf) return
        raf = window.requestAnimationFrame(() => {
          raf = 0
          const sections = getSections()
          if (sections.length === 0) return

          const isScrollWindow = root!.scrollHeight <= root!.clientHeight + 4
          const scrollHeight = isScrollWindow ? document.documentElement.scrollHeight : root!.scrollHeight
          const scrollTop = isScrollWindow ? Math.max(window.scrollY, document.documentElement.scrollTop) : root!.scrollTop
          const clientHeight = isScrollWindow ? window.innerHeight : root!.clientHeight

          const atBottom =
            scrollHeight - (scrollTop + clientHeight) <= 24
          if (atBottom) {
            const last = sections[sections.length - 1]
            if (last?.id) setActiveIbpSection(last.id)
            return
          }

          const anchor = scrollTop + (isScrollWindow ? 180 : 24)
          let current = sections[0]
          for (const section of sections) {
            if (section.top <= anchor) current = section
            else break
          }
          if (current?.id) setActiveIbpSection(current.id)
        })
      }

      handleScroll = onScroll
      ibpRecalcRef.current = onScroll
      handleResize = () => onScroll()
      resizeObserver = new ResizeObserver(() => onScroll())
      resizeObserver.observe(root)
      mutationObserver = new MutationObserver(() => onScroll())
      mutationObserver.observe(root, { childList: true, subtree: true })

      onScroll()
      initRaf = window.requestAnimationFrame(onScroll)
      timeoutId = window.setTimeout(onScroll, 120)
      root.addEventListener('scroll', onScroll, { passive: true })
      window.addEventListener('scroll', onScroll, { passive: true })
      window.addEventListener('resize', handleResize)
    }

    setup()
    return () => {
      if (root && handleScroll) root.removeEventListener('scroll', handleScroll)
      if (handleScroll) window.removeEventListener('scroll', handleScroll)
      if (handleResize) window.removeEventListener('resize', handleResize)
      if (resizeObserver) resizeObserver.disconnect()
      if (mutationObserver) mutationObserver.disconnect()
      if (raf) window.cancelAnimationFrame(raf)
      if (initRaf) window.cancelAnimationFrame(initRaf)
      if (retryRaf) window.cancelAnimationFrame(retryRaf)
      if (timeoutId) window.clearTimeout(timeoutId)
      if (ibpRecalcRef.current === handleScroll) ibpRecalcRef.current = null
    }
  }, [tabValue, interviewStatus, ibpTocItems])

  useEffect(() => {
    if (tabValue !== 'interview') return
    if (interviewStatus !== 'COMPLETED') return
    if (!ibpTocItems.length) return
    const recalc = ibpRecalcRef.current
    if (!recalc) return
    const rafId = window.requestAnimationFrame(() => recalc())
    const timeoutId = window.setTimeout(() => recalc(), 200)
    return () => {
      window.cancelAnimationFrame(rafId)
      window.clearTimeout(timeoutId)
    }
  }, [tabValue, interviewStatus, ibpTocItems])

  // Get simulated progress from store
  // Get simulated progress from V2 Bridge
  const simulatedProgress = v2Bridge?.progress || 0

  const { currentStep, maxUnlockedStep, cta, statusMessage, progressValue } =
    deriveStage(
      status as any,
      dict,
      isPending,
      statusDetail,
      errorMessage,
      simulatedProgress,
      tier === 'paid',
    )

  // Display cost is 0 for free tier (no coins deducted)
  const displayCost = tier === 'free' ? 0 : currentTaskCost

  const lastUpdated =
    (lastUpdatedMatch as any) || (initialService?.updatedAt as any) || null

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
      requestRefresh()
    }
  }, [requestRefresh, shouldRefreshJobSummary])

  const hasRefreshedCustomizeRef = useRef(false)
  useEffect(() => {
    let timeoutId: number | undefined
    if (customizeStatus === 'PENDING' || customizeStatus === 'IDLE') {
      hasRefreshedCustomizeRef.current = false
    }
    if (
      (customizeStatus === 'COMPLETED' || customizeStatus === 'FAILED') &&
      !hasRefreshedCustomizeRef.current
    ) {
      hasRefreshedCustomizeRef.current = true
      timeoutId = window.setTimeout(() => {
        requestRefresh()
      }, WORKBENCH_CUSTOMIZE_REFRESH_DELAY_MS)
    }
    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [customizeStatus, requestRefresh])

  const customizeDataRetryRef = useRef(0)
  useEffect(() => {
    if (customizeStatus !== 'COMPLETED') {
      customizeDataRetryRef.current = 0
      return
    }
    const hasCustomizeData = Boolean(
      customizedResumeBase?.editedResumeJson ||
      customizedResumeBase?.customizedResumeJson,
    )
    if (hasCustomizeData) {
      customizeDataRetryRef.current = 0
      return
    }
    if (customizeDataRetryRef.current >= WORKBENCH_CUSTOMIZE_REFRESH_RETRY_MAX)
      return
    const timeoutId = window.setTimeout(() => {
      customizeDataRetryRef.current += 1
      requestRefresh()
    }, WORKBENCH_CUSTOMIZE_REFRESH_RETRY_MS)
    return () => window.clearTimeout(timeoutId)
  }, [
    customizeStatus,
    customizedResumeBase?.editedResumeJson,
    customizedResumeBase?.customizedResumeJson,
    requestRefresh,
  ])

  const hasRefreshedInterviewRef = useRef(false)
  const interviewDataRetryRef = useRef(0)
  useEffect(() => {
    if (!serviceId) return
    const currentSessionId = initialService?.executionSessionId || null
    const serviceChanged = lastServiceIdRef.current !== serviceId
    const sessionChanged =
      lastExecutionSessionIdRef.current !== currentSessionId
    const v2Status = v2Bridge?.status
    const isActiveStatus =
      v2Status?.includes('PENDING') || v2Status?.includes('STREAMING')
    const shouldPreserveInterview =
      status.startsWith('INTERVIEW') || hasInterviewData

    if (
      serviceChanged ||
      (sessionChanged && !isActiveStatus && !shouldPreserveInterview)
    ) {
      setTabValue(() => {
        if (status.startsWith('INTERVIEW')) return 'interview'
        if (status.startsWith('CUSTOMIZE')) return 'customize'
        return 'match'
      })
      setMatchTaskId(null)
      setNotification(null)
      setMatchLive(null)

      if (typeof window !== 'undefined') {
        const cachedTier = serviceId
          ? localStorage.getItem(`executionTier_${serviceId}`)
          : null
        setExecutionTier(
          cachedTier === 'free' || cachedTier === 'paid' ? cachedTier : null,
        )
        const cachedInterviewTier = serviceId
          ? localStorage.getItem(`executionTier_interview_${serviceId}`)
          : null
        setInterviewExecutionTier(
          cachedInterviewTier === 'free' || cachedInterviewTier === 'paid'
            ? cachedInterviewTier
            : null,
        )
      }

      hasRefreshedJobSummaryRef.current = false
      hasRefreshedCustomizeRef.current = false
      hasRefreshedInterviewRef.current = false
      interviewDataRetryRef.current = 0
      v2Bridge?.reset?.()
    }

    lastServiceIdRef.current = serviceId
    lastExecutionSessionIdRef.current = currentSessionId
  }, [
    serviceId,
    initialService?.executionSessionId,
    status,
    v2Bridge,
    hasInterviewData,
  ])
  useEffect(() => {
    const serverInterviewStatus = initialService?.interview?.status
    if (
      (serverInterviewStatus === 'COMPLETED' ||
        serverInterviewStatus === 'FAILED') &&
      !hasRefreshedInterviewRef.current
    ) {
      hasRefreshedInterviewRef.current = true
      requestRefresh()
      setTabValue('interview')
    }
  }, [initialService?.interview?.status, requestRefresh])

  useEffect(() => {
    if (interviewStatus !== 'COMPLETED') {
      interviewDataRetryRef.current = 0
      return
    }
    if (interviewParsed) {
      interviewDataRetryRef.current = 0
      return
    }
    if (interviewDataRetryRef.current >= 3) return
    const timeoutId = window.setTimeout(() => {
      interviewDataRetryRef.current += 1
      requestRefresh()
    }, 2000)
    return () => window.clearTimeout(timeoutId)
  }, [interviewStatus, interviewParsed, requestRefresh])

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

  useEffect(() => {
    if (tabValue === 'match') {
      const isCollapsed = localStorage.getItem('sidebar_collapsed') === '1'
      if (isCollapsed) {
        localStorage.removeItem('sidebar_collapsed')
        window.dispatchEvent(new CustomEvent('sidebar:collapsed-changed'))
      }
    }
    if (tabValue === 'interview') {
      const isCollapsed = localStorage.getItem('sidebar_collapsed') === '1'
      if (!isCollapsed) {
        localStorage.setItem('sidebar_collapsed', '1')
        window.dispatchEvent(new CustomEvent('sidebar:collapsed-changed'))
      }
    }
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
  const [copiedMatch, setCopiedMatch] = useState(false)
  const [copiedInterview, setCopiedInterview] = useState(false)

  const handleCopyMatch = async () => {
    const text = buildMatchResultCopyText(matchResult || matchParsed, {
      company: displayCompany,
      jobTitle: displayJob,
      labels: dict.workbench?.resultCard,
    })
    await navigator.clipboard.writeText(text)
    setCopiedMatch(true)
    window.setTimeout(() => setCopiedMatch(false), 2000)
  }

  const handleCopyInterview = async () => {
    if (!interviewParsed) return
    const text = buildInterviewBattlePlanCopyText(
      interviewParsed,
      dict.workbench?.interviewBattlePlan,
    )
    await navigator.clipboard.writeText(text)
    setCopiedInterview(true)
    window.setTimeout(() => setCopiedInterview(false), 2000)
  }

  const matchTheme = getMatchThemeColor(
    getMatchScore(matchResult || matchParsed),
  )
  const interviewTheme = getMatchThemeColor(
    getMatchScore(matchResult || matchParsed),
  )

  const getActionThemeClasses = (theme: 'emerald' | 'amber' | 'rose') => {
    switch (theme) {
      case 'emerald':
        return {
          base: 'bg-emerald-500/45 text-white border-emerald-400/20',
          hover: 'hover:bg-emerald-500/65',
          ring: 'ring-emerald-200/60 dark:ring-emerald-900/30',
        }
      case 'amber':
        return {
          base: 'bg-amber-500/45 text-white border-amber-400/20',
          hover: 'hover:bg-amber-500/65',
          ring: 'ring-amber-200/60 dark:ring-amber-900/30',
        }
      default:
        return {
          base: 'bg-rose-500/45 text-white border-rose-400/20',
          hover: 'hover:bg-rose-500/65',
          ring: 'ring-rose-200/60 dark:ring-rose-900/30',
        }
    }
  }

  const matchActions = [
    {
      id: 'print',
      label: String(dict.workbench?.interviewBattlePlan?.print || '打印'),
      icon: Printer,
      onClick: () => window.print(),
      disabled: !(status === 'MATCH_COMPLETED' || matchResult || matchParsed),
    },
    {
      id: 'copy',
      label: copiedMatch
        ? String(dict.workbench?.resultCard?.copied || '已复制')
        : String(dict.workbench?.resultCard?.copy || '复制全文'),
      icon: copiedMatch ? Check : Copy,
      onClick: handleCopyMatch,
      disabled: !(status === 'MATCH_COMPLETED' || matchResult || matchParsed),
    },
  ]

  const interviewActions = [
    {
      id: 'print',
      label: String(dict.workbench?.interviewBattlePlan?.print || '打印'),
      icon: Printer,
      onClick: () => window.print(),
      disabled: !(interviewStatus === 'COMPLETED' && interviewParsed),
    },
    {
      id: 'copy',
      label: copiedInterview
        ? String(dict.workbench?.interviewBattlePlan?.copied || '已复制')
        : String(dict.workbench?.interviewBattlePlan?.copy || '复制全文'),
      icon: copiedInterview ? Check : Copy,
      onClick: handleCopyInterview,
      disabled: !(interviewStatus === 'COMPLETED' && interviewParsed),
    },
    {
      id: 'toc',
      label: String(dict.workbench?.interviewUi?.toc || '目录'),
      icon: ListOrdered,
      onClick: () => setTocOpen(true),
      disabled: !(interviewStatus === 'COMPLETED' && interviewParsed),
    },
  ]

  const stepActions = stepActionNode
    ? { [activeActionStep]: stepActionNode }
    : undefined
  const step3Label = String(dict.workbench?.tabs?.interview || 'Step 3')

  const [mobileBarRoot, setMobileBarRoot] = useState<Element | null>(null)
  const [matchFabOpen, setMatchFabOpen] = useState(false)
  const [interviewFabOpen, setInterviewFabOpen] = useState(false)
  useEffect(() => {
    if (typeof document === 'undefined') return
    let el = document.getElementById('mobile-bottom-bar-root')
    if (!el) {
      el = document.createElement('div')
      el.id = 'mobile-bottom-bar-root'
      document.body.appendChild(el)
    }
    setMobileBarRoot(el)
    return () => { }
  }, [])

  return (
    <>
      <div
        className={cn(
          'h-full flex flex-col pt-2 md:pt-0',
          tabValue === 'customize' && 'bg-gray-50/50 dark:bg-zinc-950',
        )}
      >
        <div className="md:hidden fixed top-0 inset-x-0 h-12 z-[50] bg-background/70 backdrop-blur border-border/40 print:hidden" />
        {notification && (
          <div className="fixed top-12 sm:top-10 md:top-8 left-1/2 lg:left-[calc(50%+var(--workbench-sidebar-width)/2)] -translate-x-1/2 z-[80] w-[92vw] max-w-[720px] px-1 sm:px-0 print:hidden pointer-events-none">
            <div className="w-full flex justify-center pointer-events-none">
              <div className="pointer-events-auto">
                <ServiceNotification
                  type={notification.type}
                  title={notification.title}
                  description={notification.description}
                  onClose={() => setNotification(null)}
                  autoDismiss={3000}
                  className="w-fit max-w-[92vw] sm:max-w-[720px]"
                />
              </div>
            </div>
          </div>
        )}

        <div className="w-full px-3 md:px-4 pt-6 md:pt-0 print:hidden">
          <div className="mx-auto w-full max-w-[1180px]">
            <div className="md:hidden fixed top-[14px] right-3 z-[60] flex items-center gap-1">
              <I18nToggleCompact />
              <ThemeToggle />
              <UserMenu locale={locale} dict={{ shell: dict }} />
            </div>
            <StepperProgress
              currentStep={tabValue === 'match' ? 1 : tabValue === 'customize' ? 2 : 3}
              maxUnlockedStep={maxUnlockedStep as any}
              onStepClick={(s) => {
                if (s === 1) setTabValue('match')
                else if (s === 2) setTabValue('customize')
                else setTabValue('interview')
              }}
              labels={{
                step1: String(dict.workbench?.tabs?.match || 'Step 1'),
                step2: String(dict.workbench?.tabs?.customize || 'Step 2'),
                step3: step3Label,
              }}
              {...(stepActions ? { stepActions } : {})}
              className="shrink-0"
            />
          </div>
        </div>

        {!shouldHideConsole &&
          USE_SSE_V2 &&
          v2Bridge &&
          tabValue === 'match' && (
            <div className="w-full px-3 md:px-4 mt-6 md:mt-8 print:hidden">
              <div className="mx-auto w-full max-w-[1180px]">
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
              </div>
            </div>
          )}

        <Tabs
          value={tabValue}
          defaultValue="match"
          onValueChange={(v) =>
            setTabValue(v as 'match' | 'customize' | 'interview')
          }
          className={cn(
            "flex-1 flex flex-col min-h-0 mb-0",
            tabValue === 'customize' ? "mt-4 md:mt-4" : "mt-6 md:mt-8"
          )}
        >
          <TabsContent
            value="match"
            className="flex-1 flex flex-col min-h-0 overflow-x-visible overflow-y-visible sm:overflow-y-auto print:overflow-visible print:h-auto"
          >
            <div className="w-full px-0 sm:px-3 md:px-4">
              <div className="mx-auto w-full max-w-none sm:max-w-[1180px]">
                {(status === 'MATCH_COMPLETED' ||
                  matchResult ||
                  matchParsed) && (
                    <>
                      <div className="hidden md:flex fixed right-6 bottom-8 z-40 flex-col items-end gap-2 print:hidden">
                        <TooltipProvider>
                          {matchActions.map((action) => {
                            const themeClasses = getActionThemeClasses(matchTheme)
                            const Icon = action.icon
                            return (
                              <Tooltip key={action.id}>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    disabled={action.disabled}
                                    onClick={action.onClick}
                                    className={cn(
                                      'h-10 w-10 rounded-full border shadow-lg backdrop-blur-sm',
                                      themeClasses.base,
                                      themeClasses.hover,
                                      themeClasses.ring,
                                    )}
                                  >
                                    <Icon className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="left">
                                  {action.label}
                                </TooltipContent>
                              </Tooltip>
                            )
                          })}
                        </TooltipProvider>
                      </div>
                      <div className="md:hidden fixed right-4 bottom-[85px] z-40 flex flex-col items-center gap-2 print:hidden">
                        {matchFabOpen && (
                          <div className="flex flex-col items-center gap-2 w-10">
                            {matchActions.map((action) => {
                              const themeClasses =
                                getActionThemeClasses(matchTheme)
                              const Icon = action.icon
                              return (
                                <Button
                                  key={action.id}
                                  size="icon"
                                  disabled={action.disabled}
                                  onClick={() => {
                                    action.onClick()
                                    setMatchFabOpen(false)
                                  }}
                                  className={cn(
                                    'h-9 w-9 rounded-full border shadow-lg',
                                    themeClasses.base,
                                    themeClasses.hover,
                                    themeClasses.ring,
                                  )}
                                >
                                  <Icon className="h-4 w-4" />
                                  <span className="sr-only">{action.label}</span>
                                </Button>
                              )
                            })}
                          </div>
                        )}
                        <Button
                          size="icon"
                          onClick={() => setMatchFabOpen((prev) => !prev)}
                          className={cn(
                            'h-10 w-10 rounded-full shadow-lg border transition-all duration-300',
                            getActionThemeClasses(matchTheme).base,
                            getActionThemeClasses(matchTheme).hover,
                          )}
                        >
                          <Menu className="h-5 w-5" />
                        </Button>
                      </div>
                    </>
                  )}
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
                    v2Bridge.status === 'OCR_FAILED' ||
                    v2Bridge.status === 'JOB_VISION_FAILED' ||
                    v2Bridge.status === 'SUMMARY_FAILED' ||
                    v2Bridge.status === 'PREMATCH_FAILED' ||
                    v2Bridge.status === 'MATCH_FAILED') && (
                    <div>
                      <StreamPanelV2
                        status={v2Bridge.status}
                        tier={v2Bridge.tier}
                        visionContent={v2Bridge.visionContent}
                        visionJson={v2Bridge.visionJson}
                        ocrContent={v2Bridge.ocrContent}
                        ocrJson={v2Bridge.ocrJson}
                        summaryContent={v2Bridge.summaryContent}
                        summaryJson={v2Bridge.summaryJson}
                        preMatchContent={v2Bridge.preMatchContent}
                        preMatchJson={v2Bridge.preMatchJson}
                        matchContent={v2Bridge.matchContent}
                        matchJson={v2Bridge.matchJson}
                        errorMessage={localizedError}
                        dict={dict?.workbench?.streamPanel}
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
                      className="mt-0"
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
                        smartPitch:
                          dict.workbench?.resultCard?.smartPitch?.label,
                        copyTooltip:
                          dict.workbench?.resultCard?.smartPitch?.copyTooltip,
                        copy: dict.workbench?.resultCard?.copy,
                        copied: dict.workbench?.resultCard?.copied,
                        copySuccess: dict.workbench?.resultCard?.copySuccess,
                        highlyMatched:
                          dict.workbench?.resultCard?.highlyMatched,
                        goodFit: dict.workbench?.resultCard?.goodFit,
                        lowMatch: dict.workbench?.resultCard?.lowMatch,
                        targetCompany:
                          dict.workbench?.resultCard?.targetCompany,
                        targetPosition:
                          dict.workbench?.resultCard?.targetPosition,
                        noHighlights: dict.workbench?.resultCard?.noHighlights,
                        noGaps: dict.workbench?.resultCard?.noGaps,
                        tip: dict.workbench?.resultCard?.tip,
                        expertVerdict:
                          dict.workbench?.resultCard?.expertVerdict,
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
              </div>
            </div>
          </TabsContent>

          <TabsContent
            value="customize"
            className="flex-1 flex flex-col min-h-0 print:hidden bg-gray-50/50 dark:bg-zinc-950"
          >
            {/* Customize Tab Content */}
            {(customizeStatus as string) === 'COMPLETED' &&
              customizedResumeBase?.customizedResumeJson ? (
              <StepCustomize
                serviceId={initialService.id}
                initialData={
                  customizedResumeBase.editedResumeJson ||
                  customizedResumeBase.customizedResumeJson
                }
                initialConfig={customizedResumeBase.sectionConfig || undefined}
                originalData={
                  customizedResumeBase.customizedResumeJson || undefined
                }
                optimizeSuggestion={
                  customizedResumeBase.optimizeSuggestion || null
                }
                initialOpsJson={customizedResumeBase.ops_json || undefined}
                ctaAction={ctaNode}
                dict={dict.resume}
              />
            ) : (
              <>
                {isTransitionState ? (
                  <BatchProgressPanel
                    title={
                      dict.workbench?.statusText?.CUSTOMIZE_STARTING ||
                      dict.workbench?.statusConsole?.customizeStarting ||
                      '正在启动定制任务...'
                    }
                    description={
                      dict.workbench?.statusText?.CUSTOMIZE_STARTING_DESC ||
                      '已提交请求，正在排队分配计算资源。'
                    }
                    progress={12}
                  />
                ) : (customizeStatus as string) === 'PENDING' ? (
                  <BatchProgressPanel
                    title={
                      dict.workbench?.statusText?.CUSTOMIZE_PENDING ||
                      dict.workbench?.statusConsole?.customizePending ||
                      '正在定制简历...'
                    }
                    description={
                      dict.workbench?.statusText?.CUSTOMIZE_PENDING_DESC ||
                      '正在分析岗位要求并重写你的简历内容。'
                    }
                    progress={30}
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
                    title={
                      dict.workbench?.statusText?.CUSTOMIZE_LOADING ||
                      '正在加载定制简历...'
                    }
                    description={
                      dict.workbench?.statusText?.CUSTOMIZE_LOADING_DESC ||
                      '定制内容已生成，正在整理与排版，请稍候。'
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

          <TabsContent
            value="interview"
            className="flex-1 flex flex-col min-h-0 overflow-x-visible overflow-y-visible sm:overflow-y-hidden print:overflow-visible"
          >
            <div
              ref={interviewScrollRef}
              className="flex-1 min-h-0 overflow-x-visible overflow-y-visible sm:overflow-y-auto print:overflow-visible"
              style={{ scrollbarGutter: 'stable' }}
            >
              {shouldShowInterviewPlan ? (
                <div className="w-full px-0 sm:px-3 md:px-4 pt-0 pb-6 print:px-0 print:py-2">
                  <div className="mx-auto w-full max-w-none sm:max-w-[1180px] relative">
                    <div className="hidden md:flex fixed xl:left-[calc(50%+(var(--workbench-sidebar-width,0px)/2)+0.75rem+440px+4rem)] right-6 xl:right-auto bottom-8 z-40 flex-col gap-2 print:hidden">
                      <TooltipProvider>
                        {interviewActions.map((action) => {
                          const themeClasses =
                            getActionThemeClasses(interviewTheme)
                          const Icon = action.icon
                          const isToc = action.id === 'toc'
                          const button = (
                            <Tooltip key={action.id}>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  disabled={action.disabled}
                                  onClick={action.onClick}
                                  className={cn(
                                    'h-10 w-10 rounded-full border shadow-lg backdrop-blur-sm',
                                    themeClasses.base,
                                    themeClasses.hover,
                                    themeClasses.ring,
                                  )}
                                >
                                  <Icon className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="left">
                                {action.label}
                              </TooltipContent>
                            </Tooltip>
                          )
                          return isToc ? (
                            <div key={action.id} className="xl:hidden">
                              {button}
                            </div>
                          ) : (
                            button
                          )
                        })}

                        {/* Desktop Global FAB Up/Down */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              onClick={() => {
                                const currentIndex = activeIbpSection ? ibpTocItems.findIndex(i => i.id === activeIbpSection) : 0;
                                const prevItem = currentIndex > 0 ? ibpTocItems[currentIndex - 1] : undefined;
                                if (prevItem) {
                                  setActiveIbpSection(prevItem.id);
                                  scrollToIbpSection(prevItem.id);
                                } else {
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }
                              }}
                              className={cn(
                                'h-10 w-10 rounded-full border shadow-lg backdrop-blur-sm',
                                getActionThemeClasses(interviewTheme).base,
                                getActionThemeClasses(interviewTheme).hover,
                                getActionThemeClasses(interviewTheme).ring,
                              )}
                              aria-label="Scroll to previous section"
                            >
                              <ChevronUp className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            上一节
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              onClick={() => {
                                const currentIndex = activeIbpSection ? ibpTocItems.findIndex(i => i.id === activeIbpSection) : 0;
                                const nextItem = currentIndex < ibpTocItems.length - 1 ? ibpTocItems[currentIndex + 1] : undefined;
                                if (nextItem) {
                                  setActiveIbpSection(nextItem.id);
                                  scrollToIbpSection(nextItem.id);
                                }
                              }}
                              className={cn(
                                'h-10 w-10 rounded-full border shadow-lg backdrop-blur-sm',
                                getActionThemeClasses(interviewTheme).base,
                                getActionThemeClasses(interviewTheme).hover,
                                getActionThemeClasses(interviewTheme).ring,
                              )}
                              aria-label="Scroll to next section"
                            >
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            下一节
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="md:hidden fixed right-4 bottom-[85px] z-40 flex flex-col items-center gap-2 print:hidden">
                      {interviewFabOpen && (
                        <div className="flex flex-col items-center gap-2 w-10">
                          {interviewActions.map((action) => {
                            const themeClasses =
                              getActionThemeClasses(interviewTheme)
                            const Icon = action.icon
                            return (
                              <Button
                                key={action.id}
                                size="icon"
                                disabled={action.disabled}
                                onClick={() => {
                                  action.onClick()
                                  setInterviewFabOpen(false)
                                }}
                                className={cn(
                                  'h-9 w-9 rounded-full border shadow-lg',
                                  themeClasses.base,
                                  themeClasses.hover,
                                  themeClasses.ring,
                                )}
                              >
                                <Icon className="h-4 w-4" />
                                <span className="sr-only">{action.label}</span>
                              </Button>
                            )
                          })}
                        </div>
                      )}
                      {/* Mobile Global FAB Up/Down */}
                      <div className="flex flex-col gap-2 mt-2">
                        <Button
                          type="button"
                          onClick={() => {
                            const currentIndex = activeIbpSection ? ibpTocItems.findIndex(i => i.id === activeIbpSection) : 0;
                            const prevItem = currentIndex > 0 ? ibpTocItems[currentIndex - 1] : undefined;
                            if (prevItem) {
                              setActiveIbpSection(prevItem.id);
                              scrollToIbpSection(prevItem.id);
                            } else {
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }
                          }}
                          className={cn(
                            'h-10 w-10 rounded-full shadow-lg border transition-all duration-300',
                            getActionThemeClasses(interviewTheme).base,
                            getActionThemeClasses(interviewTheme).hover,
                          )}
                          aria-label="Scroll to previous section"
                        >
                          <ChevronUp className="h-5 w-5" />
                        </Button>

                        <Button
                          type="button"
                          onClick={() => {
                            const currentIndex = activeIbpSection ? ibpTocItems.findIndex(i => i.id === activeIbpSection) : 0;
                            const nextItem = currentIndex < ibpTocItems.length - 1 ? ibpTocItems[currentIndex + 1] : undefined;
                            if (nextItem) {
                              setActiveIbpSection(nextItem.id);
                              scrollToIbpSection(nextItem.id);
                            }
                          }}
                          className={cn(
                            'h-10 w-10 rounded-full shadow-lg border transition-all duration-300',
                            getActionThemeClasses(interviewTheme).base,
                            getActionThemeClasses(interviewTheme).hover,
                          )}
                          aria-label="Scroll to next section"
                        >
                          <ChevronDown className="h-5 w-5" />
                        </Button>
                      </div>
                      <Button
                        size="icon"
                        onClick={() => setInterviewFabOpen((prev) => !prev)}
                        className={cn(
                          'h-10 w-10 rounded-full shadow-lg border transition-all duration-300',
                          getActionThemeClasses(interviewTheme).base,
                          getActionThemeClasses(interviewTheme).hover,
                        )}
                      >
                        <Menu className="h-5 w-5" />
                      </Button>
                    </div>
                    <div className="mx-auto w-full max-w-[880px] relative print:max-w-none print:mx-0 print:w-full">
                      <InterviewBattlePlan
                        data={interviewParsed}
                        matchScore={getMatchScore(matchParsed)}
                        labels={interviewBattlePlanLabels}
                        className="mt-0"
                      />
                    </div>
                    <aside className="hidden xl:block print:hidden w-[240px]">
                      <div className="fixed top-[136px] w-[240px] left-[calc(50%+(var(--workbench-sidebar-width,0px)/2)+0.75rem+440px+4rem)]">
                        <div className="w-full max-h-[calc(100vh-136px)] overflow-y-auto pr-1">
                          <div className="text-[11px] font-semibold text-foreground/60 tracking-[0.24em]">
                            {dict.workbench?.interviewUi?.toc || 'Contents'}
                          </div>
                          <div className="mt-4 space-y-2.5">
                            {ibpTocItems.map((item) => {
                              const isActive =
                                (activeIbpSection &&
                                  activeIbpSection === item.id) ||
                                (!activeIbpSection &&
                                  ibpTocItems[0]?.id === item.id)
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => {
                                    setActiveIbpSection(item.id)
                                    scrollToIbpSection(item.id)
                                  }}
                                  aria-current={isActive ? 'true' : undefined}
                                  className={cn(
                                    'group w-full text-left text-[12px] leading-5 flex items-center gap-2.5 transition-colors',
                                    'text-foreground/60 hover:text-foreground',
                                    isActive && 'text-foreground font-semibold',
                                  )}
                                >
                                  <span
                                    className={cn(
                                      'h-1.5 w-1.5 rounded-full transition-colors shrink-0',
                                      isActive
                                        ? 'bg-primary'
                                        : 'bg-slate-300/70 dark:bg-slate-700/70',
                                    )}
                                  />
                                  <span className="block truncate">
                                    {item.label}
                                  </span>
                                </button>
                              )
                            })}
                          </div>

                        </div>
                      </div>
                    </aside>
                  </div>
                </div>
              ) : shouldShowInterviewLoading ? (
                <BatchProgressPanel
                  title={
                    dict.workbench?.statusText?.INTERVIEW_LOADING ||
                    '正在加载面试作战手卡...'
                  }
                  description={
                    dict.workbench?.statusText?.INTERVIEW_LOADING_DESC ||
                    '内容已生成，正在整理与排版，请稍候。'
                  }
                  progress={96}
                />
              ) : USE_SSE_V2 &&
                v2Bridge &&
                (v2Bridge.status === 'INTERVIEW_PENDING' ||
                  v2Bridge.status === 'INTERVIEW_STREAMING' ||
                  v2Bridge.status === 'INTERVIEW_COMPLETED') &&
                (v2Bridge.interviewContent || v2Bridge.interviewJson) ? (
                <div className="w-full px-0 sm:px-4 md:px-6">
                  <div className="mx-auto w-full max-w-[1180px]">
                    <StreamPanelV2
                      status={v2Bridge.status}
                      tier={v2Bridge.tier!}
                      interviewContent={v2Bridge.interviewContent}
                      interviewJson={v2Bridge.interviewJson}
                      errorMessage={localizedError!}
                      dict={dict?.workbench?.streamPanel}
                    />
                  </div>
                </div>
              ) : (
                <>
                  {isInterviewTransitionState ? (
                    <BatchProgressPanel
                      title={
                        dict.workbench?.statusText?.INTERVIEW_STARTING ||
                        '正在启动面试建议任务...'
                      }
                      description={
                        dict.workbench?.statusText?.INTERVIEW_STARTING_DESC ||
                        '已提交请求，正在排队分配计算资源。'
                      }
                      progress={12}
                    />
                  ) : interviewStatus === 'PENDING' ? (
                    <BatchProgressPanel
                      title={
                        dict.workbench?.statusText?.INTERVIEW_PENDING ||
                        '准备生成面试作战手卡...'
                      }
                      description={
                        dict.workbench?.statusText?.INTERVIEW_PENDING_DESC ||
                        '正在分析匹配度结果和定制简历，准备个性化面试建议。'
                      }
                      progress={30}
                    />
                  ) : interviewStatus === 'FAILED' ? (
                    <BatchProgressPanel
                      mode="error"
                      title={
                        dict.workbench?.statusText?.INTERVIEW_FAILED ||
                        '面试建议生成失败'
                      }
                      description={
                        interviewExecutionTier === 'free'
                          ? dict.workbench?.statusText
                            ?.INTERVIEW_FAILED_DESC_FREE ||
                          '免费模型暂时繁忙，请稍后重试'
                          : dict.workbench?.statusText
                            ?.INTERVIEW_FAILED_DESC_PAID ||
                          dict.workbench?.statusText?.INTERVIEW_FAILED_DESC ||
                          '金币已自动返还，请点击重试'
                      }
                      onRetry={onInterview}
                      isRetryLoading={isPending}
                      retryLabel={
                        dict.workbench?.interviewUi?.start || '生成面试建议'
                      }
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 space-y-6 border rounded-md bg-card min-h-[300px]">
                      <div className="text-center space-y-2">
                        <h3 className="text-lg font-semibold">
                          {dict.workbench?.interviewUi?.ready ||
                            'Ready to Generate Interview Tips'}
                        </h3>
                        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                          {dict.workbench?.interviewUi?.readyDesc ||
                            'Generate personalized interview Q&A and tips based on the job match analysis.'}
                        </p>
                      </div>
                      {/* Desktop CTA for Ready State */}
                      {!isPending && (
                        <div className="hidden md:block">{ctaNode}</div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {mobileBarRoot &&
          createPortal(
            <div
              className={cn(
                'fixed left-0 right-0 bottom-0 z-50 px-4 pt-2 pb-[env(safe-area-inset-bottom)] flex items-center justify-center h-[calc(48px+env(safe-area-inset-bottom))]',
                interviewStatus !== 'COMPLETED' && 'gap-3',
                'bg-zinc-300/20 dark:bg-zinc-800/30 backdrop-blur-xs border-t border-border/10 shadow-[0_-4px_20px_rgba(0,0,0,0.12)]',
                'md:hidden print:hidden',
              )}
            >
              {interviewStatus !== 'COMPLETED' ? (
                <div className="flex items-center gap-3 relative z-50">
                  {cta &&
                    !(
                      tabValue === 'interview' &&
                      (interviewStatus === 'PENDING' ||
                        isInterviewTransitionState)
                    ) && (
                      <Button
                        onClick={() => {
                          if (cta.action === 'customize') onCustomize()
                          else if (cta.action === 'interview') onInterview()
                          else if (cta.action === 'retry_match')
                            retryMatchAction()
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
              ) : (
                <div className="flex items-center justify-center w-full text-center">
                  <span className="text-xs text-muted-foreground leading-relaxed text-center w-full">
                    {dict.workbench?.statusText?.INTERVIEW_COMPLETED_WISH ||
                      'Wishing you success in your job search!'}
                  </span>
                </div>
              )}
            </div>,
            mobileBarRoot,
          )}

        {tabValue === 'interview' && interviewStatus === 'COMPLETED' && (
          <Drawer open={tocOpen} onOpenChange={setTocOpen}>
            <DrawerContent className="print:hidden">
              <DrawerHeader className="pb-2">
                <DrawerTitle className="text-sm">
                  {dict.workbench?.interviewUi?.toc || 'Contents'}
                </DrawerTitle>
              </DrawerHeader>
              <div className="px-4 pb-6 space-y-2">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-xs h-8"
                  onClick={() => {
                    setTocOpen(false)
                    handleIbpTop()
                  }}
                >
                  {dict.workbench?.interviewUi?.backToTop || 'Back to Top'}
                </Button>
                {ibpTocItems.map((item) => {
                  const isActive =
                    (activeIbpSection && activeIbpSection === item.id) ||
                    (!activeIbpSection && ibpTocItems[0]?.id === item.id)
                  return (
                    <Button
                      key={item.id}
                      variant="ghost"
                      className={cn(
                        'w-full justify-start text-xs h-8',
                        isActive && 'text-foreground',
                      )}
                      onClick={() => {
                        setActiveIbpSection(item.id)
                        setTocOpen(false)
                        handleIbpToc(item.id)
                      }}
                    >
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full mr-2',
                          isActive
                            ? 'bg-primary'
                            : 'bg-slate-300/70 dark:bg-slate-700/70',
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                    </Button>
                  )
                })}
              </div>
            </DrawerContent>
          </Drawer>
        )}
      </div>

      {/* Lightweight Free Tier Warning Dialogs */}
      {customizeGuard.GuardDialog}
      {interviewGuard.GuardDialog}
    </>
  )
}
