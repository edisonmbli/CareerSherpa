import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { withApiAuth, ApiUser, ApiContext } from '@/lib/api/auth-wrapper'
import { createResume } from '@/lib/dal'
import { processUploadedFile, processTextInput, extractFileFromFormData } from '@/lib/utils/file-processor'

export const runtime = 'nodejs'

/**
 * 处理简历上传请求
 */
async function handleResumeUpload(
  user: ApiUser,
  req: NextRequest,
  context: ApiContext
): Promise<NextResponse> {
  const contentType = req.headers.get('content-type') || ''
  let result
  let lang = ''
  const resumeId = crypto.randomUUID()

  if (contentType.includes('multipart/form-data')) {
    // 处理文件上传
    const formData = await req.formData()
    const { file, lang: fileLang } = extractFileFromFormData(formData)
    lang = fileLang
    
    result = await processUploadedFile(file, 'resume')
  } else {
    // 处理文本输入
    const body = await req.json().catch(() => ({}))
    const text = (body.text as string) || ''
    lang = (body.lang as string) || ''
    
    if (!text || !lang) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
    }
    
    result = await processTextInput(text, lang)
  }

  // 创建简历记录
  await createResume({
    id: resumeId,
    userId: user.id,
    lang,
    originalText: result.content,
    sourceType: result.metadata.sourceType,
    contentType: result.metadata.mimeType,
    charCount: result.metadata.charCount,
    mediaBase64: result.mediaBase64
  })

  return NextResponse.json({ resume_id: resumeId }, { status: 200 })
}

export const POST = withApiAuth('/api/upload/resume', handleResumeUpload)
