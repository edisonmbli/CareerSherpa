/**
 * Prompt Templates for CareerShaper
 * 
 * This module contains all LLM prompt templates organized by functionality.
 * Each template follows a consistent structure and supports variable substitution.
 */

export interface PromptTemplate {
  id: string
  name: string
  description: string
  systemPrompt: string
  userPrompt: string
  variables: string[]
  outputSchema?: any
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
      dm_script: { type: 'string' }
    },
    required: ['score', 'highlights', 'gaps', 'dm_script']
  },
  maxTokens: 900,
  temperature: 0.3
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
            to: { type: 'string' }
          },
          required: ['type', 'reason']
        }
      }
    },
    required: ['summary', 'ops']
  },
  maxTokens: 1200,
  temperature: 0.2
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
            hints: { type: 'array', items: { type: 'string' } }
          },
          required: ['question', 'framework', 'hints']
        }
      }
    },
    required: ['intro', 'qa_items']
  },
  maxTokens: 1200,
  temperature: 0.4
}

/**
 * Summary Generation Templates
 */
export const RESUME_SUMMARY_TEMPLATE: PromptTemplate = {
  id: 'resume_summary',
  name: '简历摘要提取',
  description: '从简历文本中提取结构化摘要',
  systemPrompt: SYSTEM_BASE,
  userPrompt: `请分析以下简历内容，提取关键信息并以JSON格式返回：

简历内容：
{{resumeText}}

请返回JSON格式：
{
  "name": "姓名",
  "title": "当前职位/求职意向",
  "experience": ["工作经历要点"],
  "skills": ["技能列表"],
  "education": ["教育背景"],
  "highlights": ["核心亮点"],
  "years_experience": 3,
  "industry": "所属行业"
}`,
  variables: ['resumeText'],
  outputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      title: { type: 'string' },
      experience: { type: 'array', items: { type: 'string' } },
      skills: { type: 'array', items: { type: 'string' } },
      education: { type: 'array', items: { type: 'string' } },
      highlights: { type: 'array', items: { type: 'string' } },
      years_experience: { type: 'number' },
      industry: { type: 'string' }
    },
    required: ['name', 'title', 'experience', 'skills']
  },
  maxTokens: 800,
  temperature: 0.2
}

/**
 * Detailed Resume Extraction Template
 * Implements verbatim extraction for complete information preservation
 */
export const DETAILED_RESUME_TEMPLATE: PromptTemplate = {
  id: 'detailed_resume',
  name: '详细简历信息提取',
  description: '逐字提取详细简历信息，确保信息完整性',
  systemPrompt: `你是一位专业的简历信息提取专家，专门负责从详细简历中进行逐字逐句的信息提取。

核心原则：
1. VERBATIM EXTRACTION - 逐字提取，不得省略任何信息
2. 100% 信息保留 - 完整保留原文的所有细节
3. 结构化组织 - 将信息按工作经历组织成 jobs 数组
4. 严格按照 JSON 格式输出
5. 使用与输入一致的语言

CRITICAL RULES:
- 这是 VERBATIM DETAILED 简历提取。必须从输入文本中逐字提取所有内容并组织到 "jobs" 数组中
- 不得总结、压缩或省略任何细节
- 复制每个完整的句子和段落，包括所有成就、项目详情、学习经历、具体数字、指标和描述
- 如果原文有200字的描述，提取结果应包含完整的200字描述，而不是50字的总结
- 不得缩短、总结或压缩任何内容，按原文完整提取段落和句子

输出要求：
- 必须返回包含 "jobs" 数组的 JSON 格式
- 每个 job 对象必须填充从原文中提取的完整内容
- 保持原文的完整长度和细节`,
  userPrompt: `请从以下详细简历文本中进行逐字信息提取：

简历内容：
{{resumeText}}

请返回 JSON 格式，包含以下结构：
{
  "jobs": [
    {
      "company": "公司名称",
      "title": "职位标题",
      "position": "职位名称（备用）",
      "keywords": ["关键技能/技术"],
      "duration": "时间段",
      "highlights": ["完整的成就描述"],
      "project_experiences": ["完整的项目描述"],
      "contributions": ["完整的量化结果"],
      "learnings": ["完整的技能发展描述"],
      "improvements": ["完整的流程优化描述"],
      "co_working": ["完整的团队合作示例"],
      "leadership": ["完整的团队管理描述"],
      "problem_solving": ["完整的挑战解决描述"]
    }
  ]
}

字段映射说明：
- company/title: 工作信息
- keywords: 关键技能/技术
- duration: 时间段
- highlights: 完整的成就描述
- project_experiences: 完整的项目描述
- contributions: 完整的量化结果
- learnings: 完整的技能发展描述
- improvements: 完整的流程优化描述
- co_working: 完整的团队合作示例
- leadership: 完整的团队管理描述
- problem_solving: 完整的挑战解决描述

VERBATIM 要求：
- 从上述详细简历文本中逐字提取所有信息并组织到 JSON 结构中
- 不得总结、压缩或缩短 - 复制每个完整的句子、段落、成就、项目描述和经历，完全按照原文书写
- 如果输入有具体数字、日期、项目名称、成就、完整描述 - 在相应字段中完全按照原文包含所有内容
- 每个字段应包含完整的原始句子和段落，而不是缩短版本
- 保持原始描述的完整长度和细节`,
  variables: ['resumeText'],
  outputSchema: {
    type: 'object',
    properties: {
      jobs: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            company: { type: 'string' },
            title: { type: 'string' },
            position: { type: 'string' },
            keywords: { type: 'array', items: { type: 'string' } },
            duration: { type: 'string' },
            highlights: { type: 'array', items: { type: 'string' } },
            project_experiences: { type: 'array', items: { type: 'string' } },
            contributions: { type: 'array', items: { type: 'string' } },
            learnings: { type: 'array', items: { type: 'string' } },
            improvements: { type: 'array', items: { type: 'string' } },
            co_working: { type: 'array', items: { type: 'string' } },
            leadership: { type: 'array', items: { type: 'string' } },
            problem_solving: { type: 'array', items: { type: 'string' } }
          },
          required: ['company', 'title', 'keywords', 'duration']
        }
      }
    },
    required: ['jobs']
  },
  maxTokens: 60000, // 详细提取需要更多 token
  temperature: 0.1 // 低温度确保一致性
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
      location: { type: 'string' }
    },
    required: ['title', 'requirements', 'responsibilities', 'skills']
  },
  maxTokens: 800,
  temperature: 0.2
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
  const missingVars = template.variables.filter(v => !(v in variables))
  if (missingVars.length > 0) {
    throw new Error(`Missing template variables: ${missingVars.join(', ')}`)
  }
  
  // Replace variables in user prompt
  let userPrompt = template.userPrompt
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`
    userPrompt = userPrompt.replace(new RegExp(placeholder, 'g'), value)
  }
  
  return {
    systemPrompt: template.systemPrompt,
    userPrompt
  }
}

/**
 * Get template configuration for LLM
 */
export function getTemplateConfig(templateId: TemplateId) {
  const template = getTemplate(templateId)
  return {
    maxTokens: template.maxTokens,
    temperature: template.temperature,
    outputSchema: template.outputSchema
  }
}