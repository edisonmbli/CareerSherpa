/**
 * Prompt Templates for CareerShaper
 *
 * This module contains all LLM prompt templates organized by functionality.
 * Each template follows a consistent structure and supports variable substitution.
 */

import {
  enhancePromptTemplate,
  JSON_FORMAT_CONFIGS,
} from './json-format-enhancer'

/**
 * JSON Schema type definition
 */
export interface JsonSchema {
  type: string
  properties?: Record<string, any>
  items?: any
  required?: string[]
  enum?: any[]
  minimum?: number
  maximum?: number
  [key: string]: unknown
}

/**
 * Prompt template interface
 */
export interface PromptTemplate {
  id: string
  name: string
  description: string
  systemPrompt: string
  userPrompt: string
  variables: string[]
  outputSchema?: JsonSchema
  maxTokens?: number
  temperature?: number
}

/**
 * System prompt base - consistent across all templates
 */
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
- 使用与用户输入一致的语言（中文/英文）`

/**
 * Job Matching Analysis Template (Step A)
 */
export const JOB_MATCH_TEMPLATE: PromptTemplate = {
  id: 'job_match',
  name: '职位匹配度分析',
  description: '分析简历与职位的匹配度，提供评分和改进建议',
  systemPrompt: SYSTEM_BASE,
  userPrompt: `请分析以下简历与职位描述的匹配度：

简历摘要：
{{resumeSummary}}

职位描述：
{{jobDescription}}

请按照以下JSON格式返回分析结果：
{
  "score": 85,
  "highlights": [
    "匹配的优势点1",
    "匹配的优势点2"
  ],
  "gaps": [
    "需要改进的方面1",
    "需要改进的方面2"
  ],
  "dm_script": "基于分析结果的私信话术，突出匹配优势"
}

评分标准：
- 90-100分：高度匹配，技能和经验完全符合
- 70-89分：良好匹配，主要要求满足
- 50-69分：一般匹配，部分要求满足
- 30-49分：较低匹配，需要显著提升
- 0-29分：不匹配，不建议申请`,
  variables: ['resumeSummary', 'jobDescription'],
  outputSchema: {
    type: 'object',
    properties: {
      score: { type: 'number', minimum: 0, maximum: 100 },
      highlights: { type: 'array', items: { type: 'string' } },
      gaps: { type: 'array', items: { type: 'string' } },
      dm_script: { type: 'string' },
    },
    required: ['score', 'highlights', 'gaps', 'dm_script'],
  },
  maxTokens: 6000,
  temperature: 0.3,
}

/**
 * Resume Editing Template (Step B)
 */
export const RESUME_EDIT_TEMPLATE: PromptTemplate = {
  id: 'resume_edit',
  name: '简历编辑优化',
  description: '基于职位要求生成简历编辑计划',
  systemPrompt: SYSTEM_BASE,
  userPrompt: `基于以下信息，生成简历编辑计划：

当前简历：
{{resumeText}}

目标职位：
{{jobDescription}}

匹配分析：
{{matchAnalysis}}

请返回编辑计划的JSON格式：
{
  "summary": "编辑计划的简要说明",
  "ops": [
    {
      "type": "edit",
      "target": "section.experience.0.description",
      "content": "优化后的内容",
      "reason": "优化原因"
    },
    {
      "type": "add",
      "target": "section.skills",
      "content": "新增技能项",
      "reason": "添加原因"
    },
    {
      "type": "move",
      "from": "section.projects.1",
      "to": "section.experience.0",
      "reason": "调整原因"
    }
  ]
}

编辑类型说明：
- edit: 修改现有内容
- add: 新增内容
- remove: 删除内容
- move: 移动位置
- reorder: 重新排序

注意：
1. 只输出EditPlan，不生成完整简历
2. 保持可寻址的json_pointer/span_id格式
3. 每个操作都要有明确的reason`,
  variables: ['resumeText', 'jobDescription', 'matchAnalysis'],
  outputSchema: {
    type: 'object',
    properties: {
      summary: { type: 'string' },
      ops: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { enum: ['edit', 'add', 'remove', 'move', 'reorder'] },
            target: { type: 'string' },
            content: { type: 'string' },
            reason: { type: 'string' },
            from: { type: 'string' },
            to: { type: 'string' },
          },
          required: ['type', 'reason'],
        },
      },
    },
    required: ['summary', 'ops'],
  },
  maxTokens: 1200,
  temperature: 0.2,
}

/**
 * Interview Preparation Template (Step C)
 */
export const INTERVIEW_PREP_TEMPLATE: PromptTemplate = {
  id: 'interview_prep',
  name: '面试准备',
  description: '生成面试自我介绍和问答要点',
  systemPrompt: SYSTEM_BASE,
  userPrompt: `基于以下信息，准备面试材料：

