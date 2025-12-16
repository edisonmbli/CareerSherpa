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
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { toast } from '@/components/ui/use-toast'
import { useRouter } from 'next/navigation'
import { createServiceAction } from '@/lib/actions/service.actions'
import { StepperProgress } from '@/components/workbench/StepperProgress'
import { UnifiedJDBox } from '@/components/workbench/UnifiedJDBox'
import { Coins } from 'lucide-react'
import { getTaskCost } from '@/lib/constants'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function NewServiceForm({
  locale,
  dict,
  tabsDict,
  hasResume,
}: {
  locale: Locale
  dict: any
  tabsDict: any
  hasResume: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [file, setFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [text, setText] = useState('')
  const [errorDialog, setErrorDialog] = useState<{
    open: boolean
    title: string
    description: string
  }>({ open: false, title: '', description: '' })

  const showError = (title: string, description: string) => {
    setErrorDialog({ open: true, title, description })
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!hasResume) {
      showError(dict.prerequisiteError, '')
      return
    }
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
      let jobImage: string | undefined
      if (file) {
        jobImage = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result))
          reader.onerror = () => reject(new Error('file_read_failed'))
          reader.readAsDataURL(file)
        })
      }
      const args: { locale: Locale; jobText?: string; jobImage?: string } = {
        locale,
      }
      if (text) args.jobText = text
      if (jobImage) args.jobImage = jobImage
      const res = await createServiceAction(args)
      if (!res || !('ok' in (res as any))) {
        showError('服务创建失败', '')
        return
      }
      
      // Handle success
      if ((res as any).ok) {
        if ((res as any).isFree)
          showError(
            dict.freeQueueTitle || '金币不足，已转入免费队列',
            dict.freeQueueDesc ||
              '建议充值使用付费模型，获得更好更快的分析体验。'
          )
        if ((res as any).serviceId)
          router.push(`/${locale}/workbench/${(res as any).serviceId}`)
      } else {
        // Handle failure
        // If we have a serviceId even on failure, we should redirect to it so user sees the "FAILED" state
        if ((res as any).serviceId) {
          router.push(`/${locale}/workbench/${(res as any).serviceId}`)
          return
        }

        const error = (res as any).error
        if (error === 'rate_limited') {
          showError(
            '创建请求受限',
            dict.rateLimited || '已有多个任务在创建中，请稍后再试'
          )
        } else {
          showError('服务创建失败', dict.serverError || '服务创建失败')
        }
      }
    })
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
        <AppCard className="shadow-md border-0">
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
          <AppCardFooter>
            <div className="flex items-center gap-3">
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
          </AppCardFooter>
        </AppCard>
      </form>
      <Dialog
        open={errorDialog.open}
        onOpenChange={(open) => setErrorDialog((prev) => ({ ...prev, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{errorDialog.title}</DialogTitle>
            <DialogDescription>{errorDialog.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() =>
                setErrorDialog((prev) => ({ ...prev, open: false }))
              }
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
