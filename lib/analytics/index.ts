import { createAnalyticsEvent, type CreateAnalyticsEventParams } from '@/lib/dal/analyticsEvent'
import {
  AnalyticsCategory,
  AnalyticsOutcome,
  AnalyticsQueueKind,
  AnalyticsRuntime,
  AnalyticsSource,
} from '@prisma/client'
import { logInfo } from '@/lib/logger'
import { z } from 'zod'

export {
  AnalyticsCategory,
  AnalyticsOutcome,
  AnalyticsQueueKind,
  AnalyticsRuntime,
  AnalyticsSource,
}

type TaskKind = 'stream' | 'batch'
const taskKindSchema = z.enum(['stream', 'batch'])
const genericPayloadSchema = z.record(z.string(), z.unknown())

export interface AnalyticsEventMap {
  // System lifecycle
  TASK_ENQUEUED: {
    templateId?: string
    kind?: TaskKind
    queueId?: string
    messageId?: string
    idemKey?: string
    isFree?: boolean
  }
  TASK_REPLAYED: { templateId?: string; kind?: TaskKind; idemKey?: string }
  TASK_BACKPRESSURED: {
    templateId?: string
    kind?: TaskKind
    queueId?: string
    pending?: number
    maxSize?: number
    retryAfter?: number
  }
  TASK_ENQUEUE_FAILED: {
    templateId?: string
    kind?: TaskKind
    queueId?: string
    error?: string
  }
  WORKER_JOB_STARTED: {
    templateId?: string
    queueWaitTime?: number
    enqueuedAt?: number
    startedAt?: number
  }
  WORKER_JOB_FINISHED: {
    templateId?: string
    kind?: TaskKind
    success?: boolean
    reason?: string
    error?: string
  }
  WORKER_GUARDS_BLOCKED: {
    reason: string
    templateId?: string
    kind?: TaskKind
    retryAfter?: number
    pending?: number
    maxSize?: number
    retryCount?: number
    maxRetries?: number
    refunded?: boolean
  }
  WORKER_PROVIDER_NOT_CONFIGURED: {
    templateId?: string
    modelId?: string
    provider?: string
  }

  // Business
  USER_SIGNUP_COMPLETED: { method?: string }
  SERVICE_CREATED: {
    isImage?: boolean
    isPaid?: boolean
    hasDetailedResume?: boolean
    acqTouch?: 'first' | 'last'
    acqChannel?: string
    acqSource?: string | null
    acqMedium?: string | null
    acqCampaign?: string | null
    acqContent?: string | null
    acqTerm?: string | null
    acqReferrerDomain?: string
    acqShareId?: string | null
    acqSessionId?: string
    acqAnonymousId?: string
  }
  LANDING_ATTRIBUTED: {
    touch: 'first' | 'last'
    channel: string
    landingPath?: string
    referrerDomain?: string
    utm_source?: string | null
    utm_medium?: string | null
    utm_campaign?: string | null
    utm_content?: string | null
    utm_term?: string | null
    src?: string | null
    shareId?: string | null
    anonymousId?: string
    sessionId?: string
  }
  RESUME_UPLOAD_ACCEPTED: { type?: 'resume' | 'detailed'; isFree?: boolean; length?: number }
  RESUME_PARSE_COMPLETED: {
    templateId: 'resume_summary' | 'detailed_resume_summary'
    success: boolean
    failureCode?: string
  }
  MATCH_GENERATED: {
    matchScore?: number
    jobId?: string
    resumeId?: string
  }
  MATCH_FAILED: {
    failureCode?: string
    reason?: string
  }
  CUSTOMIZE_SESSION_STARTED: { serviceId?: string }
  CUSTOMIZE_GENERATED: { success: boolean; reason?: string }
  CUSTOMIZE_SAVE_CLICKED: { serviceId?: string }
  CUSTOMIZE_EXPORT_CLICKED: { serviceId?: string; markdownLength?: number }
  CUSTOMIZE_SHARE_CLICKED: {
    shareId: string
    templateId?: string
    source?: string
    shareMethod?: string
  }
  INTERVIEW_SESSION_STARTED: { interviewId?: string }
  INTERVIEW_COMPLETED: { interviewId?: string }
  INTERVIEW_FAILED: { interviewId?: string; reason?: string }
  INTERVIEW_MESSAGE_SENT: { role?: 'user' | 'ai'; length?: number }
  RESUME_SHARE_VIEW: {
    shareId: string
    templateId: string
    source?: string
    referrerDomain?: string
    utm_source?: string | null
    utm_medium?: string | null
    utm_campaign?: string | null
    utm_content?: string | null
    utm_term?: string | null
  }
  RESUME_SHARE_CTA_CLICK: {
    shareId: string
    templateId: string
    target?: string
    source?: string
    utm_source?: string | null
    utm_medium?: string | null
    utm_campaign?: string | null
    utm_content?: string | null
    utm_term?: string | null
  }
  TOPUP_CLICK: Record<string, unknown>
  TOPUP_WAITLIST_SUBMIT: { emailHash: string; emailDomain?: string }
  RAG_QUERY_COMPLETED: {
    category?: string
    topK?: number
    minScore?: number
    matchedCount?: number
    lang?: string
  }