简历信息：
{{resumeSummary}}

目标职位：
{{jobDescription}}

简历优化结果：
{{resumeEditSummary}}

请返回面试准备的JSON格式：
{
  "intro": "2-3分钟的自我介绍，突出与职位的匹配点",
  "qa_items": [
    {
      "question": "常见面试问题",
      "framework": "STAR/其他回答框架",
      "hints": ["回答要点1", "回答要点2"]
    }
  ]
}

面试问题分类：
1. 通用问题（自我介绍、优缺点、职业规划）
2. 岗位相关（技能、经验、项目）
3. 追问深入（细节、挑战、学习）

要求：
- 自我介绍控制在150字以内
- 问答要点10-15条
- 使用STAR框架组织回答
- 突出与职位的匹配度`,
  variables: ['resumeSummary', 'jobDescription', 'resumeEditSummary'],
  outputSchema: {
    type: 'object',
    properties: {
      intro: { type: 'string' },
      qa_items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            question: { type: 'string' },
            framework: { type: 'string' },
            hints: { type: 'array', items: { type: 'string' } },
          },
          required: ['question', 'framework', 'hints'],
        },
      },
    },
    required: ['intro', 'qa_items'],
  },
  maxTokens: 1200,
  temperature: 0.4,
}

/**
 * Summary Generation Templates
 */
export const RESUME_SUMMARY_TEMPLATE: PromptTemplate = {
  id: 'resume_summary',
  name: '简历摘要提取',
  description: '从简历文本中提取结构化摘要，最大程度保留简历内容',
  systemPrompt: SYSTEM_BASE,
  userPrompt: `请分析以下简历内容，最大程度地提取所有关键信息并以JSON格式返回。

简历内容：
{{resumeText}}

提取要求：
- 简历内容较短，需要最大程度地把其中的内容提取出来
- 不要遗漏任何重要信息，包括具体的项目、成就、技能等
- 按照指定的结构化字段进行组织

请返回JSON格式：
{
  "personal_info": {
    "name": "姓名",
    "title": "当前职位/求职意向", 
    "contact": ["联系方式"],
    "location": "所在地区"
  },
  "education": [
    {
      "school": "学校名称",
      "degree": "学位",
      "major": "专业",
      "duration": "时间段",
      "details": ["相关详情、成绩、荣誉等"]
    }
  ],
  "highlights": [
    "核心亮点1：具体描述",
    "核心亮点2：具体描述"
  ],
  "key_skills": {
    "technical": ["技术技能"],
    "soft": ["软技能"],
    "languages": ["语言能力"],
    "certifications": ["认证证书"]
  },
  "working_experiences": [
    {
      "company": "公司名称",
      "position": "职位",
      "duration": "时间段",
      "responsibilities": ["职责描述"],
      "achievements": ["具体成就"]
    }
  ],
  "projects": [
    {
      "name": "项目名称",
      "description": "项目描述",
      "technologies": ["使用技术"],
      "achievements": ["项目成果"]
    }
  ],
  "years_experience": 3,
  "industry": ["所属行业"]
}`,
  variables: ['resumeText'],
  outputSchema: {
    type: 'object',
    properties: {
      personal_info: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          title: { type: 'string' },
          contact: { type: 'array', items: { type: 'string' } },
          location: { type: 'string' },
        },
        required: ['name', 'title'],
      },
      education: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            school: { type: 'string' },
            degree: { type: 'string' },
            major: { type: 'string' },
            duration: { type: 'string' },
            details: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      highlights: { type: 'array', items: { type: 'string' } },
      key_skills: {
        type: 'object',
        properties: {
          technical: { type: 'array', items: { type: 'string' } },
          soft: { type: 'array', items: { type: 'string' } },
          languages: { type: 'array', items: { type: 'string' } },
          certifications: { type: 'array', items: { type: 'string' } },
        },
      },
      working_experiences: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            company: { type: 'string' },
            position: { type: 'string' },
            duration: { type: 'string' },
            responsibilities: { type: 'array', items: { type: 'string' } },
            achievements: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      projects: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            technologies: { type: 'array', items: { type: 'string' } },
            achievements: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      years_experience: { type: 'number' },
      industry: { type: 'array', items: { type: 'string' } },
    },
    required: [
      'personal_info',
      'highlights',
      'key_skills',
      'working_experiences',
    ],
  },
  maxTokens: 8000, // 增加token限制以支持更详细的提取
  temperature: 0.2,
}

/**
 * Detailed Resume Extraction Template
 * Implements detailed extraction and refinement for complete information preservation
 */
export const DETAILED_RESUME_TEMPLATE: PromptTemplate = {
  id: 'detailed_resume',
  name: '详细简历信息提取',
  description: '详细提取简历信息，最大程度还原履历细节',
  systemPrompt: `你是一位专业的简历信息提取专家，专门负责从详细简历中进行深度信息提取和提炼。

