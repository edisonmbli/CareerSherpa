import { z } from 'zod'
import { DEFAULT_SECTION_ORDER } from '@/lib/constants'

// ==========================================
// 1. 原子数据结构 (Data Structures)
// ==========================================

// 基础信息 (固定置顶，通常不参与普通排序，但内容可编辑)
export const basicInfoSchema = z.object({
  name: z.string().optional().describe('姓名'),
  mobile: z.string().optional().describe('手机号'),
  email: z.string().optional().describe('邮箱'),
  wechat: z.string().optional().describe('微信号'),
  qq: z.string().optional().describe('QQ号'),
  github: z.string().optional().describe('GitHub'),
  linkedin: z.string().optional().describe('LinkedIn'),
  website: z.string().optional().describe('个人网站'),
  twitter: z.string().optional().describe('Twitter'),
  behance: z.string().optional().describe('Behance'),
  dribbble: z.string().optional().describe('Dribbble'),
  location: z.string().optional().describe('所在城市'),
  address: z.string().optional().describe('详细地址'),
  photoUrl: z.string().optional().describe('头像URL'),
  summary: z.string().optional().describe('个人总结/职业摘要'),
  lang: z.enum(['zh', 'en']).default('zh').describe('简历语言'),
})

// 通用列表项 (用于教育、工作、项目)
// description 字段统一约定：使用纯文本，换行符 \n 代表新的 bullet point
export const educationSchema = z.object({
  id: z.string().describe('UUID'),
  school: z.string().optional().describe('学校名称'),
  major: z.string().optional().describe('专业'),
  degree: z.string().optional().describe('学历'),
  startDate: z.string().optional().describe('开始时间'),
  endDate: z.string().optional().describe('结束时间'),
  description: z.string().optional().describe('在校经历描述'),
})

export const workExperienceSchema = z.object({
  id: z.string(),
  company: z.string().optional().describe('公司名称'),
  position: z.string().optional().describe('职位'),
  industry: z.string().optional().describe('行业'), // 针对匹配分析很有用
  location: z.string().optional().describe('工作地点'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  description: z.string().optional().describe('工作内容描述'), // 重点：包含 \n 的纯文本
})

export const projectExperienceSchema = z.object({
  id: z.string(),
  projectName: z.string().optional().describe('项目名称'),
  role: z.string().optional().describe('担任角色'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  githubUrl: z.string().optional().describe('GitHub链接'),
  demoUrl: z.string().optional().describe('作品/演示链接'),
  description: z.string().optional().describe('项目详情描述'), // 重点：包含 \n 的纯文本
})

// 自定义板块 (用于无法归类的额外信息)
export const customSectionItemSchema = z.object({
  id: z.string(),
  title: z.string().optional().describe('小标题'),
  description: z.string().optional().describe('描述内容'),
})

// ==========================================
// 2. 完整简历数据 (Resume Data)
// ==========================================

export const resumeDataSchema = z.object({
  basics: basicInfoSchema,

  // 列表型板块
  educations: z.array(educationSchema).default([]),
  workExperiences: z.array(workExperienceSchema).default([]),
  projectExperiences: z.array(projectExperienceSchema).default([]),

  // 文本型板块 (前端解析换行符渲染为列表)
  skills: z.string().optional().describe('技能特长'),
  certificates: z.string().optional().describe('证书奖项'),
  hobbies: z.string().optional().describe('兴趣爱好'),

  // 扩展板块
  customSections: z
    .array(customSectionItemSchema)
    .default([])
    .describe('其他自定义板块'),

  // 用户自定义章节标题 (覆盖默认翻译)
  // Note: Use explicit object instead of z.record() for Gemini API compatibility
  // Note: passthrough() removed - may cause LangChain schema conversion issues
  sectionTitles: z.object({
    basics: z.string().optional(),
    summary: z.string().optional(),
    educations: z.string().optional(),
    workExperiences: z.string().optional(),
    projectExperiences: z.string().optional(),
    skills: z.string().optional(),
    certificates: z.string().optional(),
    hobbies: z.string().optional(),
    customSections: z.string().optional(),
    // Add any additional known section keys here
    languages: z.string().optional(),
    awards: z.string().optional(),
    publications: z.string().optional(),
    references: z.string().optional(),
  }).optional().describe('自定义章节标题'),
})

// ==========================================
// 3. 布局配置 (Layout Config)
// ==========================================

// 用于控制 ResumeEditor 的章节顺序和显隐
export const sectionConfigSchema = z.object({
  order: z.array(z.string()).default([...DEFAULT_SECTION_ORDER]),
  hidden: z.array(z.string()).default([]),
  // Note: Use explicit object instead of z.record() for Gemini API compatibility
  // Note: passthrough() removed - may cause LangChain schema conversion issues
  pageBreaks: z.object({
    basics: z.boolean().optional(),
    summary: z.boolean().optional(),
    educations: z.boolean().optional(),
    workExperiences: z.boolean().optional(),
    projectExperiences: z.boolean().optional(),
    skills: z.boolean().optional(),
    certificates: z.boolean().optional(),
    hobbies: z.boolean().optional(),
    customSections: z.boolean().optional(),
    // Add any additional known section keys here
    languages: z.boolean().optional(),
    awards: z.boolean().optional(),
    publications: z.boolean().optional(),
    references: z.boolean().optional(),
  }).optional().describe('章节后强制分页'),
})

// ==========================================
// 4. LLM 交互结构 (AI Response)
// ==========================================

export const llmResumeResponseSchema = z.object({
  fact_check: z
    .object({
      extracted_name: z.string().describe('从简历摘要中提取的姓名'),
      extracted_company: z.string().describe('从简历摘要中提取的最近公司'),
      verification_status: z.enum(['PASS', 'FAIL']).describe('核验结果'),
    })
    .describe('事实核验信息'),
  optimizeSuggestion: z.string().describe('简历修改建议(Markdown)'),
  resumeData: resumeDataSchema.describe('完整的简历数据JSON'),
})

// ==========================================
// 5. TypeScript 类型导出
// ==========================================

export type ResumeData = z.infer<typeof resumeDataSchema>
export type SectionConfig = z.infer<typeof sectionConfigSchema>
export type LLMResumeResponse = z.infer<typeof llmResumeResponseSchema>

// 辅助类型
export type WorkExperience = z.infer<typeof workExperienceSchema>
export type Education = z.infer<typeof educationSchema>
export type ProjectExperience = z.infer<typeof projectExperienceSchema>
