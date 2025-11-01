import { logInfo } from '@/lib/logger'
import {
  executeJobMatch,
  executeResumeEdit,
  executeInterviewPrep,
} from '@/lib/prompts/executor'
import {
  getServiceById,
  getResumeByIdForUser,
  getJobByIdForUser,
} from '@/lib/dal'
import { prisma } from '@/lib/prisma'
import { ApiContext } from '@/lib/api/utils'
import { checkQuotaForService } from '@/lib/quota/atomic-operations'

export interface JobMatchRequest {
  service_id: string
  tier?: 'free' | 'paid'
}

export interface JobMatchResult {
  score: number
  highlights: string[]
  gaps: string[]
  dm_script: string
  tokens_used: number
}

export interface ResumeEditRequest {
  service_id: string
  tier?: 'free' | 'paid'
}

export interface ResumeEditResult {
  summary: string
  ops: Array<{
    type: 'edit' | 'add' | 'remove' | 'move'
    target: string
    content?: string
    reason: string
    from?: string
    to?: string
  }>
  tokens_used: number
}

export interface InterviewPrepRequest {
  service_id: string
  tier?: 'free' | 'paid'
}

export interface InterviewPrepResult {
  intro: string
  qa_items: Array<{
    question: string
    framework: string
    hints: string[]
  }>
  tokens_used: number
}

export class BusinessLogicService {
  /**
   * 执行职位匹配分析
   */
  async executeJobMatch(
    request: JobMatchRequest,
    context: ApiContext
  ): Promise<JobMatchResult> {
    const { service_id, tier } = request
    const { reqId, route, userKey } = context
    
    // 如果没有明确指定tier，根据用户quota动态确定
    let finalTier = tier
    if (!finalTier) {
      const quotaStatus = await checkQuotaForService(userKey)
      finalTier = quotaStatus.shouldUseFreeQueue ? 'free' : 'paid'
    }

    logInfo({
      reqId,
      route,
      userKey,
      phase: 'job_match_start',
      service_id,
      tier: finalTier,
    })

    // 获取服务数据
    const serviceData = await this.getServiceData(service_id, userKey)
    
    // 执行职位匹配
    const result = await executeJobMatch(
      JSON.stringify(serviceData.resumeSummary),
      JSON.stringify(serviceData.jobSummary),
      userKey,
      service_id,
      { tier: finalTier }
    )

    if (!result.success || !result.data) {
      throw new Error(`upstream_error: Job match failed - ${result.error}`)
    }

    const jobMatchData = result.data as { score: number; highlights: string[]; gaps: string[]; dm_script: string }

    logInfo({
      reqId,
      route,
      userKey,
      phase: 'job_match_done',
      service_id,
      tokens_used: result.llmResult?.response?.usage?.totalTokens || 0,
      score: jobMatchData.score,
    })

    return {
      score: jobMatchData.score,
      highlights: jobMatchData.highlights,
      gaps: jobMatchData.gaps,
      dm_script: jobMatchData.dm_script,
      tokens_used: result.llmResult?.response?.usage?.totalTokens || 0,
    }
  }

  /**
   * 执行简历编辑建议
   */
  async executeResumeEdit(
    request: ResumeEditRequest,
    context: ApiContext
  ): Promise<ResumeEditResult> {
    const { service_id, tier } = request
    const { reqId, route, userKey } = context
    
    // 如果没有明确指定tier，根据用户quota动态确定
    let finalTier = tier
    if (!finalTier) {
      const quotaStatus = await checkQuotaForService(userKey)
      finalTier = quotaStatus.shouldUseFreeQueue ? 'free' : 'paid'
    }

    logInfo({
      reqId,
      route,
      userKey,
      phase: 'resume_edit_start',
      service_id,
      tier: finalTier,
    })

    // 获取服务数据
    const serviceData = await this.getServiceData(service_id, userKey)
    
    // 执行简历编辑
    const result = await executeResumeEdit(
      JSON.stringify(serviceData.resumeSummary),
      JSON.stringify(serviceData.jobSummary),
      JSON.stringify(serviceData.detailedSummary),
      userKey,
      service_id,
      { tier: finalTier }
    )

    if (!result.success || !result.data) {
      throw new Error(`upstream_error: Resume edit failed - ${result.error}`)
    }

    const resumeEditData = result.data as { summary: string; ops: Array<{ type: 'edit' | 'add' | 'remove' | 'move'; target: string; content?: string; reason: string; from?: string; to?: string }> }

    logInfo({
      reqId,
      route,
      userKey,
      phase: 'resume_edit_done',
      service_id,
      tokens_used: result.llmResult?.response?.usage?.totalTokens || 0,
      ops_count: resumeEditData.ops.length,
    })

    return {
      summary: resumeEditData.summary,
      ops: resumeEditData.ops,
      tokens_used: result.llmResult?.response?.usage?.totalTokens || 0,
    }
  }

