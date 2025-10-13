'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import crypto from 'crypto'

import { 
  processUploadedFile, 
  processTextInput, 
  extractFileFromFormData,
  isFileProcessError,
  FILE_PROCESS_ERRORS,
  type SupportedFileType,
} from '@/lib/utils/file-processor'
import { createOrUpdateUser, createResume, createDetailedResume, createJobDescription } from '@/lib/dal'
import { ensureMigrations } from '@/lib/db-migrations'
import {
  ActionResult,
  createActionContext,
  handleActionError,
  createActionSuccess,
  validateRequiredFields,
  getFormDataString,
  getFormDataFile,
  extractUserKeyFromFormData,
} from './utils'
import { withAuth } from './auth-wrapper'

/**
 * 获取用户标识
 */
function getUserKey(formData: FormData): string {
  const headers = Object.fromEntries(
    Array.from(formData.entries()).filter(([key]) => key.startsWith('x-'))
  )
  
  return (
    (headers['x-user-key'] as string) ||
    (headers['x-forwarded-for'] as string)?.split(',')[0] ||
    'unknown'
  )
}

/**
 * 通用文件上传处理函数（内部使用，已认证）
 */
async function handleFileUpload(
  userKey: string,
  formData: FormData,
  fileType: SupportedFileType,
  createEntityFn: (data: any) => Promise<any>
): Promise<ActionResult> {
  const context = createActionContext(`upload-${fileType}`, userKey)

  try {
    await ensureMigrations()

    // 提取文件和语言信息
    const { file, lang } = extractFileFromFormData(formData)
    
    // 处理文件
    const result = await processUploadedFile(file, fileType)
    
    // 创建或更新用户
    const user = await createOrUpdateUser({
      stackUserId: userKey,
      langPref: lang,
    })

    // 创建实体记录
    const entityData: any = {
      id: crypto.randomUUID(),
      userId: user.id,
      lang,
      sourceType: result.metadata.sourceType,
      contentType: result.metadata.mimeType,
      charCount: result.metadata.charCount,
      mediaBase64: result.mediaBase64,
    }

    if (fileType === 'jd') {
      entityData.rawText = result.content
    } else {
      entityData.originalText = result.content
    }

    const entity = await createEntityFn(entityData)

    return createActionSuccess(
      { [`${fileType.replace('-', '_')}_id`]: entity.id },
      context,
      `${fileType} uploaded successfully`
    )

  } catch (error: unknown) {
    return handleActionError(error, context)
  }
}

/**
 * 上传简历
 */
export const uploadResume = withAuth(
  'upload-resume',
  async (user, formData: FormData): Promise<ActionResult> => {
    return handleFileUpload(user.id, formData, 'resume', createResume)
  }
)

/**
 * 上传详细简历
 */
export const uploadDetailedResume = withAuth(
  'upload-detailed-resume',
  async (user, formData: FormData): Promise<ActionResult> => {
    return handleFileUpload(user.id, formData, 'detailed-resume', createDetailedResume)
  }
)

/**
 * 上传职位描述
 */
export const uploadJobDescription = withAuth(
  'upload-job-description',
  async (user, formData: FormData): Promise<ActionResult> => {
    return handleFileUpload(user.id, formData, 'jd', createJobDescription)
  }
)

/**
 * 批量上传文件
 */
export const uploadBatch = withAuth(
  'upload-batch',
  async (user, formData: FormData): Promise<ActionResult> => {
    const userKey = user.id
    const context = createActionContext('upload-batch', userKey)

    try {
      await ensureMigrations()

      const results: Record<string, any> = {}
      const errors: string[] = []

      // 上传简历
      const resumeFormData = new FormData()
      const resumeFile = formData.get('resumeFile') as File
      const lang = formData.get('lang') as string

      if (resumeFile && resumeFile.size > 0) {
        resumeFormData.append('file', resumeFile)
        resumeFormData.append('lang', lang)
        resumeFormData.append('x-user-key', userKey)

        const resumeResult = await uploadResume(resumeFormData)
        if (resumeResult.success) {
          results.resume = resumeResult.data
        } else {
          errors.push(`Resume upload failed: ${resumeResult.error}`)
        }
      }

      // 上传职位描述
      const jdFile = formData.get('jdFile') as File
      const jdText = formData.get('jdText') as string

      if ((jdFile && jdFile.size > 0) || jdText) {
        const jdFormData = new FormData()
        if (jdFile && jdFile.size > 0) {
          jdFormData.append('file', jdFile)
        } else {
          jdFormData.append('text', jdText)
        }
        jdFormData.append('lang', lang)
        jdFormData.append('x-user-key', userKey)

        const jdResult = await uploadJobDescription(jdFormData)
        if (jdResult.success) {
          results.jobDescription = jdResult.data
        } else {
          errors.push(`Job description upload failed: ${jdResult.error}`)
        }
      }

      // 上传详细简历（可选）
      const detailedFile = formData.get('detailedFile') as File
      const detailedText = formData.get('detailedText') as string

      if ((detailedFile && detailedFile.size > 0) || detailedText) {
        const detailedFormData = new FormData()
        if (detailedFile && detailedFile.size > 0) {
          detailedFormData.append('file', detailedFile)
        } else {
          detailedFormData.append('text', detailedText)
        }
        detailedFormData.append('lang', lang)
        detailedFormData.append('x-user-key', userKey)

        const detailedResult = await uploadDetailedResume(detailedFormData)
        if (detailedResult.success) {
          results.detailedResume = detailedResult.data
        } else {
          errors.push(`Detailed resume upload failed: ${detailedResult.error}`)
        }
      }

      if (errors.length > 0) {
        return {
          success: false,
          error: 'partial_failure',
          message: errors.join('; '),
          data: results,
        }
      }

      return createActionSuccess(results, context, 'Batch upload completed successfully')

    } catch (error: unknown) {
      return handleActionError(error, context)
    }
  }
)

/**
 * 重定向到工作台
 */
export async function redirectToWorkbench() {
  revalidatePath('/workbench')
  redirect('/workbench')
}