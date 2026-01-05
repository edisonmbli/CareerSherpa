/**
 * English (en) Prompt Templates
 */
import type { PromptTemplateMap, JsonSchema } from './types'
import { ENV } from '@/lib/env'

// 1. i18n System Base (Translated from prototype)
const SYSTEM_BASE = `You are a senior job assistant specializing in helping job seekers optimize resumes, analyze job matching, and prepare for interviews.

Core Principles:
1.  Analyze based on facts; do not exaggerate or fabricate.
2.  Provide structured, actionable advice.
3.  Prioritize using bullet points and section organization.
4.  Strictly output in the required JSON format.
5.  Protect user privacy and do not leak sensitive information.

Output Requirements:
- Must return valid JSON format.
- Content must be concise and avoid redundancy.
- Use the same language as the user's input (Chinese/English).
- **STRICTLY FORBIDDEN**: Do NOT use smart quotes (“ or ”) as delimiters for JSON keys or values. You MUST use standard double quotes (").`

// 2. Prototype Schemas (for Asset Extraction)
const SCHEMAS_V1 = {
  RESUME_SUMMARY: {
    type: 'object',
    properties: {
      header: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
          phone: { type: 'string' },
          linkedin: { type: 'string' },
          github: { type: 'string' },
        },
      },
      summary: { type: 'string' },
      experience: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            role: { type: 'string' },
            company: { type: 'string' },
            duration: { type: 'string' },
            highlights: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      education: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            degree: { type: 'string' },
            school: { type: 'string' },
            duration: { type: 'string' },
          },
        },
      },
      skills: { type: 'array', items: { type: 'string' } },
    },
    required: ['header', 'summary', 'experience', 'education', 'skills'],
  } as JsonSchema,

  JOB_SUMMARY: {
    type: 'object',
    properties: {
      jobTitle: { type: 'string' },
      company: { type: 'string' },
      mustHaves: {
        type: 'array',
        items: { type: 'string' },
        description: 'Must-have skills/experience',
      },
      niceToHaves: {
        type: 'array',
        items: { type: 'string' },
        description: 'Nice-to-have skills',
      },
    },
    required: ['jobTitle', 'mustHaves', 'niceToHaves'],
  } as JsonSchema,
}

