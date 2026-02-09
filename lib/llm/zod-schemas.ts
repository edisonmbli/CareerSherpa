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
// Fixed: Use object structure only (no union) for Gemini responseSchema compatibility
const skillsSchema = z.object({
  technical: z.array(z.string()).optional(),
  soft: z.array(z.string()).optional(),
  tools: z.array(z.string()).optional(),
  // Fallback for skills that don't fit above categories
  other: z.array(z.string()).optional(),
})
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
    skills: skillsSchema.optional(),
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
        ((d.skills as any).technical?.length ||
          (d.skills as any).soft?.length ||
          (d.skills as any).tools?.length ||
          (d.skills as any).other?.length),
      ),
    { message: 'empty_resume_summary' },
  )

// V4: Flattened schema for Gemini compatibility (max 3 levels nesting)
// Changes from V3:
// - experiences[].projects[].metrics[] (5 levels) → experiences[].metrics[] (3 levels)
// - experiences[].projects[].task[] → merged into highlights[]
// - capabilities[].points[] (3 levels) → capabilities[] (2 levels)
// This is now unified for both Free tier (Gemini) and Paid tier (DeepSeek)
const detailedResumeV4Schema = z
  .object({
    header: headerSchema.optional(),
    summary: z.string().optional(),

    // Flattened experiences (max 3 levels: root → experiences[] → {properties})
    experiences: z
      .array(
        z.object({
          company: z.string().optional(),
          product_or_team: z.string().optional(),
          role: z.string().optional(),
          duration: z.string().optional(),
          keywords: z.array(z.string()).optional(),
          // All project highlights, tasks, actions merged into flat list
          highlights: z.array(z.string()).optional(),
          // Metrics formatted as strings: "提升响应时间 40%"
          metrics: z.array(z.string()).optional(),
          // Keep contributions as flat array
          contributions: z.array(z.string()).optional(),
        }),
      )
      .optional(),

    // Flattened capabilities (2 levels instead of 3)
    // Each string is a capability point like "精通 React 生态系统"
    capabilities: z.array(z.string()).optional(),

    // These are already 2-3 levels, no change needed
    education: z.array(educationItemSchema).optional(),
    skills: skillsSchema.optional(),
    certifications: z.array(certificationItemSchema).optional(),
    languages: z.array(languageItemSchema).optional(),
    awards: z.array(awardItemSchema).optional(),
    openSource: z.array(openSourceItemSchema).optional(),
    extras: z.array(z.string()).optional(),
    summary_points: z.array(z.string()).optional(),
    specialties_points: z.array(z.string()).optional(),

    // Keep rawSections for flexibility, but simplified
    rawSections: z
      .array(
        z.object({
          title: z.string().optional(),
          points: z.array(z.string()).optional(),
        }),
      )
      .optional(),
  })
  .refine(
    (d) =>
      // Simplified refine: check if ANY meaningful content exists
      Boolean(d.summary && String(d.summary).trim().length > 0) ||
      (Array.isArray(d.summary_points) && d.summary_points.length > 0) ||
      (Array.isArray(d.experiences) && d.experiences.length > 0) ||
      (Array.isArray(d.capabilities) && d.capabilities.length > 0) ||
      (Array.isArray(d.education) && d.education.length > 0) ||
      (Array.isArray(d.rawSections) && d.rawSections.length > 0) ||
      Boolean(
        d.skills &&
        ((d.skills as any).technical?.length ||
          (d.skills as any).soft?.length ||
          (d.skills as any).tools?.length ||
          (d.skills as any).other?.length),
      ),
    { message: 'empty_detailed_resume_summary' },
  )

// [NEW] Deep Schema for Paid Tier / DeepSeek (supports nested projects)
// Extends V4 logic but restores rich project structure
export const detailedResumeDeepSchema = z
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
          metrics: z.array(z.string()).optional(),
          // Nested projects for DeepSeek R1
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
                    }),
                  )
                  .optional(),
                highlights: z.array(z.string()).optional(),
              }),
            )
            .optional(),

          contributions: z.array(z.string()).optional(),
        }),
      )
      .optional(),
    // [PATCH] Allow rich capabilities (object with name/points) to match prompt instruction
    capabilities: z
      .array(
        z.union([
          z.string(),
          z.object({
            name: z.string().optional(),
            points: z.array(z.string()).optional(),
          }),
        ]),
      )
      .optional(),
    education: z.array(educationItemSchema).optional(),
    // [PATCH] Allow skills to be simple array OR structured object
    skills: z.union([z.array(z.string()), skillsSchema]).optional(),
    certifications: z.array(certificationItemSchema).optional(),
    languages: z.array(languageItemSchema).optional(),
    awards: z.array(awardItemSchema).optional(),
    openSource: z.array(openSourceItemSchema).optional(),
    extras: z.array(z.string()).optional(),
    summary_points: z.array(z.string()).optional(),
    specialties_points: z.array(z.string()).optional(),
    rawSections: z
      .array(
        z.object({
          title: z.string().optional(),
          points: z.array(z.string()).optional(),
        }),
      )
      .optional(),
  })
  .refine(
    (d) => Boolean(d.summary || d.experiences?.length || d.education?.length),
    { message: 'empty_detailed_resume_summary' },
  )