  /**
   * 执行面试准备
   */
  async executeInterviewPrep(
    request: InterviewPrepRequest,
    context: ApiContext
  ): Promise<InterviewPrepResult> {
    const { service_id, tier } = request
    const { reqId, route, userKey } = context
    
    // 如果没有明确指定tier，根据用户quota动态确定
    let finalTier = tier
    if (!finalTier) {
      const quotaStatus = await checkQuotaForService(userKey)
      finalTier = quotaStatus.shouldUseFreeQueue ? 'free' : 'paid'
    }

    logInfo({
      reqId,
      route,
      userKey,
      phase: 'interview_prep_start',
      service_id,
      tier: finalTier,
    })

    // 获取服务数据
    const serviceData = await this.getServiceData(service_id, userKey)
    
    // 执行面试准备
    const result = await executeInterviewPrep(
      JSON.stringify(serviceData.resumeSummary),
      JSON.stringify(serviceData.jobSummary),
      JSON.stringify(serviceData.detailedSummary),
      userKey,
      service_id,
      { tier: finalTier }
    )

    if (!result.success || !result.data) {
      throw new Error(`upstream_error: Interview prep failed - ${result.error}`)
    }

    const interviewPrepData = result.data as { intro: string; qa_items: Array<{ question: string; framework: string; hints: string[] }> }

    logInfo({
      reqId,
      route,
      userKey,
      phase: 'interview_prep_done',
      service_id,
      tokens_used: result.llmResult?.response?.usage?.totalTokens || 0,
      qa_count: interviewPrepData.qa_items.length,
    })

    return {
      intro: interviewPrepData.intro,
      qa_items: interviewPrepData.qa_items,
      tokens_used: result.llmResult?.response?.usage?.totalTokens || 0,
    }
  }

  /**
   * 获取服务相关数据
   */
  private async getServiceData(serviceId: string, userKey: string) {
    // 获取服务信息
    const service = await getServiceById(serviceId)
    if (!service || service.userId !== userKey) {
      throw new Error('not_found: Service not found or access denied')
    }

    if (service.status !== 'done') {
      throw new Error('invalid_request: Service not completed yet')
    }

    // 获取简历和职位数据
    const [resumeData, jobData, detailedData] = await Promise.all([
      service.resumeId ? getResumeByIdForUser(service.resumeId, userKey) : null,
      getJobByIdForUser(service.jobId, userKey),
      prisma.detailedResume.findFirst({ where: { userId: userKey } }), // 通过userId获取详细简历
    ])

    if (!resumeData || !jobData) {
      throw new Error('not_found: Resume or job data not found')
    }

    if (!resumeData.resumeSummaryJson || !jobData.jobSummaryJson) {
      throw new Error('invalid_request: Summary data not available')
    }

    return {
      service,
      resumeSummary: resumeData.resumeSummaryJson,
      jobSummary: jobData.jobSummaryJson,
      detailedSummary: detailedData?.detailedSummaryJson || null,
    }
  }
}

// 导出单例实例
export const businessLogicService = new BusinessLogicService()

// 便捷函数
export async function executeJobMatchAnalysis(
  request: JobMatchRequest,
  context: ApiContext
): Promise<JobMatchResult> {
  return businessLogicService.executeJobMatch(request, context)
}

export async function executeResumeEditSuggestions(
  request: ResumeEditRequest,
  context: ApiContext
): Promise<ResumeEditResult> {
  return businessLogicService.executeResumeEdit(request, context)
}

export async function executeInterviewPreparation(
  request: InterviewPrepRequest,
  context: ApiContext
): Promise<InterviewPrepResult> {
  return businessLogicService.executeInterviewPrep(request, context)
}