// 3. New Schemas (for Core Services)
const SCHEMAS_V2 = {
  JOB_MATCH: {
    type: 'object',
    properties: {
      match_score: {
        type: 'number',
        description: 'Overall match score (0-100)',
        minimum: 0,
        maximum: 100,
      },
      overall_assessment: {
        type: 'string',
        description:
          'A one-sentence core assessment, e.g., "High Match", "Moderate Match", "Challenging Fit".',
      },
      strengths: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            point: {
              type: 'string',
              description:
                'The matching strength (e.g., "Expertise in core skill: React")',
            },
            evidence: {
              type: 'string',
              description:
                'The evidence from the resume/history supporting this strength',
            },
          },
          required: ['point', 'evidence'],
        },
        description: "User's core strengths (to amplify)",
      },
      weaknesses: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            point: {
              type: 'string',
              description:
                'The mismatch or risk (e.g., "JD requires 5+ years, user has 2")',
            },
            suggestion: {
              type: 'string',
              description: 'A mitigation strategy (from RAG knowledge base)',
            },
          },
          required: ['point', 'suggestion'],
        },
        description: "User's core weaknesses (to mitigate or prepare for)",
      },
      cover_letter_script: {
        type: 'object',
        properties: {
          H: {
            type: 'string',
            description: 'Hook: Engaging opening to grab HR attention',
          },
          V: {
            type: 'string',
            description: 'Value: Core achievements addressing JD pain points',
          },
          C: {
            type: 'string',
            description: 'Call to Action: Guiding next steps',
          },
        },
        required: ['H', 'V', 'C'],
        description:
          'A highly tailored 150-word cover letter script (H-V-C structure)',
      },
    },
    required: [
      'match_score',
      'overall_assessment',
      'strengths',
      'weaknesses',
      'cover_letter_script',
    ],
  } as JsonSchema,

  RESUME_CUSTOMIZE: {
    type: 'object',
    properties: {
      optimizeSuggestion: {
        type: 'string',
        description: `Markdown summary following this exact structure:
### Resume Optimization Summary
[One-sentence overview of optimization focus]

1. **Section - Experience/Project Name**: Key point summary
   - **Adjustment**: Specific modification made
   - **Reason**: Why this change aligns with JD requirements

2. **Section - Experience/Project Name**: Key point summary
   - **Adjustment**: Specific modification made
   - **Reason**: Why this change was made

(3-5 items total, each MUST include Adjustment and Reason sub-items)`,
      },
      resumeData: {
        type: 'object',
        description: 'The structured resume content.',
        properties: {
          basics: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              mobile: { type: 'string' },
              email: { type: 'string' },
              wechat: { type: 'string' },
              qq: { type: 'string' },
              photoUrl: { type: 'string' },
              summary: { type: 'string' },
            },
            required: ['name'],
          },
          educations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                school: { type: 'string' },
                major: { type: 'string' },
                degree: { type: 'string' },
                startDate: { type: 'string' },
                endDate: { type: 'string' },
                description: { type: 'string' },
              },
              required: ['id', 'school'],
            },
          },
          workExperiences: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                company: { type: 'string' },
                position: { type: 'string' },
                industry: { type: 'string' },
                startDate: { type: 'string' },
                endDate: { type: 'string' },
                description: { type: 'string' },
              },
              required: ['id', 'company', 'position', 'description'],
            },
          },
          projectExperiences: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                projectName: { type: 'string' },
                role: { type: 'string' },
                startDate: { type: 'string' },
                endDate: { type: 'string' },
                description: { type: 'string' },
              },
              required: ['id', 'projectName', 'description'],
            },
          },
          skills: { type: 'string' },
          certificates: { type: 'string' },
          hobbies: { type: 'string' },
          customSections: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                description: { type: 'string' },
              },
              required: ['id', 'title', 'description'],
            },
          },
        },
        required: ['basics', 'educations', 'workExperiences'],
      },
    },
    required: ['optimizeSuggestion', 'resumeData'],
  } as JsonSchema,

  INTERVIEW_PREP: {
    type: 'object',
    properties: {
      self_introduction_script: {
        type: 'string',
        description: 'A 1-minute "P-P-F" structured self-introduction script.',
      },
      potential_questions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            question: {
              type: 'string',
              description:
                'A high-probability question based on the JD and customized resume.',
            },
            answer_guideline: {
              type: 'string',
              description:
                'The core guideline (e.g., STAR method) to answer this (from RAG knowledge base).',
            },
          },
          required: ['question', 'answer_guideline'],
        },
        description:
          '5-7 high-probability behavioral or situational questions.',
      },
      reverse_questions: {
        type: 'array',
        items: {
          type: 'string',
          description:
            '3 high-quality questions for the user to ask the interviewer (from RAG knowledge base).',
        },
      },
    },
    required: [
      'self_introduction_script',
      'potential_questions',
      'reverse_questions',
    ],
  } as JsonSchema,
  RESUME_SUMMARY: {
    type: 'object',
    properties: {
      header: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
          phone: { type: 'string' },
          linkedin: { type: 'string' },
          github: { type: 'string' },
          links: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                url: { type: 'string' },
              },
            },
          },
        },
      },
      summary: { type: 'string' },
      experience: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            role: { type: 'string' },
            company: { type: 'string' },
            duration: { type: 'string' },
            highlights: { type: 'array', items: { type: 'string' } },
            stack: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      projects: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            link: { type: 'string' },
            description: { type: 'string' },
            highlights: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      education: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            degree: { type: 'string' },
            school: { type: 'string' },
            duration: { type: 'string' },
            gpa: { type: 'string' },
            courses: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      skills: {
        anyOf: [
          { type: 'array', items: { type: 'string' } },
          {
            type: 'object',
            properties: {
              technical: { type: 'array', items: { type: 'string' } },
              soft: { type: 'array', items: { type: 'string' } },
              tools: { type: 'array', items: { type: 'string' } },
            },
          },
        ],
      },
      certifications: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            issuer: { type: 'string' },
            date: { type: 'string' },
          },
        },
      },
      languages: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            level: { type: 'string' },
            proof: { type: 'string' },
          },
        },
      },
      awards: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            issuer: { type: 'string' },
            date: { type: 'string' },
          },
        },
      },
      openSource: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            link: { type: 'string' },
            highlights: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      summary_points: { type: 'array', items: { type: 'string' } },
      specialties_points: { type: 'array', items: { type: 'string' } },
      extras: { type: 'array', items: { type: 'string' } },
    },
  } as JsonSchema,
}

