/**
 * 中文 (zh) Prompt 模板
 */
import type { PromptTemplateMap, JsonSchema } from './types';

// 1. 复用 prototype 的 System Base
const SYSTEM_BASE = `你是一位资深的求职助手，专门帮助求职者优化简历、分析职位匹配度和准备面试。

核心原则：
1. 基于事实分析，不夸大不编造
2. 提供结构化、可操作的建议
3. 优先使用要点列表和分节组织
4. 严格按照要求的JSON格式输出
5. 保护用户隐私，不泄露敏感信息

输出要求：
- 必须返回有效的JSON格式
- 内容简洁明了，避免冗余
- 使用与用户输入一致的语言（中文/英文）`;

// 2. 复用 prototype 的 Schemas (用于资产提取)
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
      mustHaves: { type: 'array', items: { type: 'string' }, description: '必须具备的技能/经验' },
      niceToHaves: { type: 'array', items: { type: 'string' }, description: '加分项' },
    },
    required: ['jobTitle', 'mustHaves', 'niceToHaves'],
  } as JsonSchema,
};

// 3. 新架构的 Schemas (用于核心服务)
const SCHEMAS_V2 = {
  JOB_MATCH: {
    type: 'object',
    properties: {
      match_score: { type: 'number', description: '综合匹配度评分 (0-100)', minimum: 0, maximum: 100 },
      overall_assessment: { type: 'string', description: '一句话总结的核心评估，例如：高度匹配/中度匹配/存在挑战。' },
      strengths: { 
        type: 'array', 
        items: { 
          type: 'object',
          properties: {
            point: { type: 'string', description: '匹配的优势点 (例如：核心技能 React 精通)' },
            evidence: { type: 'string', description: '简历中支持该优势的证据 (来自简历或履历)' }
          },
          required: ['point', 'evidence']
        },
        description: '用户的核心优势 (用于放大)'
      },
      weaknesses: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            point: { type: 'string', description: '不匹配的风险点 (例如：JD 要求 5 年经验，用户只有 2 年)' },
            suggestion: { type: 'string', description: '建议的规避或准备策略 (来自 RAG 知识库)' }
          },
          required: ['point', 'suggestion']
        },
        description: '用户的核心劣势 (用于规避或准备)'
      },
      cover_letter_script: { 
        type: 'string', 
        description: '一段 150 字以内、高度定制化的“毛遂自荐”私信话术 (H-V-C 结构)'
      }
    },
    required: ['match_score', 'overall_assessment', 'strengths', 'weaknesses', 'cover_letter_script']
  } as JsonSchema,

  RESUME_CUSTOMIZE: {
    type: 'object',
    properties: {
      customized_resume_markdown: { type: 'string', description: '一份完整的、可以直接渲染的 Markdown 格式定制化简历。' },
      customization_summary: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            section: { type: 'string', description: '被修改的章节 (例如：项目经历 A)' },
            change_reason: { type: 'string', description: '为什么这样修改 (例如：为了突出 JD 要求的“性能优化”关键词)' }
          },
          required: ['section', 'change_reason']
        },
        description: '简历修改的亮点总结。'
      }
    },
    required: ['customized_resume_markdown', 'customization_summary']
  } as JsonSchema,

  INTERVIEW_PREP: {
    type: 'object',
    properties: {
      self_introduction_script: { type: 'string', description: '一段 1 分钟的“P-P-F”结构化自我介绍脚本。' },
      potential_questions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            question: { type: 'string', description: '一个基于 JD 和定制化简历的高概率面试问题。' },
            answer_guideline: { type: 'string', description: '回答该问题的核心思路和 STAR 案例建议 (来自 RAG 知识库)。' }
          },
          required: ['question', 'answer_guideline']
        },
        description: '5-7 个最可能被问到的行为或情景面试问题。'
      },
      reverse_questions: {
        type: 'array',
        items: {
          type: 'string',
          description: '3 个建议用户反问面试官的高分问题 (来自 RAG 知识库)。'
        }
      }
    },
    required: ['self_introduction_script', 'potential_questions', 'reverse_questions']
  } as JsonSchema,
};


