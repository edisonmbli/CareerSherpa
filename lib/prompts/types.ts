/**
 * 共享的 Prompt 模板接口
 * (Based on prototype templates.ts)
 */

export interface JsonSchema {
  type: string
  properties?: Record<string, any>
  items?: any
  required?: string[]
  [key: string]: unknown
}

export interface PromptTemplate {
  id: string // 'resume_summary', 'job_match', etc.
  name: string
  description: string
  systemPrompt: string // 基础 System Prompt
  userPrompt: string // 任务指令 (包含 {{variables}})
  variables: string[] // 模板中使用的变量
  outputSchema: JsonSchema // 强制的 JSON 输出结构
}

// 任务 ID，用于 M4 的 `service.ts` 调用
export type TaskTemplateId =
  | 'resume_summary'
  | 'detailed_resume_summary'
  | 'job_summary'
  | 'job_match'
  | 'resume_customize'
  | 'interview_prep'
  | 'ocr_extract'
  // 非对话/非生成型任务的统一日志标识（用于嵌入生成、RAG流水线）
  | 'rag_embedding'

export type PromptTemplateMap = Record<TaskTemplateId, PromptTemplate>
