'use client'

import { useState, useTransition } from 'react'
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
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { createServiceAction } from '@/lib/actions/service.actions'
import { StepperProgress } from '@/components/workbench/StepperProgress'
import { UnifiedJDBox } from '@/components/workbench/UnifiedJDBox'
import { BatchProgressPanel } from '@/components/workbench/BatchProgressPanel'
import { Coins } from 'lucide-react'
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
  hasResume,
  quotaBalance,
}: {
  locale: Locale
  dict: any
  tabsDict: any
  statusDict?: any
  notificationDict?: any
  hasResume: boolean
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
    if (!hasResume) {
      showError(dict.prerequisiteError, '')
      return
    }
    // Execution flow: Guard (Quota Check) -> executeCreateService
    execute()
  }

  if (!hasResume) {
    return (
      <AppCard>
        <AppCardContent>
          <Alert>
            <AlertTitle>{dict.prerequisite.title}</AlertTitle>
            <AlertDescription>{dict.prerequisite.description}</AlertDescription>
          </Alert>
        </AppCardContent>
        <AppCardFooter>
          <Button onClick={() => router.push(`/${locale}/profile`)}>
            {dict.prerequisite.button}
          </Button>
        </AppCardFooter>
      </AppCard>
    )
  }

  const isBusy = isPending || isSubmitting
  const pendingTitle =
    statusDict?.MATCH_PENDING ||
    statusDict?.matchPending ||
    dict.pendingTitle ||
    '已进入匹配队列...'
  const pendingDescription =
    dict.pendingDescription || '已提交请求，正在排队分配计算资源。'

  return (
    <>
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
        <AppCard className="border border-border/60 bg-card/50 shadow-[0_0_0_1px_rgba(255,255,255,0.4)_inset,0_2px_6px_rgba(0,0,0,0.04)] sm:shadow-[0_0_0_1px_rgba(255,255,255,0.5)_inset,0_4px_12px_rgba(0,0,0,0.05)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset,0_4px_24px_rgba(0,0,0,0.2)] backdrop-blur-sm">
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
          <AppCard className="border border-border/60 bg-card/50 shadow-[0_0_0_1px_rgba(255,255,255,0.4)_inset,0_2px_6px_rgba(0,0,0,0.04)] sm:shadow-[0_0_0_1px_rgba(255,255,255,0.5)_inset,0_4px_12px_rgba(0,0,0,0.05)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset,0_4px_24px_rgba(0,0,0,0.2)] backdrop-blur-sm">
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
                  className="dark:shadow-lg dark:ring-1 dark:ring-primary/30"
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
      {/* Free Tier Confirmation Dialog */}
      {GuardDialog}
    </>
  )
}
