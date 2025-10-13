import { executeLLMTask, LLMTaskResult } from './worker-pool'
import { updateSummaries } from '@/lib/dal'
import { logError, logInfo } from '@/lib/logger'
import { renderTemplate, type TemplateId } from '@/lib/prompts/templates'
import { validateLLMResponse, type ValidationResult } from './json-validator'

export interface ResumeSummary {
  name?: string
  title?: string
  experience?: string[]
  skills?: string[]
  education?: string[]
  highlights?: string[]
  overview?: string
  key_skills?: string[]
  risks?: string[]
  working_experience?: string[]
  projects?: string[]
  summary?: string
  fallback?: boolean
  parse_error?: boolean
  error_details?: string
  parse_warnings?: string[]
}

export interface JobSummary {
  title?: string
  company?: string
  requirements?: string[]
  responsibilities?: string[]
  skills?: string[]
  benefits?: string[]
  level?: string
  role?: string
  must_have?: string[]
  nice_to_have?: string[]
  risks?: string[]
  summary?: string
  fallback?: boolean
  parse_error?: boolean
  error_details?: string
  parse_warnings?: string[]
}

export interface DetailedSummary {
  jobs?: Array<{
    company?: string
    title?: string
    position?: string
    keywords?: string[]
    duration?: string
    highlights?: string[]
    project_experiences?: string[]
    contributions?: string[]
    learnings?: string[]
    improvements?: string[]
    co_working?: string[]
    leadership?: string[]
    problem_solving?: string[]
  }>
  // Legacy fields for backward compatibility
  summary?: string
  key_points?: string[]
  categories?: Record<string, string[]>
  metadata?: Record<string, unknown>
  fallback?: boolean
  parse_error?: boolean
  error_details?: string
  parse_warnings?: string[]
}

export type SummaryJson = ResumeSummary | JobSummary | DetailedSummary

export interface SummaryTask {
  type: 'resume' | 'job' | 'detailed'
  id: string
  text: string
  userId: string
  serviceId: string
}

export interface SummaryResult {
  type: 'resume' | 'job' | 'detailed'
  id: string
  success: boolean
  summaryJson?: SummaryJson
  summaryTokens?: number
  error?: string
  duration: number
}

export interface OrchestrationOptions {
  tier?: 'free' | 'paid'
  timeout?: number // milliseconds
  enableFallback?: boolean
  priority?: number
}

/**
 * Parallel Summary Orchestrator
 * Executes resume, job, and detailed summaries in parallel with timeout and fallback
 */
export class SummaryOrchestrator {
  private defaultTimeout = 30000 // 30 seconds
  private fallbackTimeout = 15000 // 15 seconds for fallback

  /**
   * Execute multiple summary tasks in parallel
   */
  async executeSummaries(
    tasks: SummaryTask[],
    options: OrchestrationOptions = {}
  ): Promise<SummaryResult[]> {
    const {
      tier = 'free',
      timeout = this.defaultTimeout,
      enableFallback = true,
      priority = 1,
    } = options

    // Create parallel promises for each task
    const taskPromises = tasks.map((task) =>
      this.executeSingleSummary(task, {
        tier,
        priority,
        timeout,
        enableFallback,
      })
    )

    // Execute all tasks in parallel with global timeout
    try {
      const results = await Promise.allSettled(
        taskPromises.map((promise) => this.withTimeout(promise, timeout))
      )

      return results.map((result, index) => {
        const task = tasks[index]

        if (result.status === 'fulfilled') {
          return result.value
        } else {
          return {
            type: task.type,
            id: task.id,
            success: false,
            error: result.reason?.message || 'Unknown error',
            duration: timeout,
          }
        }
      })
    } catch (error) {
      // Fallback: return error results for all tasks
      return tasks.map((task) => ({
        type: task.type,
        id: task.id,
        success: false,
        error: error instanceof Error ? error.message : 'Orchestration failed',
        duration: timeout,
      }))
    }
  }