  // Deprecated aliases kept for backward compatibility
  TASK_FAILED: Record<string, unknown>
  WORKER_JOB_COMPLETED: Record<string, unknown>
  ASSET_UPLOADED: Record<string, unknown>
  RESUME_UPLOAD_COMPLETED: Record<string, unknown>
  CUSTOMIZE_COMPLETED: Record<string, unknown>
  RESUME_SHARE_CONVERT: Record<string, unknown>
}

export type AnalyticsEventName = keyof AnalyticsEventMap

const payloadSchemas: Record<AnalyticsEventName, z.ZodTypeAny> = {
  TASK_ENQUEUED: z.object({
    templateId: z.string().max(100).optional(),
    kind: taskKindSchema.optional(),
    queueId: z.string().max(64).optional(),
    messageId: z.string().max(128).optional(),
    idemKey: z.string().max(128).optional(),
    isFree: z.boolean().optional(),
  }),
  TASK_REPLAYED: z.object({
    templateId: z.string().max(100).optional(),
    kind: taskKindSchema.optional(),
    idemKey: z.string().max(128).optional(),
  }),
  TASK_BACKPRESSURED: z.object({
    templateId: z.string().max(100).optional(),
    kind: taskKindSchema.optional(),
    queueId: z.string().max(64).optional(),
    pending: z.number().int().nonnegative().optional(),
    maxSize: z.number().int().positive().optional(),
    retryAfter: z.number().int().positive().optional(),
  }),
  TASK_ENQUEUE_FAILED: z.object({
    templateId: z.string().max(100).optional(),
    kind: taskKindSchema.optional(),
    queueId: z.string().max(64).optional(),
    error: z.string().max(300).optional(),
  }),
  WORKER_JOB_STARTED: z.object({
    templateId: z.string().max(100).optional(),
    queueWaitTime: z.number().int().optional(),
    enqueuedAt: z.number().int().optional(),
    startedAt: z.number().int().optional(),
  }),
  WORKER_JOB_FINISHED: z.object({
    templateId: z.string().max(100).optional(),
    kind: taskKindSchema.optional(),
    success: z.boolean().optional(),
    reason: z.string().max(120).optional(),
    error: z.string().max(300).optional(),
  }),
  WORKER_GUARDS_BLOCKED: z.object({
    reason: z.string().max(120),
    templateId: z.string().max(100).optional(),
    kind: taskKindSchema.optional(),
    retryAfter: z.number().int().positive().optional(),
    pending: z.number().int().nonnegative().optional(),
    maxSize: z.number().int().positive().optional(),
    retryCount: z.number().int().nonnegative().optional(),
    maxRetries: z.number().int().nonnegative().optional(),
    refunded: z.boolean().optional(),
  }),
  WORKER_PROVIDER_NOT_CONFIGURED: z.object({
    templateId: z.string().max(100).optional(),
    modelId: z.string().max(80).optional(),
    provider: z.string().max(40).optional(),
  }),
  USER_SIGNUP_COMPLETED: z.object({ method: z.string().max(40).optional() }),
  SERVICE_CREATED: z.object({
    isImage: z.boolean().optional(),
    isPaid: z.boolean().optional(),
    hasDetailedResume: z.boolean().optional(),
    acqTouch: z.enum(['first', 'last']).optional(),
    acqChannel: z.string().max(32).optional(),
    acqSource: z.string().max(80).nullable().optional(),
    acqMedium: z.string().max(80).nullable().optional(),
    acqCampaign: z.string().max(80).nullable().optional(),
    acqContent: z.string().max(120).nullable().optional(),
    acqTerm: z.string().max(120).nullable().optional(),
    acqReferrerDomain: z.string().max(128).optional(),
    acqShareId: z.string().max(120).nullable().optional(),
    acqSessionId: z.string().max(80).optional(),
    acqAnonymousId: z.string().max(80).optional(),
  }),
  LANDING_ATTRIBUTED: z.object({
    touch: z.enum(['first', 'last']),
    channel: z.string().max(32),
    landingPath: z.string().max(256).optional(),
    referrerDomain: z.string().max(128).optional(),
    utm_source: z.string().max(80).nullable().optional(),
    utm_medium: z.string().max(80).nullable().optional(),
    utm_campaign: z.string().max(80).nullable().optional(),
    utm_content: z.string().max(120).nullable().optional(),
    utm_term: z.string().max(120).nullable().optional(),
    src: z.string().max(24).nullable().optional(),
    shareId: z.string().max(120).nullable().optional(),
    anonymousId: z.string().max(80).optional(),
    sessionId: z.string().max(80).optional(),
  }),
  RESUME_UPLOAD_ACCEPTED: z.object({
    type: z.enum(['resume', 'detailed']).optional(),
    isFree: z.boolean().optional(),
    length: z.number().int().nonnegative().optional(),
  }),
  RESUME_PARSE_COMPLETED: z.object({
    templateId: z.enum(['resume_summary', 'detailed_resume_summary']),
    success: z.boolean(),
    failureCode: z.string().max(80).optional(),
  }),
  MATCH_GENERATED: z.object({
    matchScore: z.number().optional(),
    jobId: z.string().max(80).optional(),
    resumeId: z.string().max(80).optional(),
  }),
  MATCH_FAILED: z.object({
    failureCode: z.string().max(80).optional(),
    reason: z.string().max(300).optional(),
  }),
  CUSTOMIZE_SESSION_STARTED: z.object({
    serviceId: z.string().max(80).optional(),
  }),
  CUSTOMIZE_GENERATED: z.object({
    success: z.boolean(),
    reason: z.string().max(300).optional(),
  }),
  CUSTOMIZE_SAVE_CLICKED: z.object({
    serviceId: z.string().max(80).optional(),
  }),
  CUSTOMIZE_EXPORT_CLICKED: z.object({
    serviceId: z.string().max(80).optional(),
    markdownLength: z.number().int().nonnegative().optional(),
  }),
  CUSTOMIZE_SHARE_CLICKED: z.object({
    shareId: z.string().max(120),
    templateId: z.string().max(60).optional(),
    source: z.string().max(24).optional(),
    shareMethod: z.string().max(40).optional(),
  }),
  INTERVIEW_SESSION_STARTED: z.object({ interviewId: z.string().max(80).optional() }),
  INTERVIEW_COMPLETED: z.object({ interviewId: z.string().max(80).optional() }),
  INTERVIEW_FAILED: z.object({
    interviewId: z.string().max(80).optional(),
    reason: z.string().max(300).optional(),
  }),
  INTERVIEW_MESSAGE_SENT: z.object({
    role: z.enum(['user', 'ai']).optional(),
    length: z.number().int().nonnegative().optional(),
  }),
  RESUME_SHARE_VIEW: z.object({
    shareId: z.string().max(120),
    templateId: z.string().max(60),
    source: z.string().max(24).optional(),
    referrerDomain: z.string().max(128).optional(),
    utm_source: z.string().max(80).nullable().optional(),
    utm_medium: z.string().max(80).nullable().optional(),
    utm_campaign: z.string().max(80).nullable().optional(),
    utm_content: z.string().max(120).nullable().optional(),
    utm_term: z.string().max(120).nullable().optional(),
  }),
  RESUME_SHARE_CTA_CLICK: z.object({
    shareId: z.string().max(120),
    templateId: z.string().max(60),
    target: z.string().max(64).optional(),
    source: z.string().max(24).optional(),
    utm_source: z.string().max(80).nullable().optional(),
    utm_medium: z.string().max(80).nullable().optional(),
    utm_campaign: z.string().max(80).nullable().optional(),
    utm_content: z.string().max(120).nullable().optional(),
    utm_term: z.string().max(120).nullable().optional(),
  }),
  TOPUP_CLICK: genericPayloadSchema,
  TOPUP_WAITLIST_SUBMIT: z.object({
    emailHash: z.string().max(128),
    emailDomain: z.string().max(120).optional(),
  }),
  RAG_QUERY_COMPLETED: z.object({
    category: z.string().max(80).optional(),
    topK: z.number().int().positive().optional(),
    minScore: z.number().optional(),
    matchedCount: z.number().int().nonnegative().optional(),
    lang: z.enum(['zh', 'en']).optional(),
  }),
  TASK_FAILED: genericPayloadSchema,
  WORKER_JOB_COMPLETED: genericPayloadSchema,
  ASSET_UPLOADED: genericPayloadSchema,
  RESUME_UPLOAD_COMPLETED: genericPayloadSchema,
  CUSTOMIZE_COMPLETED: genericPayloadSchema,
  RESUME_SHARE_CONVERT: genericPayloadSchema,
}

