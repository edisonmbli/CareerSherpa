import { z } from 'zod'
import type { TaskTemplateId } from '@/lib/prompts/types'
import { llmResumeResponseSchema } from '@/lib/types/resume-schema'

const linkSchema = z.object({
  label: z.string().optional(),
  url: z.string().optional(),
})
const headerSchema = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  linkedin: z.string().optional(),
  github: z.string().optional(),
  links: z.array(linkSchema).optional(),
})
const experienceItemSchema = z.object({
  role: z.string().optional(),
  company: z.string().optional(),
  duration: z.string().optional(),
  highlights: z.array(z.string()).optional(),
  stack: z.array(z.string()).optional(),
})
const projectItemSchema = z.object({
  name: z.string().optional(),
  link: z.string().optional(),
  description: z.string().optional(),
  highlights: z.array(z.string()).optional(),
})
const educationItemSchema = z.object({
  degree: z.string().optional(),
  school: z.string().optional(),
  duration: z.string().optional(),
  gpa: z.string().optional(),
  courses: z.array(z.string()).optional(),
})
const skillsUnionSchema = z.union([
  z.array(z.string()),
  z
    .object({
      technical: z.array(z.string()).optional(),
      soft: z.array(z.string()).optional(),
      tools: z.array(z.string()).optional(),
    })
    .partial(),
])
const certificationItemSchema = z.object({
  name: z.string().optional(),
  issuer: z.string().optional(),
  date: z.string().optional(),
})
const languageItemSchema = z.object({
  name: z.string().optional(),
  level: z.string().optional(),
  proof: z.string().optional(),
})
const awardItemSchema = z.object({
  name: z.string().optional(),
  issuer: z.string().optional(),
  date: z.string().optional(),
})
const openSourceItemSchema = z.object({
  name: z.string().optional(),
  link: z.string().optional(),
  highlights: z.array(z.string()).optional(),
})
const resumeSummarySchema = z
  .object({
    header: headerSchema.optional(),
    summary: z.string().optional(),
    summary_points: z.array(z.string()).optional(),
    specialties_points: z.array(z.string()).optional(),
    experience: z.array(experienceItemSchema).optional(),
    projects: z.array(projectItemSchema).optional(),
    education: z.array(educationItemSchema).optional(),
    skills: skillsUnionSchema.optional(),
    certifications: z.array(certificationItemSchema).optional(),
    languages: z.array(languageItemSchema).optional(),
    awards: z.array(awardItemSchema).optional(),
    openSource: z.array(openSourceItemSchema).optional(),
    extras: z.array(z.string()).optional(),
  })
  .refine(
    (d) =>
      Boolean(d.summary && String(d.summary).trim().length > 0) ||
      (Array.isArray(d.summary_points) && d.summary_points.length > 0) ||
      (Array.isArray(d.specialties_points) &&
        d.specialties_points.length > 0) ||
      (Array.isArray(d.experience) && d.experience.length > 0) ||
      (Array.isArray(d.projects) && d.projects.length > 0) ||
      (Array.isArray(d.education) && d.education.length > 0) ||
      Boolean(
        d.skills &&
        (Array.isArray(d.skills)
          ? d.skills.length > 0
          : (d.skills as any).technical?.length ||
          (d.skills as any).soft?.length ||
          (d.skills as any).tools?.length)
      ),
    { message: 'empty_resume_summary' }
  )

