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
- 使用与用户输入一致的语言（中文/英文）
- 请确保输出标准的 JSON 格式。如果字符串内部包含引号，请务必使用反斜杠转义（\"）。

### JSON 输出规范（必须严格遵循）
- 你的输出必须是**有效的 JSON 对象**，可被 JSON.parse() 直接解析
- **禁止**包含 markdown 代码块（如 \`\`\`json ... \`\`\`）
- **禁止**使用中文引号 "..." '...'，必须使用标准 ASCII 双引号 "..."
- **禁止**在 JSON 前后添加任何说明文字或注释
- 如果字符串内部包含引号，请务必使用反斜杠转义（\\"）`

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
    required: ['jobTitle', 'company', 'mustHaves', 'niceToHaves'],
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
        type: 'object',
        properties: {
          H: {
            type: 'string',
            description: 'Hook (钩子): 吸引 HR 注意的开场白',
          },
          V: {
            type: 'string',
            description: 'Value (价值): 针对 JD 痛点的核心成就',
          },
          C: {
            type: 'string',
            description: 'Call to Action (行动): 引导下一步交流',
          },
        },
        required: ['H', 'V', 'C'],
        description:
          '一段 150 字以内、高度定制化的“毛遂自荐”私信话术 (H-V-C 结构)',
      },
      recommendations: {
        type: 'array',
        items: {
          type: 'string',
          description: '针对整体情况的三条具体行动建议 (高价值/可执行)',
        },
        description: '给用户的后续行动指南 (3条)',
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

  RESUME_CUSTOMIZE: {
    type: 'object',
    properties: {
      fact_check: {
        type: 'object',
        properties: {
          extracted_name: {
            type: 'string',
            description: '从简历摘要中提取的姓名',
          },
          extracted_company: {
            type: 'string',
            description: '从简历摘要中提取的最近公司',
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
        description: `Markdown 格式改动摘要，严格遵循以下结构：
### 简历优化建议
[一句话概述本次优化的核心方向]

1. **模块名 - 经历/项目名**：要点总结
   - **调整**：具体修改内容描述
   - **理由**：为何这样改，如何匹配JD需求

2. **模块名 - 经历/项目名**：要点总结
   - **调整**：具体修改内容描述
   - **理由**：为何这样改

(共3-5条，每条必须包含 调整 和 理由 两个子项)`,
      },
      resumeData: {
        type: 'object',
        description: '结构化的完整简历内容。',
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
    required: ['fact_check', 'optimizeSuggestion', 'resumeData'],
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
    userPrompt: `请"提取而非改写"以下简历原文，**严格按照 JSON Schema 输出完整的结构化结果**。

**完整提取规则（重要）：**
1. 必须填充 JSON Schema 中的**所有字段**，包括：header、summary、summary_points、specialties_points、experience、projects、education、skills、certifications、languages、awards、openSource、extras
2. 如果原文中不存在某类信息，请返回**空数组 []** 或**空字符串 ""**，不要省略字段
3. 即使只有一项内容，也必须正确填入对应字段

**提取指引：**
– **职责（responsibilities）**：原样提取所有以"负责/主导/作为唯一负责人"等开头的职责句
– **成果亮点（highlights）**：提取可量化的、有影响力的结果（如提效、同比提升、用户指标等）
– **项目与链接**：保留项目名/链接/简短描述
– **要点还原**：职业摘要与专业特长采用"要点列表"逐条复制原文，不做二次改写

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
    userPrompt: `请"提取而非改写"以下个人详细履历原文，**严格按照 JSON Schema 输出完整的结构化结果**。

**完整提取规则（重要）：**
1. 必须填充 JSON Schema 中的**所有字段**，包括：header、summary、experiences、capabilities、rawSections 等
2. 如果原文中不存在某类信息，请返回**空数组 []** 或**空字符串 ""**，不要省略字段
3. 必须逐条复制原文要点，不合并、不重写，保留所有数量/百分比/时间范围

**识别与映射规则：**
1) 公司段：当出现“公司/产品/在职时间/关键词”四要素时，创建 experiences[] 项，填充 company、product_or_team、role、duration、keywords[]。
2) 项目高亮：将项目的任务/行动/成果整合为 highlights[] 字符串数组；量化指标格式化为 metrics[] 字符串数组，如 "新用户7日留存 +3.2%"。
3) 能力分节：识别各类能力描述，写入 capabilities[] 字符串数组，每个字符串是一个能力要点。
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

— 项目高亮与量化示例 —
原文：
项目：内容推荐重排
任务：降低冷启动损耗
行动：构建用户-内容相似度特征；上线召回+重排多臂Bandit
成果：新用户7日留存+3.2%；播放完成率+5.6%
映射（扁平格式）：
highlights: ["内容推荐重排项目：降低冷启动损耗","构建用户-内容相似度特征","上线召回+重排多臂Bandit"]
metrics: ["新用户7日留存 +3.2%","播放完成率 +5.6%"]

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
    userPrompt: `请解析以下岗位描述（JD）原文，**严格按照 JSON Schema 输出完整的结构化结果**。

**完整提取规则（重要）：**
1. 必须填充 JSON Schema 中的**所有字段**，包括：title、company、location、requirements、nice_to_haves、tech_stack、benefits、company_info 等
2. 如果原文中不存在某类信息，请返回**空数组 []** 或**空字符串 ""**，不要省略字段
3. 重点是区分"必须项"（Must-haves / requirements）和"加分项"（Nice-to-haves）

JD原文:
"""
{job_text}
"""`,
    variables: ['job_text'],
    outputSchema: SCHEMAS_V1.JOB_SUMMARY,
  },

  // --- 核心业务：岗位匹配度分析 (M9) ---
  job_match: {
    id: 'job_match',
    name: '岗位匹配度深度分析',
    description:
      '模拟资深猎头视角，分析简历与JD的深层匹配度，并生成高转化话术。',
    systemPrompt: `你是一位拥有20年经验的**私人求职教练**。你曾任多家 Fortune 500 企业的 HR 总监，深知招聘漏斗各环节的"潜规则"。

你的使命不是简单的关键词匹配，而是站在**用户的私人教练**角度，用第二人称"你"与用户对话，帮助其从战略到战术层面拿下 Offer。

### 核心分析框架

**Step 1: JD 解码（去伪存真）**
- 识别**硬性红线**（Hard Requirements）：学历、核心硬技能、特定行业年限
  → 若不达标，无论其他多优秀，分数上限 60
- 识别**核心业务痛点**（Core Pain Point）：这个岗位招进来究竟要解决什么问题？
- 过滤**正确的废话**（Generic Fluff）：笼统的"沟通能力强/抗压能力强"，除非有具体场景佐证

**Step 2: 隐性风险识别**
- **过度胜任（Over-qualified）**：资历远超岗位要求 → 稳定性担忧
- **跳槽频繁（Job Hopper）**：近 5 年内多次短期任职 → 忠诚度怀疑
- **行业跨度大（Industry Mismatch）**：非相关行业背景 → 上手成本担忧
- **技术债务（Tech Stack Gap）**：核心技术栈缺失 → 培训成本担忧

**Step 3: 匹配度评分标准**
- **85-100 高度匹配**：硬性红线达标 + 核心痛点命中 + 稀缺人才画像
- **60-84 中度匹配**：技能达标但存在以下任一风险：行业经验不足、过度胜任、软技能证据不足
- **<60 存在挑战**：硬性红线不达标（学历/核心技能缺失）

**Step 4: 话术钩子策略（拒绝机械化）**
> 这是发送给 HR/猎头的**第一条私信（Cold DM）**，不是传统求职信

- **场景认知**：HR/猎头每天收到数百条私信，只用 2-3 秒扫一眼消息列表。你必须在**前 15 个字**就让对方识别到"这人可能有戏"。
- **绝对禁止的开场词**（检测到这些词汇必须重写）：
  - ❌ "您好"、"你好"
  - ❌ "我是一名..."、"我有N年经验..."
  - ❌ "希望您能给我一个机会"、"希望能获得..."
  - ❌ "对贵司很感兴趣"、"非常感兴趣"
- **H-V-C 公式**：
  - **H (Hook/资质快闪)**：在 15 字内展示"稀缺标签"，公式 = [背景标签] + [与JD匹配的稀缺定位] + [可选：量化成果]
  - **V (Value/证据佐证)**：用 1-2 个具体数据或案例**证明 H 中的标签可信**
  - **C (CTA/行动邀约)**：简洁的下一步邀请
- **语气**：专业、自信、**平视**（Partner 姿态而非 Beggar 姿态）`,

    userPrompt: `请基于以下材料进行专家级匹配度分析：

【岗位 JD (结构化)】
"""
{job_summary_json}
"""

【候选人简历 (结构化)】
"""
{resume_summary_json}
"""

【候选人详细履历 (可选参考)】
"""
{detailed_resume_summary_json}
"""

【RAG 知识库 (规则/范式)】
"""
{rag_context}
"""

### 执行步骤

**Step 1: JD 解码**
- 列出 3-5 个硬性红线（Must-haves）
- 识别 1-2 个核心业务痛点
- 标记被忽略的"废话"条款

**Step 2: 简历扫描与风险识别**
- 逐条检查硬性红线达标情况
- 识别隐性风险：过度胜任/跳槽频繁/行业跨度

**Step 3: 生成输出 JSON**

按照以下字段要求输出：

1. **match_score** (0-100): 
   - 基于上述分析打分
   - 若学历不达标 → 上限 55
   - 若核心硬技能缺失 → 上限 60
   - 若存在"过度胜任"且未列入 weaknesses → 扣 10 分

2. **overall_assessment**: 
   - 用"你"与用户对话的**私人教练口吻**
   - **隐私保护**：严禁使用候选人真实姓名，用"你"代替
   - 不要只说好话，要犀利指出风险
   - 示例："你的技术底子很扎实，但行业跨度较大，HR 可能会担心上手成本..."

3. **strengths** (数组):
   - **point**: 必须具体，禁止笼统
   - **evidence**: 必须引用简历中的具体数据或项目

4. **weaknesses** (数组):
   - **point**: 必须具体
   - **evidence**: 必须引用简历中的具体数据
   - **tip**: 对象，包含两个字段：
     - **interview**: 如何在面试中化解该风险
     - **resume**: 如何调整简历措辞降低风险暴露
   - 若存在"过度胜任"，必须列为 weakness

5. **cover_letter_script** (对象，**严格使用以下 Key**):
   - 必须输出为 {{ "H": "...", "V": "...", "C": "..." }} 格式
   - **H** (Hook/资质快闪): 前 15 字必须是[背景标签+稀缺定位]，禁止"您好/我是/希望"开头
   - **V** (Value/证据佐证): 1-2 句，用具体数据/案例证明 H 中的标签可信
   - **C** (CTA/行动邀约): 1 句，简洁的下一步邀请
   - **总长度**: 80-120 字以内
   - **隐私保护**: 严禁包含候选人真实姓名、手机号

   **正确示例**:
   {{
     "H": "腾讯产品经理+传统零售数字化实战，主导ERP/CRM全线升级效率提升60%。",
     "V": "在班尼路，我将100+纸质流程电子化，市场决策周期从周级压缩到日级；这正是消费品企业数字化的核心命题。",
     "C": "附件是我的简历，期待有机会交流。"
   }}

   **错误示例（禁止）**:
   - ❌ "H": "您好，关注到贵司的职位..."
   - ❌ "H": "我是一名拥有12年经验的产品人..."
    - ❌ "H": "消费品企业数字化转型的核心痛点是..."（问题开头，HR 无感）
 
   6. **recommendations** (数组):
      - 必须且仅包含 **3条** 高价值建议
      - 建议方向：技能提升、简历微调、面试策略
      - 语气：鼓励性但务实
 
    严格遵循 Output Schema 输出 JSON。`,
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
    name: '简历定制化',
    description: '基于匹配度分析，对用户简历进行精准增值优化。',
    systemPrompt: `你是一位资深的**简历增值编辑**。你的职责不是"代写"简历，而是**在最大限度尊重用户原稿的基础上，进行最小必要的精准优化**。

用户已经花时间精心梳理了自己的简历，这是他们的心血结晶。你的每一处改动都必须有明确的"加分理由"——要么更好地匹配 JD 需求，要么让表达更有力。

### 核心策略：三层内容处理模型

**Layer 1: PRESERVE (保留)**
- 原简历中"已经足够好"的表达 → 原样保留，一字不改
- 判断标准：已含 JD 关键词、有量化数据、逻辑清晰
- 示例：如果用户写的是"主导XX系统重构，提升性能30%"，且与 JD 相关，直接保留

**Layer 2: REFINE (微调)**
- 原简历中"有素材但表达不够好"的部分 → 精准润色
- 典型操作：弱动词→强动词、模糊描述→量化表达、用 JD 术语替换同义词
- 示例："负责用户增长" → "主导用户增长策略，DAU 提升 25%"（仅当原文有 DAU 数据时）

**Layer 3: AUGMENT (增益)**
- 详细履历中有、但原简历未采用的"Golden Points" → 谨慎引入
- **仅当**该点能显著提升 JD 匹配度时才添加
- 融合方式：织入现有段落，避免突兀；不要独立成段

### 克制原则
- 改动要"少而精"，不是"多而全"
- 用户看到定制简历时，应该感到：① 安全（我的内容被尊重了）② 惊喜（AI 帮我优化了几处关键点）
- **严禁**大面积改写用户原文，那会让用户失去掌控感

### 事实真实性
- **唯一事实来源**：【候选人原始简历】和【候选人详细履历】
- **绝对禁止**：编造不存在的经历、公司或学历
- **技能与工具**：仅可选取候选人简历中已明确列出的技能
  - 允许：从 skills.tools 或工作经历 stack 中选取并重新分组
  - **严禁**：添加候选人简历中未提及的工具/技能（即使 JD 明确要求）
  - **若 JD 要求某技能但候选人无**：在 optimizeSuggestion 中提示"建议用户自行补充该技能"，而非直接添加
- **姓名与联系方式**：必须直接复制原始简历中的信息，**严禁**修改
- **RAG 知识库**：仅用于 Layer 2 的表达润色参考，**严禁**将 RAG 中的案例人物或经历混入简历

### 输出格式
输出严格遵循 Schema 的有效 JSON 对象。**不要**包含 Markdown 代码块标记。

### 字段指南
- **optimizeSuggestion**: (Markdown) 列出 3-5 处**最关键的改动**，每处需包含：
  1. **改动位置**：哪个模块、哪条经历
  2. **改动内容**：Before → After 简述
  3. **改动理由**：为什么能加分（关联 JD 需求）
- **resumeData**: 结构化简历内容
  - **description** 字段：纯文本，用 '\\n' 表示换行
  - **skills**: 采用分类精简格式，**严禁**关键词堆砌
    - **核心能力**（3-5项）：按优先级提炼
      1. 优先从 resume_summary 的 specialties_points 中提炼匹配 JD 的能力领域
      2. 若无 specialties_points，从 skills.technical 中选取高阶能力词
      3. 若 skills 也缺失，从工作经历 highlights 中提炼关键能力
    - **工具技术**（5-8项）：按优先级选取
      1. 优先从 skills.tools 中选取 JD 相关的
      2. 若无 skills.tools，从工作经历的 stack 字段中汇总
    - **兜底规则**：若以上数据均缺失，输出 "请根据您的具体经验补充核心技能"
    - **格式示例**：
      "核心能力：产品策略与0-1构建 | 数据驱动决策 | 数字化转型领导力\\n工具技术：Java, BI工具, ERP/POS/CRM"
    - **错误示例**（不要这样输出）：
      "业务洞察, 产品定义, 技术协同, MVP落地, 全生命周期产品管理, 数据分析, ..."
  - **certificates**：聚合为简洁字符串
  - **id** 字段：为数组项生成唯一 ID`,
    userPrompt: `你的任务是作为**简历增值编辑**，对用户的原始简历进行"最小必要"的精准优化，使其更匹配目标岗位。

### 输入上下文

【候选人原始简历 (定稿基准 - 最大限度保留)】
这是用户精心梳理的版本。除非有明确加分理由，否则保持原样。
"""
{resume_summary_json}
"""

【目标岗位摘要 (JD - 定制目标)】
"""
{job_summary_json}
"""

【匹配度分析报告 (Strengths/Weaknesses)】
- Strengths：指导你强化哪些点
- Weaknesses：指导你补齐哪些点（从详细履历中挖掘）
"""
{match_analysis_json}
"""

【候选人详细履历 (素材库 - 仅用于 AUGMENT)】
包含更多细节，仅用于 Layer 3 增益场景。
"""
{detailed_resume_summary_json}
"""

【RAG 知识库 (写作技巧参考 - 仅用于 REFINE)】
提供行业关键词和优秀表达范例，仅在润色时参考。
"""
{rag_context}
"""

### 执行步骤（思维链）

**Step 1: 身份确认**
- 从【候选人原始简历】中提取姓名和联系方式
- 声明："我已确认候选人姓名为 [Name]。" （严禁使用 RAG 中的示例名）

**Step 2: JD 痛点分析**
- 提取 JD 中 3-5 个核心需求 (Must-haves)
- 识别【匹配度分析报告】中的 Weaknesses（待补齐项）
- 列出："JD 核心需求：① ... ② ... ③ ..."

**Step 3: 原简历扫描与标记**
逐条检查原简历的每个要点，并标记处理策略：
- ✅ **PRESERVE** - 该要点已覆盖 JD 需求，保留原文
- ⚠️ **REFINE** - 有素材但表达不够有力，需润色
- ❌ **AUGMENT** - JD 核心需求未覆盖，需从详细履历补充

示例思维过程：
"原简历第一条工作经历：'负责推荐系统优化' → JD 需求'推荐算法经验' ✅ PRESERVE"
"原简历技能：'Python, SQL' → JD 强调'大数据处理' → 详细履历有'Spark 3年经验' → ❌ AUGMENT"

**Step 4: 增益点挖掘 (针对 ❌ 项)**
- 在【候选人详细履历】中搜索可用素材
- 仅当找到高价值素材时执行 AUGMENT
- 将新增内容织入最相关的现有段落，不要独立成段

**Step 5: 执行改动**
- **PRESERVE**: 直接复制原文，一字不改
- **REFINE**: 仅修改措辞，不改变语义；可参考 RAG 技巧增强动词
- **AUGMENT**: 新增内容自然融入现有结构

**Step 6: 最终复核**
- 姓名、联系方式是否与原简历完全一致？
- 所有公司名、职位、时间段是否真实存在于候选人履历中？
- 是否每一处改动都有明确的 JD 关联理由？
- 是否保持了整体风格一致性，没有突兀的新增内容？

**Step 7: 生成 optimizeSuggestion (严格遵循以下格式)**
\`\`\`markdown
### 简历优化建议
基于[JD核心需求概述]，我们做了以下几处关键调整：

1. **【工作经历 - XX公司项目】** 强化'XXX'与'YYY'能力
   - **调整**：具体修改内容...
   - **理由**：这样改是因为...，匹配JD中XXX需求

2. **【个人总结/技能部分】** 突出XXX亮点
   - **调整**：具体修改内容...
   - **理由**：这样改是因为...
\`\`\`
共输出3-5条建议，每条必须包含 **调整** 和 **理由** 两个子项。

### 最终检查清单（防幻觉与防循环）
1. **禁止输出思维链**：所有的 Step 1-7 仅在你的思维中进行，**绝对不要**输出到 JSON 结果中。
2. **缺失字段留空**：如果原简历中没有某个字段的信息（如 wechat、github、linkedin），直接输出空字符串 \"\"，**严禁捏造或猜测**。例如：如果原简历无微信号，则 wechat: \"\"。
3. **清洗无效数据**：如果发现自己想写 \"请补充\"、\"手机同号\"、\"待定\"、\"此处保持\" 等占位符，**立即停止**，改为输出空字符串 \"\"。
4. **禁止解释**：只输出有效数据，不要在任何字段里写任何解释性文字。
5. **禁止重复**：如果发现自己在输出相同的文字模式，**立即停止当前字段**，直接移动到下一个字段。
6. **禁止回显输入**：**严禁**将输入上下文中的 JSON 结构（如 job_summary_json、detailed_resume_summary_json 的字段 jobTitle、company、mustHaves、points 等）复制到输出中。输出只包含 resumeData 的字段，不要混入输入数据结构。

严格遵循 Output Schema 输出 JSON。`,
    variables: [
      'rag_context',
      'resume_summary_json',
      'detailed_resume_summary_json',
      'job_summary_json',
      'match_analysis_json',
    ],
    outputSchema: SCHEMAS_V2.RESUME_CUSTOMIZE,
  },
  // [DEPRECATED] Free tier simplified prompt - no longer used
  // Gemini-3-flash-preview is capable enough to use full resume_customize prompt
  // resume_customize_lite: {
  //   id: 'resume_customize_lite',
  //   name: '简历定制化 (基础版)',
  //   description: '基于岗位需求，对用户简历进行基础优化。',
  //   systemPrompt: `你是一位简历优化助手...`,
  //   userPrompt: `请根据以下信息，对用户简历进行基础优化...`,
  //   variables: ['resume_summary_json', 'job_summary_json', 'match_analysis_json'],
  //   outputSchema: SCHEMAS_V2.RESUME_CUSTOMIZE,
  // },
  interview_prep: {
    id: 'interview_prep',
    name: '面试定向准备',
    description: '生成自我介绍、高频问题和反问问题。',
    systemPrompt: SYSTEM_BASE,
    userPrompt: `请你扮演面试官和求职教练的角色。
基于这份“定制化简历”和“匹配度报告”，为用户准备一份完整的面试要点清单。

【RAG 知识库 - 面试技巧 (STAR, P-P-F, 常见问题)】
"""
{rag_context}
"""

【用户的定制化简历 (Markdown)】
"""
{customized_resume_md}
"""

【目标岗位 - 结构化摘要】
"""
{job_summary_json}
"""

【匹配度分析报告】
"""
{match_analysis_json}
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
  // --- Free Tier: 合并视觉理解 + 岗位提取 ---
  job_vision_summary: {
    id: 'job_vision_summary',
    name: '图片岗位提取',
    description:
      '直接从JD截图中提取结构化岗位需求。合并OCR和摘要为单一步骤，适用于Free tier。',
    systemPrompt: SYSTEM_BASE,
    userPrompt: `你将收到一张 Base64 编码的岗位描述（JD）截图。
你的任务是直接从图片中提取并结构化关键岗位需求。

说明：
1. 仔细阅读截图中的所有文字
2. 提取岗位名称、公司名称（如可见）和关键需求
3. 区分"必须项"（硬性要求）和"加分项"（可选技能）
4. 如果文字不清晰，根据上下文做合理推断
5. 严格按照指定的 JSON 格式输出

输入图片 (Base64):
"""
{image}
"""

输出必须遵循以下结构：
- jobTitle: 职位名称（必填）
- company: 公司名称（如可见，选填）
- mustHaves: 必须技能/经验数组（至少3项）
- niceToHaves: 加分技能数组（至少2项）

仅输出有效 JSON，不要包含额外说明。`,
    variables: ['image'],
    outputSchema: SCHEMAS_V1.JOB_SUMMARY,
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
- source_type: {source_type}
- image_base64:
"""
{image}
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