核心原则：
1. DETAILED EXTRACTION - 详细提取，最大程度保留重要信息
2. 信息提炼 - 将原文信息提炼成结构化的详细描述
3. 结构化组织 - 将信息按工作经历组织成 work_detail 数组
4. 严格按照 JSON 格式输出
5. 使用与输入一致的语言

提取策略：
- 这是详细简历提取任务，需要最大程度地还原详细履历的细节
- 将原文信息提炼成详细的结构化描述，保留关键细节和具体内容
- 包含所有重要的成就、项目详情、学习经历、具体数字、指标和描述
- 提炼而非简单复制，但要保持信息的完整性和详细程度
- 确保每个字段都包含丰富的细节信息

输出要求：
- 必须返回包含 "work_detail" 数组的 JSON 格式
- 每个 work_detail 对象必须填充详细的提炼信息
- 保持信息的详细程度和完整性`,
  userPrompt: `请从以下详细简历文本中进行深度信息提取和提炼：

简历内容：
{{resumeText}}

请返回 JSON 格式，包含以下结构：
{
  "work_detail": [
    {
      "company": "公司名称",
      "role": "职位角色",
      "keywords": ["关键技能/技术/工具"],
      "duration": "工作时间段",
      "highlights": ["主要成就和亮点的详细描述"],
      "projects": ["项目经历的详细描述，包括项目背景、技术栈、个人贡献"],
      "key_contribution": ["关键贡献和价值创造的详细说明"],
      "learning": ["技能发展和学习成长的详细描述"],
      "improvement": ["流程优化和改进措施的详细说明"],
      "co_operation": ["团队合作和跨部门协作的详细示例"],
      "leadership": ["领导力和团队管理的详细体现"],
      "problem_solving": ["问题解决和挑战应对的详细案例"]
    }
  ]
}

字段要求说明：
- company: 公司名称
- role: 具体职位角色
- keywords: 关键技能、技术、工具等
- duration: 工作时间段
- highlights: 主要成就和亮点，包含具体数据和影响
- projects: 项目经历，包含项目背景、技术实现、个人贡献
- key_contribution: 关键贡献，量化的价值创造
- learning: 技能发展，学习的新技术、方法、知识
- improvement: 流程优化，改进的具体措施和效果
- co_operation: 团队合作，跨部门协作的具体示例
- leadership: 领导力体现，团队管理、指导他人的经历
- problem_solving: 问题解决，面临的挑战和解决方案

提取要求：
- 从简历文本中提炼出详细的工作经历信息
- 每个字段都要包含丰富的细节描述，不是简单的关键词列表
- 保留具体的数字、时间、项目名称、技术栈等关键信息
- 将相关信息合理归类到对应字段中
- 确保信息的完整性和详细程度，为后续步骤提供充分的上下文`,
  variables: ['resumeText'],
  outputSchema: {
    type: 'object',
    properties: {
      work_detail: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            company: { type: 'string' },
            role: { type: 'string' },
            keywords: { type: 'array', items: { type: 'string' } },
            duration: { type: 'string' },
            highlights: { type: 'array', items: { type: 'string' } },
            projects: { type: 'array', items: { type: 'string' } },
            key_contribution: { type: 'array', items: { type: 'string' } },
            learning: { type: 'array', items: { type: 'string' } },
            improvement: { type: 'array', items: { type: 'string' } },
            co_operation: { type: 'array', items: { type: 'string' } },
            leadership: { type: 'array', items: { type: 'string' } },
            problem_solving: { type: 'array', items: { type: 'string' } },
          },
          required: ['company', 'role', 'keywords', 'duration'],
        },
      },
    },
    required: ['work_detail'],
  },
  maxTokens: 30000, // 根据智谱官网文档，GLM-4.5支持最大98304 tokens
  temperature: 0.1, // 低温度确保一致性
}

export const JOB_SUMMARY_TEMPLATE: PromptTemplate = {
  id: 'job_summary',
  name: '职位描述摘要',
  description: '从职位描述中提取结构化信息',
  systemPrompt: SYSTEM_BASE,
  userPrompt: `请分析以下职位描述，提取关键信息并以JSON格式返回：