const detailedResumeV3Schema = z
  .object({
    header: headerSchema.optional(),
    summary: z.string().optional(),
    experiences: z
      .array(
        z.object({
          company: z.string().optional(),
          product_or_team: z.string().optional(),
          role: z.string().optional(),
          duration: z.string().optional(),
          keywords: z.array(z.string()).optional(),
          highlights: z.array(z.string()).optional(),
          projects: z
            .array(
              z.object({
                name: z.string().optional(),
                description: z.string().optional(),
                link: z.string().optional(),
                task: z.array(z.string()).optional(),
                actions: z.array(z.string()).optional(),
                results: z.array(z.string()).optional(),
                metrics: z
                  .array(
                    z.object({
                      label: z.string(),
                      value: z.union([z.number(), z.string()]),
                      unit: z.string().optional(),
                      period: z.string().optional(),
                    })
                  )
                  .optional(),
              })
            )
            .optional(),
          contributions: z.array(z.string()).optional(),
        })
      )
      .optional(),
    capabilities: z
      .array(z.object({ name: z.string(), points: z.array(z.string()) }))
      .optional(),
    education: z.array(educationItemSchema).optional(),
    skills: skillsUnionSchema.optional(),
    certifications: z.array(certificationItemSchema).optional(),
    languages: z.array(languageItemSchema).optional(),
    awards: z.array(awardItemSchema).optional(),
    openSource: z.array(openSourceItemSchema).optional(),
    extras: z.array(z.string()).optional(),
    summary_points: z.array(z.string()).optional(),
    specialties_points: z.array(z.string()).optional(),
    rawSections: z
      .array(z.object({ title: z.string(), points: z.array(z.string()) }))
      .optional(),
  })
  .refine(
    (d) =>
      (Array.isArray(d.experiences) &&
        d.experiences.length > 0 &&
        d.experiences.some(
          (e: any) =>
            (Array.isArray(e.highlights) && e.highlights.length > 0) ||
            (Array.isArray(e.projects) &&
              e.projects.length > 0 &&
              e.projects.some(
                (p: any) =>
                  (Array.isArray(p.task) && p.task.length > 0) ||
                  (Array.isArray(p.actions) && p.actions.length > 0) ||
                  (Array.isArray(p.results) && p.results.length > 0)
              ))
        )) ||
      (Array.isArray(d.capabilities) &&
        d.capabilities.length > 0 &&
        d.capabilities.some(
          (c: any) => Array.isArray(c.points) && c.points.length > 0
        )) ||
      (Array.isArray(d.education) && d.education.length > 0) ||
      Boolean(
        d.skills &&
        (Array.isArray(d.skills)
          ? d.skills.length > 0
          : (d.skills as any).technical?.length ||
          (d.skills as any).soft?.length ||
          (d.skills as any).tools?.length)
      ),
    { message: 'empty_detailed_resume_summary' }
  )

const jobSummarySchema = z.object({
  jobTitle: z.string(),
  company: z.string().optional(),
  mustHaves: z.array(z.string()).min(1),
  niceToHaves: z.array(z.string()).min(1),
})

// V2：新设计任务（match/customize/interview）
const jobMatchSchema = z.object({
  match_score: z.number().min(0).max(100),
  overall_assessment: z.string().min(1),
  strengths: z
    .array(
      z.object({
        point: z.string(),
        evidence: z.string(),
        section: z.string().optional(),
      })
    )
    .min(1),
  weaknesses: z
    .array(
      z.object({
        point: z.string(),
        evidence: z.string(),
        tip: z.object({
          interview: z.string(), // 面试应对
          resume: z.string(),    // 简历微调
        }),
        section: z.string().optional(),
      })
    )
    .min(1),
  cover_letter_script: z.object({
    H: z.string(),
    V: z.string(),
    C: z.string(),
  }),
  recommendations: z.array(z.string()).optional(),
})

// Resume customize now uses the structured schema from '@/lib/types/resume-schema'
const resumeCustomizeSchema = llmResumeResponseSchema

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

// OCR extraction schema (vision task)
const ocrExtractSchema = z.object({
  extracted_text: z.string().min(1),
  content_type: z.string().min(1),
  language: z.string().min(1),
  structure: z
    .object({
      has_tables: z.boolean(),
      has_lists: z.boolean(),
      sections: z.array(z.string()),
    })
    .default({ has_tables: false, has_lists: false, sections: [] }),
  confidence: z.number().min(0).max(1).optional(),
  notes: z.array(z.string()).optional(),
})

// 统一映射
const SCHEMA_MAP: Record<TaskTemplateId, z.ZodTypeAny> = {
  resume_summary: resumeSummarySchema,
  detailed_resume_summary: detailedResumeV3Schema,
  job_summary: jobSummarySchema,
  job_vision_summary: jobSummarySchema, // Free tier merged OCR + Summary (same output as job_summary)
  job_match: jobMatchSchema,
  resume_customize: resumeCustomizeSchema,
  resume_customize_lite: resumeCustomizeSchema, // Same schema as full customize
  interview_prep: interviewPrepSchema,
  ocr_extract: ocrExtractSchema,
  // 非生成型任务（嵌入/RAG流水线）占位
  rag_embedding: z.object({}),
}

export type TaskOutput<T extends TaskTemplateId> = z.infer<
  (typeof SCHEMA_MAP)[T]
>

export function getTaskSchema<T extends TaskTemplateId>(taskId: T) {
  return SCHEMA_MAP[taskId]
}