  /**
   * Execute a single summary task with fallback
   */
  private async executeSingleSummary(
    task: SummaryTask,
    options: {
      tier: 'free' | 'paid'
      priority: number
      timeout: number
      enableFallback: boolean
    }
  ): Promise<SummaryResult> {
    const startTime = Date.now()

    try {
      // Primary execution
      const prompt = this.buildSummaryPrompt(task)
      const result = await executeLLMTask(
        task.userId,
        task.serviceId,
        'match', // Use match step for summaries
        prompt,
        {
          tier: options.tier,
          priority: options.priority,
          maxRetries: 2,
        }
      )

      if (result.success && result.response) {
        const parseResult = this.parseSummaryResponse(
          result.response.content,
          task.type
        )

        return {
          type: task.type,
          id: task.id,
          success: true,
          summaryJson: parseResult.summaryJson,
          summaryTokens: result.response.usage?.totalTokens,
          duration: Date.now() - startTime,
        }
      } else {
        throw new Error(result.error || 'LLM task failed')
      }
    } catch (error) {
      // Fallback execution if enabled
      if (options.enableFallback) {
        try {
          const fallbackResult = await this.executeFallbackSummary(task)
          return {
            ...fallbackResult,
            duration: Date.now() - startTime,
          }
        } catch (fallbackError) {
          return {
            type: task.type,
            id: task.id,
            success: false,
            error: `Primary failed: ${
              error instanceof Error ? error.message : error
            }. Fallback failed: ${
              fallbackError instanceof Error
                ? fallbackError.message
                : fallbackError
            }`,
            duration: Date.now() - startTime,
          }
        }
      } else {
        return {
          type: task.type,
          id: task.id,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          duration: Date.now() - startTime,
        }
      }
    }
  }

  /**
   * Fallback summary execution (simplified/rule-based)
   */
  private async executeFallbackSummary(
    task: SummaryTask
  ): Promise<Omit<SummaryResult, 'duration'>> {
    // Simple rule-based fallback
    const text = task.text.slice(0, 2000) // Truncate to manageable size

    let summaryJson: SummaryJson

    switch (task.type) {
      case 'resume':
        summaryJson = this.generateFallbackResumeSummary(text)
        break
      case 'job':
        summaryJson = this.generateFallbackJobSummary(text)
        break
      case 'detailed':
        summaryJson = this.generateFallbackDetailedSummary(text)
        break
      default:
        throw new Error(`Unknown task type: ${task.type}`)
    }

    return {
      type: task.type,
      id: task.id,
      success: true,
      summaryJson,
      summaryTokens: Math.ceil(text.length / 4), // Rough token estimate
    }
  }

  /**
   * Build LLM prompt for summary task
   */
  private buildSummaryPrompt(task: SummaryTask): string {
    let templateId: TemplateId
    let variables: Record<string, string>

    switch (task.type) {
      case 'resume':
        templateId = 'resume_summary'
        variables = { resumeText: task.text }
        break

      case 'job':
        templateId = 'job_summary'
        variables = { jobText: task.text }
        break

      case 'detailed':
        templateId = 'detailed_resume'
        variables = { resumeText: task.text }
        break

      default:
        // Fallback to simple prompt for unknown types
        return `请分析以下内容，提取关键信息并以JSON格式返回结构化摘要。\n\n内容：\n${task.text}`
    }

    const { systemPrompt, userPrompt } = renderTemplate(templateId, variables)
    return `${systemPrompt}\n\n${userPrompt}`
  }

