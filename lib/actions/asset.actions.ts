'use server'

import type { Locale } from '@/i18n-config'
import { processUploadedFile } from '@/lib/utils/file-processor'
import { uploadResumeAction, uploadDetailedResumeAction } from '@/lib/actions/resume.actions'
import { getTaskLimits } from '@/lib/llm/config'

export async function uploadAssetFormDataAction({
  formData,
  locale,
  taskTemplateId,
}: {
  formData: FormData
  locale: Locale
  taskTemplateId: 'resume_summary' | 'detailed_resume_summary'
}) {
  const file = formData.get('assetFile') as File | null
  if (!file) return { success: false, error: 'missing_file' }

  if (file.type !== 'application/pdf') {
    return { success: false, error: 'unsupported_file_type' }
  }

  try {
    const processed = await processUploadedFile(file, taskTemplateId === 'resume_summary' ? 'resume' : 'detailed-resume')
    // 仅支持文本型 PDF：要求 sourceType 为 pdf_text，且有足够文本
    if (processed.metadata.sourceType !== 'pdf_text' || processed.metadata.charCount < 200) {
      return { success: false, error: 'unsupported_scan_pdf' }
    }

    const recommendLimit = getTaskLimits(taskTemplateId).maxTokens
    if (processed.metadata.charCount > recommendLimit) {
      return { success: false, error: 'text_too_long' }
    }

    if (taskTemplateId === 'resume_summary') {
      const res = await uploadResumeAction({ locale, originalText: processed.content })
      if (res.ok) return { success: true, taskId: res.taskId, isFree: res.isFree }
      const taskId = 'taskId' in res ? res.taskId : undefined
      const isFree = 'isFree' in res ? res.isFree : undefined
      return { success: false, error: res.error, taskId, isFree }
    } else {
      const res = await uploadDetailedResumeAction({ locale, originalText: processed.content })
      if (res.ok) return { success: true, taskId: res.taskId, isFree: res.isFree }
      const taskId = 'taskId' in res ? res.taskId : undefined
      const isFree = 'isFree' in res ? res.isFree : undefined
      return { success: false, error: res.error, taskId, isFree }
    }
  } catch (e) {
    return { success: false, error: 'processing_failed' }
  }
}