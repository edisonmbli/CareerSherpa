import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { logInfo, logError } from '@/lib/logger'
import { ensureSchema, sql } from '@/lib/db'
import { pdf } from 'pdf-parse'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const start = Date.now()
  const reqId = crypto.randomUUID()
  const route = '/api/upload/resume'
  const headers = Object.fromEntries(req.headers)
  const userKey =
    (headers['x-user-key'] as string | undefined) ??
    (headers['x-forwarded-for'] as string | undefined)?.split(',')[0] ??
    'unknown'

  try {
    await ensureSchema()
    const contentType = req.headers.get('content-type') || ''
    const isMultipart = contentType.includes('multipart/form-data')

    let text = ''
    let lang = ''
    let sourceType = 'text'
    let mimeType = 'text/plain'
    let charCount = 0
    let mediaBase64: string | null = null

    if (isMultipart) {
      // multipart/form-data
      const form = await req.formData()
      const file = form.get('file') as File | null
      lang = (form.get('lang') as string) || ''
      if (!file || !lang) {
        return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
      }
      mimeType = file.type || 'application/octet-stream'

      if (mimeType === 'application/pdf') {
        // pdf_text: 直接提取文本
        const buf = Buffer.from(await file.arrayBuffer())
        const parsed = await pdf(buf).catch(() => ({ text: '' }))
        text = (parsed?.text || '').trim()
        charCount = text.length
        sourceType = charCount > 300 ? 'pdf_text' : 'pdf_scan'
        // pdf_scan: 转换为 base64 存储
        if (sourceType === 'pdf_scan') {
          mediaBase64 = `data:${mimeType};base64,${buf.toString('base64')}`
        }
      } else if (mimeType === 'text/plain') {
        // text/plain: 直接读取文本
        const buf = Buffer.from(await file.arrayBuffer())
        text = buf.toString('utf-8')
        charCount = text.length
        sourceType = 'text'
      } else {
        return NextResponse.json(
          { error: 'unsupported_file_type' },
          { status: 415 }
        )
      }
    } else {
      // application/json
      const body = await req.json().catch(() => ({}))
      text = (body.text as string) || ''
      lang = (body.lang as string) || ''
      if (!text || !lang) {
        return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
      }
      charCount = text.length
      sourceType = 'text'
      mimeType = 'application/json'
    }

    const resumeId = crypto.randomUUID()
    const db = sql()

    // upsert user
    await db/* sql */ `
      INSERT INTO users (id, lang_pref)
      VALUES (${userKey}, ${lang})
      ON CONFLICT (id) DO UPDATE SET lang_pref = EXCLUDED.lang_pref, updated_at = NOW();
    `

    await db/* sql */ `
      INSERT INTO resumes (id, user_id, lang, original_text, active, source_type, content_type, char_count, media_base64)
      VALUES (${resumeId}, ${userKey}, ${lang}, ${text}, TRUE, ${sourceType}, ${mimeType}, ${charCount}, ${mediaBase64});
    `

    const durationMs = Date.now() - start
    logInfo({ reqId, route, userKey, lang, durationMs })
    return NextResponse.json({ resume_id: resumeId }, { status: 200 })
  } catch (e: unknown) {
    const durationMs = Date.now() - start
    const msg = e instanceof Error ? e.message : 'internal_error'
    logError({
      reqId,
      route,
      userKey,
      lang: 'unknown',
      durationMs,
      error: msg,
    })
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
