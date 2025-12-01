import 'server-only'
import crypto from 'crypto'

/**
 * 文件处理结果接口
 */
export interface FileProcessResult {
  /** 提取的文本内容 */
  content: string
  /** 文件元数据 */
  metadata: FileMetadata
  /** 文件内容哈希 */
  hash: string
  /** 媒体文件的base64编码（如果适用） */
  mediaBase64?: string
}

/**
 * 文件元数据接口
 */
export interface FileMetadata {
  /** 源文件类型 */
  sourceType: 'text' | 'pdf_text' | 'pdf_scan' | 'image'
  /** MIME类型 */
  mimeType: string
  /** 字符数量 */
  charCount: number
  /** 文件大小（字节） */
  fileSize: number
  /** 原始文件名 */
  fileName?: string
}

/**
 * 支持的文件类型
 */
export type SupportedFileType = 'resume' | 'jd' | 'detailed-resume'

/**
 * 文件处理配置
 */
interface FileProcessConfig {
  /** PDF文本提取的最小字符数阈值 */
  pdfTextThreshold: number
  /** 最大文件大小（字节） */
  maxFileSize: number
  /** 支持的MIME类型 */
  supportedMimeTypes: string[]
}

/**
 * 不同文件类型的处理配置
 */
const FILE_CONFIGS: Record<SupportedFileType, FileProcessConfig> = {
  resume: {
    pdfTextThreshold: 300,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    supportedMimeTypes: ['application/pdf', 'text/plain'],
  },
  'detailed-resume': {
    pdfTextThreshold: 300,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    supportedMimeTypes: ['application/pdf', 'text/plain'],
  },
  jd: {
    pdfTextThreshold: 300,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    supportedMimeTypes: [
      'application/pdf',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/webp',
    ],
  },
}

/**
 * 验证文件类型和大小
 */
function validateFile(file: File, fileType: SupportedFileType): void {
  const config = FILE_CONFIGS[fileType]

  // 检查文件大小
  if (file.size > config.maxFileSize) {
    throw new Error('file_too_large')
  }

  // 检查MIME类型
  const mimeType = file.type || 'application/octet-stream'
  if (!config.supportedMimeTypes.includes(mimeType)) {
    throw new Error('unsupported_file_type')
  }
}

/**
 * 处理PDF文件
 */
async function processPdfFile(
  buffer: Buffer,
  mimeType: string,
  config: FileProcessConfig
): Promise<{
  content: string
  metadata: Omit<FileMetadata, 'fileSize' | 'fileName'>
  mediaBase64?: string
}>
{
  try {
    const pdf = (await import('pdf-parse')).default as (buf: Buffer) => Promise<{ text?: string }>
    const parsed = await pdf(buffer)
    const text = (parsed?.text || '').trim()
    const charCount = text.length

    // 根据文本长度决定处理方式
    if (charCount > config.pdfTextThreshold) {
      // 文本足够多，直接使用提取的文本
      return {
        content: text,
        metadata: {
          sourceType: 'pdf_text',
          mimeType,
          charCount,
        },
      }
    } else {
      // 文本太少，可能是扫描件，保存为base64
      const mediaBase64 = `data:${mimeType};base64,${buffer.toString('base64')}`
      return {
        content: text,
        metadata: {
          sourceType: 'pdf_scan',
          mimeType,
          charCount,
        },
        mediaBase64,
      }
    }
  } catch {
    // PDF解析失败，作为扫描件处理
    const mediaBase64 = `data:${mimeType};base64,${buffer.toString('base64')}`
    return {
      content: '',
      metadata: {
        sourceType: 'pdf_scan',
        mimeType,
        charCount: 0,
      },
      mediaBase64,
    }
  }
}

/**
 * 处理图片文件
 */
