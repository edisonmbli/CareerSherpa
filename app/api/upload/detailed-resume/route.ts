import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { withApiAuth, ApiUser, ApiContext } from '@/lib/api/auth-wrapper'
import { createDetailedResume } from '@/lib/dal'
import { 
  extractFileFromFormData, 
  processUploadedFile, 
  processTextInput,
  type FileProcessResult 
} from '@/lib/utils/file-processor'

export const runtime = 'nodejs'

/**
 * 处理详细简历上传请求
 */
async function handleDetailedResumeUpload(
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
    
    processedData = await processUploadedFile(file, 'detailed-resume')
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

  const detailedId = crypto.randomUUID()

  // Create detailed resume using DAL
  await createDetailedResume({
    id: detailedId,
    userId: user.id,
    lang,
    originalText: processedData.content,
    sourceType: processedData.metadata.sourceType,
    contentType: processedData.metadata.mimeType,
    charCount: processedData.metadata.charCount,
    mediaBase64: processedData.mediaBase64 || null,
  })

  return NextResponse.json(
    { detailed_resume_id: detailedId },
    { status: 200 }
  )
}

export const POST = withApiAuth('/api/upload/detailed-resume', handleDetailedResumeUpload)
