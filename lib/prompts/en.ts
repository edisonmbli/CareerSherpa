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
- Use the same language as the user's input (Chinese/English).`

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
        type: 'string',
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
      customized_resume_markdown: {
        type: 'string',
        description:
          'A complete, render-ready Markdown version of the customized resume.',
      },
      customization_summary: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            section: {
              type: 'string',
              description: 'The section that was changed (e.g., "Project A")',
            },
            change_reason: {
              type: 'string',
              description:
                'Why this change was made (e.g., "To highlight the "Performance Optimization" keyword from the JD")',
            },
          },
          required: ['section', 'change_reason'],
        },
        description: 'A summary of the most important changes.',
      },
    },
    required: ['customized_resume_markdown', 'customization_summary'],
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
{{job_text}}
"""`,
    variables: ['job_text'],
    outputSchema: SCHEMAS_V1.JOB_SUMMARY,
  },

  // --- New Core Service Tasks (M8, M9) ---
  job_match: {
    id: 'job_match',
    name: 'Job Match Analysis',
    description:
      'Analyzes resume/JD fit, identifies strengths/weaknesses, and generates a script.',
    systemPrompt: SYSTEM_BASE,
    userPrompt: `Act as an expert career coach. Produce a strictly structured job match analysis and a human, concise outreach script based on the materials below.

【RAG Knowledge Base (curated snippets: rules/frameworks/examples)】
"""
{{rag_context}}
"""

【User Resume (structured summary)】
"""
{{resume_summary_json}}
"""

【User Detailed History (structured summary, optional)】
"""
{{detailed_resume_summary_json}}
"""

【Target Job (structured summary)】
"""
{{job_summary_json}}
"""

Output requirements (must follow exactly):
- Return a single JSON object following the given JSON Schema; no extra prose or Markdown.
- 'match_score' MUST be a numeric value between 0 and 100.
- 'overall_assessment' must be a short label: High/Moderate/Challenging Fit.
- 'strengths': for each item, include the point, concrete evidence from the resume, and the related section (e.g., experience/skills/projects).
- 'weaknesses': for each item, include the risk and a practical mitigation suggestion; leverage RAG rules first.
- 'cover_letter_script' MUST be a single string (not an object). Tone: polite, confident, first-person, platform DM style (human, not robotic). Length: ≤120 words. Structure:
  - Hook: 1 line that includes the target role and 2–4 JD keywords.
  - Value: 1–2 lines that highlight 1–2 quantified outcomes aligned to JD must-haves.
  - Close: 1 line with a succinct interest signal; do NOT propose/schedule calls.
- Forbidden: greetings, self-introduction by name, calendly/meeting requests, long courtesy phrases.
- Style: concise, professional, keyword-forward; avoid boilerplate; do not quote RAG verbatim, only distilled conclusions.`,
    variables: [
      'rag_context',
      'resume_summary_json',
      'detailed_resume_summary_json',
      'job_summary_json',
    ],
    outputSchema: SCHEMAS_V2.JOB_MATCH,
  },
  resume_customize: {
    id: 'resume_customize',
    name: 'Resume Customization',
    description:
      'Rewrites a general resume into a targeted Markdown resume based on match analysis.',
    systemPrompt: SYSTEM_BASE,
    userPrompt: `Act as an expert resume editor.
Your task is to rewrite a new, highly-customized resume (in Markdown format) based on the "General Resume" and the "Match Analysis Report".

【RAG Knowledge Base - Resume Writing Techniques (XYZ, Action Verbs)】
"""
{{rag_context}}
"""

【User's General Resume (Raw Text)】
"""
{{resume_text}}
"""

【Target Job - Structured Summary】
"""
{{job_summary_json}}
"""

【Previous Step: Match Analysis Report】
"""
{{match_analysis_json}}
"""

Please perform the following actions:
1.  **Amplify Strengths**: Emphasize all \`strengths\` mentioned in the \`match_analysis_json\`.
2.  **Quantify Achievements**: Use the "XYZ Formula" and "Action Verbs" from the RAG context to rewrite project descriptions.
3.  **Keyword Matching**: Ensure "mustHaves" keywords from \`job_summary_json\` appear prominently.
4.  **Mitigate Weaknesses**: De-emphasize or remove items that are irrelevant to the JD or expose \`weaknesses\`.
5.  **Output Markdown**: Strictly follow the Schema to output the full Markdown resume and the change summary.`,
    variables: [
      'rag_context',
      'resume_text',
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
{{rag_context}}
"""

【User's Customized Resume (Markdown)】
"""
{{customized_resume_md}}
"""

【Target Job - Structured Summary】
"""
{{job_summary_json}}
"""

【Match Analysis Report】
"""
{{match_analysis_json}}
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
- source_type: {{source_type}}
- image_base64:
"""
{{image}}
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
