'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import {
  AssetUploader,
  type AssetUploaderHandle,
} from '@/components/app/AssetUploader'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard,
  Eye,
  RotateCw,
  Layers,
  TrendingUp,
  Zap,
  Lock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ResumeGuidanceTooltip } from '@/components/resume/ResumeGuidanceTooltip'

type ParsedDetailedResume = {
  project_metrics: {
    count: number
    highlight: string
  }
  quantified_impact: {
    metrics_count: number
    top_example: string
  }
  ai_readiness: {
    level: string
    feedback: string
  }
}

type DashboardDict = {
  projectDepthTitle: string
  projectDepthUnit: string
  quantifiedTitle: string
  quantifiedUnit: string
  aiReadinessTitle: string
  backToDashboard: string
}

type DetailedResumePanelClientProps = {
  locale: 'en' | 'zh'
  uploaderDict: any
  previewLabels: Record<string, string>
  quotaBalance: number
  statusTextDict?: any
  notificationDict?: any
  resumeTitle: string
  detailedTitle: string
  pdfNotice?: string
  latestStatus?: any
  latestFileName?: string | null
  detailedSummaryJson?: any
  parsedKeyInfoJson?: any
  dashboardDict: DashboardDict
  actions: {
    preview: string
    reupload: string
    backToDashboard: string
  }
  lockHint: string
  maskText: string
  dimmed?: boolean
  detailedDescription: string
  detailedBadge: string
  hasGeneral: boolean
  detailedExamples: any
}

function useCountUp(target: number) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!Number.isFinite(target)) return
    let raf = 0
    const start = performance.now()
    const duration = 700
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      const next = Math.round(progress * target)
      setValue(next)
      if (progress < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])

  return value
}

