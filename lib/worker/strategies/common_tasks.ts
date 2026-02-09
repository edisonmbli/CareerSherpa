import { WorkerStrategy, StrategyContext, ExecutionResult } from './interface'
import {
  setInterviewTipsJson,
  updateServiceExecutionStatus,
  getInterviewContext,
} from '@/lib/dal/services'
import { AsyncTaskStatus, ExecutionStatus } from '@prisma/client'
import {
  recordRefund,
  markDebitSuccess,
  markDebitFailed,
} from '@/lib/dal/coinLedger'
import { logError } from '@/lib/logger'
import {
  getChannel,
  publishEvent,
  buildInterviewTaskId,
} from '@/lib/worker/common'
import { retrieveInterviewContext } from '@/lib/rag/retriever'
import { validateJson } from '@/lib/llm/json-validator'

function normalizeJson(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

export class InterviewStrategy implements WorkerStrategy<any> {
  templateId = 'interview_prep' as const

  async prepareVars(variables: any, ctx: StrategyContext) {
    const vars = { ...variables }
    const { serviceId, userId, taskId, locale, requestId } = ctx

    if (!serviceId) return vars

    try {
      const channel = getChannel(userId, serviceId, taskId)
      await publishEvent(channel, {
        type: 'status',
        taskId,
        code: 'interview_pending',
        status: 'INTERVIEW_PENDING',
        lastUpdatedAt: new Date().toISOString(),
        requestId,
      })
    } catch (e) {
      /* ignore */
    }

    const context = await getInterviewContext(serviceId)

    vars.job_summary_json = normalizeJson(context.jobSummaryJson)
    vars.match_analysis_json = normalizeJson(context.matchSummaryJson)
    vars.customized_resume_json = normalizeJson(context.customizedResumeJson)
    vars.resume_summary_json = normalizeJson(context.resumeSummaryJson)
    vars.detailed_resume_summary_json = normalizeJson(
      context.detailedSummaryJson,
    )

    let jobTitle = 'unknown position'
    try {
      const jobData = JSON.parse(vars.job_summary_json || '{}')
      jobTitle = jobData?.jobTitle || jobData?.title || 'unknown position'
    } catch (e) {
      /* ignore */
    }

    if (!vars.rag_context) {
      try {
        vars.rag_context = await retrieveInterviewContext(
          jobTitle,
          String(locale || 'en'),
        )
      } catch (e) {
        vars.rag_context = ''
      }
    }

    return vars
  }

  async writeResults(
    execResult: ExecutionResult,
    variables: any,
    ctx: StrategyContext,
  ) {
    const { serviceId, userId, requestId } = ctx
    const raw = String(execResult.raw || execResult.data?.raw || '')
    let parsed = execResult.data
    if (!parsed && raw) {
      const parsedResult = validateJson(raw, {
        debug: {
          reqId: requestId,
          route: 'worker/interview',
          userKey: userId,
        },
        maxAttempts: 4,
      })
      if (parsedResult.success) {
        parsed = parsedResult.data
      }
    }
    const finalOk = execResult.ok && Boolean(parsed)

    try {
      await setInterviewTipsJson(
        serviceId,
        parsed || { markdown: raw },
        finalOk ? AsyncTaskStatus.COMPLETED : AsyncTaskStatus.FAILED,
      )

      // Status update logic
      const sessionId = String(variables.executionSessionId || '')
      const interviewTaskId =
        ctx.taskId || buildInterviewTaskId(serviceId, sessionId)
      const channel = getChannel(userId, serviceId, interviewTaskId)

      if (finalOk) {
        await updateServiceExecutionStatus(
          serviceId,
          ExecutionStatus.INTERVIEW_COMPLETED,
          { executionSessionId: variables.executionSessionId },
        )
        try {
          await publishEvent(channel, {
            type: 'status',
            taskId: interviewTaskId,
            code: 'interview_completed',
            status: 'INTERVIEW_COMPLETED',
            lastUpdatedAt: new Date().toISOString(),
            requestId,
          })
        } catch (e) {
          /* ignore */
        }
      } else {
        await updateServiceExecutionStatus(
          serviceId,
          ExecutionStatus.INTERVIEW_FAILED,
          { executionSessionId: variables.executionSessionId },
        )
        try {
          await publishEvent(channel, {
            type: 'status',
            taskId: interviewTaskId,
            code: 'interview_failed',
            status: 'INTERVIEW_FAILED',
            lastUpdatedAt: new Date().toISOString(),
            requestId,
          })
        } catch (e) {
          /* ignore */
        }
      }
    } catch (err) {
      logError({
        reqId: requestId,
        route: 'worker/interview',
        error: String(err),
        phase: 'write_result',
        serviceId,
      })
    }

    await handleRefunds(
      { ...execResult, ok: finalOk },
      variables,
      serviceId,
      userId,
      'interview_prep',
    )
  }
}

async function handleRefunds(
  execResult: ExecutionResult,
  variables: any,
  serviceId: string,
  userId: string,
  templateId: string,
) {
  const wasPaid = !!variables?.wasPaid
  const cost = Number(variables?.cost || 0)
  const debitId = String(variables?.debitId || '')

  if (!execResult.ok && wasPaid && cost > 0 && debitId) {
    try {
      await recordRefund({
        userId,
        amount: cost,
        relatedId: debitId,
        serviceId,
        templateId, // templateId is already string type
      })
    } catch (e) {
      /* best effort */
    }
    try {
      await markDebitFailed(debitId)
    } catch (e) {
      /* best effort */
    }
  } else if (execResult.ok && wasPaid && cost > 0 && debitId) {
    try {
      await markDebitSuccess(debitId, execResult.usageLogId)
    } catch (e) {
      /* best effort */
    }
  }
}
