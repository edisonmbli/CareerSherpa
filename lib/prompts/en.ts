/**
 * English (en) Prompt Templates
 */
import type { PromptTemplateMap, JsonSchema } from './types'

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
    userPrompt: `Please parse the following raw resume text and extract key information strictly according to the JSON Schema.
Ensure the "highlights" field captures quantifiable and impactful achievements.

Raw Resume Text:
"""
{{resume_text}}
"""`,
    variables: ['resume_text'],
    outputSchema: SCHEMAS_V1.RESUME_SUMMARY,
  },
  detailed_resume_summary: {
    id: 'detailed_resume_summary',
    name: 'Detailed History Extraction',
    description:
      "Extract all structured information from the user's detailed history.",
    systemPrompt: SYSTEM_BASE,
    userPrompt: `Please parse the following raw detailed resume text. This document is more detailed than a general resume. Extract as much structured information as possible, especially the highlights of project experiences.

Raw Text:
"""
{{detailed_resume_text}}
"""`,
    variables: ['detailed_resume_text'],
    outputSchema: SCHEMAS_V1.RESUME_SUMMARY, // Re-using schema
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
    userPrompt: `Act as an expert career coach. Deeply analyze the following materials.
Your goal is to help the user identify "Strengths" (to amplify) and "Weaknesses" (to mitigate).

【RAG Knowledge Base - Match Analysis Techniques】
"""
{{rag_context}}
"""

【User Resume - Structured Summary】
"""
{{resume_summary_json}}
"""

【User Detailed History - Structured Summary (Optional)】
"""
{{detailed_resume_summary_json}}
"""

【Target Job - Structured Summary】
"""
{{job_summary_json}}
"""

Based on all available information, output an analysis report strictly in the required JSON Schema.
- 'strengths' must be backed by specific evidence from the resume.
- 'weaknesses' must include a mitigation suggestion, informed by the RAG context.
- 'cover_letter_script' must use the H-V-C structure and highlight the 1-2 strongest matching points.`,
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
}
