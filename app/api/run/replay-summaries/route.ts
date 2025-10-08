import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { logInfo, logError } from '@/lib/logger'
import { ensureSchema, sql } from '@/lib/db'
import { summarizeResume, summarizeDetailed, summarizeJD } from '@/lib/llm/summarize'

export const runtime = 'nodejs'

// 使用已有的数据库记录（resume_id, jd_id, detailed_resumes_id）重跑三类 summaries
// 请求体：{ services_id?, resume_id, jd_id, detailed_resumes_id, lang? }
export async function POST(req: Request) {
  const start = Date.now()
  const reqId = crypto.randomUUID()
  const route = '/api/run/replay-summaries'
  try {
    await ensureSchema()
    const body = await req.json().catch(() => ({}))
    const services_id = (body.services_id as string) || ''
    const resume_id = (body.resume_id as string) || ''
    const jd_id = (body.jd_id as string) || ''
    const detailed_resumes_id = (body.detailed_resumes_id as string) || ''
    const langOverride = (body.lang as string) || ''

    if (!resume_id || !jd_id) {
      return NextResponse.json({ error: 'missing_ids' }, { status: 400 })
    }

    const db = sql()

    type ResumeRow = { user_id: string; lang: string; original_text: string | null }
    type JobRow = { user_id: string; lang: string; raw_text: string | null }
    type DetailedRow = { user_id: string; lang: string; original_text: string | null }

    const resumeRows = (await db/* sql */ `
      SELECT user_id, lang, original_text FROM resumes WHERE id = ${resume_id};
    `) as ResumeRow[]
    const jdRows = (await db/* sql */ `
      SELECT user_id, lang, raw_text FROM job_descriptions WHERE id = ${jd_id};
    `) as JobRow[]
    const detailedRows = detailed_resumes_id
      ? ((await db/* sql */ `SELECT user_id, lang, original_text FROM detailed_resumes WHERE id = ${detailed_resumes_id};`) as DetailedRow[])
      : []

    const resume = resumeRows?.[0]
    const jd = jdRows?.[0]
    const detailed = detailedRows?.[0]
    if (!resume || !jd) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    const userKey = resume.user_id
    const finalLang = langOverride || resume.lang || jd.lang || 'zh'

    logInfo({ reqId, route, userKey, phase: 'replay_inputs', inputs_len: {
      resume: (resume.original_text || '').length,
      jd: (jd.raw_text || '').length,
      detailed: (detailed?.original_text || '').length,
    } })

    const resumeSummary = await summarizeResume(resume.original_text || '', finalLang, { reqId, route, userKey })
    const jobSummary = await summarizeJD(jd.raw_text || '', finalLang, { reqId, route, userKey })
    const detailedSummary = detailed?.original_text
      ? await summarizeDetailed(detailed.original_text || '', finalLang, { reqId, route, userKey })
      : null

    const durationMs = Date.now() - start
    logInfo({ reqId, route, userKey, lang: finalLang, durationMs })
    return NextResponse.json({
      services_id,
      resume_id,
      jd_id,
      detailed_resumes_id,
      resumeSummary,
      jobSummary,
      detailedSummary,
    }, { status: 200 })
  } catch (e: unknown) {
    const durationMs = Date.now() - start
    const msg = e instanceof Error ? e.message : 'internal_error'
    logError({ reqId, route, userKey: 'unknown', lang: 'unknown', durationMs, error: msg })
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}