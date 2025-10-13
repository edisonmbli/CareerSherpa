import crypto from 'crypto'
import { logInfo, logError } from '@/lib/logger'
import { ensureMigrations } from '@/lib/db-migrations'
import {
  countPendingServices,
  getResumeByIdForUser,
  getJobByIdForUser,
  getDetailedByIdForUser,
  createService,
  updateServiceStatus,
  updateResumeText,
  updateJobText,
  updateDetailedText,
} from '@/lib/dal'
import { isZhipuReady } from '@/lib/env'
import { extractTextFromMedia } from '@/lib/llm/summarize'
import { executeParallelSummaries, SummaryTask } from '@/lib/llm/orchestrator'

// Database row types
interface ResumeRow {
  id: string
  userId: string
  lang?: string | null
  originalText?: string | null
  sourceType?: string | null
  mediaBase64?: string | null
}

interface JobRow {
  id: string
  userId: string
  lang?: string | null
  rawText?: string | null
  sourceType?: string | null
  mediaBase64?: string | null
}

interface DetailedRow {
  id: string
  userId: string
  lang?: string | null
  originalText?: string | null
  sourceType?: string | null
  mediaBase64?: string | null
}

export interface ServiceCreationRequest {
  resume_id: string
  job_id: string
  detailed_resume_id?: string
  lang?: string
}

export interface ServiceCreationContext {
  reqId: string
  route: string
  userId: string
  startTime: number
}

export interface ServiceCreationResult {
  service_id: string
  duration_ms: number
}

export class ServiceOrchestrator {
  async createService(
    request: ServiceCreationRequest,
    context: ServiceCreationContext
  ): Promise<ServiceCreationResult> {
    const { reqId, route, userId, startTime } = context
    const { resume_id, job_id, detailed_resume_id, lang } = request

    // 记录 LLM 可用性
    logInfo({ reqId, route, userId, phase: 'init', llmReady: isZhipuReady() })

    let serviceId: string | null = null

    try {
      await ensureMigrations()

      // 验证必填字段
      if (!resume_id || !job_id) {
        throw new Error('missing_fields')
      }

      // 预检：pending ≤ 3
      const pendingCount = await countPendingServices(userId)
      if (pendingCount > 3) {
        throw new Error('too_many_pending_services')
      }

      // 拉取输入数据
      const inputs = await this.fetchInputData(
        { resume_id, job_id, detailed_resume_id },
        { reqId, route, userId }
      )

      // 语言一致性检查
      const finalLang = this.validateLanguageConsistency(inputs, lang)

      // 创建服务记录
      const service = await createService({
        userId: userId,
        resumeId: resume_id,
        jobId: job_id,
      })
      serviceId = service.id

      // 文本抽取（如果需要）
      const extractedTexts = await this.extractTextsIfNeeded(
        inputs,
        finalLang,
        { reqId, route, userId }
      )

      // 并行执行摘要生成
      const summaryTasks = this.buildSummaryTasks({
        resumeId: resume_id,
        resumeText: extractedTexts.resumeText,
        jobId: job_id,
        jobText: extractedTexts.jobText,
        detailedId: detailed_resume_id,
        detailedText: extractedTexts.detailedText,
        userId,
        serviceId: serviceId!,
      })

      await executeParallelSummaries(summaryTasks, {
        tier: 'free', // 可以根据用户等级调整
        timeout: 30000,
        enableFallback: true,
      })

      // 更新服务状态为完成
      await updateServiceStatus(serviceId, 'done', null)

      const durationMs = Date.now() - startTime
      logInfo({ reqId, route, userId, lang: finalLang, durationMs })

      return {
        service_id: serviceId,
        duration_ms: durationMs,
      }
    } catch (error) {
      const durationMs = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'internal_error'

      logError({
        reqId,
        route,
        userId,
        lang: 'unknown',
        durationMs,
        error: errorMessage,
      })

      // 尝试更新服务状态为错误
      if (serviceId) {
        try {
          await updateServiceStatus(serviceId, 'error')
        } catch {
          // 忽略状态更新错误
        }
      }

      throw error
    }
  }

  private async fetchInputData(
    ids: { resume_id: string; job_id: string; detailed_resume_id?: string },
    context: { reqId: string; route: string; userId: string }
  ) {
    const { resume_id, job_id, detailed_resume_id } = ids
    const { reqId, route, userId } = context

    const resumeRow = await getResumeByIdForUser(resume_id, userId)
    const jdRow = await getJobByIdForUser(job_id, userId)
    const detailedRow = detailed_resume_id
      ? await getDetailedByIdForUser(detailed_resume_id, userId)
      : null

    if (!resumeRow || !jdRow) {
      throw new Error('invalid_resume_or_job')
    }

    // 记录输入数据信息
    logInfo({
      reqId,
      route,
      userId,
      phase: 'fetch_inputs',
      resume: {
        lang: resumeRow.lang,
        source_type: resumeRow.sourceType,
        has_media: !!resumeRow.mediaBase64,
        original_len: (resumeRow.originalText || '').length,
      },
      jd: {
        lang: jdRow.lang,
        source_type: jdRow.sourceType,
        has_media: !!jdRow.mediaBase64,
        raw_len: (jdRow.rawText || '').length,
      },
      detailed: detailedRow
        ? {
            lang: detailedRow.lang,
            source_type: detailedRow.sourceType,
            has_media: !!detailedRow.mediaBase64,
            original_len: (detailedRow.originalText || '').length,
          }
        : null,
    })

    return { resumeRow, jdRow, detailedRow }
  }