职位描述：
{{jobText}}

请返回JSON格式：
{
  "title": "职位名称",
  "company": "公司名称",
  "requirements": ["任职要求"],
  "responsibilities": ["工作职责"],
  "skills": ["技能要求"],
  "benefits": ["福利待遇"],
  "level": "职级水平",
  "industry": "行业领域",
  "location": "工作地点"
}`,
  variables: ['jobText'],
  outputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      company: { type: 'string' },
      requirements: { type: 'array', items: { type: 'string' } },
      responsibilities: { type: 'array', items: { type: 'string' } },
      skills: { type: 'array', items: { type: 'string' } },
      benefits: { type: 'array', items: { type: 'string' } },
      level: { type: 'string' },
      industry: { type: 'string' },
      location: { type: 'string' },
    },
    required: ['title', 'requirements', 'responsibilities', 'skills'],
  },
  maxTokens: 6000,
  temperature: 0.2,
}

/**
 * OCR Text Extraction Template
 */
export const OCR_EXTRACT_TEMPLATE: PromptTemplate = {
  id: 'ocr_extract',
  name: 'OCR文本抽取',
  description: '从图片或PDF扫描件中抽取文本内容',
  systemPrompt: `你是一位专业的OCR文本识别专家，专门负责从图片和PDF扫描件中准确提取文本内容。

核心原则：
1. 准确识别 - 尽可能准确地识别图片中的所有文字
2. 结构保持 - 保持原文档的结构和格式
3. 完整提取 - 不遗漏任何重要信息
4. 智能纠错 - 对明显的OCR错误进行合理纠正
5. 分类整理 - 根据内容类型进行适当的分类和整理

识别策略：
- 仔细观察图片中的所有文字内容，包括标题、正文、表格、列表等
- 保持原有的段落结构和层次关系
- 对于表格数据，尽量保持表格格式
- 识别并保留重要的格式信息（如粗体、标题层级等）
- 对于模糊或不清晰的文字，基于上下文进行合理推测

输出要求：
- 必须返回有效的JSON格式
- 提取的文本应该结构清晰、易于阅读
- 保持与原文档相同的语言（中文/英文）
- 对于无法识别的内容，标注为"[无法识别]"`,
  userPrompt: `请从以下图片中提取所有文本内容：

图片类型：{{sourceType}}
图片内容：[图片已提供]

请仔细识别图片中的所有文字，并按照以下JSON格式返回：

{
  "extracted_text": "完整的提取文本，保持原有结构和格式",
  "content_type": "文档类型（如：简历、职位描述、证书、合同等）",
  "language": "主要语言（中文/英文/其他）",
  "structure": {
    "has_tables": false,
    "has_lists": false,
    "sections": ["识别到的主要章节或部分"]
  },
  "confidence": 0.95,
  "notes": ["识别过程中的注意事项或不确定的地方"]
}

识别要求：
- 仔细观察图片中的每一个文字和符号
- 保持原有的段落分隔和结构层次
- 对于表格内容，尽量保持表格的行列关系
- 识别标题、副标题、正文等不同层级的内容
- 对于手写文字或特殊字体，尽力识别并标注不确定性
- 置信度评分基于整体识别的准确性和清晰度`,
  variables: ['sourceType'],
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
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      notes: { type: 'array', items: { type: 'string' } },
    },
    required: [
      'extracted_text',
      'content_type',
      'language',
      'structure',
      'confidence',
    ],
  },
  maxTokens: 8000,
  temperature: 0.1,
}

/**
 * Template Registry
 */
export const PROMPT_TEMPLATES = {
  job_match: JOB_MATCH_TEMPLATE,
  resume_edit: RESUME_EDIT_TEMPLATE,
  interview_prep: INTERVIEW_PREP_TEMPLATE,
  resume_summary: RESUME_SUMMARY_TEMPLATE,
  job_summary: JOB_SUMMARY_TEMPLATE,
  detailed_resume: DETAILED_RESUME_TEMPLATE,
  ocr_extract: OCR_EXTRACT_TEMPLATE,
} as const

export type TemplateId = keyof typeof PROMPT_TEMPLATES

/**
 * Get template by ID
 */
export function getTemplate(id: TemplateId): PromptTemplate {
  const template = PROMPT_TEMPLATES[id]
  if (!template) {
    throw new Error(`Template not found: ${id}`)
  }
  return template
}

/**
 * Render template with variables
 */
export function renderTemplate(
  templateId: TemplateId,
  variables: Record<string, string>
): { systemPrompt: string; userPrompt: string } {
  const template = getTemplate(templateId)

  // Check required variables
  const missingVars = template.variables.filter((v) => !(v in variables))
  if (missingVars.length > 0) {
    throw new Error(`Missing template variables: ${missingVars.join(', ')}`)
  }

  // Check for undefined or null values
  const undefinedVars = template.variables.filter(
    (v) =>
      variables[v] === undefined ||
      variables[v] === null ||
      variables[v] === 'undefined'
  )
  if (undefinedVars.length > 0) {
    throw new Error(
      `Template variables have undefined values: ${undefinedVars.join(
        ', '
      )}. Variables: ${JSON.stringify(variables)}`
    )
  }

  // Replace variables in user prompt
  let userPrompt = template.userPrompt
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`
    userPrompt = userPrompt.replace(new RegExp(placeholder, 'g'), value)
  }

  return {
    systemPrompt: template.systemPrompt,
    userPrompt,
  }
}

