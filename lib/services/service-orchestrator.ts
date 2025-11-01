import * as crypto from 'crypto'
import { logInfo, logError } from '../logger'
import { ensureMigrations } from '../db-migrations'
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
  updateSummaries,
} from '../dal'
import { isZhipuReady } from '../env'
import { OCRService } from './ocr-service'
import { llmScheduler, type SummaryTask, type SummaryResult } from '../llm/llm-scheduler'
import { checkQuotaForService } from '../quota/atomic-operations'
import { providerRegistry } from '../llm/providers'

// LLM readiness check function
async function checkLLMReadiness(
  userId: string,
  quotaStatus: { shouldUseFreeQueue: boolean; tier: 'free' | 'paid' },
  step?: 'match' | 'resume' | 'interview' | 'detailed'
) {
  const workerPoolStatus = llmScheduler.getWorkerPoolStatus()

  // 根据用户quota确定应该使用的tier
  const userTier = quotaStatus.tier

  // 获取可用的providers
  const availableProviders = providerRegistry.getAvailable(userTier)

  // 检查具体模型的可用性和负载情况
  const modelAvailability = {
    deepseek: {
      ready: providerRegistry.get('deepseek')?.isReady() || false,
      currentLoad: workerPoolStatus.queues
        .filter((q) => q.provider === 'deepseek' && q.tier === userTier)
        .reduce((sum: number, q) => sum + q.active, 0),
      maxConcurrent: workerPoolStatus.queues
        .filter((q) => q.provider === 'deepseek' && q.tier === userTier)
        .reduce((sum: number, q) => sum + q.maxConcurrent, 0),
    },
    zhipu: {
      ready: providerRegistry.get('zhipu')?.isReady() || false,
      currentLoad: workerPoolStatus.queues
        .filter((q) => q.provider === 'zhipu' && q.tier === userTier)
        .reduce((sum: number, q) => sum + q.active, 0),
      maxConcurrent: workerPoolStatus.queues
        .filter((q) => q.provider === 'zhipu' && q.tier === userTier)
        .reduce((sum: number, q) => sum + q.maxConcurrent, 0),
    },
  }

  // 确定推荐的模型和具体模型名称
  let recommendedProvider = 'zhipu' // 默认使用zhipu
  let recommendedModel: string | undefined

  if (userTier === 'paid' && modelAvailability.deepseek.ready) {
    // 付费用户优先使用DeepSeek，但如果负载过高则切换到GLM
    const deepseekLoadRatio =
      modelAvailability.deepseek.currentLoad /
      Math.max(modelAvailability.deepseek.maxConcurrent, 1)
    if (deepseekLoadRatio < 0.8) {
      // 负载低于80%时使用DeepSeek
      recommendedProvider = 'deepseek'
      // 根据step确定具体模型
      if (step === 'match' || step === 'interview' || step === 'detailed') {
        recommendedModel = 'deepseek-reasoner' // 复杂推理任务（思考模式）
      } else {
        recommendedModel = 'deepseek-chat' // 文本生成任务（非思考模式）
      }
    }
  }

  // 如果没有选择DeepSeek或DeepSeek不可用，则使用GLM
  if (recommendedProvider === 'zhipu') {
    if (userTier === 'paid') {
      recommendedModel = 'glm-4.5' // 付费用户使用高级模型
    } else {
      recommendedModel = 'glm-4.5-flash' // 免费用户使用快速模型
    }
  }

  return {
    userTier,
    quotaStatus,
    workerPoolStatus,
    modelAvailability,
    recommendedProvider,
    recommendedModel,
    availableProviders: availableProviders.map((p) => p.name),
    canProceed:
      availableProviders.length > 0 &&
      (modelAvailability.deepseek.ready || modelAvailability.zhipu.ready),
  }
}

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
  quotaStatus?: {
    shouldUseFreeQueue: boolean
    tier: 'free' | 'paid'
  }
}

