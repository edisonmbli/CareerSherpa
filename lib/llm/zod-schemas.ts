import { z } from 'zod'
import type { TaskTemplateId } from '@/lib/prompts/types'

// V1: 复用原型的 summary 任务（resume/job/detailed_resume）
const resumeSummarySchema = z.object({
  header: z
    .object({
      name: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      linkedin: z.string().optional(),
      github: z.string().optional(),
    })
    .optional(),
  summary: z.string().optional(),
  experience: z
    .array(
      z.object({
        role: z.string().optional(),
        company: z.string().optional(),
        duration: z.string().optional(),
        achievements: z.array(z.string()).optional(),
      })
    )
    .optional(),
  skills: z
    .object({
      technical: z.array(z.string()).optional(),
      soft: z.array(z.string()).optional(),
      tools: z.array(z.string()).optional(),
    })
    .optional(),
  highlights: z.array(z.string()).optional(),
})

const detailedResumeSummarySchema = z.object({
  timeline: z
    .array(
      z.object({
        time: z.string().optional(),
        event: z.string().optional(),
        details: z.array(z.string()).optional(),
      })
    )
    .optional(),
  projects: z
    .array(
      z.object({
        name: z.string().optional(),
        description: z.string().optional(),
        impact: z.array(z.string()).optional(),
      })
    )
    .optional(),
  certificates: z.array(z.string()).optional(),
  publications: z.array(z.string()).optional(),
})

const jobSummarySchema = z.object({
  company: z.string().optional(),
  title: z.string().optional(),
  location: z.string().optional(),
  requirements: z.array(z.string()).optional(),
  responsibilities: z.array(z.string()).optional(),
  benefits: z.array(z.string()).optional(),
  company_values: z.array(z.string()).optional(),
})

// V2：新设计任务（match/customize/interview）
const jobMatchSchema = z.object({
  match_score: z.number().min(0).max(100),
  reasons: z.array(z.string()).min(1),
  gaps: z.array(z.string()).optional(),
  fixes: z.array(z.string()).optional(),
  risk_assessment: z.string().optional(),
})

const resumeCustomizeSchema = z.object({
  markdown: z.string().min(1),
})

const interviewPrepSchema = z.object({
  self_introduction_script: z.string().min(1),
  potential_questions: z
    .array(
      z.object({
        question: z.string(),
        answer_guideline: z.string(),
      })
    )
    .min(1),
  reverse_questions: z.array(z.string()).min(1),
})

// 统一映射
const SCHEMA_MAP: Record<TaskTemplateId, z.ZodTypeAny> = {
  resume_summary: resumeSummarySchema,
  detailed_resume_summary: detailedResumeSummarySchema,
  job_summary: jobSummarySchema,
  job_match: jobMatchSchema,
  resume_customize: resumeCustomizeSchema,
  interview_prep: interviewPrepSchema,
}

export type TaskOutput<T extends TaskTemplateId> = z.infer<(typeof SCHEMA_MAP)[T]>

export function getTaskSchema<T extends TaskTemplateId>(taskId: T) {
  return SCHEMA_MAP[taskId]
}