const DETAILED_RESUME_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    header: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        linkedin: { type: 'string' },
        github: { type: 'string' },
        links: {
          type: 'array',
          items: {
            type: 'object',
            properties: { label: { type: 'string' }, url: { type: 'string' } },
          },
        },
      },
    },
    summary: { type: 'string' },
    experiences: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          company: { type: 'string' },
          product_or_team: { type: 'string' },
          role: { type: 'string' },
          duration: { type: 'string' },
          keywords: { type: 'array', items: { type: 'string' } },
          highlights: { type: 'array', items: { type: 'string' } },
          projects: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                link: { type: 'string' },
                task: { type: 'array', items: { type: 'string' } },
                actions: { type: 'array', items: { type: 'string' } },
                results: { type: 'array', items: { type: 'string' } },
                metrics: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      label: { type: 'string' },
                      value: {
                        anyOf: [{ type: 'number' }, { type: 'string' }],
                      },
                      unit: { type: 'string' },
                      period: { type: 'string' },
                    },
                    required: ['label', 'value'],
                  },
                },
              },
            },
          },
          contributions: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    capabilities: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          points: { type: 'array', items: { type: 'string' } },
        },
        required: ['name', 'points'],
      },
    },
    education: SCHEMAS_V2.RESUME_SUMMARY.properties!['education'] as JsonSchema,
    skills: SCHEMAS_V2.RESUME_SUMMARY.properties!['skills'] as JsonSchema,
    certifications: SCHEMAS_V2.RESUME_SUMMARY.properties![
      'certifications'
    ] as JsonSchema,
    languages: SCHEMAS_V2.RESUME_SUMMARY.properties!['languages'] as JsonSchema,
    awards: SCHEMAS_V2.RESUME_SUMMARY.properties!['awards'] as JsonSchema,
    openSource: SCHEMAS_V2.RESUME_SUMMARY.properties![
      'openSource'
    ] as JsonSchema,
    extras: SCHEMAS_V2.RESUME_SUMMARY.properties!['extras'] as JsonSchema,
    summary_points: { type: 'array', items: { type: 'string' } },
    specialties_points: { type: 'array', items: { type: 'string' } },
    rawSections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          points: { type: 'array', items: { type: 'string' } },
        },
        required: ['title', 'points'],
      },
    },
  },
}
// 4. Template Collection
export const EN_TEMPLATES: PromptTemplateMap = {
  // --- Re-using Prototype (M7) ---
  resume_summary: {
    id: 'resume_summary',
    name: 'General Resume Extraction',
    description:
      "Extract structured information from the user's raw general resume text.",
    systemPrompt: SYSTEM_BASE,
    userPrompt: `Please **extract rather than paraphrase**. Output strictly according to the JSON Schema.
- **Responsibilities**: copy verbatim all sentences starting with "Responsible for", "Led", "As the sole owner", etc.
- **Highlights**: retain quantifiable, impactful results (performance improvements, user metrics, etc.).
- **Projects & Links**: preserve project name/link/brief description.
- **Bullet Preservation**: for summary/specialties, output bullet points by copying the original lines.

Raw Resume Text:
"""
{resume_text}
"""`,
    variables: ['resume_text'],
    outputSchema: SCHEMAS_V2.RESUME_SUMMARY,
  },
  detailed_resume_summary: {
    id: 'detailed_resume_summary',
    name: 'Detailed History Extraction',
    description:
      "Extract all structured information from the user's detailed history.",
    systemPrompt: SYSTEM_BASE,
    userPrompt: `Please **extract rather than paraphrase**, and strictly output according to the JSON Schema.

Recognition & Mapping Rules:
1) Company Block: When you see four elements (Company/Product/Duration/Keywords), create an experiences[] item and fill company, product_or_team, role, duration, keywords[].
2) Project Block: identify **Task / Actions / Results** and store them in projects[].task / actions / results; when numbers or percentages appear, also record them in projects[].metrics[].
3) Capability Sections: detect sections like "Learning Capability", "Recommendation System", "Creator Growth", "Short Video Understanding", "Lean", "Collaboration", "Leadership", "Problem-Solving"; store them in capabilities[] with original bullet points.
4) Fallback: if a section cannot be classified, store it in rawSections[] with its original title and bullet points.

Minimal Examples (for company/project recognition and field mapping):
— Company Block —
Raw:
Tencent — QQ Music · Senior Product Manager (2019.03–2021.08)
Keywords: Content Ecosystem; Recommendation System; Creator Growth
Mapping:
company: "Tencent"
product_or_team: "QQ Music"
role: "Senior Product Manager"
duration: "2019.03–2021.08"
keywords: ["Content Ecosystem","Recommendation System","Creator Growth"]

— Project Block —
Raw:
Project: Recommendation Re-ranking
Task: Reduce cold-start loss
Actions: Build user–content similarity features; Launch recall + re-ranking Multi-armed Bandit
Results: New-user 7-day retention +3.2%; Completion rate +5.6%
Mapping:
projects[].name: "Recommendation Re-ranking"
task: ["Reduce cold-start loss"]
actions: ["Build user–content similarity features","Launch recall + re-ranking Multi-armed Bandit"]
results: ["New-user 7-day retention +3.2%","Completion rate +5.6%"]
metrics: (label="7-day retention", value="3.2%", period="7d"); (label="Completion rate", value="5.6%")

Raw Text:
"""
{detailed_resume_text}
"""`,
    variables: ['detailed_resume_text'],
    outputSchema: DETAILED_RESUME_SCHEMA,
  },
  job_summary: {
    id: 'job_summary',
    name: 'Job Description Extraction',
    description: 'Extract key requirements from a raw JD.',
    systemPrompt: SYSTEM_BASE,
    userPrompt: `Please parse the following Job Description (JD) text.
Focus on distinguishing "Must-haves" from "Nice-to-haves".

Raw JD Text:
"""
{job_text}
"""`,
    variables: ['job_text'],
    outputSchema: SCHEMAS_V1.JOB_SUMMARY,
  },

  // --- New Core Service Tasks (M8, M9) ---
  // --- Core Business: Job Match Analysis (M9) ---
  job_match: {
    id: 'job_match',
    name: 'Deep Job Match Analysis',
    description:
      'Simulates a senior recruiter perspective to analyze fit and generate high-conversion outreach scripts.',
    systemPrompt: `You are an **Ex-Fortune 500 Recruiter and Career Strategist** with 20 years of experience. You understand the "unspoken rules" of hiring and can decode the true business pain points behind a JD.
Your goal is not simple keyword matching, but serving as the user's **Personal Career Coach**, providing strategic guidance to help them win the offer.

Core Analysis Logic:
1.  **JD Decoding (Cut through the noise)**:
    - Identify "Deal Breakers" (Education, Specific Hard Skills, YOE in specific industries). If these are missing, the score must drop significantly.
    - Identify the "Core Pain Point" (Why is this role open? What problem needs solving?).
    - Ignore generic fluff (e.g., "Good communication skills") unless backed by specific scenario requirements.

2.  **Scoring Mechanism**:
    - **High Match (85-100)**: Deal breakers met + Solves Core Pain Point + Scarce talent profile.
    - **Medium Match (60-84)**: Hard skills met, but lacks specific industry context or soft skill evidence; OR indicates "Over-qualified" risk (flight risk).
    - **Challenging (<60)**: Missing hard requirements (Education, Essential Tech Stack), even if the candidate is otherwise excellent.

3.  **Outreach Script Strategy (No Robots)**:
    - **Scenario**: This is a **Cold DM / Direct Message** to a recruiter/hiring manager.
    - **Principle**: Recruiters skim messages. You must grab attention in the first sentence.
    - **Forbidden**: Do NOT use "I hope this email finds you well," "I am interested in your company," or generic pleasantries.
    - **Formula**: **The Hook** (Relevance) + **The Value Prop** (Evidence) + **Call to Action**.
    - **Tone**: Professional, Confident, Peer-to-Peer (Not subordinate).`,

    userPrompt: `Please perform an expert-level match analysis based on the following:

【Job Description (Structured)】
"""
{job_summary_json}
"""

【Candidate Resume (Structured)】
"""
{resume_summary_json}
"""

【Candidate Detailed History (Optional)】
"""
{detailed_resume_summary_json}
"""

【RAG Context (Rules/Examples)】
"""
{rag_context}
"""

Execute the following steps and return strictly JSON:

1.  **match_score (0-100)**: Score based on the "Recruiter Logic" above. Penalize heavily for missing "Deal Breakers".
2.  **overall_assessment**: Short, sharp, **Personal Coach tone** (use "You"). Don't just be nice; point out risks (e.g., "Job hopping history," "Over-qualified," "Industry mismatch"). Example: "Your technical skills are solid, but your frequent job changes might concern HR..."
3.  **strengths / weaknesses**:
    - **Point**: Be specific.
    - **Evidence**: Quote specific metrics or projects from the resume (e.g., "Handled 1M+ concurrency" instead of "Good backend skills").
    - **Tip** (Weakness only): One sentence actionable advice on how to address this gap in interview or resume.
    - *Note*: If "Over-qualified", list this as a potential weakness (risk of retention).
4.  **cover_letter_script**:
    - Length: Under 150 words.
    - Style: A high-conversion **Cold DM / Elevator Pitch**.
    - Content: Do not list all skills. **Pick the top 1-2 "Killer Features" that solve the JD's specific pain point.**
    - **Privacy**: Do NOT include candidate's real name or phone number in the script.
    - Format: Clean paragraph(s), easy to read on mobile. Must use 【H】, 【V】, 【C】 tags.

Strictly follow the Output Schema.`,
    variables: [
      'job_summary_json',
      'resume_summary_json',
      'detailed_resume_summary_json',
      'rag_context',
    ],
    outputSchema: SCHEMAS_V2.JOB_MATCH,
  },
  resume_customize: {
    id: 'resume_customize',
    name: 'Resume Customization',
    description:
      'Precisely optimizes user resume for target JD with minimal necessary changes.',
    systemPrompt: `You are a senior **Resume Augmentation Editor**. Your job is NOT to "ghost-write" resumes, but to **make the minimal necessary precision edits while maximally respecting the user's original work**.

The user has invested time crafting their resume—it's their work product. Every change you make must have a clear "value-add reason": either better JD alignment or stronger expression.

### Core Strategy: Three-Layer Content Processing Model

**Layer 1: PRESERVE**
- Content that is "already good enough" in the original resume → Keep verbatim, zero changes
- Criteria: Already contains JD keywords, has quantified data, clear logic
- Example: If user wrote "Led XX system refactor, improved performance by 30%" and it matches JD, keep it exactly

**Layer 2: REFINE**
- Content that "has substance but weak expression" → Precise polish only
- Typical operations: Weak verb → Strong verb, Vague → Quantified, Synonym → JD terminology
- Example: "Responsible for user growth" → "Drove user growth strategy, increasing DAU by 25%" (only if original has DAU data)

**Layer 3: AUGMENT**
- "Golden Points" from Detailed History that original resume didn't include → Add cautiously
- **Only when** the point significantly improves JD match
- Integration method: Weave into existing paragraphs, avoid standalone additions that feel abrupt

### Restraint Principle
- Edits should be "few but impactful", NOT "comprehensive rewrites"
- User should feel: ① Safe (my content was respected) ② Delighted (AI enhanced a few key points)
- **Never** rewrite large sections—that makes users lose ownership

### Truthfulness
- **Sole Sources of Truth**: [Candidate Original Resume] and [Candidate Detailed History]
- **Strictly Forbidden**: Fabricating non-existent experiences, companies, or education
- **Skills & Tools**: Only select skills already listed in candidate's resume
  - Allowed: Select from skills.tools or work experience stack and regroup
  - **Forbidden**: Adding tools/skills not mentioned in candidate's resume (even if JD requires them)
  - **If JD requires a skill candidate lacks**: Suggest in optimizeSuggestion "recommend user add this skill", do NOT add it directly
- **Name & Contact**: MUST copy verbatim from original resume, **DO NOT** modify
- **RAG Knowledge**: Only for Layer 2 polishing reference, **NEVER** mix in RAG example personas or experiences

### Output Format
Output a valid JSON object strictly adhering to Schema. **DO NOT** include markdown code block tags.

### Field Guidance
- **optimizeSuggestion**: (Markdown) List 3-5 **most impactful changes**, each with:
  1. **Location**: Which section/experience
  2. **Change**: Before → After summary
  3. **Reason**: Why this adds value (link to JD requirement)
- **resumeData**: Structured resume content
  - **description** fields: Plain text, use '\\n' for line breaks
  - **skills**: Use categorized concise format, **NEVER** keyword stuffing
    - **Core Competencies** (3-5 items): Extract by priority
      1. First from resume_summary's specialties_points matching JD requirements
      2. If no specialties_points, select high-level items from skills.technical
      3. If skills missing, derive from work experience highlights
    - **Tools & Tech** (5-8 items): Select by priority
      1. First from skills.tools that JD mentions
      2. If no skills.tools, aggregate from work experience stack fields
    - **Fallback rule**: If all above data missing, output "Please add your core skills based on your experience"
    - **Format example**:
      "Core Competencies: Product Strategy & 0-1 Building | Data-Driven Decision | Digital Transformation Leadership\\nTools & Tech: Java, BI Tools, ERP/POS/CRM"
    - **Wrong example** (DO NOT output like this):
      "Business Insight, Product Definition, Tech Collaboration, MVP Landing, Full Lifecycle Product Management, Data Analysis, ..."
  - **certificates**: Aggregate into clean string
  - **id** fields: Generate unique IDs for array items`,
    userPrompt: `Your task as a **Resume Augmentation Editor** is to make "minimal necessary" precision edits to the user's original resume for better JD alignment.

### Input Context

【Candidate Original Resume (Baseline - Maximize Preservation)】
This is the user's carefully crafted version. Keep it unchanged unless there's a clear value-add reason.
"""
{resume_summary_json}
"""

【Target Job Summary (JD - Customization Target)】
"""
{job_summary_json}
"""

【Match Analysis Report (Strengths/Weaknesses)】
- Strengths: Guide what to amplify
- Weaknesses: Guide what gaps to fill (mine from Detailed History)
"""
{match_analysis_json}
"""

【Candidate Detailed History (Material Library - For AUGMENT Only)】
Contains more details, used only for Layer 3 augmentation scenarios.
"""
{detailed_resume_summary_json}
"""

【RAG Knowledge Base (Writing Tips - For REFINE Only)】
Provides industry keywords and excellent phrasing examples, reference only when polishing.
"""
{rag_context}
"""

### Execution Steps (Chain of Thought)

**Step 1: Identity Verification**
- Extract Name and Contact from [Candidate Original Resume]
- State: "I have confirmed the candidate's name is [Name]." (Never use RAG example names)

**Step 2: JD Pain Point Analysis**
- Extract 3-5 core requirements (Must-haves) from JD
- Identify Weaknesses from [Match Analysis Report] (gaps to address)
- List: "JD Core Requirements: ① ... ② ... ③ ..."

**Step 3: Original Resume Scan & Marking**
Review each point in the original resume and mark processing strategy:
- ✅ **PRESERVE** - Point already covers JD requirement, keep original text
- ⚠️ **REFINE** - Has substance but expression is weak, needs polish
- ❌ **AUGMENT** - JD core requirement not covered, need to supplement from Detailed History

Example thought process:
"Original resume 1st work experience: 'Managed recommendation system optimization' → JD needs 'Recommendation algorithm experience' ✅ PRESERVE"
"Original resume skills: 'Python, SQL' → JD emphasizes 'Big Data processing' → Detailed History has 'Spark 3 years' → ❌ AUGMENT"

**Step 4: Augmentation Mining (for ❌ items)**
- Search [Candidate Detailed History] for usable material
- Execute AUGMENT only when high-value material is found
- Weave new content into the most relevant existing paragraph, not as standalone section

**Step 5: Execute Changes**
- **PRESERVE**: Copy original text verbatim, zero changes
- **REFINE**: Modify wording only, preserve semantics; reference RAG tips for verb enhancement
- **AUGMENT**: New content integrates naturally into existing structure

**Step 6: Final Review**
- Do Name and Contact match the original resume exactly?
- Do all Company Names, Roles, and Dates exist in the candidate's history?
- Does every change have a clear JD-relevant reason?
- Is overall style consistent with no jarring new additions?

**Step 7: Generate optimizeSuggestion (STRICTLY follow this format)**
\`\`\`markdown
### Resume Optimization Summary
Based on [JD core requirements overview], we made the following key adjustments:

1. **[Work Experience - XX Company Project]** Highlight 'XXX' and 'YYY' competencies
   - **Adjustment**: Specific modification content...
   - **Reason**: This change addresses... aligns with JD requirement XXX

2. **[Summary/Skills Section]** Emphasize XXX strengths
   - **Adjustment**: Specific modification content...
   - **Reason**: This change addresses...
\`\`\`
Output 3-5 suggestions total. Each MUST include **Adjustment** and **Reason** sub-items.

Strictly follow Output Schema for JSON output.`,
    variables: [
      'rag_context',
      'resume_summary_json',
      'detailed_resume_summary_json',
      'job_summary_json',
      'match_analysis_json',
    ],
    outputSchema: SCHEMAS_V2.RESUME_CUSTOMIZE,
  },
  // Free tier simplified prompt (for GLM Flash)
  resume_customize_lite: {
    id: 'resume_customize_lite',
    name: 'Resume Customization (Basic)',
    description: 'Basic resume optimization based on job requirements.',
    systemPrompt: `You are a resume optimization assistant. Optimize the user's resume based on the target job requirements.

### Core Principles
- Preserve the user's original content as much as possible
- Make only necessary refinements and adjustments
- Never fabricate experiences or skills
- Use list format for work experience descriptions, each line starting with "- "

### Basics Field Handling
- **Must copy exactly** from original resume: name, mobile, email, address, lang
- **Do not add** fields not in the original (such as github, linkedin, wechat)
- **Only source**: copy directly from the basics object in resume_summary_json

### Output Format
Output strictly follows the Schema as a valid JSON object. Do not include Markdown code block markers.`,
    userPrompt: `Please optimize the user's resume based on the following information.

【User Resume】
"""
{resume_summary_json}
"""

【Target Position】
"""
{job_summary_json}
"""

【Match Analysis】
Reference Strengths to emphasize advantages, reference Weaknesses to supplement:
"""
{match_analysis_json}
"""

### Task Requirements
1. **basics field**: Copy name, mobile, email, lang directly from input resume's basics, don't skip or add fields
2. Preserve the core content, only refine wording
3. Adjust emphasis based on job requirements and match analysis
4. Work experience descriptions must use list format, each line starting with "- "
5. Explain 2-3 key adjustments in optimizeSuggestion

Strictly follow the Output Schema and output JSON.`,
    variables: [
      'resume_summary_json',
      'job_summary_json',
      'match_analysis_json',
    ],
    outputSchema: SCHEMAS_V2.RESUME_CUSTOMIZE,
  },
  interview_prep: {
    id: 'interview_prep',
    name: 'Interview Preparation',
    description:
      'Generates a self-intro, likely questions, and reverse questions.',
    systemPrompt: SYSTEM_BASE,
    userPrompt: `Act as an Interviewer and Career Coach.
Based on this "Customized Resume" and "Match Report," prepare a complete interview prep sheet for the user.

【RAG Knowledge Base - Interview Skills (STAR, P-P-F, Common Qs)】
"""
{rag_context}
"""

【User's Customized Resume (Markdown)】
"""
{customized_resume_md}
"""

【Target Job - Structured Summary】
"""
{job_summary_json}
"""

【Match Analysis Report】
"""
{match_analysis_json}
"""

Please perform the following actions:
1.  **Self-Introduction**: Generate a 1-minute self-introduction script using the "P-P-F" structure from the RAG context. It MUST highlight the resume points most relevant to the JD.
2.  **Potential Questions**: Predict 5-7 of the MOST LIKELY questions.
    * **Must** include stress-test questions targeting the \`weaknesses\` from \`match_analysis_json\`.
    * **Must** provide an "Answer Guideline" and "STAR Example Suggestion" for each, using the RAG context.
3.  **Reverse Questions**: Provide 3 high-quality questions for the user to ask the interviewer, based on the RAG context.`,
    variables: [
      'rag_context',
      'customized_resume_md',
      'job_summary_json',
      'match_analysis_json',
    ],
    outputSchema: SCHEMAS_V2.INTERVIEW_PREP,
  },
  // Placeholder for non-generative embedding task (logging only)
  rag_embedding: {
    id: 'rag_embedding',
    name: 'RAG Embedding',
    description: 'Embedding-only task placeholder (no text generation).',
    systemPrompt: SYSTEM_BASE,
    userPrompt: `Return an empty JSON object. This template is a placeholder for embedding tasks.`,
    variables: ['text'],
    outputSchema: { type: 'object', properties: {} } as JsonSchema,
  },
  // --- Vision OCR extraction ---
  ocr_extract: {
    id: 'ocr_extract',
    name: 'OCR Text Extraction',
    description:
      'Extract structured text from a base64-encoded image using a vision model.',
    systemPrompt: SYSTEM_BASE,
    userPrompt: `You will receive an image encoded in Base64 along with the source type.
Your task is to perform OCR and return a strictly valid JSON object following the schema below.

Instructions:
- Only include text you can confidently extract; do not hallucinate.
- Detect layout features (tables, lists, sections) if present.
- If the image is not primarily text, set 'notes' accordingly.
- ALWAYS respond with a valid JSON object, no prose.

Inputs:
- source_type: {source_type}
- image_base64:
"""
{image}
"""

Output JSON Schema fields:
- extracted_text: string
- content_type: string (e.g., 'document_scan', 'screenshot', 'photo')
- language: string (BCP-47 or simple code like 'en', 'zh')
- structure: { has_tables: boolean, has_lists: boolean, sections: string[] }
- confidence: number (0.0 to 1.0)
- notes: string[] (optional)`,
    variables: ['image', 'source_type'],
    outputSchema: {
      type: 'object',
      properties: {
        extracted_text: { type: 'string' },
        content_type: { type: 'string' },
        language: { type: 'string' },
        structure: {
          type: 'object',
          properties: {
            has_tables: { type: 'boolean' },
            has_lists: { type: 'boolean' },
            sections: { type: 'array', items: { type: 'string' } },
          },
          required: ['has_tables', 'has_lists', 'sections'],
        },
        confidence: { type: 'number' },
        notes: { type: 'array', items: { type: 'string' } },
      },
      required: ['extracted_text', 'content_type', 'language', 'structure'],
    } as JsonSchema,
  },
}
