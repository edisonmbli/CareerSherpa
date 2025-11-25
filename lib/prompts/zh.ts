/**
 * 中文 (zh) Prompt 模板
 */
import type { PromptTemplateMap, JsonSchema } from './types'
import { ENV } from '@/lib/env'

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
- 使用与用户输入一致的语言（中文/英文）`

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
      mustHaves: {
        type: 'array',
        items: { type: 'string' },
        description: '必须具备的技能/经验',
      },
      niceToHaves: {
        type: 'array',
        items: { type: 'string' },
        description: '加分项',
      },
    },
    required: ['jobTitle', 'mustHaves', 'niceToHaves'],
  } as JsonSchema,
}

// 3. 新架构的 Schemas (用于核心服务)
const SCHEMAS_V2 = {
  JOB_MATCH: {
    type: 'object',
    properties: {
      match_score: {
        type: 'number',
        description: '综合匹配度评分 (0-100)',
        minimum: 0,
        maximum: 100,
      },
      overall_assessment: {
        type: 'string',
        description: '一句话总结的核心评估，例如：高度匹配/中度匹配/存在挑战。',
      },
      strengths: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            point: {
              type: 'string',
              description: '匹配的优势点 (例如：核心技能 React 精通)',
            },
            evidence: {
              type: 'string',
              description: '简历中支持该优势的证据 (来自简历或履历)',
            },
          },
          required: ['point', 'evidence'],
        },
        description: '用户的核心优势 (用于放大)',
      },
      weaknesses: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            point: {
              type: 'string',
              description:
                '不匹配的风险点 (例如：JD 要求 5 年经验，用户只有 2 年)',
            },
            suggestion: {
              type: 'string',
              description: '建议的规避或准备策略 (来自 RAG 知识库)',
            },
          },
          required: ['point', 'suggestion'],
        },
        description: '用户的核心劣势 (用于规避或准备)',
      },
      cover_letter_script: {
        type: 'string',
        description:
          '一段 150 字以内、高度定制化的“毛遂自荐”私信话术 (H-V-C 结构)',
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
        description: '一份完整的、可以直接渲染的 Markdown 格式定制化简历。',
      },
      customization_summary: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            section: {
              type: 'string',
              description: '被修改的章节 (例如：项目经历 A)',
            },
            change_reason: {
              type: 'string',
              description:
                '为什么这样修改 (例如：为了突出 JD 要求的“性能优化”关键词)',
            },
          },
          required: ['section', 'change_reason'],
        },
        description: '简历修改的亮点总结。',
      },
    },
    required: ['customized_resume_markdown', 'customization_summary'],
  } as JsonSchema,

  INTERVIEW_PREP: {
    type: 'object',
    properties: {
      self_introduction_script: {
        type: 'string',
        description: '一段 1 分钟的“P-P-F”结构化自我介绍脚本。',
      },
      potential_questions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            question: {
              type: 'string',
              description: '一个基于 JD 和定制化简历的高概率面试问题。',
            },
            answer_guideline: {
              type: 'string',
              description:
                '回答该问题的核心思路和 STAR 案例建议 (来自 RAG 知识库)。',
            },
          },
          required: ['question', 'answer_guideline'],
        },
        description: '5-7 个最可能被问到的行为或情景面试问题。',
      },
      reverse_questions: {
        type: 'array',
        items: {
          type: 'string',
          description: '3 个建议用户反问面试官的高分问题 (来自 RAG 知识库)。',
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

const DETAILED_RESUME_SCHEMA = {
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
    extras: { type: 'array', items: { type: 'string' } },
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
} as JsonSchema

// 4. 模板合集
export const ZH_TEMPLATES: PromptTemplateMap = {
  // --- 复用 Prototype (M7) ---
  resume_summary: {
    id: 'resume_summary',
    name: '通用简历提取',
    description: '从用户上传的通用简历原文中提取结构化信息。',
    systemPrompt: SYSTEM_BASE,
    userPrompt: `请“提取而非改写”以下简历原文，严格按照 JSON Schema 输出结构化结果。
– **职责职责（responsibilities）**：原样提取所有以“负责/主导/作为唯一负责人”等开头的职责句。
– **成果亮点（highlights）**：提取可量化的、有影响力的结果（如提效、同比提升、用户指标等）。
– **项目与链接**：保留项目名/链接/简短描述。
– **要点还原**：职业摘要与专业特长采用“要点列表”逐条复制原文，不做二次改写。

简历原文:
"""
{resume_text}
"""`,
    variables: ['resume_text'],
    outputSchema: SCHEMAS_V2.RESUME_SUMMARY,
  },
  detailed_resume_summary: {
    id: 'detailed_resume_summary',
    name: '详细履历提取',
    description: '从用户的详细履历中提取所有结构化信息。',
    systemPrompt: SYSTEM_BASE,
    userPrompt: `请“提取而非改写”以下个人详细履历原文，严格按照给定 JSON Schema 输出。必须逐条复制原文要点，不合并、不重写，保留所有数量/百分比/时间范围。

识别与映射规则：
1) 公司段：当出现“公司/产品/在职时间/关键词”四要素时，创建 experiences[] 项，填充 company、product_or_team、role、duration、keywords[]。
2) 项目段（项目经历）：识别“任务/行动/成果”三段，分别写入 projects[].task/actions/results；出现数字或百分比时，同时写入 projects[].metrics[]。
3) 能力分节：识别“学习能力/推荐系统/创作者增长/短视频内容理解/精益能力/协同能力/领导能力/问题解决能力”等，写入 capabilities[]，points 为原文要点。
4) 兜底：无法归类的分节写入 rawSections[]，title 为原文标题，points 为原文要点。