export interface ServiceCreationResult {
  service_id: string
  duration_ms: number
}

export class ServiceOrchestrator {
  private ocrService: OCRService

  constructor() {
    this.ocrService = new OCRService()
  }

  async createService(
    request: ServiceCreationRequest,
    context: ServiceCreationContext
  ): Promise<ServiceCreationResult> {
    const { reqId, route, userId, startTime } = context
    const { resume_id, job_id, detailed_resume_id, lang } = request

    // 获取quota状态（如果context中没有提供）
    let quotaStatus: { shouldUseFreeQueue: boolean; tier: 'free' | 'paid' }
    if (context.quotaStatus) {
      quotaStatus = context.quotaStatus
    } else {
      const quotaCheck = await checkQuotaForService(userId)
      quotaStatus = {
        shouldUseFreeQueue: quotaCheck.shouldUseFreeQueue,
        tier: quotaCheck.shouldUseFreeQueue ? 'free' : 'paid'
      }
    }
    
    // 检查LLM服务可用性（包括quota和队列状态）
    const llmReadinessInfo = await checkLLMReadiness(userId, quotaStatus)
    logInfo({
      reqId,
      route: 'create-service',
      userKey: userId,
      llmReadinessInfo,
      step: 'llm_readiness_check',
    })

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
      const fetchDataParams = { resume_id, job_id } as any
      if (detailed_resume_id !== undefined) {
        fetchDataParams.detailed_resume_id = detailed_resume_id
      }
      
      const inputs = await this.fetchInputData(
        fetchDataParams,
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
      
      // Service record created successfully

      // 文本抽取（如果需要）
      const extractedTexts = await this.extractTextsIfNeeded(
        inputs,
        finalLang,
        { reqId, route, userId },
        serviceId,
        quotaStatus.tier
      )

      // 并行执行摘要生成
      const summaryTasksParams = {
        resumeId: resume_id,
        resumeText: extractedTexts.resumeText,
        jobId: job_id,
        jobText: extractedTexts.jobText,
        userId,
        serviceId: serviceId!,
      } as any
      
      if (detailed_resume_id !== undefined) {
        summaryTasksParams.detailedId = detailed_resume_id
      }
      if (extractedTexts.detailedText !== undefined) {
        summaryTasksParams.detailedText = extractedTexts.detailedText
      }
      
      const summaryTasks = this.buildSummaryTasks(summaryTasksParams)

      // 根据quota状态动态选择tier（使用已获取的quotaStatus）
      const tier = quotaStatus.tier

      // Starting LLM task execution

      const llmResults = await llmScheduler.executeSummaries(summaryTasks, {
        tier,
        // 移除硬编码的timeout，让LLM调度器根据任务类型自动选择合适的超时时间
        enableFallback: true,
      })
      

      
      // 检查LLM任务执行结果
      const successCount = llmResults.filter((r: any) => r.success).length
      const totalCount = llmResults.length
      const hasAnySuccess = successCount > 0
      const allSuccess = successCount === totalCount
      
      // 检查核心任务（resume和job）的成功状态
      const resumeResult = llmResults.find((r: any) => r.type === 'resume')
      const jobResult = llmResults.find((r: any) => r.type === 'job')
      const detailedResult = llmResults.find((r: any) => r.type === 'detailed')
      
      const hasDetailedTask = !!detailedResult
      


      // LLM task execution completed

      // 根据LLM任务结果决定服务状态
      if (allSuccess) {
        // 所有任务成功 - 保存结果到数据库并标记为完成
        await this.saveLLMResultsToDatabase(llmResults, summaryTasks)
        await updateServiceStatus(serviceId, 'done', null)
      } else if (hasAnySuccess) {
        // 部分任务成功 - Partial failure 处理
        const successfulTasks = llmResults.filter((r: any) => r.success)
        const failedTasks = llmResults.filter((r: any) => !r.success)
        
        // 保存成功的结果到数据库
        await this.saveLLMResultsToDatabase(successfulTasks, summaryTasks.filter(task => 
          successfulTasks.some(result => result.type === task.type)
        ))
        
        // 标记为部分成功状态 - 这里可以根据业务需求决定是 'done' 还是 'partial'
        // 暂时标记为 'done' 因为有成功的任务
        await updateServiceStatus(serviceId, 'done', null)
      } else {
        // 所有任务失败 - All LLM tasks failed
        const failedTasks = llmResults.filter((r: any) => !r.success).map((r: any) => `${r.type}: ${r.error || 'unknown error'}`)
        
        const errorMessage = `All LLM tasks failed: ${failedTasks.join(', ')}`
        
        await updateServiceStatus(serviceId, 'error', null)
        
        console.error('❌ [ServiceOrchestrator] 所有LLM任务失败', {
          serviceId,
          reqId,
          errorMessage,
          failedTasks,
          hasAnySuccess: false,
          allSuccess: false
        })
        
        // 抛出异常以确保调用方知道服务创建失败
        throw new Error(`service_llm_failed: ${errorMessage}`)
      }

      const durationMs = Date.now() - startTime
      logInfo({ reqId, route, userId, lang: finalLang, durationMs })

      return {
        service_id: serviceId,
        duration_ms: durationMs,
      }
    } catch (error) {
      const durationMs = Date.now() - startTime
      const errorMessage =
        error instanceof Error ? error.message : 'internal_error'

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
    context: { reqId: string; route: string; userId: string },
    serviceId: string,
    tier: 'free' | 'paid' = 'free'
  ) {
    const { resumeRow, jdRow, detailedRow } = inputs
    const { reqId, route, userId } = context

    let resumeText = resumeRow.originalText || ''
    let jobText = jdRow.rawText || ''
    let detailedText = detailedRow?.originalText || ''

    // 🔍 调试日志：记录从数据库读取的原始文本内容
    logInfo({
      reqId,
      route,
      userKey: userId,
      phase: 'text_extraction_start',
      resumeText_length: resumeText.length,
      resumeText_preview: resumeText.substring(0, 100),
      jobText_length: jobText.length,
      jobText_preview: jobText.substring(0, 100),
      detailedText_length: detailedText.length,
      detailedText_preview: detailedText.substring(0, 100),
      resumeRow_sourceType: resumeRow.sourceType,
      jdRow_sourceType: jdRow.sourceType,
      detailedRow_sourceType: detailedRow?.sourceType,
    })

    // 抽取JD文本
    if (!jobText && jdRow.mediaBase64 && jdRow.sourceType === 'image') {
      logInfo({
        reqId,
        route,
        userKey: userId,
        phase: 'vision_extract_start',
        target: 'jd',
      })
      const ocrResult = await this.ocrService.extractTextFromMedia(
        jdRow.mediaBase64,
        jdRow.sourceType,
        userId,
        serviceId
      )
      if (ocrResult.success && ocrResult.extractedText) {
        jobText = ocrResult.extractedText
      } else {
        // OCR失败时记录错误并抛出异常
        const errorMsg = `JD图片OCR失败: ${ocrResult.error || '未知错误'}`
        logError({
          reqId,
          route,
          userKey: userId,
          phase: 'vision_extract_failed',
          target: 'jd',
          error: errorMsg,
        })
        throw new Error(errorMsg)
      }
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
    if (
      !resumeText &&
      resumeRow.mediaBase64 &&
      resumeRow.sourceType === 'pdf_scan'
    ) {
      logInfo({
        reqId,
        route,
        userKey: userId,
        phase: 'vision_extract_start',
        target: 'resume',
      })
      const ocrResult = await this.ocrService.extractTextFromMedia(
        resumeRow.mediaBase64,
        resumeRow.sourceType,
        userId,
        serviceId
      )
      if (ocrResult.success && ocrResult.extractedText) {
        resumeText = ocrResult.extractedText
      } else {
        // OCR失败时记录错误并抛出异常
        const errorMsg = `简历OCR失败: ${ocrResult.error || '未知错误'}`
        logError({
          reqId,
          route,
          userKey: userId,
          phase: 'vision_extract_failed',
          target: 'resume',
          error: errorMsg,
        })
        throw new Error(errorMsg)
      }
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
    if (
      !detailedText &&
      detailedRow?.mediaBase64 &&
      detailedRow?.sourceType === 'pdf_scan'
    ) {
      logInfo({
        reqId,
        route,
        userKey: userId,
        phase: 'vision_extract_start',
        target: 'detailed',
      })
      const ocrResult = await this.ocrService.extractTextFromMedia(
        detailedRow.mediaBase64,
        detailedRow.sourceType,
        userId,
        serviceId
      )
      if (ocrResult.success && ocrResult.extractedText) {
        detailedText = ocrResult.extractedText
      } else {
        // OCR失败时记录错误并抛出异常
        const errorMsg = `详细简历OCR失败: ${ocrResult.error || '未知错误'}`
        logError({
          reqId,
          route,
          userKey: userId,
          phase: 'vision_extract_failed',
          target: 'detailed',
          error: errorMsg,
        })
        throw new Error(errorMsg)
      }
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

    // 🔍 调试日志：记录最终提取的文本内容
    logInfo({
      reqId,
      route,
      userKey: userId,
      phase: 'text_extraction_final',
      final_resumeText_length: resumeText.length,
      final_resumeText_preview: resumeText.substring(0, 100),
      final_jobText_length: jobText.length,
      final_jobText_preview: jobText.substring(0, 100),
      final_detailedText_length: detailedText.length,
      final_detailedText_preview: detailedText.substring(0, 100),
    })

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
        data: { text: resumeText },
        userId: userId,
        serviceId,
      },
      {
        type: 'job',
        id: jobId,
        data: { text: jobText },
        userId: userId,
        serviceId,
      },
    ]

    if (detailedId && detailedText) {
      tasks.push({
        type: 'detailed',
        id: detailedId,
        data: { text: detailedText },
        userId: userId,
        serviceId,
      })
    }



    return tasks
  }

  /**
   * 将LLM执行结果保存到数据库
   */
  private async saveLLMResultsToDatabase(
    llmResults: SummaryResult[],
    summaryTasks: SummaryTask[]
  ): Promise<void> {
    logInfo({
      reqId: 'service-orchestrator',
      route: 'save-llm-results',
      phase: 'start',
      message: 'Starting to save LLM results to database',
      llmResultsCount: llmResults.length,
      summaryTasksCount: summaryTasks.length,
      llmResults: llmResults.map(r => ({
        type: r.type,
        id: r.id,
        success: r.success,
        hasJson: !!r.summaryJson,
        tokens: r.summaryTokens,
        error: r.error
      }))
    })

    // 构建updateSummaries的参数
    const updateParams: any = {}
    
    // 处理每个结果
    for (const result of llmResults) {
      logInfo({
        reqId: 'service-orchestrator',
        route: 'save-llm-results',
        phase: 'processing_result',
        message: `Processing LLM result for ${result.type}`,
        resultDetails: {
          type: result.type,
          id: result.id,
          success: result.success,
          hasJson: !!result.summaryJson,
          jsonPreview: result.summaryJson ? JSON.stringify(result.summaryJson).slice(0, 200) : null,
          tokens: result.summaryTokens,
          error: result.error
        }
      })

      if (!result.success) {
        logInfo({
          reqId: 'service-orchestrator',
          route: 'save-llm-results',
          phase: 'skip_failed_result',
          message: `Skipping failed result for ${result.type}`,
          ...(result.error && { error: result.error })
        })
        continue // 跳过失败的任务
      }
      
      // 根据任务类型设置对应的参数
      switch (result.type) {
        case 'resume':
          updateParams.resumeId = result.id
          updateParams.resumeSummaryJson = result.summaryJson
          updateParams.resumeSummaryTokens = result.summaryTokens
          logInfo({
            reqId: 'service-orchestrator',
            route: 'save-llm-results',
            phase: 'set_resume_params',
            message: 'Set resume parameters',
            resumeId: result.id,
            hasJson: !!result.summaryJson,
            ...(result.summaryTokens && { tokens: result.summaryTokens })
          })
          break
        case 'job':
          updateParams.jobId = result.id
          updateParams.jobSummaryJson = result.summaryJson
          updateParams.jobSummaryTokens = result.summaryTokens
          logInfo({
            reqId: 'service-orchestrator',
            route: 'save-llm-results',
            phase: 'set_job_params',
            message: 'Set job parameters',
            jobId: result.id,
            hasJson: !!result.summaryJson,
            ...(result.summaryTokens && { tokens: result.summaryTokens })
          })
          break
        case 'detailed':
          updateParams.detailedId = result.id
          updateParams.detailedSummaryJson = result.summaryJson
          updateParams.detailedSummaryTokens = result.summaryTokens
          logInfo({
            reqId: 'service-orchestrator',
            route: 'save-llm-results',
            phase: 'set_detailed_params',
            message: 'Set detailed parameters',
            detailedId: result.id,
            hasJson: !!result.summaryJson,
            ...(result.summaryTokens && { tokens: result.summaryTokens }),
            ...(result.summaryJson && { jsonPreview: JSON.stringify(result.summaryJson).slice(0, 200) })
          })
          break
      }
    }
    
    // 确保至少有resumeId和jobId（这些是必需的）
    if (!updateParams.resumeId || !updateParams.jobId) {
      // 从summaryTasks中获取缺失的ID
      for (const task of summaryTasks) {
        if (task.type === 'resume' && !updateParams.resumeId) {
          updateParams.resumeId = task.id
        }
        if (task.type === 'job' && !updateParams.jobId) {
          updateParams.jobId = task.id
        }
      }
    }
    
    // 调用updateSummaries保存到数据库
    if (updateParams.resumeId && updateParams.jobId) {
      await updateSummaries(updateParams)
      
      logInfo({
        reqId: 'service-orchestrator',
        route: 'save-llm-results',
        phase: 'database_update_success',
        message: 'Successfully saved LLM results to database',
        updateParams: {
          resumeId: updateParams.resumeId,
          jobId: updateParams.jobId,
          detailedId: updateParams.detailedId,
          hasResumeSummary: !!updateParams.resumeSummaryJson,
          hasJobSummary: !!updateParams.jobSummaryJson,
          hasDetailedSummary: !!updateParams.detailedSummaryJson,
        }
      })
    } else {
      logError({
        reqId: 'service-orchestrator',
        route: 'save-llm-results',
        phase: 'database_update_failed',
        error: 'Missing required resumeId or jobId',
        updateParams,
        summaryTasks: summaryTasks.map(t => ({ type: t.type, id: t.id }))
      })
      throw new Error('Missing required resumeId or jobId for database update')
    }
  }
}

// 导出单例实例
export const serviceOrchestrator = new ServiceOrchestrator()

// 便捷函数
export async function createServiceWithOrchestration(
  request: ServiceCreationRequest,
  userId: string,
  route: string = '/api/service/create',
  quotaStatus?: { shouldUseFreeQueue: boolean; tier: 'free' | 'paid' }
): Promise<ServiceCreationResult> {
  const reqId = crypto.randomUUID()
  const startTime = Date.now()

  const context = {
    reqId,
    route,
    userId,
    startTime,
  } as any
  
  if (quotaStatus !== undefined) {
    context.quotaStatus = quotaStatus
  }
  
  return serviceOrchestrator.createService(request, context)
}
