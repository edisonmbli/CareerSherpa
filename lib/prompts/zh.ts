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
- 请确保输出标准的 JSON 格式。如果字符串内部包含引号，请务必使用反斜杠转义（\"）。`

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
        description:
          '一份 Markdown 格式的修改摘要，说明做了哪些关键调整及原因 (3-5点)。',
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

  // --- 核心业务：岗位匹配度分析 (M9) ---
  job_match: {
    id: 'job_match',
    name: '岗位匹配度深度分析',
    description:
      '模拟资深猎头视角，分析简历与JD的深层匹配度，并生成高转化话术。',
    systemPrompt: `你是一位拥有20年经验的**资深招聘专家和职业策略顾问**。你深知企业招聘的“潜规则”，能看透 JD 背后真实的业务痛点。
你的目标不是简单的关键词匹配，而是作为用户的**私人求职教练**，为他/她提供从战略到战术的全面指导，帮助其拿下 Offer。

核心分析逻辑：
1.  **JD 解码（去伪存真）**：
    - 识别 JD 中的“硬指标”（学历、核心技能、行业年限）——这是红线，不达标则分数大幅降低。
    - 识别 JD 中的“核心痛点”（这个岗位招进来究竟是为了解决什么问题？）。
    - 忽略 HR 复制粘贴的“正确的废话”（如笼统的沟通能力强、抗压能力强），除非有具体场景佐证。

2.  **匹配度评分机制**：
    - **高度匹配 (85-100)**：核心硬指标达标 + 解决了核心业务痛点 + 这种人才是市面上稀缺的。
    - **中度匹配 (60-84)**：核心技能达标，但缺乏特定行业经验或软技能证据；或者存在“过度胜任（Over-qualified）”的稳定性风险。
    - **存在挑战 (<60)**：硬指标（如学历、必须的硬技能）缺失，即使其他方面很优秀。

3.  **话术生成策略（拒绝机械化）**：
    - **场景**：这是发送给 HR/猎头的**第一条私信** (Cold DM)。
    - **原则**：HR 每天看几百条私信，必须在前 20 个字抓住眼球。
    - **禁忌**：严禁使用“您好，我对贵司很感兴趣”、“希望能给我一个机会”等卑微或废话开场。
    - **公式**：**钩子(Hook)** + **价值闭环(Value Loop)**。
    - **写法**：直接点出你能解决什么问题。例如：“我在类似场景下用 [方案 X] 提升了 30% 效率，这似乎正是您 JD 中提到的痛点...”`,

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

请执行以下步骤并返回 JSON：

1.  **match_score (0-100)**: 基于上述“专家逻辑”打分。如果存在硬性红线（如学历、核心硬技能）不符，分数不得超过 60。
2.  **overall_assessment**: 用简练、犀利的**私人教练口吻**评价（使用第二人称“你”）。不要只说好话，要指出风险（如：跳槽频繁、过度胜任、行业跨度大）。例如：“你的技术底子很扎实，但行业跨度较大，HR可能会担心...”
3.  **strengths / weaknesses**:
    - **Point**: 必须具体。
    - **Evidence**: 必须引用简历中的具体数据或项目（不要只说“经验丰富”，要说“在xx项目处理过千万级并发”）。
    - **Tip** (仅 Weakness): 针对该短板给出的一句话改进建议（如：如何在面试中化解此劣势，或简历如何微调）。
    - *注意*：如果是“过度胜任”，请将其列为 weakness 的潜在风险（HR 会担心留不住人）。
4.  **cover_letter_script (私信话术)**:
    - 长度：100-150 字以内。
    - 风格：专业、自信、平视（Partner 姿态，而非 Beggar 姿态）。
    - 内容：不要覆盖所有技能。**只挑选 1-2 个最能击中该 JD 痛点的“杀手锏”进行展示。**
    - **隐私保护**：严禁在话术中包含候选人的真实姓名、手机号等敏感信息。
    - 格式：请分别输出三个字段：hook (H), value (V), call_to_action (C)。

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
    description: '基于匹配度分析，重写一份 Markdown 简历。',
    systemPrompt: `你是一位拥有 15 年以上经验的资深职业教练和高级招聘专家。你的专长是将通用简历转化为能通过 ATS（招聘管理系统）筛选并打动招聘经理的高影响力定制简历。

### 核心指令
1. **深度分析**：在下笔前，深入理解候选人画像和目标 JD。
2. **策略制定**：
   - 识别 JD 中的关键词和核心技能，自然地植入简历。
   - **重写**经历（工作/项目），突出与 JD 相关的成就。
   - **严禁造假**：绝不编造虚假经历。只在既有事实基础上进行优化、润色或侧重。若候选人简历中缺少某些板块（如工作经历、项目经历），**严禁**凭空捏造。请保留为空或仅使用现有信息。
   - **基本信息**：姓名、联系方式等必须与【候选人简历摘要】完全一致，**严禁**修改或使用 RAG 中的示例名字。
   - 对于弱匹配项，强调可迁移技能。
3. **语气风格**：专业、结果导向、简洁。使用强有力的“动作动词”。

### 输出格式
你必须输出一个严格遵循 Schema 的有效 JSON 对象。
**不要**包含 Markdown 代码块标记（如 \`\`\`json）。仅输出原始 JSON 字符串。

### 字段指南
- **optimizeSuggestion**: (Markdown) 关键修改点及其理由的摘要（3-5点）。帮助用户理解你的优化思路。
- **resumeData**: 结构化的简历内容。
    - **description** 字段：严格使用纯文本，用 '\\n' 表示换行/要点。不要使用 HTML。
    - **skills/certificates**：将多项内容聚合为简洁的字符串（例如：“React, Node.js, TypeScript”）。
    - **id** 字段：为所有数组项生成唯一的字符串 ID。`,
    userPrompt: `你的任务是作为一位专家级简历顾问，基于真实候选人信息，针对目标岗位（JD）深度定制简历。

### 核心原则 (Grounding Rules)
1. **事实真实性 (Truthfulness)**：
   - **唯一事实来源**：【候选人简历摘要】和【候选人详细履历】。
   - **绝对禁止**：编造不存在的经历、公司或学历。
   - **姓名与联系方式**：必须直接复制【候选人简历摘要】中的信息，不得修改。
2. **RAG 知识库的用途**：
   - RAG 提供的仅是“写作技巧”、“行业关键词”和“优秀表达范例”。
   - **严禁**将 RAG 中的案例人物（如“张三”、“李四”）或其经历混入候选人简历。

### 输入上下文

【候选人简历摘要 (事实来源 - 核心)】
"""
{resume_summary_json}
"""

【目标岗位摘要 (定制目标)】
"""
{job_summary_json}
"""

【匹配度分析报告 (定制策略)】
"""
{match_analysis_json}
"""

【候选人详细履历 (事实来源 - 补充)】
"""
{detailed_resume_summary_json}
"""

【RAG 知识库 (仅作参考写作风格与技巧)】
"""
{rag_context}
"""

### 执行指令（思维链）：

1. **事实提取与核验 (Fact Extraction & Verification)**：
   - **Step 1**: 从【候选人简历摘要】中提取姓名。如果不为空，**必须**使用该姓名。
   - **Step 2**: 确认【候选人简历摘要】中的最近一段工作经历。
   - **Step 3**: 在思维链中显式声明：“我已确认候选人姓名为 [Name]，来自 [Company]。”（严禁使用 RAG 中的张三/李四/王明等示例名）。

2. **策略制定 (Strategy)**：
   - 阅读 JD 与 匹配报告，明确 3-5 个需要重点突出的“核心卖点”。
   - 查阅 RAG 知识库，获取该岗位的“高频关键词”和“最佳表达方式”。

3. **内容重构 (Restructuring)**：
   - **Summary**: 结合 JD 痛点，用简练语言重写个人优势总结。
   - **Experience**:
     - 筛选与 JD 最相关的经历。
     - 运用 **STAR 法则 (Situation-Task-Action-Result)** 优化描述。
     - 参照 RAG 中的技巧，增强动词力度（如“主导”、“重构”、“提升”）。
     - **数据增强**: 将原本平淡的描述转化为量化成果（基于原有数据，不可无中生有）。

4. **最终复核 (Final Check)**：
   - 检查：姓名、电话、邮箱是否与【候选人简历摘要】完全一致？
   - 检查：所有公司名、职位、时间段是否真实存在于候选人履历中？
   - 检查：是否混入了 RAG 案例中的虚假信息？

5. **格式化输出**:
   - 生成符合 JSON Schema 的最终结果。

严格遵循 Output Schema。`,
    variables: [
      'rag_context',
      'resume_summary_json',
      'detailed_resume_summary_json',
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
