import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { logInfo, logError } from '@/lib/logger'
import { ensureSchema } from '@/lib/db'
import { summarizeResume, summarizeJD } from '@/lib/llm/summarize'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const start = Date.now()
  const reqId = crypto.randomUUID()
  const route = '/api/run/test-summarize'
  try {
    await ensureSchema()
    const body = await req.json().catch(() => ({}))
    const text = (body.text as string) || ''
    const lang = (body.lang as string) || 'zh'
    const kind = ((body.kind as string) || 'resume') as 'resume' | 'jd'
    if (!text) {
      return NextResponse.json({ error: 'missing_text' }, { status: 400 })
    }
    const out =
      kind === 'jd' ? await summarizeJD(text, lang) : await summarizeResume(text, lang)
    const durationMs = Date.now() - start
    logInfo({ reqId, route, userKey: 'test', lang, durationMs })
    return NextResponse.json({ result: out }, { status: 200 })
  } catch (e: unknown) {
    const durationMs = Date.now() - start
    const msg = e instanceof Error ? e.message : 'internal_error'
    logError({ reqId, route, userKey: 'test', lang: 'unknown', durationMs, error: msg })
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}