export interface TrackContext<E extends AnalyticsEventName = AnalyticsEventName> {
  userId?: string
  serviceId?: string
  taskId?: string
  templateId?: string
  traceId?: string
  duration?: number | null
  category?: AnalyticsCategory
  source?: AnalyticsSource
  runtime?: AnalyticsRuntime
  queueKind?: AnalyticsQueueKind
  outcome?: AnalyticsOutcome
  errorCode?: string
  idempotencyKey?: string
  occurredAt?: Date
  payload?: AnalyticsEventMap[E]
}

const RESERVED_PAYLOAD_KEYS = new Set(['serviceId', 'taskId'])

function normalizePayload<E extends AnalyticsEventName>(
  eventName: E,
  ctx: TrackContext<E>,
): Record<string, unknown> {
  const base: Record<string, unknown> = {}
  if (ctx.serviceId) base['serviceId'] = ctx.serviceId
  if (ctx.taskId) base['taskId'] = ctx.taskId

  const schema = payloadSchemas[eventName]
  const parsed = schema.safeParse(ctx.payload || {})
  if (!parsed.success) {
    logInfo({
      reqId: 'analytics',
      route: 'analytics/trackEvent',
      phase: 'invalid_payload',
      eventName,
      error: parsed.error.flatten(),
    })
    return base
  }

  const payloadRecord = parsed.data as Record<string, unknown>
  for (const [key, value] of Object.entries(payloadRecord)) {
    if (RESERVED_PAYLOAD_KEYS.has(key)) continue
    base[key] = value
  }
  return base
}