const jobSummarySchema = z.object({
  jobTitle: z.string(),
  company: z.string(),
  department: z.string(),
  team: z.string(),
  seniority: z.string(),
  salaryRange: z.string(),
  reportingLine: z.string(),
  responsibilities: z.array(z.string()),
  mustHaves: z.array(z.string()),
  niceToHaves: z.array(z.string()),
  techStack: z.array(z.string()),
  tools: z.array(z.string()),
  methodologies: z.array(z.string()),
  domainKnowledge: z.array(z.string()),
  industry: z.array(z.string()),
  education: z.array(z.string()),
  experience: z.array(z.string()),
  certifications: z.array(z.string()),
  languages: z.array(z.string()),
  softSkills: z.array(z.string()),
  businessGoals: z.array(z.string()),
  relocation: z.string(),
  companyInfo: z.string(),
  otherRequirements: z.array(z.string()),
  rawSections: z.array(
    z.object({
      title: z.string(),
      points: z.array(z.string()),
    }),
  ),
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
      }),
    )
    .min(1),
  weaknesses: z
    .array(
      z.object({
        point: z.string(),
        evidence: z.string(),
        tip: z.object({
          interview: z.string(), // 面试应对
          resume: z.string(), // 简历微调
        }),
        section: z.string().optional(),
      }),
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
      }),
    )
    .min(1),
  reverse_questions: z.array(z.string()).min(1),
})

const interviewPrepV2Schema = z.object({
  radar: z.object({
    core_challenges: z
      .array(
        z.object({
          challenge: z.string(),
          why_important: z.string(),
          your_angle: z.string(),
        }),
      )
      .min(1),
    interview_rounds: z
      .array(
        z.object({
          round_name: z.string(),
          interviewer_role: z.string(),
          focus_points: z.array(z.string()).min(1),
        }),
      )
      .min(1),
    hidden_requirements: z.array(z.string()).min(1),
  }),
  hook: z.object({
    ppf_script: z.string(),
    key_hooks: z
      .array(
        z.object({
          hook: z.string(),
          evidence_source: z.string(),
        }),
      )
      .min(1),
    delivery_tips: z.array(z.string()).min(1),
  }),
  evidence: z
    .array(
      z.object({
        story_title: z.string(),
        matched_pain_point: z.string(),
        star: z.object({
          situation: z.string(),
          task: z.string(),
          action: z.string(),
          result: z.string(),
        }),
        quantified_impact: z.string(),
        source: z.enum(['resume', 'detailed_resume']),
      }),
    )
    .min(1),
  defense: z
    .array(
      z.object({
        weakness: z.string(),
        anticipated_question: z.string(),
        defense_script: z.string(),
        supporting_evidence: z.string(),
      }),
    )
    .min(1),
  reverse_questions: z
    .array(
      z.object({
        question: z.string(),
        ask_intent: z.string(),
        listen_for: z.string(),
      }),
    )
    .min(1),
  knowledge_refresh: z
    .array(
      z.object({
        topic: z.string(),
        key_points: z.array(z.string()).min(1),
        relevance: z.string(),
      }),
    )
    .optional(),
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

const preMatchAuditSchema = z.object({
  risks: z.array(
    z.object({
      risk_point: z.string(),
      severity: z.enum(['HIGH', 'MEDIUM', 'LOW']),
      reasoning: z.string(),
    }),
  ),
  overall_risk_level: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'SAFE']),
  audit_summary: z.string(),
})

// 统一映射
const SCHEMA_MAP: Record<TaskTemplateId, z.ZodTypeAny> = {
  resume_summary: resumeSummarySchema,
  detailed_resume_summary: detailedResumeV4Schema,
  job_summary: jobSummarySchema,
  job_vision_summary: jobSummarySchema, // Free tier merged OCR + Summary (same output as job_summary)
  job_match: jobMatchSchema,
  resume_customize: resumeCustomizeSchema,
  // resume_customize_lite: resumeCustomizeSchema, // [DEPRECATED] Same schema as full customize
  interview_prep: interviewPrepV2Schema,
  ocr_extract: ocrExtractSchema,
  pre_match_audit: preMatchAuditSchema,
  // 非生成型任务（嵌入/RAG流水线）占位
  rag_embedding: z.object({}),
}

export type TaskOutput<T extends TaskTemplateId> = z.infer<
  (typeof SCHEMA_MAP)[T]
>

export function getTaskSchema<T extends TaskTemplateId>(taskId: T) {
  return SCHEMA_MAP[taskId]
}
