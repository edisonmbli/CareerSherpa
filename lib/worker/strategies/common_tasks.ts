import { WorkerStrategy, StrategyContext, ExecutionResult } from './interface'
import {
  setInterviewTipsJson,
  updateServiceExecutionStatus,
} from '@/lib/dal/services'
import { AsyncTaskStatus, ExecutionStatus } from '@prisma/client'
import {
  recordRefund,
  markDebitSuccess,
  markDebitFailed,
} from '@/lib/dal/coinLedger'
import { logError } from '@/lib/logger'
import { getChannel, publishEvent, buildMatchTaskId } from '@/lib/worker/common'

export class InterviewStrategy implements WorkerStrategy<any> {
  templateId = 'interview_prep' as const

  async prepareVars(variables: any, ctx: StrategyContext) {
    return variables
  }

  async writeResults(
    execResult: ExecutionResult,
    variables: any,
    ctx: StrategyContext
  ) {
    const { serviceId, userId, requestId } = ctx
    const raw = String(execResult.data?.raw || '')
    let parsed = execResult.data
    if (!parsed && raw) {
      try {
        parsed = JSON.parse(raw)
      } catch (e) {
        /* ignore parse error */
      }
    }

    try {
      await setInterviewTipsJson(
        serviceId,
        parsed || { markdown: raw },
        execResult.ok ? AsyncTaskStatus.COMPLETED : AsyncTaskStatus.FAILED
      )

      // Status update logic
      const sessionId = String(variables.executionSessionId || '')
      const matchTaskId = buildMatchTaskId(serviceId, sessionId)
      const channel = getChannel(userId, serviceId, matchTaskId)

      if (execResult.ok) {
        await updateServiceExecutionStatus(
          serviceId,
          ExecutionStatus.INTERVIEW_COMPLETED,
          { executionSessionId: variables.executionSessionId }
        )
        try {
          await publishEvent(channel, {
            type: 'status',
            taskId: matchTaskId,
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
          { executionSessionId: variables.executionSessionId }
        )
        try {
          await publishEvent(channel, {
            type: 'status',
            taskId: matchTaskId,
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
      execResult,
      variables,
      serviceId,
      userId,
      'interview_prep'
    )
  }
}

async function handleRefunds(
  execResult: ExecutionResult,
  variables: any,
  serviceId: string,
  userId: string,
  templateId: string
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
        templateId: templateId as any,
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
