import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { withApiAuth, ApiUser, ApiContext } from '@/lib/api/auth-wrapper'
import { createJobDescription } from '@/lib/dal'
import { 
  extractFileFromFormData, 
  processUploadedFile, 
  processTextInput,
  type FileProcessResult 
} from '@/lib/utils/file-processor'

export const runtime = 'nodejs'

/**
 * 处理职位描述上传请求
 */
async function handleJobDescriptionUpload(
  user: ApiUser,
  req: NextRequest,
  context: ApiContext
): Promise<NextResponse> {
  const contentType = req.headers.get('content-type') || ''
  const isMultipart = contentType.includes('multipart/form-data')

  let processedData: FileProcessResult
  let lang: string

  if (isMultipart) {
    // Handle file upload
    const formData = await req.formData()
    const { file, lang: extractedLang } = extractFileFromFormData(formData)
    lang = extractedLang
    
    processedData = await processUploadedFile(file, 'jd')
  } else {
    // Handle JSON text input
    const body = await req.json().catch(() => ({}))
    const text = (body.text as string) || ''
    const extractedLang = (body.lang as string) || ''
    
    if (!text || !extractedLang) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
    }
    
    lang = extractedLang
    processedData = await processTextInput(text, lang)
  }

  const jobId = crypto.randomUUID()

  // Create job description using DAL
  await createJobDescription({
    id: jobId,
    userId: user.id,
    lang,
    rawText: processedData.content,
    sourceType: processedData.metadata.sourceType,
    contentType: processedData.metadata.mimeType,
    charCount: processedData.metadata.charCount,
    mediaBase64: processedData.mediaBase64 || null,
  })

  return NextResponse.json({ job_id: jobId }, { status: 200 })
}

export const POST = withApiAuth('/api/upload/jd', handleJobDescriptionUpload)