// 4. 模板合集
export const ZH_TEMPLATES: PromptTemplateMap = {
  // --- 复用 Prototype (M7) ---
  resume_summary: { 
    id: 'resume_summary',
    name: '通用简历提取',
    description: '从用户上传的通用简历原文中提取结构化信息。',
    systemPrompt: SYSTEM_BASE,
    userPrompt: `请解析以下简历原文，并严格按照 JSON Schema 提取关键信息。
确保“highlights”字段只包含可量化的、有影响力的成就。

简历原文:
"""
{{resume_text}}
"""`,
    variables: ['resume_text'],
    outputSchema: SCHEMAS_V1.RESUME_SUMMARY,
  },
  detailed_resume_summary: {
    id: 'detailed_resume_summary',
    name: '详细履历提取',
    description: '从用户的详细履历中提取所有结构化信息。',
    systemPrompt: SYSTEM_BASE,
    userPrompt: `请解析以下个人详细履历原文。这份文档比通用简历更详细，请尽可能多地提取所有结构化信息，特别是项目经历（experience）的亮点（highlights）。

履历原文:
"""
{{detailed_resume_text}}
"""`,
    variables: ['detailed_resume_text'],
    outputSchema: SCHEMAS_V1.RESUME_SUMMARY, // 复用
  },
  job_summary: {
    id: 'job_summary',
    name: '岗位JD提取',
    description: '从 JD 原文中提取关键需求。',
    systemPrompt: SYSTEM_BASE,
    userPrompt: `请解析以下岗位描述（JD）原文。
重点是区分“必须项”（Must-haves）和“加分项”（Nice-to-haves）。

JD原文:
"""
{{job_text}}
"""`,
    variables: ['job_text'],
    outputSchema: SCHEMAS_V1.JOB_SUMMARY,
  },

  // --- 新架构核心服务 (M8, M9) ---
  job_match: {
    id: 'job_match',
    name: '工作匹配度分析',
    description: '分析简历与 JD 的匹配度，找出优势和劣势，并生成话术。',
    systemPrompt: SYSTEM_BASE,
    userPrompt: `请你扮演求职专家的角色，深度分析以下材料。
你的目标是帮助用户识别“优势”（用于放大）和“劣势”（用于规避）。

【RAG 知识库 - 匹配度分析技巧】
"""
{{rag_context}}
"""

【用户简历 - 结构化摘要】
"""
{{resume_summary_json}}
"""

【用户详细履历 - 结构化摘要 (可选)】
"""
{{detailed_resume_summary_json}}
"""

【目标岗位 - 结构化摘要】
"""
{{job_summary_json}}
"""

请根据以上所有信息，严格按照 JSON Schema 输出分析报告。
- 'strengths' 必须从简历中找到具体证据。
- 'weaknesses' 必须结合 RAG 知识库给出规避建议。
- 'cover_letter_script' 必须使用 H-V-C 结构，并突出 1-2 个最强的优势点。`,
    variables: ['rag_context', 'resume_summary_json', 'detailed_resume_summary_json', 'job_summary_json'],
    outputSchema: SCHEMAS_V2.JOB_MATCH,
  },
  resume_customize: {
    id: 'resume_customize',
    name: '简历定制化',
    description: '基于匹配度分析，重写一份 Markdown 简历。',
    systemPrompt: SYSTEM_BASE,
    userPrompt: `请你扮演简历优化专家的角色。
你的任务是基于“通用简历”和“匹配度分析报告”，重写一份高度定制化的新简历（Markdown 格式）。

【RAG 知识库 - 简历撰写技巧 (XYZ 法则, 动作动词)】
"""
{{rag_context}}
"""

【用户的通用简历原文】
"""
{{resume_text}}
"""

【目标岗位 - 结构化摘要】
"""
{{job_summary_json}}
"""

【上一步的匹配度分析报告】
"""
{{match_analysis_json}}
"""

请执行以下操作：
1.  **突出优势**：放大 `match_analysis_json` 中提到的所有 `strengths`。
2.  **量化成就**：使用 RAG 知识库中的“XYZ 法则” 和“动作动词” 重写项目描述。
3.  **关键词匹配**：确保 `job_summary_json` 中的“mustHaves”关键词在新简历中显眼地出现。
4.  **规避劣势**：弱化或删除与 JD 无关、且暴露劣势（`weaknesses`）的条目。
5.  **输出 Markdown**：严格按照 Schema 输出完整的 Markdown 简历和修改摘要。`,
    variables: ['rag_context', 'resume_text', 'job_summary_json', 'match_analysis_json'],
    outputSchema: SCHEMAS_V2.RESUME_CUSTOMIZE,
  },
  interview_prep: {
    id: 'interview_prep',
    name: '面试定向准备',
    description: '生成自我介绍、高频问题和反问问题。',
    systemPrompt: SYSTEM_BASE,
    userPrompt: `请你扮演面试官和求职教练的角色。
基于这份“定制化简历”和“匹配度报告”，为用户准备一份完整的面试要点清单。

【RAG 知识库 - 面试技巧 (STAR, P-P-F, 常见问题)】
"""
{{rag_context}}
"""

【用户的定制化简历 (Markdown)】
"""
{{customized_resume_md}}
"""

【目标岗位 - 结构化摘要】
"""
{{job_summary_json}}
"""

【匹配度分析报告】
"""
{{match_analysis_json}}
"""

请执行以下操作：
1.  **自我介绍**：结合 RAG 知识库中的“P-P-F”结构，生成一段 1 分钟的自我介绍，**必须**突出简历中最匹配 JD 的亮点。
2.  **高频问题**：预测 5-7 个**最可能**被问到的问题。
    * **必须**包含针对 `match_analysis_json` 中 `weaknesses`（劣势） 的压力测试问题（例如：“我看到你只有 2 年经验，我们这个岗位要求 5 年，你如何胜任？”）。
    * **必须**结合 RAG 知识库，为每个问题提供“回答思路”和“STAR 案例建议”。
3.  **反问问题**：结合 RAG 知识库，提供 3 个高质量的反问问题。`,
    variables: ['rag_context', 'customized_resume_md', 'job_summary_json', 'match_analysis_json'],
    outputSchema: SCHEMAS_V2.INTERVIEW_PREP,
  },
};