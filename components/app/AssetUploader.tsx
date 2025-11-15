'use client'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Upload, FileCheck, FileX, Loader2 } from 'lucide-react'
import { toast } from '@/components/ui/use-toast'
import { useTaskPolling } from '@/lib/hooks/useTaskPolling'
import { uploadAssetFormDataAction } from '@/lib/actions/asset.actions'

type UploaderStatus = 'IDLE' | 'UPLOADING' | 'PENDING' | 'COMPLETED' | 'FAILED'

export function AssetUploader({
  locale,
  taskTemplateId,
  initialStatus,
  initialFileName,
  dict,
}: {
  locale: 'en' | 'zh'
  taskTemplateId: 'resume_summary' | 'detailed_resume_summary'
  initialStatus: UploaderStatus
  initialFileName: string | null
  dict: {
    button: string
    buttonProcessing: string
    status: { pending: string; completed: string; failed: string }
    toast: {
      uploadSuccess: string
      queueFree: string
      queueError: string
      pollSuccess: string
      pollFailed: string
    }
  }
}) {
  const [status, setStatus] = useState<UploaderStatus>(initialStatus)
  const [fileName, setFileName] = useState<string | null>(initialFileName)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const { status: pollStatus } = useTaskPolling({
    taskId,
    taskType:
      taskTemplateId === 'resume_summary' ? 'resume' : 'detailed_resume',
    initialStatus: status === 'PENDING' ? 'PENDING' : 'IDLE',
    onSuccess: () => {
      setStatus('COMPLETED')
      toast.success(dict.toast.pollSuccess)
    },
    onError: () => {
      setStatus('FAILED')
      toast.error(dict.toast.pollFailed)
    },
  })

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const file = formData.get('assetFile') as File | null
    if (!file) {
      toast.error('请选择 PDF 文件')
      return
    }
    if (file.type !== 'application/pdf') {
      toast.warning('目前仅支持文本型 PDF')
      return
    }

    setFileName(file.name)
    setStatus('UPLOADING')
    startTransition(async () => {
      const res = await uploadAssetFormDataAction({
        formData,
        locale,
        taskTemplateId,
      })
      if (res.success) {
        setTaskId(res.taskId ?? null)
        setStatus('PENDING')
        toast.success(dict.toast.uploadSuccess)
        if (res.isFree) toast.warning(dict.toast.queueFree)
      } else {
        setStatus('FAILED')
        toast.error(res.error || dict.toast.queueError)
      }
    })
  }

  const renderStatus = () => {
    const s = status === 'PENDING' ? pollStatus : status
    switch (s) {
      case 'UPLOADING':
      case 'PENDING':
        return (
          <div className="space-y-2">
            <Progress value={33} className="w-full" />
            <div className="flex items-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {fileName} - {dict.status.pending}...
            </div>
          </div>
        )
      case 'COMPLETED':
        return (
          <Badge variant="secondary" className="text-green-600">
            <FileCheck className="mr-2 h-4 w-4" />
            {fileName} - {dict.status.completed}
          </Badge>
        )
      case 'FAILED':
        return (
          <Badge variant="destructive">
            <FileX className="mr-2 h-4 w-4" />
            {fileName} - {dict.status.failed}
          </Badge>
        )
      default:
        return null
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-sm text-muted-foreground">
        仅支持文本型 PDF（扫描件/图片暂不支持）
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Input
          id="assetFile"
          name="assetFile"
          type="file"
          accept="application/pdf"
          required
          disabled={isPending || status === 'PENDING' || status === 'UPLOADING'}
          className="flex-1"
        />
        <Button
          type="submit"
          disabled={isPending || status === 'PENDING' || status === 'UPLOADING'}
          className="w-full sm:w-auto"
        >
          {isPending || status === 'PENDING' || status === 'UPLOADING' ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          {isPending ? dict.buttonProcessing : dict.button}
        </Button>
      </div>
      <div className="h-10">{renderStatus()}</div>
    </form>
  )
}