极简示例（用于公司/项目识别与字段映射）：
— 公司段示例 —
原文：
腾讯 - QQ音乐 · 高级产品经理（2019.03-2021.08）
关键词：内容生态；推荐系统；创作者增长
映射：
company: "腾讯"
product_or_team: "QQ音乐"
role: "高级产品经理"
duration: "2019.03-2021.08"
keywords: ["内容生态","推荐系统","创作者增长"]

— 项目段示例 —
原文：
项目：内容推荐重排
任务：降低冷启动损耗
行动：构建用户-内容相似度特征；上线召回+重排多臂Bandit
成果：新用户7日留存+3.2%；播放完成率+5.6%
映射：
projects[].name: "内容推荐重排"
task: ["降低冷启动损耗"]
actions: ["构建用户-内容相似度特征","上线召回+重排多臂Bandit"]
results: ["新用户7日留存+3.2%","播放完成率+5.6%"]
metrics: (label="7日留存", value="3.2%", period="7d"); (label="播放完成率", value="5.6%")

履历原文:
"""
{detailed_resume_text}
"""`,
    variables: ['detailed_resume_text'],
    outputSchema: DETAILED_RESUME_SCHEMA,
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
{job_text}
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
    userPrompt: `请你扮演求职专家，基于以下材料进行严格结构化的岗位匹配度分析，并生成更「像人」的简洁私信话术。

【RAG 知识库（精选片段，规则/范式/示例）】
"""
{rag_context}
"""

【用户简历（结构化摘要）】
"""
{resume_summary_json}
"""

【用户详细履历（结构化摘要，可选）】
"""
{detailed_resume_summary_json}
"""

【目标岗位（结构化摘要）】
"""
{job_summary_json}
"""

输出要求（必须严格遵守）：
- 严格按照 JSON Schema 返回；不得输出多余文字或 Markdown。
- 'match_score' 必须提供 0-100 的数值评分。
- 'overall_assessment' 使用简洁标签（高度匹配/中度匹配/存在挑战）。
- 字段名必须严格使用英文键名：
  - strengths[].point, strengths[].evidence, （可选）strengths[].section
  - weaknesses[].point, weaknesses[].suggestion
  - cover_letter_script 为单个字符串，不要返回对象
- 'strengths'：逐点给出 point、来自简历的 evidence、关联板块（experience/skills/projects）。
- 'weaknesses'：逐点给出 point、可操作的 suggestion；优先结合 RAG 规则。
- 'cover_letter_script' 语气与风格：礼貌自信、第一人称、平台私信风格（更像真人、避免模板腔）。长度：≤120字。结构：
  - Hook：1行，包含目标岗位与 2–4 个 JD 关键词；
  - Value：1–2行，呈现 1–2 个与 JD 必须项对齐的量化成果；
  - Close：1行，简洁表达兴趣；不要主动安排或请求电话/会议。
- 禁止：问候语、姓名自我介绍、约电话/会议、冗长客套。`,
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
1.  **突出优势**：放大 \`match_analysis_json\` 中提到的所有 \`strengths\`。
2.  **量化成就**：使用 RAG 知识库中的“XYZ 法则” 和“动作动词” 重写项目描述。
3.  **关键词匹配**：确保 \`job_summary_json\` 中的“mustHaves”关键词在新简历中显眼地出现。
4.  **规避劣势**：弱化或删除与 JD 无关、且暴露劣势（\`weaknesses\`）的条目。
5.  **输出 Markdown**：严格按照 Schema 输出完整的 Markdown 简历和修改摘要。`,
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
    * **必须**包含针对 \`match_analysis_json\` 中 \`weaknesses\`（劣势） 的压力测试问题（例如：“我看到你只有 2 年经验，我们这个岗位要求 5 年，你如何胜任？”）。
    * **必须**结合 RAG 知识库，为每个问题提供“回答思路”和“STAR 案例建议”。
3.  **反问问题**：结合 RAG 知识库，提供 3 个高质量的反问问题。`,
    variables: [
      'rag_context',
      'customized_resume_md',
      'job_summary_json',
      'match_analysis_json',
    ],
    outputSchema: SCHEMAS_V2.INTERVIEW_PREP,
  },
  // 非生成型任务（嵌入/RAG流水线）占位模板
  rag_embedding: {
    id: 'rag_embedding',
    name: 'RAG 嵌入生成',
    description: '仅用于嵌入生成与日志记录的占位模板（不进行文本生成）。',
    systemPrompt: SYSTEM_BASE,
    userPrompt: `返回一个空的 JSON 对象。本模板仅作为嵌入任务的占位符。`,
    variables: ['text'],
    outputSchema: { type: 'object', properties: {} } as JsonSchema,
  },
  // --- 视觉OCR提取 ---
  ocr_extract: {
    id: 'ocr_extract',
    name: 'OCR 文本提取',
    description: '对 Base64 编码的图像执行 OCR，并返回结构化文本。',
    systemPrompt: SYSTEM_BASE,
    userPrompt: `你将收到一张 Base64 编码的图像及其来源类型。
你的任务是进行 OCR 并返回严格有效的 JSON 对象，遵循以下 Schema。

说明：
- 只包含你有把握提取的文本，不要臆造。
- 如有版式特征（表格、列表、章节），请检测并标注。
- 如果图像不是以文本为主，请在 notes 中说明。
- 必须以 JSON 对象形式输出，不要包含多余说明文字。

输入：
- source_type: {{source_type}}
- image_base64:
"""
{{image}}
"""`,
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
