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

export const resumeSummaryVars = z.object({
  resumeId: z.string().min(1),
  wasPaid: z.boolean(),
  cost: z.number(),
  debitId: z.string().optional(),
  tierOverride: paidTier,
  prompt: z.string().optional(),
})

export const detailedResumeSummaryVars = z.object({
  detailedResumeId: z.string().min(1),
  wasPaid: z.boolean(),
  cost: z.number(),
  debitId: z.string().optional(),
  tierOverride: paidTier,
  prompt: z.string().optional(),
})

export const jobSummaryVars = z.object({
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

export const ocrExtractVars = z.object({
  jobId: z.string().min(1),
  image: z.string().optional(),
  source_type: z.string().optional(),
  wasPaid: z.boolean(),
  cost: z.number(),
  debitId: z.string().optional(),
  tierOverride: paidTier,
  executionSessionId: z.string().optional(),
})

export const jobMatchVarsJson = z.object({
  rag_context: z.string(),
  resume_summary_json: z.string(),
  detailed_resume_summary_json: z.string().optional(),
  job_summary_json: z.string(),
  pre_match_risks: z.string().optional(),
  wasPaid: z.boolean(),
  cost: z.number(),
  debitId: z.string().optional(),
  tierOverride: paidTier,
  prompt: z.string().optional(),
  executionSessionId: z.string().optional(),
})

export const jobMatchVarsIds = z.object({
  rag_context: z.string(),
  resumeId: z.string().min(1),
  detailedResumeId: z.string().min(1).optional(),
  jobId: z.string().min(1),
  pre_match_risks: z.string().optional(),
  wasPaid: z.boolean(),
  cost: z.number(),
  debitId: z.string().optional(),
  tierOverride: paidTier,
  prompt: z.string().optional(),
  executionSessionId: z.string().optional(),
})

export const resumeCustomizeVars = z.object({
  serviceId: z.string().min(1),
  wasPaid: z.boolean(),
  cost: z.number(),
  debitId: z.string().optional(),
  tierOverride: paidTier,
  prompt: z.string().optional(),
  executionSessionId: z.string().optional(),
})

export const interviewPrepVars = z.object({
  interviewId: z.string().min(1),
  wasPaid: z.boolean(),
  cost: z.number(),
  debitId: z.string().optional(),
  tierOverride: paidTier,
  prompt: z.string().optional(),
})

export const preMatchAuditVars = z.object({
  resume_summary_json: z.string(),
  job_summary_json: z.string(),
  nextTaskId: z.string(),
  serviceId: z.string(),
  resumeId: z.string(),
  detailedResumeId: z.string().optional(),
  jobId: z.string(),
  wasPaid: z.boolean(),
  cost: z.number(),
  debitId: z.string().optional(),
  tierOverride: paidTier,
  executionSessionId: z.string().optional(),
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
const w7 = z.object({
  ...common,
  templateId: z.literal('resume_customize'),
  variables: resumeCustomizeVars,
})
// Phase 1.5: Free tier merged OCR + Job Summary
const w8 = z.object({
  ...common,
  templateId: z.literal('job_vision_summary'),
  variables: jobSummaryVars, // Same variables as job_summary (uses image field)
})
const w9 = z.object({
  ...common,
  templateId: z.literal('pre_match_audit'),
  variables: preMatchAuditVars,
})

export const workerBodySchema = z.discriminatedUnion('templateId', [
  w1,
  w2,
  w3,
  w4,
  w5,
  w6,
  w7,
  w8,
  w9,
])

export type WorkerBody = z.infer<typeof workerBodySchema>
export type ResumeSummaryVars = z.infer<typeof resumeSummaryVars>
export type JobSummaryVars = z.infer<typeof jobSummaryVars>
export type OcrExtractVars = z.infer<typeof ocrExtractVars>
export type JobMatchVars =
  | z.infer<typeof jobMatchVarsJson>
  | z.infer<typeof jobMatchVarsIds>
export type ResumeCustomizeVars = z.infer<typeof resumeCustomizeVars>
export type InterviewPrepVars = z.infer<typeof interviewPrepVars>