  /**
   * Parse LLM response to extract JSON
   */
  private parseSummaryResponse(
    content: string,
    taskType: 'resume' | 'job' | 'detailed',
    debug?: { reqId?: string; route?: string; userKey?: string }
  ): { summaryJson: SummaryJson; warnings?: string[] } {
    // Define expected fields for each task type
    const expectedFields = {
      resume: {
        education: 'string[]',
        overview: 'string',
        highlights: 'string[]',
        key_skills: 'string[]',
        risks: 'string[]',
        working_experience: 'string[]',
        projects: 'string[]',
      },
      job: {
        role: 'string',
        responsibilities: 'string[]',
        requirements: 'string[]',
        must_have: 'string[]',
        nice_to_have: 'string[]',
        risks: 'string[]',
      },
      detailed: {
        jobs: 'object[]',
      },
    } as const

    const validation = validateLLMResponse<SummaryJson>(
      content,
      expectedFields[taskType],
      {
        debug,
        enableFallback: true,
        maxAttempts: 3,
        strictMode: false,
      }
    )

    if (validation.success && validation.data) {
      const summaryJson = {
        ...validation.data,
        ...(validation.fallbackUsed && { fallback: true }),
        ...(validation.warnings &&
          validation.warnings.length > 0 && {
            parse_warnings: validation.warnings,
          }),
      }

      return {
        summaryJson,
        warnings: validation.warnings,
      }
    } else {
      // Fallback to simple content wrapping
      if (debug) {
        logError({
          reqId: debug.reqId ?? 'unknown',
          route: debug.route ?? 'orchestrator/parseSummaryResponse',
          userKey: debug.userKey ?? 'unknown',
          phase: 'parse_fallback',
          error: validation.error,
          warnings: validation.warnings?.join('; '),
          parseAttempts: validation.parseAttempts,
        })
      }

      return {
        summaryJson: {
          summary: content,
          parse_error: true,
          error_details: validation.error,
        },
        warnings: validation.warnings,
      }
    }
  }

  /**
   * Generate fallback resume summary
   */
  private generateFallbackResumeSummary(text: string): ResumeSummary {
    const lines = text.split('\n').filter((line) => line.trim())

    return {
      name: this.extractName(lines),
      title: this.extractTitle(lines),
      experience: this.extractExperience(lines),
      skills: this.extractSkills(lines),
      education: this.extractEducation(lines),
      highlights: lines.slice(0, 3).map((line) => line.trim()),
      fallback: true,
    }
  }

  /**
   * Generate fallback job summary
   */
  private generateFallbackJobSummary(text: string): JobSummary {
    const lines = text.split('\n').filter((line) => line.trim())

    return {
      title: this.extractJobTitle(lines),
      company: this.extractCompany(lines),
      requirements: this.extractRequirements(lines),
      responsibilities: this.extractResponsibilities(lines),
      skills: this.extractSkills(lines),
      level: this.extractLevel(lines),
      fallback: true,
    }
  }

  /**
   * Generate fallback detailed summary
   */
  private generateFallbackDetailedSummary(text: string): DetailedSummary {
    const lines = text.split('\n').filter((line) => line.trim())

    return {
      summary: lines.slice(0, 2).join(' '),
      key_points: lines.slice(0, 5),
      categories: {
        content: lines,
      },
      metadata: {
        length: text.length,
        lines: lines.length,
      },
      fallback: true,
    }
  }

  // Helper methods for fallback extraction
  private extractName(lines: string[]): string {
    return lines[0]?.trim() || 'Unknown'
  }

  private extractTitle(lines: string[]): string {
    return lines[1]?.trim() || 'Unknown'
  }

  private extractJobTitle(lines: string[]): string {
    const titleLine = lines.find(
      (line) =>
        line.includes('职位') ||
        line.includes('岗位') ||
        line.includes('Position')
    )
    return titleLine?.trim() || lines[0]?.trim() || 'Unknown'
  }

  private extractCompany(lines: string[]): string {
    const companyLine = lines.find(
      (line) => line.includes('公司') || line.includes('Company')
    )
    return companyLine?.trim() || 'Unknown'
  }

  private extractExperience(lines: string[]): string[] {
    return lines
      .filter(
        (line) =>
          line.includes('经验') ||
          line.includes('工作') ||
          line.includes('Experience')
      )
      .slice(0, 3)
  }

