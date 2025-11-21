import type { Locale } from '@/i18n-config'
import { SseStreamViewer } from '@/components/dev/SseStreamViewer'
import { pushTask } from '@/lib/queue/producer'
import type { TaskTemplateId } from '@/lib/prompts/types'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function Page({ params, searchParams }: { params: Promise<{ locale: Locale }>, searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale } = await params
  const sp = await searchParams
  const defaults = {
    userId: 'u_dev',
    serviceId: 'svc_stream',
    taskId: `t_${Date.now()}`,
  }
  const readParam = (key: string): string | undefined => {
    const v = sp[key]
    return Array.isArray(v) ? v[0] : v
  }
  const current = {
    userId: readParam('userId') ?? defaults.userId,
    serviceId: readParam('serviceId') ?? defaults.serviceId,
    taskId: readParam('taskId') ?? defaults.taskId,
    templateId: readParam('templateId') as TaskTemplateId | undefined,
  }

  async function triggerStream(formData: FormData) {
    'use server'
    const userId = (formData.get('userId') as string) || 'u_dev'
    const serviceId = (formData.get('serviceId') as string) || 'svc_stream'
    const taskId = (formData.get('taskId') as string) || `t_${Date.now()}`
    const templateId = (formData.get('templateId') as string) as TaskTemplateId
    const locale = formData.get('locale') as Locale
    const image = (formData.get('image') as string) || ''
    const tierOverride = (formData.get('tierOverride') as string) || 'auto'

    const base = {
      prompt: 'Hello stream from dev page',
      ...(image ? { image } : {}),
      ...(tierOverride === 'paid' ? { wasPaid: true, cost: 1, tierOverride: 'paid' } : {}),
      ...(tierOverride === 'free' ? { wasPaid: false, tierOverride: 'free' } : {}),
      ...(tierOverride === 'auto' ? {} : {}),
    }
    const variables = templateId === 'job_summary'
      ? { ...base, jobId: 'job_dev' }
      : templateId === 'job_match'
      ? { ...base, jobId: 'job_dev', text: 'hello' }
      : templateId === 'resume_summary'
      ? { ...base, resumeId: taskId, wasPaid: true, cost: 1 }
      : templateId === 'detailed_resume_summary'
      ? { ...base, detailedResumeId: taskId, wasPaid: true, cost: 1 }
      : templateId === 'interview_prep'
      ? { ...base, interviewId: 'interview_dev', wasPaid: true, cost: 1 }
      : base
    await pushTask({ kind: 'stream', serviceId, taskId, userId, locale, templateId, variables: variables as any })
    // 重定向到带查询参数的同一路径，以同步 Viewer 与提交值
    redirect(`/${locale}/sse?userId=${encodeURIComponent(userId)}&serviceId=${encodeURIComponent(serviceId)}&taskId=${encodeURIComponent(taskId)}&templateId=${encodeURIComponent(templateId)}`)
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">SSE Stream Dev ({locale})</h1>
      <form action={triggerStream} className="space-y-3">
        <input type="hidden" name="locale" value={locale} />
        <div className="grid grid-cols-3 gap-2">
          <input name="userId" defaultValue={current.userId} className="border rounded px-2 py-1" />
          <input name="serviceId" defaultValue={current.serviceId} className="border rounded px-2 py-1" />
          <input name="taskId" defaultValue={current.taskId} className="border rounded px-2 py-1" />
        </div>
        <input name="templateId" defaultValue={current.templateId ?? ''} placeholder="Template ID" className="border rounded px-2 py-1 w-full" />
        <div className="grid grid-cols-2 gap-2">
          <input name="image" placeholder="Image URL (trigger vision)" className="border rounded px-2 py-1 w-full" />
          <select name="tierOverride" className="border rounded px-2 py-1">
            <option value="auto">Auto</option>
            <option value="paid">Force Paid</option>
            <option value="free">Force Free</option>
          </select>
        </div>
        <button type="submit" className="border rounded px-3 py-1">Push Stream Task</button>
      </form>
      <SseStreamViewer userId={current.userId} serviceId={current.serviceId} taskId={current.taskId} />
    </div>
  )
}
