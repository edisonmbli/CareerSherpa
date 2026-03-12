import { CoinTxnStatus, CoinTxnType } from '@prisma/client'
import { getTaskCost } from '@/lib/constants'
import { withPrismaGuard } from '@/lib/guard/prismaGuard'
import type { FeedbackDispatchPayload } from '@/lib/feedback/schema'
import { parseTaskId } from '@/lib/types/task-context'

export type FeedbackDeliveryMode = 'direct' | 'qstash'

type LookupSource = 'task_id' | 'service_template' | 'none'

type CostedTemplateId = 'job_match' | 'resume_customize' | 'interview_prep'

export type FeedbackEnrichment = {
  deliveryMode: FeedbackDeliveryMode
  resolvedTaskId?: string
  resolvedTaskTemplateId?: string
  taskTierHint?: 'free' | 'paid'
  currentTabCostPreview?: number
  billingMode?: 'free' | 'paid'
  billingStatus?: CoinTxnStatus
  debitDelta?: number
  debitCreatedAt?: string
  billingLookupSource: LookupSource
  modelId?: string
  provider?: string
  llmUsageCreatedAt?: string
  modelLookupSource: LookupSource
}

const COSTED_TEMPLATE_IDS = new Set<CostedTemplateId>([
  'job_match',
  'resume_customize',
  'interview_prep',
])

function asIsoString(value: Date | null | undefined) {
  return value instanceof Date ? value.toISOString() : undefined
}

function deriveTemplateIdFromTaskId(taskId?: string): string | undefined {
  const parsed = parseTaskId(taskId || '')
  if (!parsed) return undefined
  if (parsed.taskType === 'customize') return 'resume_customize'
  if (parsed.taskType === 'interview') return 'interview_prep'
  return 'job_match'
}

function getCurrentTabCostPreview(taskTemplateId?: string) {
  if (!taskTemplateId) return undefined
  if (!COSTED_TEMPLATE_IDS.has(taskTemplateId as CostedTemplateId)) {
    return undefined
  }
  return getTaskCost(taskTemplateId as CostedTemplateId)
}

export async function enrichFeedbackPayload(
  payload: FeedbackDispatchPayload,
  options: { deliveryMode: FeedbackDeliveryMode },
): Promise<FeedbackEnrichment> {
  const serviceId = payload.context.serviceId
  const resolvedTaskId = payload.context.taskId || undefined
  const resolvedTaskTemplateId =
    payload.context.taskTemplateId || deriveTemplateIdFromTaskId(resolvedTaskId)
  const taskTierHint =
    payload.context.taskTierHint || payload.context.tier || undefined
  const currentTabCostPreview = getCurrentTabCostPreview(resolvedTaskTemplateId)

  const base: FeedbackEnrichment = {
    deliveryMode: options.deliveryMode,
    ...(resolvedTaskId ? { resolvedTaskId } : {}),
    ...(resolvedTaskTemplateId ? { resolvedTaskTemplateId } : {}),
    ...(taskTierHint ? { taskTierHint } : {}),
    ...(currentTabCostPreview !== undefined ? { currentTabCostPreview } : {}),
    billingLookupSource: 'none',
    modelLookupSource: 'none',
  }

  if (!serviceId || !resolvedTaskTemplateId) {
    return base
  }

  const lookupTime = new Date(payload.context.occurredAt || payload.submittedAt)
  if (Number.isNaN(lookupTime.getTime())) {
    return base
  }

  return await withPrismaGuard(
    async (client) => {
      const exactDebit = resolvedTaskId
        ? await client.coinTransaction.findFirst({
            where: {
              userId: payload.authUser.id,
              serviceId,
              taskId: resolvedTaskId,
              type: CoinTxnType.SERVICE_DEBIT,
              createdAt: { lte: lookupTime },
            },
            orderBy: { createdAt: 'desc' },
            select: {
              status: true,
              delta: true,
              createdAt: true,
            },
          })
        : null

      const fallbackDebit = exactDebit
        ? null
        : await client.coinTransaction.findFirst({
            where: {
              userId: payload.authUser.id,
              serviceId,
              templateId: resolvedTaskTemplateId,
              type: CoinTxnType.SERVICE_DEBIT,
              createdAt: { lte: lookupTime },
            },
            orderBy: { createdAt: 'desc' },
            select: {
              status: true,
              delta: true,
              createdAt: true,
            },
          })

      const debit = exactDebit || fallbackDebit

      const usage = await client.llmUsageLog.findFirst({
        where: {
          userId: payload.authUser.id,
          serviceId,
          taskTemplateId: resolvedTaskTemplateId,
          createdAt: { lte: lookupTime },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          modelId: true,
          provider: true,
          createdAt: true,
        },
      })

      const debitCreatedAt = asIsoString(debit?.createdAt)
      const llmUsageCreatedAt = asIsoString(usage?.createdAt)

      return {
        ...base,
        ...(debit
          ? {
              billingMode: 'paid' as const,
              billingStatus: debit.status,
              debitDelta: Math.abs(Number(debit.delta || 0)),
              ...(debitCreatedAt ? { debitCreatedAt } : {}),
              billingLookupSource: exactDebit ? 'task_id' : 'service_template',
            }
          : { billingMode: 'free' as const }),
        ...(usage
          ? {
              modelId: usage.modelId,
              provider: usage.provider,
              ...(llmUsageCreatedAt ? { llmUsageCreatedAt } : {}),
              modelLookupSource: 'service_template' as const,
            }
          : {}),
      }
    },
    { attempts: 2, prewarm: false },
  )
}
