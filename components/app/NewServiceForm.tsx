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
import { useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { createServiceAction } from '@/lib/actions/service.actions'
import { StepperProgress } from '@/components/workbench/StepperProgress'
import { UnifiedJDBox } from '@/components/workbench/UnifiedJDBox'
import { Coins } from 'lucide-react'
import { getTaskCost } from '@/lib/constants'
import { ServiceNotification } from '@/components/common/ServiceNotification'
import { getServiceErrorMessage } from '@/lib/utils/service-error-handler'
import { useServiceGuard } from '@/lib/hooks/use-service-guard'

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
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [text, setText] = useState('')

  // Use unified notification state
  const [notification, setNotification] = useState<{
    type: 'error' | 'success' | 'info'
    title: string
    description: string
  } | null>(null)

  const showError = (title: string, description: string) => {
    setNotification({ type: 'error', title, description })
  }

  // Core execution logic (extracted for useServiceGuard callback)
  const executeCreateService = () => {
    if (!text && !file) {
      showError(dict.inputError, '')
      return
    }
    if (file && file.size > 3 * 1024 * 1024) {
      showError(dict.imageTooLarge || '图片大小超过 3MB', '')
      return
    }
    if (text && text.length > 8000) {
      showError(dict.jobTextTooLong || '文本长度超过 8000 字', '')
      return
    }

    startTransition(async () => {
      setNotification(null) // Clear previous errors

      let jobImage: string | undefined
      if (file) {
        try {
          jobImage = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(String(reader.result))
            reader.onerror = () => reject(new Error('file_read_failed'))
            reader.readAsDataURL(file)
          })
        } catch (e) {
          showError('File read failed', '')
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
          if ((res as any).serviceId)
            router.push(`/${locale}/workbench/${(res as any).serviceId}`)
        } else {
          const serviceError = getServiceErrorMessage((res as any).error, {
            statusText: statusDict,
            notification: notificationDict || dict.notification, // Fallback if missing
          })
          showError(serviceError.title, serviceError.description)
        }
      } catch (e) {
        console.error('Service creation failed:', e)
        showError(
          dict.notification?.serverErrorTitle || 'Service Creation Failed',
          dict.notification?.serverErrorDesc || 'An unexpected error occurred.',
        )
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

            {/* Notification area next to button */}
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
      {/* Free Tier Confirmation Dialog */}
      {GuardDialog}
    </>
  )
}
