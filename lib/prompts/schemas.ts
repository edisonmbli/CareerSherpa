import type { JsonSchema } from './types'

// From SCHEMAS_V1.JOB_SUMMARY
export const JOB_SUMMARY_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    jobTitle: { type: 'string' },
    company: { type: 'string' },
    department: { type: 'string' },
    team: { type: 'string' },
    seniority: { type: 'string' },
    salaryRange: { type: 'string' },
    reportingLine: { type: 'string' },
    responsibilities: { type: 'array', items: { type: 'string' } },
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
    techStack: { type: 'array', items: { type: 'string' } },
    tools: { type: 'array', items: { type: 'string' } },
    methodologies: { type: 'array', items: { type: 'string' } },
    domainKnowledge: { type: 'array', items: { type: 'string' } },
    industry: { type: 'array', items: { type: 'string' } },
    education: { type: 'array', items: { type: 'string' } },
    experience: { type: 'array', items: { type: 'string' } },
    certifications: { type: 'array', items: { type: 'string' } },
    languages: { type: 'array', items: { type: 'string' } },
    softSkills: { type: 'array', items: { type: 'string' } },
    businessGoals: { type: 'array', items: { type: 'string' } },
    relocation: { type: 'string' },
    companyInfo: { type: 'string' },
    otherRequirements: { type: 'array', items: { type: 'string' } },
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
  required: [
    'jobTitle',
    'company',
    'department',
    'team',
    'seniority',
    'salaryRange',
    'reportingLine',
    'responsibilities',
    'mustHaves',
    'niceToHaves',
    'techStack',
    'tools',
    'methodologies',
    'domainKnowledge',
    'industry',
    'education',
    'experience',
    'certifications',
    'languages',
    'softSkills',
    'businessGoals',
    'relocation',
    'companyInfo',
    'otherRequirements',
    'rawSections',
  ],
}

// From SCHEMAS_V2.RESUME_SUMMARY
const RESUME_SUMMARY_SCHEMA: JsonSchema = {
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
}