/**
 * Get template configuration for LLM execution
 */
export function getTemplateConfig(templateId: TemplateId) {
  const template = getTemplate(templateId)
  return {
    maxTokens: template.maxTokens || 4000,
    temperature: template.temperature || 0.3,
  }
}

/**
 * Enhanced templates with improved JSON format guidance
 * 增强版模板，包含改进的 JSON 格式指导
 */
export const ENHANCED_PROMPT_TEMPLATES = {
  job_match: enhancePromptTemplate(
    JOB_MATCH_TEMPLATE,
    JSON_FORMAT_CONFIGS.standard
  ),
  resume_edit: enhancePromptTemplate(
    RESUME_EDIT_TEMPLATE,
    JSON_FORMAT_CONFIGS.standard
  ),
  interview_prep: enhancePromptTemplate(
    INTERVIEW_PREP_TEMPLATE,
    JSON_FORMAT_CONFIGS.standard
  ),
  resume_summary: enhancePromptTemplate(
    RESUME_SUMMARY_TEMPLATE,
    JSON_FORMAT_CONFIGS.strict
  ),
  job_summary: enhancePromptTemplate(
    JOB_SUMMARY_TEMPLATE,
    JSON_FORMAT_CONFIGS.standard
  ),
  detailed_resume: enhancePromptTemplate(
    DETAILED_RESUME_TEMPLATE,
    JSON_FORMAT_CONFIGS.strict
  ),
  ocr_extract: enhancePromptTemplate(
    OCR_EXTRACT_TEMPLATE,
    JSON_FORMAT_CONFIGS.strict
  ),
} as const

/**
 * Lightweight enhanced templates for performance-critical scenarios
 * 轻量级增强模板，用于性能敏感场景
 */
export const LIGHTWEIGHT_ENHANCED_TEMPLATES = {
  job_match: enhancePromptTemplate(
    JOB_MATCH_TEMPLATE,
    JSON_FORMAT_CONFIGS.minimal
  ),
  resume_edit: enhancePromptTemplate(
    RESUME_EDIT_TEMPLATE,
    JSON_FORMAT_CONFIGS.minimal
  ),
  interview_prep: enhancePromptTemplate(
    INTERVIEW_PREP_TEMPLATE,
    JSON_FORMAT_CONFIGS.minimal
  ),
  resume_summary: enhancePromptTemplate(
    RESUME_SUMMARY_TEMPLATE,
    JSON_FORMAT_CONFIGS.minimal
  ),
  job_summary: enhancePromptTemplate(
    JOB_SUMMARY_TEMPLATE,
    JSON_FORMAT_CONFIGS.minimal
  ),
  detailed_resume: enhancePromptTemplate(
    DETAILED_RESUME_TEMPLATE,
    JSON_FORMAT_CONFIGS.minimal
  ),
  ocr_extract: enhancePromptTemplate(
    OCR_EXTRACT_TEMPLATE,
    JSON_FORMAT_CONFIGS.minimal
  ),
} as const

/**
 * Get enhanced template with improved JSON format guidance
 * 获取包含改进 JSON 格式指导的增强模板
 */
export function getEnhancedTemplate(id: TemplateId): PromptTemplate {
  const enhancedTemplate = ENHANCED_PROMPT_TEMPLATES[id]
  if (!enhancedTemplate) {
    throw new Error(`Enhanced template not found: ${id}`)
  }
  return enhancedTemplate
}

/**
 * Get lightweight enhanced template for performance-critical scenarios
 * 获取轻量级增强模板，用于性能敏感场景
 */
export function getLightweightEnhancedTemplate(
  templateId: TemplateId
): PromptTemplate {
  return LIGHTWEIGHT_ENHANCED_TEMPLATES[templateId]
}
