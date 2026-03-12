import { z } from 'zod'

export const feedbackTypeSchema = z.enum(['bug', 'feature', 'confusion'])

export const feedbackViewportSchema = z.object({
  width: z.number().int().min(1).max(10000),
  height: z.number().int().min(1).max(10000),
})

export const feedbackExtraValueSchema = z.union([
  z.string().max(300),
  z.number(),
  z.boolean(),
  z.null(),
])

export const feedbackContextSchema = z.object({
  locale: z.string().trim().min(2).max(12),
  surface: z.string().trim().min(2).max(32),
  tab: z.string().trim().max(32).optional(),
  serviceId: z.string().trim().max(128).optional(),
  taskId: z.string().trim().max(160).optional(),
  taskTemplateId: z.string().trim().max(64).optional(),
  status: z.string().trim().max(64).optional(),
  tier: z.enum(['free', 'paid']).optional(),
  taskTierHint: z.enum(['free', 'paid']).optional(),
  queueType: z.enum(['free', 'paid']).optional(),
  currentUrl: z.string().url().max(1200).optional(),
  pathname: z.string().trim().max(400).optional(),
  title: z.string().trim().max(240).optional(),
  sentryEventId: z.string().trim().max(128).optional(),
  posthogDistinctId: z.string().trim().max(128).optional(),
  posthogSessionId: z.string().trim().max(128).optional(),
  posthogReplayUrl: z.string().url().max(1600).optional(),
  timeZone: z.string().trim().max(64).optional(),
  userAgent: z.string().trim().max(1200).optional(),
  occurredAt: z.string().trim().max(64).optional(),
  viewport: feedbackViewportSchema.optional(),
  extras: z.record(z.string(), feedbackExtraValueSchema).optional(),
})

export const feedbackSubmissionSchema = z.object({
  type: feedbackTypeSchema,
  message: z.string().trim().min(3).max(2000),
  includeAccountEmail: z.boolean().default(true),
  context: feedbackContextSchema,
})

export const feedbackDispatchSchema = feedbackSubmissionSchema.extend({
  feedbackId: z.string().trim().min(6).max(64),
  submittedAt: z.string().trim().min(10).max(64),
  authUser: z.object({
    id: z.string().trim().min(1).max(128),
    email: z.string().trim().email().optional(),
  }),
})

export type FeedbackType = z.infer<typeof feedbackTypeSchema>
export type FeedbackSubmission = z.infer<typeof feedbackSubmissionSchema>
export type FeedbackDispatchPayload = z.infer<typeof feedbackDispatchSchema>
