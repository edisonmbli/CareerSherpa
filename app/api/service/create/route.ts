import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { logInfo, logError } from '@/lib/logger'
import { ensureSchema, sql } from '@/lib/db'
import { isZhipuReady } from '@/lib/env'
import {
  summarizeResume,
  summarizeDetailed,
  summarizeJD,
  extractTextFromMedia,
} from '@/lib/llm/summarize'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  const start = Date.now()
  const reqId = crypto.randomUUID()
  const route = '/api/service/create'
  const headers = Object.fromEntries(req.headers)
  const userKey =
    (headers['x-user-key'] as string | undefined) ??
    (headers['x-forwarded-for'] as string | undefined)?.split(',')[0] ??
    'unknown'
  // 记录 LLM 可用性
  logInfo({ reqId, route, userKey, phase: 'init', llmReady: isZhipuReady() })
  // 在外层声明，以便在异常路径中使用
  let serviceId: string | null = null

  try {
    await ensureSchema()
    const { resume_id, job_id, detailed_resume_id, lang } = await req.json()

    if (!resume_id || !job_id) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
    }

    // 简单预检：pending ≤ 3
    const db = sql()
    const pendingCountRes = await db/* sql */ `
      SELECT COUNT(*)::int AS cnt FROM services
      WHERE user_id = ${userKey} AND status IN ('created', 'running');
    `
    const pendingCount =
      (Array.isArray(pendingCountRes)
        ? (pendingCountRes as Array<{ cnt: number }>)
        : [{ cnt: 0 }])[0]?.cnt ?? 0
    if (pendingCount > 3) {
      return NextResponse.json(
        { error: 'too_many_pending_services' },
        { status: 429 }
      )
    }

    // 拉取输入文本 + 元数据
    type ResumeRow = {
      lang: string
      original_text: string | null
      source_type: string | null
      media_base64: string | null
    }
    type JobRow = {
      lang: string
      raw_text: string | null
      source_type: string | null
      media_base64: string | null
    }
    type DetailedRow = {
      lang: string
      original_text: string | null
      source_type: string | null
      media_base64: string | null
    }

    const resumeRows = (await db/* sql */ `
      SELECT lang, original_text, source_type, media_base64 FROM resumes WHERE id = ${resume_id} AND user_id = ${userKey};
    `) as ResumeRow[]
    const jdRows = (await db/* sql */ `
      SELECT lang, raw_text, source_type, media_base64 FROM job_descriptions WHERE id = ${job_id} AND user_id = ${userKey};
    `) as JobRow[]
    const detailedRows = detailed_resume_id
      ? ((await db/* sql */ `SELECT lang, original_text, source_type, media_base64 FROM detailed_resumes WHERE id = ${detailed_resume_id} AND user_id = ${userKey};`) as DetailedRow[])
      : []

    if (!resumeRows?.[0] || !jdRows?.[0]) {
      return NextResponse.json(
        { error: 'invalid_resume_or_job' },
        { status: 422 }
      )
    }

    const langResume = resumeRows[0].lang
    const langJob = jdRows[0].lang
    const langDetailed = detailedRows?.[0]?.lang

    // 基础输入日志
    logInfo({
      reqId,
      route,
      userKey,
      phase: 'fetch_inputs',
      resume: {
        lang: langResume,
        source_type: resumeRows[0].source_type,
        has_media: !!resumeRows[0].media_base64,
        original_len: (resumeRows[0].original_text || '').length,
      },
      jd: {
        lang: langJob,
        source_type: jdRows[0].source_type,
        has_media: !!jdRows[0].media_base64,
        raw_len: (jdRows[0].raw_text || '').length,
      },
      detailed: detailedRows?.[0]
        ? {
            lang: langDetailed,
            source_type: detailedRows[0].source_type,
            has_media: !!detailedRows[0].media_base64,
            original_len: (detailedRows[0].original_text || '').length,
          }
        : null,
    })

    // 语言一致性（如果显式传入 lang，则以其为准，否则要求一致）
    const finalLang = lang ?? langResume
    if (
      !lang &&
      (langResume !== langJob || (langDetailed && langDetailed !== langResume))
    ) {
      return NextResponse.json(
        { error: 'language_inconsistent' },
        { status: 422 }
      )
    }

    serviceId = crypto.randomUUID()

    // 创建服务记录（running），避免长时间停留在 created
    await db/* sql */ `
      INSERT INTO services (id, user_id, resume_id, job_id, status, depth)
      VALUES (${serviceId}, ${userKey}, ${resume_id}, ${job_id}, 'running', NULL);
    `

    // 触发三类 Summary 前的视觉抽取（当原文为空且存在媒体）
    let resumeText = resumeRows[0].original_text ?? ''
    let jobText = jdRows[0].raw_text ?? ''
    let detailedText = detailedRows?.[0]?.original_text ?? ''

    if (
      !jobText &&
      jdRows[0].media_base64 &&
      jdRows[0].source_type === 'image'
    ) {
      logInfo({ reqId, route, userKey, phase: 'vision_extract_start', target: 'jd' })
      jobText = await extractTextFromMedia(
        String(jdRows[0].media_base64),
        finalLang,
        { reqId, route, userKey }
      )
      logInfo({
        reqId,
        route,
        userKey,
        phase: 'vision_extract_done',
        target: 'jd',
        extracted_len: jobText.length,
      })
      // 将抽取文本回写，以便后续核验与重试
      await db/* sql */ `
        UPDATE job_descriptions
        SET raw_text = ${jobText}, updated_at = NOW()
        WHERE id = ${job_id} AND user_id = ${userKey};
      `
    }
    if (
      !resumeText &&
      resumeRows[0].media_base64 &&
      resumeRows[0].source_type === 'pdf_scan'
    ) {
      logInfo({ reqId, route, userKey, phase: 'vision_extract_start', target: 'resume' })
      resumeText = await extractTextFromMedia(
        String(resumeRows[0].media_base64),
        finalLang,
        { reqId, route, userKey }
      )
      logInfo({
        reqId,
        route,
        userKey,
        phase: 'vision_extract_done',
        target: 'resume',
        extracted_len: resumeText.length,
      })
      await db/* sql */ `
        UPDATE resumes
        SET original_text = ${resumeText}, updated_at = NOW()
        WHERE id = ${resume_id} AND user_id = ${userKey};
      `
    }
    if (
      !detailedText &&
      detailedRows?.[0]?.media_base64 &&
      detailedRows?.[0]?.source_type === 'pdf_scan'
    ) {
      logInfo({ reqId, route, userKey, phase: 'vision_extract_start', target: 'detailed' })
      detailedText = await extractTextFromMedia(
        String(detailedRows[0].media_base64),
        finalLang,
        { reqId, route, userKey }
      )
      logInfo({
        reqId,
        route,
        userKey,
        phase: 'vision_extract_done',
        target: 'detailed',
        extracted_len: detailedText.length,
      })
      await db/* sql */ `
        UPDATE detailed_resumes
        SET original_text = ${detailedText}, updated_at = NOW()
        WHERE id = ${detailed_resume_id} AND user_id = ${userKey};
      `
    }

    logInfo({
      reqId,
      route,
      userKey,
      phase: 'llm_summary_start',
      inputs_len: {
        resume: resumeText.length,
        jd: jobText.length,
        detailed: detailedText.length,
      },
    })
    const resumeSummary = await summarizeResume(resumeText, finalLang, { reqId, route, userKey })
    const jobSummary = await summarizeJD(jobText, finalLang, { reqId, route, userKey })
    const detailedSummary = detailedText
      ? await summarizeDetailed(detailedText, finalLang, { reqId, route, userKey })
      : null
    
    // 添加调试日志
    logInfo({
      reqId,
      route,
      userKey,
      phase: 'detailed_summary_debug',
      detailed_resume_id,
      detailedText_length: detailedText?.length || 0,
      detailedSummary_exists: !!detailedSummary,
      detailedSummary_json_keys: detailedSummary?.summary_json ? Object.keys(detailedSummary.summary_json).length : 0,
    })
    
    const resumeKeys = Object.keys(resumeSummary.summary_json || {})
    const jdKeys = Object.keys(jobSummary.summary_json || {})
    const detailedKeys = detailedSummary
      ? Object.keys(detailedSummary.summary_json || {})
      : []
    logInfo({
      reqId,
      route,
      userKey,
      phase: 'llm_summary_done',
      tokens: {
        resume: resumeSummary.tokens,
        jd: jobSummary.tokens,
        detailed: detailedSummary ? detailedSummary.tokens : 0,
      },
      keys_count: {
        resume: resumeKeys.length,
        jd: jdKeys.length,
        detailed: detailedKeys.length,
      },
      keys_sample: {
        resume: resumeKeys.slice(0, 6),
        jd: jdKeys.slice(0, 6),
        detailed: detailedKeys.slice(0, 6),
      },
    })

    const resumeUpdate = (await db/* sql */ `
      UPDATE resumes
      SET resume_summary_json = ${resumeSummary.summary_json},
          resume_summary_tokens = ${resumeSummary.tokens},
          updated_at = NOW()
      WHERE id = ${resume_id}
      RETURNING resume_summary_json;
    `) as Array<{ resume_summary_json: any }>
    const resumeStored = resumeUpdate?.[0]?.resume_summary_json ?? null
    logInfo({
      reqId,
      route,
      userKey,
      phase: 'db_update_resume',
      stored_keys: resumeStored ? Object.keys(resumeStored).length : 0,
    })
    const jdUpdate = (await db/* sql */ `
      UPDATE job_descriptions
      SET job_summary_json = ${jobSummary.summary_json},
          job_summary_tokens = ${jobSummary.tokens},
          updated_at = NOW()
      WHERE id = ${job_id}
      RETURNING job_summary_json;
    `) as Array<{ job_summary_json: any }>
    const jdStored = jdUpdate?.[0]?.job_summary_json ?? null
    logInfo({
      reqId,
      route,
      userKey,
      phase: 'db_update_jd',
      stored_keys: jdStored ? Object.keys(jdStored).length : 0,
    })
    if (detailed_resume_id && detailedSummary) {
      const detUpdate = (await db/* sql */ `
        UPDATE detailed_resumes
        SET detailed_summary_json = ${detailedSummary.summary_json},
            detailed_summary_tokens = ${detailedSummary.tokens},
            updated_at = NOW()
        WHERE id = ${detailed_resume_id}
        RETURNING detailed_summary_json;
      `) as Array<{ detailed_summary_json: any }>
      const detStored = detUpdate?.[0]?.detailed_summary_json ?? null
      logInfo({
        reqId,
        route,
        userKey,
        phase: 'db_update_detailed',
        stored_keys: detStored ? Object.keys(detStored).length : 0,
      })
    }

    // 更新服务状态为 done
    await db/* sql */ `
      UPDATE services
      SET status = 'done', depth = NULL, updated_at = NOW()
      WHERE id = ${serviceId};
    `

    const durationMs = Date.now() - start
    logInfo({ reqId, route, userKey, lang: finalLang, durationMs })
    return NextResponse.json({ service_id: serviceId }, { status: 200 })
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
    try {
      if (serviceId) {
        const db = sql()
        await db/* sql */ `
          UPDATE services
          SET status = 'error', updated_at = NOW()
          WHERE id = ${serviceId};
        `
      }
    } catch {}
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