function deriveQueueKind<E extends AnalyticsEventName>(
  ctx: TrackContext<E>,
  payload: Record<string, unknown>,
): AnalyticsQueueKind | undefined {
  if (ctx.queueKind) return ctx.queueKind
  const kind = payload['kind']
  if (kind === 'stream') return AnalyticsQueueKind.STREAM
  if (kind === 'batch') return AnalyticsQueueKind.BATCH
  return undefined
}

function deriveTemplateId<E extends AnalyticsEventName>(
  ctx: TrackContext<E>,
  payload: Record<string, unknown>,
): string | undefined {
  if (ctx.templateId) return ctx.templateId
  const fromPayload = payload['templateId']
  return typeof fromPayload === 'string' && fromPayload.length > 0
    ? fromPayload
    : undefined
}

/**
 * Unified analytics entrypoint.
 * Fire-and-forget, best effort, and never throws to business flow.
 */
export function trackEvent<E extends AnalyticsEventName>(
  eventName: E,
  ctx: TrackContext<E>,
): void {
  try {
    const payload = normalizePayload(eventName, ctx)
    const args: CreateAnalyticsEventParams = {
      eventName,
      payload,
    }
    if (ctx.userId) args.userId = ctx.userId
    if (ctx.serviceId) args.serviceId = ctx.serviceId
    if (ctx.taskId) args.taskId = ctx.taskId
    if (ctx.traceId) args.traceId = ctx.traceId
    if (ctx.duration !== undefined) args.duration = ctx.duration
    if (ctx.category) args.category = ctx.category
    if (ctx.source) args.source = ctx.source
    if (ctx.runtime) args.runtime = ctx.runtime
    if (ctx.outcome) args.outcome = ctx.outcome
    if (ctx.errorCode) args.errorCode = ctx.errorCode
    if (ctx.idempotencyKey) args.idempotencyKey = ctx.idempotencyKey
    if (ctx.occurredAt) args.occurredAt = ctx.occurredAt

    const templateId = deriveTemplateId(ctx, payload)
    if (templateId) args.templateId = templateId
    const queueKind = deriveQueueKind(ctx, payload)
    if (queueKind) args.queueKind = queueKind

    void createAnalyticsEvent(args)
  } catch (error) {
    logInfo({
      reqId: 'analytics',
      route: 'analytics/trackEvent',
      phase: 'track_event_failed',
      error: error instanceof Error ? error.message : String(error),
      eventName,
    })
  }
}