async function processImageFile(
  buffer: Buffer,
  mimeType: string
): Promise<{
  content: string
  metadata: Omit<FileMetadata, 'fileSize' | 'fileName'>
  mediaBase64: string
}> {
  const mediaBase64 = `data:${mimeType};base64,${buffer.toString('base64')}`

  return {
    content: '', // 图片内容需要后续通过视觉模型提取
    metadata: {
      sourceType: 'image',
      mimeType,
      charCount: 0,
    },
    mediaBase64,
  }
}

/**
 * 处理文本文件
 */
async function processTextFile(
  buffer: Buffer,
  mimeType: string
): Promise<{
  content: string
  metadata: Omit<FileMetadata, 'fileSize' | 'fileName'>
}> {
  const text = buffer.toString('utf-8')
  const charCount = text.length

  return {
    content: text,
    metadata: {
      sourceType: 'text',
      mimeType,
      charCount,
    },
  }
}

/**
 * 处理上传的文件
 * @param file 上传的文件对象
 * @param fileType 文件类型（resume/jd/detailed-resume）
 * @returns 文件处理结果
 */
export async function processUploadedFile(
  file: File,
  fileType: SupportedFileType
): Promise<FileProcessResult> {
  // 验证文件
  validateFile(file, fileType)

  const config = FILE_CONFIGS[fileType]
  const mimeType = file.type || 'application/octet-stream'
  const buffer = Buffer.from(await file.arrayBuffer())

  // 生成文件内容哈希
  const hash = crypto.createHash('sha256').update(buffer).digest('hex')

  let result: {
    content: string
    metadata: Omit<FileMetadata, 'fileSize' | 'fileName'>
    mediaBase64?: string
  }

  // 根据MIME类型处理文件
  if (mimeType === 'application/pdf') {
    result = await processPdfFile(buffer, mimeType, config)
  } else if (mimeType.startsWith('image/')) {
    result = await processImageFile(buffer, mimeType)
  } else if (mimeType === 'text/plain') {
    result = await processTextFile(buffer, mimeType)
  } else {
    throw new Error('unsupported_file_type')
  }

  const processResult = {
    content: result.content,
    metadata: {
      ...result.metadata,
      fileSize: file.size,
      fileName: file.name,
    },
    hash,
  } as FileProcessResult

  if ('mediaBase64' in result && result.mediaBase64 !== undefined) {
    processResult.mediaBase64 = result.mediaBase64
  }

  return processResult
}

/**
 * 处理JSON格式的文本输入
 * @param text 文本内容
 * @param lang 语言
 * @returns 文件处理结果
 */
export async function processTextInput(
  text: string,
  lang: string
): Promise<FileProcessResult> {
  if (!text || !lang) {
    throw new Error('missing_fields')
  }

  const charCount = text.length
  const hash = crypto.createHash('sha256').update(text, 'utf-8').digest('hex')

  return {
    content: text,
    metadata: {
      sourceType: 'text',
      mimeType: 'application/json',
      charCount,
      fileSize: Buffer.byteLength(text, 'utf-8'),
    },
    hash,
  }
}

/**
 * 从FormData中提取文件和语言参数
 * @param formData FormData对象
 * @returns 提取的文件和语言
 */
export function extractFileFromFormData(formData: FormData): {
  file: File
  lang: string
} {
  const file = formData.get('file') as File | null
  const lang = (formData.get('lang') as string) || ''

  if (!file || !lang) {
    throw new Error('missing_fields')
  }

  return { file, lang }
}

/**
 * 文件处理错误类型
 */
export const FILE_PROCESS_ERRORS = {
  MISSING_FIELDS: 'missing_fields',
  FILE_TOO_LARGE: 'file_too_large',
  UNSUPPORTED_FILE_TYPE: 'unsupported_file_type',
  PROCESSING_FAILED: 'processing_failed',
} as const

/**
 * 检查错误是否为文件处理错误
 */
export function isFileProcessError(error: unknown): error is Error {
  return (
    error instanceof Error &&
    Object.values(FILE_PROCESS_ERRORS).includes(
      error.message as (typeof FILE_PROCESS_ERRORS)[keyof typeof FILE_PROCESS_ERRORS]
    )
  )
}