  private extractSkills(lines: string[]): string[] {
    return lines
      .filter(
        (line) =>
          line.includes('技能') ||
          line.includes('Skills') ||
          line.includes('能力')
      )
      .slice(0, 5)
  }

  private extractEducation(lines: string[]): string[] {
    return lines
      .filter(
        (line) =>
          line.includes('教育') ||
          line.includes('学历') ||
          line.includes('Education')
      )
      .slice(0, 2)
  }

  private extractRequirements(lines: string[]): string[] {
    return lines
      .filter(
        (line) =>
          line.includes('要求') ||
          line.includes('Requirements') ||
          line.includes('条件')
      )
      .slice(0, 5)
  }

  private extractResponsibilities(lines: string[]): string[] {
    return lines
      .filter(
        (line) =>
          line.includes('职责') ||
          line.includes('工作内容') ||
          line.includes('Responsibilities')
      )
      .slice(0, 5)
  }

  private extractLevel(lines: string[]): string {
    const levelLine = lines.find(
      (line) =>
        line.includes('级别') || line.includes('Level') || line.includes('年限')
    )
    return levelLine?.trim() || 'Unknown'
  }

  private getTypeLabel(type: string): string {
    switch (type) {
      case 'resume':
        return '简历'
      case 'job':
        return '职位描述'
      case 'detailed':
        return '详细信息'
      default:
        return '文档'
    }
  }

  /**
   * Add timeout to a promise
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Timeout after ${timeoutMs}ms`)),
          timeoutMs
        )
      ),
    ])
  }
}

// Global orchestrator instance
export const summaryOrchestrator = new SummaryOrchestrator()

/**
 * High-level function to execute parallel summaries and update database
 */
export async function executeParallelSummaries(
  tasks: SummaryTask[],
  options: OrchestrationOptions = {}
): Promise<SummaryResult[]> {
  const results = await summaryOrchestrator.executeSummaries(tasks, options)

  // Update database with results
  const updateParams: {
    resumeId?: string
    resumeSummaryJson?: SummaryJson
    resumeSummaryTokens?: number
    jobId?: string
    jobSummaryJson?: SummaryJson
    jobSummaryTokens?: number
    detailedId?: string
    detailedSummaryJson?: SummaryJson
    detailedSummaryTokens?: number
  } = {}

  for (const result of results) {
    if (result.success && result.summaryJson) {
      switch (result.type) {
        case 'resume':
          updateParams.resumeId = result.id
          updateParams.resumeSummaryJson = result.summaryJson
          updateParams.resumeSummaryTokens = result.summaryTokens
          break
        case 'job':
          updateParams.jobId = result.id
          updateParams.jobSummaryJson = result.summaryJson
          updateParams.jobSummaryTokens = result.summaryTokens
          break
        case 'detailed':
          updateParams.detailedId = result.id
          updateParams.detailedSummaryJson = result.summaryJson
          updateParams.detailedSummaryTokens = result.summaryTokens
          break
      }
    }
  }

  // Update database if we have both required IDs
  if (updateParams.resumeId && updateParams.jobId) {
    try {
      await updateSummaries({
        resumeId: updateParams.resumeId,
        jobId: updateParams.jobId,
        resumeSummaryJson: updateParams.resumeSummaryJson as any,
        resumeSummaryTokens: updateParams.resumeSummaryTokens,
        jobSummaryJson: updateParams.jobSummaryJson as any,
        jobSummaryTokens: updateParams.jobSummaryTokens,
        detailedId: updateParams.detailedId,
        detailedSummaryJson: updateParams.detailedSummaryJson as any,
        detailedSummaryTokens: updateParams.detailedSummaryTokens,
      })
    } catch (error) {
      logError({
        reqId: 'orchestrator',
        route: 'llm/orchestrator',
        phase: 'database_update_failed',
        error: error instanceof Error ? error.message : String(error),
        updateParamsCount: Object.keys(updateParams).length,
      })
    }
  }

  return results
}
