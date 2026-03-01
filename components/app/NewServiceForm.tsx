'use client'

import { useState, useTransition, useEffect } from 'react'
import type { Locale } from '@/i18n-config'
import {
  AppCard,
  AppCardHeader,
  AppCardTitle,
  AppCardDescription,
  AppCardContent,
  AppCardFooter,
} from '@/components/app/AppCard'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { createServiceAction } from '@/lib/actions/service.actions'
import { StepperProgress } from '@/components/workbench/StepperProgress'
import { UnifiedJDBox } from '@/components/workbench/UnifiedJDBox'
import { BatchProgressPanel } from '@/components/workbench/BatchProgressPanel'
import { Archive, Coins } from 'lucide-react'
import {
  getTaskCost,
  JOB_IMAGE_MAX_BYTES,
  WORKBENCH_CREATE_PENDING_PROGRESS,
} from '@/lib/constants'
import { ServiceNotification } from '@/components/common/ServiceNotification'
import { getServiceErrorMessage } from '@/lib/utils/service-error-handler'
import { useServiceGuard } from '@/lib/hooks/use-service-guard'
import { uiLog } from '@/lib/ui/sse-debug-logger'

export function NewServiceForm({
  locale,
  dict,
  tabsDict,
  statusDict, // New prop for error mapping
  notificationDict,
  isAssetReady,
  quotaBalance,
}: {
  locale: Locale
  dict: any
  tabsDict: any
  statusDict?: any
  notificationDict?: any
  isAssetReady: boolean
  quotaBalance: number
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [file, setFile] = useState<File | null>(null)
  const [text, setText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const MAX_IMAGE_BYTES = JOB_IMAGE_MAX_BYTES

  // Use unified notification state
  const [notification, setNotification] = useState<{
    type: 'error' | 'success' | 'info'
    title: string
    description: string
  } | null>(null)

  const showError = (title: string, description: string) => {
    setNotification({ type: 'error', title, description })
  }

  const readFileAsDataUrl = (input: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('file_read_failed'))
      reader.readAsDataURL(input)
    })

  const getBase64ByteSize = (dataUrl: string) => {
    const commaIndex = dataUrl.indexOf(',')
    const base64 = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl
    return Math.floor((base64.length * 3) / 4)
  }

  const loadImage = (dataUrl: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('image_load_failed'))
      img.src = dataUrl
    })

  const renderToDataUrl = async (
    dataUrl: string,
    maxSize: number,
    quality: number,
  ) => {
    const img = await loadImage(dataUrl)
    let targetWidth = img.width
    let targetHeight = img.height
    if (targetWidth > maxSize || targetHeight > maxSize) {
      const scale = Math.min(maxSize / targetWidth, maxSize / targetHeight)
      targetWidth = Math.max(1, Math.floor(targetWidth * scale))
      targetHeight = Math.max(1, Math.floor(targetHeight * scale))
    }
    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('canvas_context_unavailable')
    }
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight)
    return canvas.toDataURL('image/jpeg', quality)
  }

  const compressToTarget = async (dataUrl: string, targetBytes: number) => {
    let current = dataUrl
    let quality = 0.82
    let maxSize = 1600
    for (let i = 0; i < 6; i += 1) {
      current = await renderToDataUrl(current, maxSize, quality)
      if (getBase64ByteSize(current) <= targetBytes) {
        return current
      }
      if (quality > 0.5) {
        quality = Math.max(0.5, Number((quality - 0.1).toFixed(2)))
      } else {
        maxSize = Math.max(600, Math.floor(maxSize * 0.85))
        quality = 0.82
      }
    }
    return current
  }

  const prepareJobImage = async (input: File) => {
    const originalDataUrl = await readFileAsDataUrl(input)
    if (getBase64ByteSize(originalDataUrl) <= MAX_IMAGE_BYTES) {
      return { ok: true, dataUrl: originalDataUrl as string }
    }
    const compressed = await compressToTarget(originalDataUrl, MAX_IMAGE_BYTES)
    if (getBase64ByteSize(compressed) <= MAX_IMAGE_BYTES) {
      return { ok: true, dataUrl: compressed as string }
    }
    return { ok: false, error: 'image_too_large' as const }
  }

  // Core execution logic (extracted for useServiceGuard callback)
  const executeCreateService = () => {
    if (!text && !file) {
      showError(dict.inputError, '')
      return
    }
    if (text && text.length > 8000) {
      showError(dict.jobTextTooLong || '文本长度超过 8000 字', '')
      return
    }

    setIsSubmitting(true)
    startTransition(async () => {
      setNotification(null) // Clear previous errors
      let shouldResetSubmitting = true

      let jobImage: string | undefined
      if (file) {
        try {
          const prepared = await prepareJobImage(file)
          if (!prepared.ok) {
            showError(
              dict.imageTooLarge || '图片过大，请上传不超过 1MB 的截图',
              '',
            )
            return
          }
          jobImage = prepared.dataUrl
        } catch (e) {
          showError(dict.imageCompressFailed || '图片压缩失败，请稍后重试', '')
          return
        }
      }

      const args: { locale: Locale; jobText?: string; jobImage?: string } = {
        locale,
      }
      if (text) args.jobText = text
      if (jobImage) args.jobImage = jobImage

      try {
        const res = await createServiceAction(args)
        if (!res || !('ok' in (res as any))) {
          showError(
            dict.notification?.serverErrorTitle || '服务创建失败',
            dict.notification?.serverErrorDesc || '',
          )
          return
        }

        if ((res as any).ok) {
          if ((res as any).serviceId) {
            shouldResetSubmitting = false
            router.push(`/${locale}/workbench/${(res as any).serviceId}`)
          }
        } else {
          if ((res as any).error === 'image_too_large') {
            showError(
              dict.imageTooLarge || '图片过大，请上传不超过 1MB 的截图',
              '',
            )
            return
          }
          const serviceError = getServiceErrorMessage((res as any).error, {
            statusText: statusDict,
            notification: notificationDict || dict.notification, // Fallback if missing
          })
          showError(serviceError.title, serviceError.description)
        }
      } catch (e) {
        uiLog.error('service creation failed', { error: e })
        showError(
          dict.notification?.serverErrorTitle || 'Service Creation Failed',
          dict.notification?.serverErrorDesc || 'An unexpected error occurred.',
        )
      } finally {
        if (shouldResetSubmitting) {
          setIsSubmitting(false)
        }
      }
    })
  }

  // Initialize Guard Hook
  const { execute, GuardDialog } = useServiceGuard({
    quotaBalance,
    cost: getTaskCost('job_match'), // Standard match cost
    dict: dict.notification,
    onConfirm: executeCreateService,
  })

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAssetReady) {
      showError(dict.prerequisiteError, '')
      return
    }
    // Execution flow: Guard (Quota Check) -> executeCreateService
    execute()
  }

  // Auto-expand sidebar when on the new service page to provide context
  useEffect(() => {
    const isCollapsed = localStorage.getItem('sidebar_collapsed') === '1'
    if (isCollapsed) {
      localStorage.setItem('sidebar_collapsed', '0')
      window.dispatchEvent(new CustomEvent('sidebar:collapsed-changed'))
    }
  }, [])

  const isBusy = isPending || isSubmitting
  const pendingTitle =
    statusDict?.MATCH_PENDING ||
    statusDict?.matchPending ||
    dict.pendingTitle ||
    '已进入匹配队列...'
  const pendingDescription =
    dict.pendingDescription || '已提交请求，正在排队分配计算资源。'

  if (!isAssetReady) {
    return (
      <div className="min-h-[calc(100vh-16rem)] flex flex-col items-center justify-center text-center px-6">
        <div className="flex flex-col items-center justify-center">
          <div className="mb-6 flex h-16 w-16 md:h-20 md:w-20 items-center justify-center rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 shadow-sm mx-auto transition-colors">
            <Archive
              className="h-8 w-8 md:h-10 md:w-10 text-slate-700 dark:text-slate-300"
              strokeWidth={2}
            />
          </div>
          <div className="text-xl md:text-2xl font-semibold text-slate-900 dark:text-white mb-3 text-center text-balance">
            {dict.assetGateTitle}
          </div>
          <p className="text-base text-slate-500 dark:text-slate-400 max-w-lg mx-auto leading-relaxed md:leading-loose text-center text-pretty">
            {dict.assetGateDescriptionLine1}
            <span className="font-semibold text-slate-900 dark:text-slate-200 whitespace-nowrap">
              {dict.assetGateHighlight1}
            </span>
            {dict.assetGateDelimiter1}
            <span className="font-semibold text-slate-900 dark:text-slate-200 whitespace-nowrap">
              {dict.assetGateHighlight2}
            </span>
            {dict.assetGateDelimiter2}
            <span className="font-semibold text-slate-900 dark:text-slate-200 whitespace-nowrap">
              {dict.assetGateHighlight3}
            </span>
            {dict.assetGateDescriptionLine2 ? (
              <>
                <br className="hidden md:block" />
                {dict.assetGateDescriptionLine2}
              </>
            ) : null}
          </p>
          <Button
            size="lg"
            className="mt-8 px-8 py-3 rounded-full font-medium transition-all active:scale-95 bg-slate-900 text-white hover:bg-slate-800 shadow-md shadow-slate-900/10 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 dark:shadow-white/10"
            onClick={() => router.push(`/${locale}/profile?tab=assets`)}
          >
            {dict.assetGateButton}
          </Button>
          <p className="mt-3 text-sm text-slate-400 dark:text-slate-400">
            {dict.assetGateMicrocopy}
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-xl border border-emerald-200/60 dark:border-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-400/[0.08] px-4 py-3 text-sm text-emerald-900 dark:text-emerald-200">
        {dict.readyBanner}
      </div>
      <StepperProgress
        currentStep={0 as any}
        maxUnlockedStep={0 as any}
        onStepClick={() => {}}
        labels={{
          step1: String(tabsDict?.match || 'Step 1'),
          step2: String(tabsDict?.customize || 'Step 2'),
          step3: String(tabsDict?.interview || 'Step 3'),
        }}
        className="shrink-0"
      />
      {isBusy ? (
        <AppCard className="border-[0.5px] border-black/5 dark:border-white/10 bg-white/50 dark:bg-white/[0.02] shadow-sm dark:shadow-2xl backdrop-blur-2xl">
          <AppCardContent className="pt-6">
            <BatchProgressPanel
              title={pendingTitle}
              description={pendingDescription}
              progress={WORKBENCH_CREATE_PENDING_PROGRESS}
            />
          </AppCardContent>
        </AppCard>
      ) : (
        <form onSubmit={onSubmit} className="space-y-6">
          <AppCard className="border-[0.5px] border-black/5 dark:border-white/10 bg-white/50 dark:bg-white/[0.02] shadow-sm dark:shadow-2xl backdrop-blur-2xl relative overflow-hidden">
            <AppCardHeader>
              <AppCardTitle>{dict.title}</AppCardTitle>
              <AppCardDescription>{dict.description}</AppCardDescription>
            </AppCardHeader>
            <AppCardContent className="space-y-4">
              <UnifiedJDBox
                dict={dict}
                disabled={isPending}
                valueText={text}
                onChangeText={setText}
                valueFile={file}
                onChangeFile={setFile}
              />
              <input type="hidden" name="jd_text" value={text} />
            </AppCardContent>
            <AppCardFooter className="flex-col items-start gap-4 sm:flex-row sm:items-center justify-start">
              <div className="flex items-center gap-3 order-2 sm:order-1 w-full sm:w-auto">
                <Button
                  type="submit"
                  disabled={isPending}
                  className="relative inline-flex items-center justify-center font-bold overflow-hidden z-10 bg-gradient-to-b from-slate-800 to-slate-900 text-white hover:from-slate-700 hover:to-slate-800 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_4px_14px_rgba(0,0,0,0.15)] dark:from-slate-100 dark:to-slate-300 dark:text-slate-900 dark:hover:from-white dark:hover:to-slate-200 dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_4px_20px_rgba(0,0,0,0.3)] border border-slate-900/10 dark:border-white/10 active:scale-[0.98] transition-all duration-300 ease-out backdrop-blur-md"
                >
                  {dict.button}
                </Button>
                <span
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground"
                  title={`Cost: ${getTaskCost('job_match')} coins`}
                >
                  <Coins className="w-3 h-3 text-yellow-500" />
                  {getTaskCost('job_match')}
                </span>
              </div>

              <div className="order-1 sm:order-2 w-full sm:w-auto flex items-center min-h-[40px]">
                {notification && (
                  <ServiceNotification
                    type={notification.type}
                    title={notification.title}
                    description={notification.description}
                    onClose={() => setNotification(null)}
                    autoDismiss={3000}
                    className="w-full sm:w-auto"
                  />
                )}
              </div>
            </AppCardFooter>
          </AppCard>
        </form>
      )}
      {GuardDialog}
    </>
  )
}