export const SCHEMAS = {
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
      recommendations: {
        type: 'array',
        items: {
          type: 'string',
          description:
            'Three specific actionable recommendations (high value/executable)',
        },
        description: 'Subsequent action guide for the user (3 items)',
      },
    },
    required: [
      'match_score',
      'overall_assessment',
      'strengths',
      'weaknesses',
      'cover_letter_script',
      'recommendations',
    ],
  } as JsonSchema,

  PRE_MATCH_AUDIT: {
    type: 'object',
    properties: {
      risks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            risk_point: {
              type: 'string',
              description: 'Specific risk identified (Deal Breaker)',
            },
            severity: {
              type: 'string',
              enum: ['HIGH', 'MEDIUM', 'LOW'],
              description: 'Severity level',
            },
            reasoning: {
              type: 'string',
              description: 'Why this is a risk (based on JD)',
            },
          },
          required: ['risk_point', 'severity', 'reasoning'],
        },
      },
      overall_risk_level: {
        type: 'string',
        enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'SAFE'],
        description: 'Overall risk assessment',
      },
      audit_summary: {
        type: 'string',
        description: 'One-sentence summary of audit findings',
      },
    },
    required: ['risks', 'overall_risk_level', 'audit_summary'],
  } as JsonSchema,

  RESUME_CUSTOMIZE: {
    type: 'object',
    properties: {
      fact_check: {
        type: 'object',
        properties: {
          extracted_name: {
            type: 'string',
            description: 'Name extracted from resume summary',
          },
          extracted_company: {
            type: 'string',
            description: 'Most recent company extracted from resume summary',
          },
          verification_status: { type: 'string', enum: ['PASS', 'FAIL'] },
        },
        required: [
          'extracted_name',
          'extracted_company',
          'verification_status',
        ],
      },
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
              summary: {
                type: 'string',
                description:
                  'Professional summary. Strategy: 1) PRESERVE if strong. 2) "Merge & Refine" if summary_points add value. 3) Synthesize if missing. **DO NOT** use language skills.',
              },
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
                description: {
                  type: 'string',
                  description:
                    'Plain text. Use "\\n" for line breaks. NO bullets/numbering.',
                },
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
                description: {
                  type: 'string',
                  description:
                    'Plain text. Use "\\n" for line breaks. NO bullets/numbering.',
                },
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
                description: {
                  type: 'string',
                  description:
                    'Plain text. Use "\\n" for line breaks. NO bullets/numbering.',
                },
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
                description: {
                  type: 'string',
                  description:
                    'Plain text. Use "\\n" for line breaks. NO bullets/numbering.',
                },
              },
              required: ['id', 'title', 'description'],
            },
          },
        },
        required: ['basics', 'educations', 'workExperiences'],
      },
    },
    required: ['fact_check', 'optimizeSuggestion', 'resumeData'],
  } as JsonSchema,

  INTERVIEW_PREP_V2: {
    type: 'object',
    properties: {
      radar: {
        type: 'object',
        properties: {
          core_challenges: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                challenge: {
                  type: 'string',
                  description: 'Core business challenge derived from JD',
                },
                why_important: {
                  type: 'string',
                  description: 'Why this challenge is critical',
                },
                your_angle: {
                  type: 'string',
                  description: 'How the candidate can approach this challenge',
                },
              },
              required: ['challenge', 'why_important', 'your_angle'],
            },
            description: '3 core business challenges',
          },
          interview_rounds: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                round_name: {
                  type: 'string',
                  description:
                    'Interview round name (e.g., "HR初筛", "技术面试", "业务面试", "高管面试")',
                },
                interviewer_role: {
                  type: 'string',
                  description:
                    'Interviewer role persona(e.g., "HR Recruiter", "Hands-on Tech Lead", "Business Director", "VP/C-level")',
                },
                focus_points: {
                  type: 'array',
                  items: { type: 'string' },
                  description:
                    'What this interviewer role cares about most (3-5 points)',
                },
              },
              required: ['round_name', 'interviewer_role', 'focus_points'],
            },
            description:
              'Predicted interview rounds and what each interviewer role will focus on',
          },
          hidden_requirements: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Implicit requirements not explicitly stated in JD but likely to be tested',
          },
        },
        required: [
          'core_challenges',
          'interview_rounds',
          'hidden_requirements',
        ],
        description: 'Module 1: Intelligence Briefing (The Radar)',
      },
      hook: {
        type: 'object',
        properties: {
          ppf_script: {
            type: 'string',
            description:
              '1-minute self-introduction script using P-P-F structure (Present-Past-Future)',
          },
          key_hooks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                hook: {
                  type: 'string',
                  description: 'A key attention-grabbing point',
                },
                evidence_source: {
                  type: 'string',
                  description: 'Which resume experience supports this hook',
                },
              },
              required: ['hook', 'evidence_source'],
            },
            description: '3 key hooks to grab attention',
          },
          delivery_tips: {
            type: 'array',
            items: { type: 'string' },
            description: 'Delivery tips for effective presentation',
          },
        },
        required: ['ppf_script', 'key_hooks', 'delivery_tips'],
        description: 'Module 2: Opening Statement (The Hook)',
      },
      evidence: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            story_title: {
              type: 'string',
              description: 'Title of the STAR story (e.g., project name)',
            },
            matched_pain_point: {
              type: 'string',
              description: 'Which JD pain point this story addresses',
            },
            star: {
              type: 'object',
              properties: {
                situation: {
                  type: 'string',
                  description: 'Situation: Background context',
                },
                task: {
                  type: 'string',
                  description: 'Task: Your responsibility/challenge',
                },
                action: {
                  type: 'string',
                  description: 'Action: What you specifically did',
                },
                result: {
                  type: 'string',
                  description: 'Result: Measurable outcome',
                },
              },
              required: ['situation', 'task', 'action', 'result'],
            },
            quantified_impact: {
              type: 'string',
              description: 'Quantified impact (e.g., "Revenue +30%")',
            },
            source: {
              type: 'string',
              enum: ['resume', 'detailed_resume'],
              description: 'Data source for this story',
            },
          },
          required: [
            'story_title',
            'matched_pain_point',
            'star',
            'quantified_impact',
            'source',
          ],
        },
        description: 'Module 3: Core Arguments (The Evidence) - 3 STAR stories',
      },
      defense: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            weakness: {
              type: 'string',
              description: 'Weakness from match_analysis.weaknesses',
            },
            anticipated_question: {
              type: 'string',
              description: 'How the interviewer might question this weakness',
            },
            defense_script: {
              type: 'string',
              description:
                'Defense script: acknowledge + reframe as growth opportunity',
            },
            supporting_evidence: {
              type: 'string',
              description: 'Concrete evidence supporting this defense script',
            },
          },
          required: [
            'weakness',
            'anticipated_question',
            'defense_script',
            'supporting_evidence',
          ],
        },
        description:
          'Module 4: Offense & Defense (Sword & Shield) - Weakness mitigation',
      },
      reverse_questions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            question: {
              type: 'string',
              description: 'A high-quality question to ask the interviewer',
            },
            ask_intent: {
              type: 'string',
              description: 'Strategic intent behind asking this question',
            },
            listen_for: {
              type: 'string',
              description: 'What to pay attention to in the interviewer\'s answer',
            },
          },
          required: ['question', 'ask_intent', 'listen_for'],
        },
        description: 'Module 5: Reverse Questions - Strategic questions to ask',
      },
      knowledge_refresh: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            topic: {
              type: 'string',
              description: 'Topic to brush up on (e.g., "Douyin API ecosystem")',
            },
            key_points: {
              type: 'array',
              items: { type: 'string' },
              description: '3-5 key points to remember',
            },
            relevance: {
              type: 'string',
              description: 'Why this knowledge is relevant to the JD',
            },
          },
          required: ['topic', 'key_points', 'relevance'],
        },
        description:
          'Optional Module: Knowledge Refresh - Quick catch-up on industry/tech concepts',
      },
    },
    required: ['radar', 'hook', 'evidence', 'defense', 'reverse_questions'],
  } as JsonSchema,

  // Keep legacy INTERVIEW_PREP for backward compatibility during migration
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

  RESUME_SUMMARY: RESUME_SUMMARY_SCHEMA,
}

export const DETAILED_RESUME_SCHEMA: JsonSchema = {
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
    education: RESUME_SUMMARY_SCHEMA.properties!['education'] as JsonSchema,
    skills: RESUME_SUMMARY_SCHEMA.properties!['skills'] as JsonSchema,
    certifications: RESUME_SUMMARY_SCHEMA.properties![
      'certifications'
    ] as JsonSchema,
    languages: RESUME_SUMMARY_SCHEMA.properties!['languages'] as JsonSchema,
    awards: RESUME_SUMMARY_SCHEMA.properties!['awards'] as JsonSchema,
    openSource: RESUME_SUMMARY_SCHEMA.properties!['openSource'] as JsonSchema,
    extras: RESUME_SUMMARY_SCHEMA.properties!['extras'] as JsonSchema,
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
