import { WorkerStrategy, StrategyContext, ExecutionResult } from './interface'
import { PreMatchAuditVars } from '@/lib/prompts/types'
import {
  getServiceSummariesReadOnly,
  updateServiceExecutionStatus,
} from '@/lib/dal/services'
import { pushTask } from '@/lib/queue/producer'
import { logError } from '@/lib/logger'
import { markTimeline } from '@/lib/observability/timeline'
import { ExecutionStatus } from '@prisma/client'
import { getChannel, publishEvent } from '@/lib/worker/common'
import { getDictionary } from '@/lib/i18n/dictionaries'

export class PreMatchStrategy implements WorkerStrategy<PreMatchAuditVars> {
  templateId = 'pre_match_audit' as const

  async prepareVars(variables: PreMatchAuditVars, ctx: StrategyContext) {
    const { serviceId, userId, locale } = ctx
    const dict = await getDictionary(locale as any)

    // Notify frontend that audit is starting
    try {
      const channel = getChannel(userId, serviceId, variables.nextTaskId) // Notify on the match task channel
      await publishEvent(channel, {
        type: 'status',
        taskId: variables.nextTaskId,
        code: 'audit_start',
        status: 'PREMATCH_PENDING', // Correct phase: PreMatch Check
        stage: 'audit_start',
        message: dict.worker.preMatch.auditing,
        lastUpdatedAt: new Date().toISOString(),
      })
    } catch (e) {
      /* ignore */
    }

    // Ensure summaries are present
    if (!variables.resume_summary_json || !variables.job_summary_json) {
      const svc = await getServiceSummariesReadOnly(serviceId, userId)
      if (svc) {
        if (!variables.resume_summary_json && svc.resume?.resumeSummaryJson) {
          variables.resume_summary_json = JSON.stringify(
            svc.resume.resumeSummaryJson
          )
        }
        if (!variables.job_summary_json && svc.job?.jobSummaryJson) {
          variables.job_summary_json = JSON.stringify(svc.job.jobSummaryJson)
        }
      }
    }

    return variables
  }

  async writeResults(
    execResult: ExecutionResult,
    variables: PreMatchAuditVars,
    ctx: StrategyContext
  ) {
    const { serviceId, userId, locale, requestId, traceId } = ctx
    const dict = await getDictionary(locale as any)

    // 1. Construct Risk Context
    let riskContext = ''
    if (execResult.ok && execResult.data) {
      try {
        const data = execResult.data
        const risks = Array.isArray(data.risks) ? data.risks : []
        const summary = data.audit_summary || ''
        const level = data.overall_risk_level || 'UNKNOWN'

        const t = dict.worker.preMatch
        riskContext = `${t.reportTitle}\n${t.overallLevel}: ${level}\n${t.summary}: ${summary}\n\n${t.fatalRisks}:\n`

        risks.forEach((r: any) => {
          riskContext += `- [${r.severity}] ${r.risk_point}: ${r.reasoning}\n`
        })
      } catch (e) {
        logError({
          reqId: ctx.requestId,
          route: 'worker/pre_match',
          error: String(e),
          phase: 'format_risk_context',
          serviceId,
        })
      }
    } else {
      // Logic for failed audit?
      // Currently worker framework might stop here if execResult.ok is false.
      // But if we reach here, we should try to proceed to Match.
      logError({
        reqId: ctx.requestId,
        route: 'worker/pre_match',
        error: execResult.error,
        phase: 'audit_failed',
        serviceId,
      })
    }

    if (execResult.ok && execResult.data) {
      try {
        const channel = getChannel(userId, serviceId, variables.nextTaskId)
        await publishEvent(channel, {
          type: 'pre_match_result',
          taskId: variables.nextTaskId,
          json: execResult.data,
          stage: 'prematch_done',
          requestId,
          traceId,
        })
        await publishEvent(channel, {
          type: 'status',
          taskId: variables.nextTaskId,
          status: 'PREMATCH_COMPLETED',
          code: 'prematch_completed',
          lastUpdatedAt: new Date().toISOString(),
          stage: 'completed',
          requestId,
          traceId,
        })
      } catch (e) {
        logError({
          reqId: ctx.requestId,
          route: 'worker/pre_match',
          error: String(e),
          phase: 'publish_prematch_result',
          serviceId,
        })
      }
    }

    // 2. Enqueue the actual Job Match Task
    await markTimeline(serviceId, 'worker_audit_enqueue_match_start', {
      taskId: variables.nextTaskId,
    })

    const pushRes = await pushTask({
      kind: 'stream',
      serviceId,
      taskId: variables.nextTaskId, // Must match the ID expected by frontend
      userId,
      locale: locale as 'en' | 'zh',
      templateId: 'job_match',
      variables: {
        rag_context: '', // MatchStrategy will fetch this
        resumeId: variables.resumeId,
        ...(variables.detailedResumeId
          ? { detailedResumeId: variables.detailedResumeId }
          : {}),
        jobId: variables.jobId,
        resume_summary_json: variables.resume_summary_json, // Pass through optimization
        job_summary_json: variables.job_summary_json,
        ...(variables.executionSessionId
          ? { executionSessionId: variables.executionSessionId }
          : {}),
        wasPaid: variables.wasPaid,
        cost: variables.cost,
        ...(variables.debitId ? { debitId: variables.debitId } : {}),
        prompt: `${Date.now()}`, // Force uniqueness if needed
        pre_match_risks: riskContext, // <--- The Golden Payload
      },
    })

    if (pushRes.error) {
      logError({
        reqId: ctx.requestId,
        route: 'worker/pre_match',
        error: pushRes.error,
        phase: 'enqueue_match_failed',
        serviceId,
      })
      // If we fail to enqueue match, the user is stuck.
      // We should probably mark service as failed.
      await updateServiceExecutionStatus(
        serviceId,
        ExecutionStatus.MATCH_FAILED
      )
    }

    await markTimeline(serviceId, 'worker_audit_enqueue_match_end', {
      taskId: variables.nextTaskId,
    })
  }
}
