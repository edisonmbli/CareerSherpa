import { WorkerStrategy, StrategyContext, ExecutionResult } from './interface'
import {
  getServiceWithContext,
  setCustomizedResumeResult,
  updateServiceExecutionStatus,
} from '@/lib/dal/services'
import { retrieveCustomizeContext } from '@/lib/rag/retriever'
import { llmResumeResponseSchema } from '@/lib/types/resume-schema'
import { validateJson } from '@/lib/llm/json-validator'
import { z } from 'zod'
import { AsyncTaskStatus, ExecutionStatus } from '@prisma/client'
import fs from 'fs'
import path from 'path'
import {
  recordRefund,
  markDebitSuccess,
  markDebitFailed,
} from '@/lib/dal/coinLedger'
import { logError } from '@/lib/logger'
import { getChannel, publishEvent, buildMatchTaskId } from '@/lib/worker/common'

// Helper for debug logging (M9 pattern)
function logDebugFile(filename: string, content: string) {
  try {
    if (process.env.NODE_ENV === 'development') {
      const logDir = path.join(process.cwd(), 'tmp', 'debug-logs')
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true })
      }
      fs.writeFileSync(path.join(logDir, filename), content)
    }
  } catch (e) {
    console.error('Failed to write debug log', e)
  }
}