export function DetailedResumePanelClient({
  locale,
  uploaderDict,
  previewLabels,
  quotaBalance,
  statusTextDict,
  notificationDict,
  resumeTitle,
  detailedTitle,
  pdfNotice,
  latestStatus,
  latestFileName,
  detailedSummaryJson,
  parsedKeyInfoJson,
  dashboardDict,
  actions,
  lockHint,
  maskText,
  dimmed = false,
  detailedDescription,
  detailedBadge,
  hasGeneral,
  detailedExamples,
}: DetailedResumePanelClientProps) {
  const uploaderRef = useRef<AssetUploaderHandle | null>(null)
  const carouselRef = useRef<HTMLDivElement | null>(null)
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null)
  const [carouselIndex, setCarouselIndex] = useState(0)
  const [mode, setMode] = useState<'uploader' | 'dashboard'>(
    parsedKeyInfoJson ? 'dashboard' : 'uploader',
  )
  const [keyInfo, setKeyInfo] = useState<ParsedDetailedResume | null>(
    parsedKeyInfoJson || null,
  )
  const [localDimmed, setLocalDimmed] = useState(dimmed)

  useEffect(() => {
    setLocalDimmed(dimmed)
  }, [dimmed])

  useEffect(() => {
    const handleResumeSummary = (e: Event) => {
      const customEvent = e as CustomEvent
      if (customEvent.detail?.taskTemplateId === 'resume_summary') {
        const summary = customEvent.detail?.summaryJson
        if (summary) {
          setLocalDimmed(false)
        }
      }
    }
    window.addEventListener('resume:summary', handleResumeSummary)
    return () => window.removeEventListener('resume:summary', handleResumeSummary)
  }, [])

  useEffect(() => {
    if (parsedKeyInfoJson) {
      setKeyInfo(parsedKeyInfoJson)
      setMode('dashboard')
    }
  }, [parsedKeyInfoJson])

  const handleModeSwitch = useCallback((newMode: 'uploader' | 'dashboard') => {
    setMode(newMode)
    setTimeout(() => {
      scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }, [])

  const handleSummaryJson = useCallback((data: any) => {
    const parsed =
      data?.parsedKeyInfoJson ||
      data?.parsed_detailed_resume_json ||
      data?.parsed_key_info_json ||
      null
    if (parsed) {
      setKeyInfo(parsed)
      handleModeSwitch('dashboard')
    }
  }, [handleModeSwitch])

  const projectCount = useCountUp(Number(keyInfo?.project_metrics?.count || 0))
  const impactCount = useCountUp(
    Number(keyInfo?.quantified_impact?.metrics_count || 0),
  )
  const showSplit = mode === 'uploader' || !keyInfo
  const canViewDashboard = Boolean(keyInfo)
  const cardCount = 3

  // Replaces buggy IntersectionObserver with reliable Scroll math
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget
    const scrollLeft = container.scrollLeft
    const cardWidth = container.clientWidth
    const newIndex = Math.round(scrollLeft / cardWidth)
    if (newIndex !== carouselIndex && newIndex >= 0 && newIndex < cardCount) {
      setCarouselIndex(newIndex)
    }
  }, [carouselIndex, cardCount])

  // 8-second Autoplay timer
  useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 767px)').matches
    if (!isMobile || carouselRef.current === null) return

    const timer = setInterval(() => {
      if (mode !== 'dashboard') return

      const nextIndex = (carouselIndex + 1) % cardCount
      const cardNodes = carouselRef.current?.querySelectorAll('.carousel-card')
      const targetCard = cardNodes?.[nextIndex] as HTMLElement
      if (targetCard && carouselRef.current) {
        carouselRef.current.scrollTo({
          left: targetCard.offsetLeft,
          behavior: 'smooth',
        })
      }
    }, 8000)

    return () => clearInterval(timer)
  }, [carouselIndex, cardCount])


  const dashboardCards = useMemo(() => {
    const placeholders = [
      {
        title: dashboardDict.projectDepthTitle,
        unit: dashboardDict.projectDepthUnit,
        accent: 'text-slate-400 dark:text-slate-500',
        icon: <Layers className="w-5 h-5" />,
        value: '—',
        detail: '—',
        variant: 'neutral',
      },
      {
        title: dashboardDict.quantifiedTitle,
        unit: dashboardDict.quantifiedUnit,
        accent: 'text-slate-400 dark:text-slate-500',
        icon: <TrendingUp className="w-5 h-5" />,
        value: '—',
        detail: '—',
        variant: 'neutral',
      },
      {
        title: dashboardDict.aiReadinessTitle,
        unit: '',
        accent: 'text-slate-400 dark:text-slate-500',
        icon: <Zap className="w-5 h-5" />,
        value: '—',
        detail: '—',
        variant: 'neutral',
        isSpecialText: true,
      },
    ]

    if (!keyInfo) {
      return placeholders
    }

    return [
      {
        title: dashboardDict.projectDepthTitle,
        unit: dashboardDict.projectDepthUnit,
        accent: 'text-slate-400 dark:text-slate-500',
        icon: <Layers className="w-5 h-5" />,
        value: `${projectCount}`,
        detail: keyInfo.project_metrics?.highlight || '',
        variant: 'neutral',
      },
      {
        title: dashboardDict.quantifiedTitle,
        unit: dashboardDict.quantifiedUnit,
        accent: 'text-slate-400 dark:text-slate-500',
        icon: <TrendingUp className="w-5 h-5" />,
        value: `${impactCount}`,
        detail: keyInfo.quantified_impact?.top_example || '',
        variant: 'neutral',
      },
      {
        title: dashboardDict.aiReadinessTitle,
        unit: '',
        accent: 'text-slate-400 dark:text-slate-500',
        icon: <Zap className="w-5 h-5" />,
        value: keyInfo.ai_readiness?.level || '',
        detail: keyInfo.ai_readiness?.feedback || '',
        variant: 'neutral',
        isSpecialText: true,
      },
    ]
  }, [keyInfo, projectCount, impactCount, dashboardDict])

  const renderDashboardCards = () => (
    <div className="relative rounded-2xl dark:ring-white/10 dark:bg-white/[0.03] p-4 h-full flex flex-col">
      <div
        ref={carouselRef}
        onScroll={handleScroll}
        className="flex lg:grid lg:grid-cols-3 gap-4 overflow-x-auto lg:overflow-visible snap-x snap-mandatory lg:snap-none no-scrollbar w-full pb-4 lg:pb-0 flex-1 scroll-smooth"
      >
        {dashboardCards.map((item, idx) => (
          <div
            key={`${item.title}-${idx}`}
            data-index={idx}
            className={cn(
              'carousel-card rounded-xl p-5 flex flex-col items-center justify-start text-center relative overflow-hidden h-auto self-stretch shrink-0 snap-always snap-center w-full min-w-full lg:min-w-0 lg:w-auto',
              'bg-slate-50/50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 shadow-sm dark:shadow-none',
              canViewDashboard && mode === 'dashboard' ? 'animate-in fade-in slide-in-from-bottom-2' : ''
            )}
            style={{ animationDelay: `${idx * 120}ms` }}
          >
            <div className={`shrink-0 flex items-center justify-center ${item.accent} mb-3`}>{item.icon}</div>
            <div className="flex flex-col flex-1 w-full gap-1">
              <div className="shrink-0 min-h-[48px] flex items-center justify-center">
                {item.isSpecialText ? (
                  <div className="text-xl font-black text-slate-900 dark:text-white tracking-widest">
                    {item.value}
                  </div>
                ) : (
                  <div className="text-3xl font-bold text-slate-900 dark:text-white">
                    {item.value}{' '}
                    {item.unit && (
                      <span className="text-sm font-medium text-slate-500 ml-1">
                        {item.unit}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1 break-words leading-tight whitespace-normal shrink-0">
                {item.title}
              </div>
              <div className="text-[11.5px] text-slate-500 mt-2.5 leading-relaxed break-words text-left flex-1 min-h-0">
                {item.detail}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="lg:hidden flex items-center justify-center gap-2 mt-auto pt-2">
        {Array.from({ length: cardCount }).map((_, idx) => (
          <div
            key={`dot-${idx}`}
            className={
              idx === carouselIndex
                ? 'w-4 h-1.5 rounded-full bg-slate-800 dark:bg-slate-200'
                : 'w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700'
            }
          />
        ))}
      </div>
      {(localDimmed || !keyInfo) && (
        <div className="absolute inset-0 z-10 rounded-2xl bg-slate-50/50 dark:bg-black/40 backdrop-blur-[3px] flex flex-col items-center justify-center text-sm font-medium text-slate-500 dark:text-slate-400">
          <Zap className="h-8 w-8 mb-3" />
          <span className="max-w-[80%] text-center text-balance">
            {maskText}
          </span>
        </div>
      )}
    </div>
  )

  return (
    <>
      <div className="mb-6">
        <div className="flex flex-row items-start justify-between gap-4 mb-2">
          <div className="flex items-center gap-3 min-w-0">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white truncate">
              {detailedTitle}
            </h3>
            <div className="shrink-0">
              <ResumeGuidanceTooltip
                triggerClassName="inline-flex items-center gap-0.5 rounded bg-blue-50 px-2 py-0.5 text-xs font-light text-blue-500 ring-1 ring-inset ring-blue-100/10 dark:bg-blue-400/10 dark:text-blue-400 dark:ring-blue-400/10"
                examples={{
                  ...(detailedExamples as any),
                }}
              >
                {detailedBadge}
              </ResumeGuidanceTooltip>
            </div>
            {!hasGeneral && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 ml-2 shrink-0">
                <Lock className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{lockHint}</span>
              </div>
            )}
          </div>

          {canViewDashboard && (
            <div className="flex items-center gap-2 shrink-0 relative z-20">
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
              {mode === 'dashboard' ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-sm text-zinc-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/10 transition-colors"
                  onClick={() => handleModeSwitch('uploader')}
                >
                  <RotateCw className="h-3.5 w-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">{actions.reupload}</span>
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-sm text-zinc-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/10 transition-colors"
                  onClick={() => handleModeSwitch('dashboard')}
                >
                  <LayoutDashboard className="h-3.5 w-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">{actions.backToDashboard}</span>
                </Button>
              )}
            </div>
          )}
        </div>
        <div className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-3xl">
          {detailedDescription}
        </div>
      </div>

      {!canViewDashboard ? (
        // IDLE STATE: Split grid side-by-side
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch lg:auto-rows-fr lg:[&>*]:h-full lg:[&>*]:self-stretch transition-all duration-300">
          <div className="h-full flex flex-col">
            <AssetUploader
              ref={uploaderRef}
              className="flex-1"
              locale={locale}
              taskTemplateId="detailed_resume_summary"
              initialStatus={latestStatus || 'IDLE'}
              initialFileName={latestFileName ?? null}
              initialSummaryJson={detailedSummaryJson || null}
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
              hidePreviewAction
              hideActions={true}
              neutralComplete
              {...(pdfNotice ? { pdfNotice } : {})}
              {...(typeof localDimmed === 'boolean' ? { dimmed: localDimmed } : {})}
            />
          </div>
          <div className="h-full flex flex-col">
            {renderDashboardCards()}
          </div>
        </div>
      ) : (
        // COMPLETED STATE: Display active mode full-width
        <div className="relative transition-all duration-300" ref={scrollAnchorRef}>
          <div className={cn("transition-all duration-300", mode === 'dashboard' ? 'flex flex-col h-full' : 'hidden')}>
            {renderDashboardCards()}
          </div>

          <div className={cn("transition-all duration-300", mode === 'uploader' ? 'flex flex-col h-full animate-in fade-in zoom-in-95' : 'hidden')}>
            <AssetUploader
              ref={uploaderRef}
              className="flex-1"
              locale={locale}
              taskTemplateId="detailed_resume_summary"
              initialStatus={latestStatus || 'IDLE'}
              initialFileName={latestFileName ?? null}
              initialSummaryJson={detailedSummaryJson || null}
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
              hidePreviewAction
              hideActions={false}
              neutralComplete
              {...(pdfNotice ? { pdfNotice } : {})}
              {...(typeof localDimmed === 'boolean' ? { dimmed: localDimmed } : {})}
            />
          </div>
        </div>
      )}
    </>
  )
}
