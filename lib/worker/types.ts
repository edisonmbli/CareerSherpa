import { z } from 'zod'
import { i18n, type Locale } from '@/i18n-config'

const common = {
  taskId: z.string().min(1),
  userId: z.string().min(1),
  serviceId: z.string().min(1),
  locale: z.enum(i18n.locales as readonly [Locale, ...Locale[]]),
  enqueuedAt: z.number().optional(),
  retryCount: z.number().optional(),
}

const paidTier = z.enum(['paid', 'free']).optional()

const resumeSummaryVars = z.object({
  resumeId: z.string().min(1),
  wasPaid: z.boolean(),
  cost: z.number(),
  debitId: z.string().optional(),
  tierOverride: paidTier,
  prompt: z.string().optional(),
})

const detailedResumeSummaryVars = z.object({
  detailedResumeId: z.string().min(1),
  wasPaid: z.boolean(),
  cost: z.number(),
  debitId: z.string().optional(),
  tierOverride: paidTier,
  prompt: z.string().optional(),
})

const jobSummaryVars = z.object({
  jobId: z.string().min(1),
  image: z.string().optional(),
  job_text: z.string().optional(),
  wasPaid: z.boolean(),
  cost: z.number(),
  debitId: z.string().optional(),
  tierOverride: paidTier,
  prompt: z.string().optional(),
  executionSessionId: z.string().optional(),
})

const ocrExtractVars = z.object({
  jobId: z.string().min(1),
  image: z.string().optional(),
  source_type: z.string().optional(),
  wasPaid: z.boolean(),
  cost: z.number(),
  debitId: z.string().optional(),
  tierOverride: paidTier,
  executionSessionId: z.string().optional(),
})

const jobMatchVarsJson = z.object({
  rag_context: z.string(),
  resume_summary_json: z.string(),
  detailed_resume_summary_json: z.string().optional(),
  job_summary_json: z.string(),
  wasPaid: z.boolean(),
  cost: z.number(),
  debitId: z.string().optional(),
  tierOverride: paidTier,
  prompt: z.string().optional(),
  executionSessionId: z.string().optional(),
})

const jobMatchVarsIds = z.object({
  rag_context: z.string(),
  resumeId: z.string().min(1),
  detailedResumeId: z.string().min(1).optional(),
  jobId: z.string().min(1),
  wasPaid: z.boolean(),
  cost: z.number(),
  debitId: z.string().optional(),
  tierOverride: paidTier,
  prompt: z.string().optional(),
  executionSessionId: z.string().optional(),
})

const interviewPrepVars = z.object({
  interviewId: z.string().min(1),
  wasPaid: z.boolean(),
  cost: z.number(),
  debitId: z.string().optional(),
  tierOverride: paidTier,
  prompt: z.string().optional(),
})

const w1 = z.object({
  ...common,
  templateId: z.literal('resume_summary'),
  variables: resumeSummaryVars,
})
const w2 = z.object({
  ...common,
  templateId: z.literal('detailed_resume_summary'),
  variables: detailedResumeSummaryVars,
})
const w3 = z.object({
  ...common,
  templateId: z.literal('job_summary'),
  variables: jobSummaryVars,
})
const w6 = z.object({
  ...common,
  templateId: z.literal('ocr_extract'),
  variables: ocrExtractVars,
})
const w4 = z.object({
  ...common,
  templateId: z.literal('job_match'),
  variables: z.union([jobMatchVarsJson, jobMatchVarsIds]),
})
const w5 = z.object({
  ...common,
  templateId: z.literal('interview_prep'),
  variables: interviewPrepVars,
})

export const workerBodySchema = z.discriminatedUnion('templateId', [
  w1,
  w2,
  w3,
  w4,
  w5,
  w6,
])

export type WorkerBody = z.infer<typeof workerBodySchema>
