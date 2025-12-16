import { WorkerStrategy, StrategyContext, ExecutionResult } from './interface'
import { setInterviewTipsJson } from '@/lib/dal/services'
import { AsyncTaskStatus } from '@prisma/client'
import {
  recordRefund,
  markDebitSuccess,
  markDebitFailed,
} from '@/lib/dal/coinLedger'
import { logError } from '@/lib/logger'

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