export const customizeStrategy: WorkerStrategy = {
  templateId: 'resume_customize',

  async prepareVars(variables: any, ctx: StrategyContext) {
    const { serviceId, locale } = ctx

    // if (process.env.NODE_ENV !== 'production') {
    //   console.log('[Worker] customizeStrategy.prepareVars', { variables, ctx })
    // }

    // 1. Get Service Context
    const service = await getServiceWithContext(serviceId)
    if (!service?.resume || !service?.job) {
      throw new Error('Service context missing (Resume or Job)')
    }

    const resumeSummary = service.resume.resumeSummaryJson
    const detailedResumeSummary = service.detailedResume?.detailedSummaryJson
    const jobSummary = service.job.jobSummaryJson
    const matchAnalysis = service.match?.matchSummaryJson

    // Validate inputs to prevent hallucinations
    if (!resumeSummary) throw new Error('Resume Summary is missing')
    if (!jobSummary) throw new Error('Job Summary is missing')
    // Match analysis is highly recommended but technically we could proceed without it,
    // but the prompt relies on it. Let's enforce it for quality.
    if (!matchAnalysis) throw new Error('Match Analysis is missing')

    // 2. Get RAG Context (Resume Customization Tips)
    const jobTitle = (jobSummary as any)?.jobTitle || 'General Job'
    let ragContext = ''
    try {
      ragContext = await retrieveCustomizeContext(jobTitle, locale)
    } catch (e) {
      console.warn('RAG retrieval failed, proceeding without context', e)
    }

    // Debug Log: Input Context
    logDebugFile(
      `customize_input_${serviceId}_${Date.now()}.json`,
      JSON.stringify(
        {
          jobTitle,
          resumeSummary,
          detailedResumeSummary,
          jobSummary,
          matchAnalysis,
          ragContext,
        },
        null,
        2
      )
    )

    // Return variables mapped to Prompt Template keys, preserving original variables for debit/cost
    return {
      ...variables,
      serviceId,
      locale,
      resume_summary_json: JSON.stringify(resumeSummary),
      detailed_resume_summary_json: detailedResumeSummary
        ? JSON.stringify(detailedResumeSummary)
        : 'N/A',
      job_summary_json: JSON.stringify(jobSummary),
      match_analysis_json: JSON.stringify(matchAnalysis),
      rag_context: ragContext,
    }
  },

  async writeResults(
    execResult: ExecutionResult,
    variables: any,
    ctx: StrategyContext
  ) {
    const { serviceId, userId, requestId } = ctx
    const result = execResult.data
    const sessionId = String(variables.executionSessionId || '')
    const matchTaskId = buildMatchTaskId(serviceId, sessionId)
    const channel = getChannel(userId, serviceId, matchTaskId)

    // if (process.env.NODE_ENV !== 'production') {
    //   console.log('[Worker] customizeStrategy.writeResults', {
    //     sessionId,
    //     matchTaskId,
    //     channel,
    //     success: execResult.ok,
    //   })
    // }

    // Debug Log: Output Result
    logDebugFile(
      `customize_output_${serviceId}_${Date.now()}.json`,
      JSON.stringify(execResult, null, 2)
    )

    if (!execResult.ok && !execResult.data?.raw) {
      await setCustomizedResumeResult(
        serviceId,
        undefined,
        undefined,
        AsyncTaskStatus.FAILED
      )

      await updateServiceExecutionStatus(
        serviceId,
        // @ts-ignore: dynamic enum
        ExecutionStatus.CUSTOMIZE_FAILED,
        {
          executionSessionId: variables.executionSessionId,
        }
      )

      try {
        await publishEvent(channel, {
          type: 'status',
          taskId: matchTaskId,
          code: 'customize_failed',
          status: 'CUSTOMIZE_FAILED',
          lastUpdatedAt: new Date().toISOString(),
          requestId,
        })
      } catch (e) {
        console.error('Failed to publish customize_failed event', e)
      }

      await handleRefunds(execResult, variables, serviceId, userId)
      return
    }

    try {
      // Parse result with robust validator (like match strategy)
      let resultJson: any = null
      const validation = validateJson(execResult.raw || '', {
        enableFallback: true,
        strictMode: false,
      })

      if (validation.success && validation.data) {
        resultJson = validation.data
      } else if (execResult.data && typeof execResult.data === 'object') {
        resultJson = execResult.data
      }

      if (!resultJson) {
        throw new Error(
          'Failed to parse LLM response: ' +
            (validation.error || 'Unknown error')
        )
      }

      // Validate Result against Schema
      const validatedData = llmResumeResponseSchema.parse(resultJson)

      // Map to DB format
      await setCustomizedResumeResult(
        serviceId,
        validatedData.optimizeSuggestion,
        validatedData.resumeData,
        AsyncTaskStatus.COMPLETED
      )

      await updateServiceExecutionStatus(
        serviceId,
        // @ts-ignore: dynamic enum
        ExecutionStatus.CUSTOMIZE_COMPLETED,
        {
          executionSessionId: variables.executionSessionId,
        }
      )

      try {
        await publishEvent(channel, {
          type: 'status',
          taskId: matchTaskId,
          code: 'customize_completed',
          status: 'CUSTOMIZE_COMPLETED',
          lastUpdatedAt: new Date().toISOString(),
          requestId,
        })
      } catch (e) {
        console.error('Failed to publish customize_completed event', e)
      }

      // Mark debit success
      const debitId = String(variables.debitId || '')
      if (debitId) {
        try {
          await markDebitSuccess(debitId, execResult.usageLogId)
        } catch (e) {
          console.error('Failed to mark debit success:', e)
        }
      }
    } catch (error) {
      console.error('Customize Strategy Write Error:', error)
      await setCustomizedResumeResult(
        serviceId,
        undefined,
        undefined,
        AsyncTaskStatus.FAILED
      )

      await updateServiceExecutionStatus(
        serviceId,
        // @ts-ignore: dynamic enum
        ExecutionStatus.CUSTOMIZE_FAILED,
        {
          executionSessionId: variables.executionSessionId,
        }
      )

      try {
        await publishEvent(channel, {
          type: 'status',
          taskId: matchTaskId,
          code: 'customize_failed',
          status: 'CUSTOMIZE_FAILED',
          lastUpdatedAt: new Date().toISOString(),
          requestId,
        })
      } catch (e) {
        console.error('Failed to publish customize_failed event', e)
      }

      // Refund on validation error (logic failure)
      // Construct a fake failed result to trigger refund logic
      const failedResult = { ...execResult, ok: false, error: String(error) }
      await handleRefunds(failedResult, variables, serviceId, userId)

      if (error instanceof z.ZodError) {
        throw new Error(`JSON Validation Failed: ${error.message}`)
      }
      throw error
    }
  },
}

async function handleRefunds(
  execResult: ExecutionResult,
  variables: any,
  serviceId: string,
  userId: string
) {
  const wasPaid = !!variables?.wasPaid
  const cost = Number(variables?.cost || 0)
  const debitId = String(variables?.debitId || '')

  const shouldRefund = !execResult.ok && wasPaid && cost > 0 && !!debitId
  if (shouldRefund) {
    try {
      await recordRefund({
        userId,
        amount: cost,
        relatedId: debitId,
        serviceId,
        templateId: 'resume_customize',
        metadata: { reason: 'customize_failed', error: execResult.error },
      })
    } catch (err) {
      logError({
        reqId: 'system',
        route: 'worker/customize',
        error: String(err),
        phase: 'refund_failed',
        serviceId,
      })
    }
    try {
      await markDebitFailed(debitId)
    } catch (e) {
      /* best effort */
    }
  }
}