  private validateLanguageConsistency(
    inputs: {
      resumeRow: ResumeRow
      jdRow: JobRow
      detailedRow: DetailedRow | null
    },
    explicitLang?: string
  ): string {
    const { resumeRow, jdRow, detailedRow } = inputs
    const langResume = resumeRow.lang || null
    const langJob = jdRow.lang || null
    const langDetailed = detailedRow?.lang || null

    const finalLang = explicitLang ?? langResume ?? 'zh'

    if (
      !explicitLang &&
      (langResume !== langJob || (langDetailed && langDetailed !== langResume))
    ) {
      throw new Error('language_inconsistent')
    }

    return finalLang
  }

  private async extractTextsIfNeeded(
    inputs: {
      resumeRow: ResumeRow
      jdRow: JobRow
      detailedRow: DetailedRow | null
    },
    lang: string,
    context: { reqId: string; route: string; userId: string }
  ) {
    const { resumeRow, jdRow, detailedRow } = inputs
    const { reqId, route, userId } = context

    let resumeText = resumeRow.originalText ?? ''
    let jobText = jdRow.rawText ?? ''
    let detailedText = detailedRow?.originalText ?? ''

    // 抽取JD文本
    if (!jobText && jdRow.mediaBase64 && jdRow.sourceType === 'image') {
      logInfo({ reqId, route, userKey: userId, phase: 'vision_extract_start', target: 'jd' })
      jobText = await extractTextFromMedia(jdRow.mediaBase64, lang, { reqId, route, userKey: userId })
      logInfo({
        reqId,
        route,
        userKey: userId,
        phase: 'vision_extract_done',
        target: 'jd',
        extracted_len: jobText.length,
      })
      await updateJobText(jdRow.id, jobText)
    }

    // 抽取简历文本
    if (!resumeText && resumeRow.mediaBase64 && resumeRow.sourceType === 'pdf_scan') {
      logInfo({ reqId, route, userKey: userId, phase: 'vision_extract_start', target: 'resume' })
      resumeText = await extractTextFromMedia(resumeRow.mediaBase64, lang, { reqId, route, userKey: userId })
      logInfo({
        reqId,
        route,
        userKey: userId,
        phase: 'vision_extract_done',
        target: 'resume',
        extracted_len: resumeText.length,
      })
      await updateResumeText(resumeRow.id, resumeText)
    }

    // 抽取详细简历文本
    if (!detailedText && detailedRow?.mediaBase64 && detailedRow?.sourceType === 'pdf_scan') {
      logInfo({ reqId, route, userKey: userId, phase: 'vision_extract_start', target: 'detailed' })
      detailedText = await extractTextFromMedia(detailedRow.mediaBase64, lang, { reqId, route, userKey: userId })
      logInfo({
        reqId,
        route,
        userKey: userId,
        phase: 'vision_extract_done',
        target: 'detailed',
        extracted_len: detailedText.length,
      })
      await updateDetailedText(detailedRow.id, detailedText)
    }

    return { resumeText, jobText, detailedText }
  }

  private buildSummaryTasks(params: {
    resumeId: string
    resumeText: string
    jobId: string
    jobText: string
    detailedId?: string
    detailedText?: string
    userId: string
    serviceId: string
  }): SummaryTask[] {
    const {
      resumeId,
      resumeText,
      jobId,
      jobText,
      detailedId,
      detailedText,
      userId,
      serviceId,
    } = params

    const tasks: SummaryTask[] = [
      {
        type: 'resume',
        id: resumeId,
        text: resumeText,
        userId: userId,
        serviceId,
      },
      {
        type: 'job',
        id: jobId,
        text: jobText,
        userId: userId,
        serviceId,
      },
    ]

    if (detailedId && detailedText) {
      tasks.push({
        type: 'detailed',
        id: detailedId,
        text: detailedText,
        userId: userId,
        serviceId,
      })
    }

    return tasks
  }
}

// 导出单例实例
export const serviceOrchestrator = new ServiceOrchestrator()

// 便捷函数
export async function createServiceWithOrchestration(
  request: ServiceCreationRequest,
  userId: string,
  route: string = '/api/service/create'
): Promise<ServiceCreationResult> {
  const reqId = crypto.randomUUID()
  const startTime = Date.now()

  return serviceOrchestrator.createService(request, {
    reqId,
    route,
    userId,
    startTime,
  })
}