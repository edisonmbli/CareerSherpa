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
import { UnifiedJDBox } from '@/components/workbench/UnifiedJDBox'

export function NewServiceForm({
  locale,
  dict,
  hasResume,
}: {
  locale: Locale
  dict: any
  hasResume: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [file, setFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [text, setText] = useState('')

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!hasResume) {
      toast.error(dict.prerequisiteError)
      return
    }
    if (!text && !file) {
      toast.error(dict.inputError)
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
      const args: { locale: Locale; jobText?: string; jobImage?: string } = { locale }
      if (text) args.jobText = text
      if (jobImage) args.jobImage = jobImage
      const res = await createServiceAction(args)
      if (!res || !('ok' in (res as any))) {
        toast.error('服务创建失败')
        return
      }
      if ((res as any).ok) {
        if ((res as any).isFree) toast.warning(dict.freeQueueHint)
        if ((res as any).serviceId) router.push(`/${locale}/workbench/${(res as any).serviceId}`)
      } else {
        toast.error(dict.serverError || '服务创建失败')
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
          <Button type="submit" disabled={isPending} className="dark:shadow-lg dark:ring-1 dark:ring-primary/30">
            {dict.button}
          </Button>
        </AppCardFooter>
      </AppCard>
    </form>
  )
}
