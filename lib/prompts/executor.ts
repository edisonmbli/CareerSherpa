import { TemplateId, renderTemplate, getTemplateConfig } from './templates'
import { validateAndFix, ValidationOptions, ValidationResult } from './validator'
import { executeLLMTask, LLMTaskResult } from '../llm/worker-pool'
import { LLMConfig } from '../llm/providers'

export interface PromptExecutionOptions {
  tier?: 'free' | 'paid'
  priority?: number
  maxRetries?: number
  validation?: ValidationOptions
  enableAutoFix?: boolean
  timeout?: number
}

export interface PromptExecutionResult {
  success: boolean
  data?: unknown
  rawOutput?: string
  fixedOutput?: string
  validation?: ValidationResult & { fixed?: string; changes?: string[] }
  llmResult?: LLMTaskResult
  error?: string
  duration: number
}

/**
 * Unified Prompt Executor
 * Handles template rendering, LLM execution, and output validation
 */
export class PromptExecutor {
  /**
   * Execute a prompt template with variables
   */
  async execute(
    templateId: TemplateId,
    variables: Record<string, string>,
    userId: string,
    serviceId: string,
    options: PromptExecutionOptions = {}
  ): Promise<PromptExecutionResult> {
    const startTime = Date.now()
    
    try {
      // Step 1: Render template
      const { systemPrompt, userPrompt } = renderTemplate(templateId, variables)
      const templateConfig = getTemplateConfig(templateId)
      
      // Step 2: Prepare LLM configuration
      const llmConfig: Partial<LLMConfig> = {
        maxTokens: templateConfig.maxTokens,
        temperature: templateConfig.temperature,
      }
      
      // Step 3: Execute LLM task
      const llmResult = await executeLLMTask(
        userId,
        serviceId,
        this.getStepForTemplate(templateId),
        this.buildFullPrompt(systemPrompt, userPrompt),
        {
          tier: options.tier ?? 'free',
          priority: options.priority ?? 1,
          maxRetries: options.maxRetries ?? 3,
          config: llmConfig,
        }
      )
      
      if (!llmResult.success || !llmResult.response) {
        return {
          success: false,
          error: llmResult.error || 'LLM execution failed',
          llmResult,
          duration: Date.now() - startTime,
        }
      }
      
      const rawOutput = llmResult.response.content
      
      // Step 4: Validate and optionally fix output
      const validation = validateAndFix(
        templateId,
        rawOutput,
        options.validation
      )
      
      // Step 5: Determine final result
      let finalData = validation.data
      const fixedOutput = validation.fixed
      
      // If validation failed but auto-fix is enabled, try again
      if (!validation.valid && options.enableAutoFix && validation.fixed) {
        const retryValidation = validateAndFix(
          templateId,
          validation.fixed,
          options.validation
        )
        
        if (retryValidation.valid) {
          finalData = retryValidation.data
          validation.valid = true
          validation.data = finalData
        }
      }
      
      return {
        success: validation.valid,
        data: finalData,
        rawOutput,
        fixedOutput,
        validation,
        llmResult,
        error: validation.valid ? undefined : `Validation failed: ${validation.errors.join(', ')}`,
        duration: Date.now() - startTime,
      }
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      }
    }
  }
  
  /**
   * Execute multiple prompts in parallel
   */
  async executeParallel(
    executions: Array<{
      templateId: TemplateId
      variables: Record<string, string>
      userId: string
      serviceId: string
      options?: PromptExecutionOptions
    }>
  ): Promise<PromptExecutionResult[]> {
    const promises = executions.map(exec => 
      this.execute(
        exec.templateId,
        exec.variables,
        exec.userId,
        exec.serviceId,
        exec.options
      )
    )
    
    return Promise.all(promises)
  }
  
  /**
   * Execute with fallback templates
   */
  async executeWithFallback(
    primaryTemplateId: TemplateId,
    fallbackTemplateId: TemplateId,
    variables: Record<string, string>,
    userId: string,
    serviceId: string,
    options: PromptExecutionOptions = {}
  ): Promise<PromptExecutionResult> {
    // Try primary template first
    const primaryResult = await this.execute(
      primaryTemplateId,
      variables,
      userId,
      serviceId,
      options
    )
    
    if (primaryResult.success) {
      return primaryResult
    }
    
    // Fallback to secondary template
    const fallbackOptions = {
      ...options,
      tier: 'free' as const, // Use free tier for fallback
      priority: Math.max((options.priority ?? 1) - 1, 1), // Lower priority
    }
    
    const fallbackResult = await this.execute(
      fallbackTemplateId,
      variables,
      userId,
      serviceId,
      fallbackOptions
    )
    
    // Combine results to show both attempts
    return {
      ...fallbackResult,
      error: fallbackResult.success 
        ? undefined 
        : `Primary failed: ${primaryResult.error}. Fallback failed: ${fallbackResult.error}`,
    }
  }
  
  /**
   * Build full prompt combining system and user prompts
   */
  private buildFullPrompt(systemPrompt: string, userPrompt: string): string {
    return `${systemPrompt}\n\n${userPrompt}`
  }
  
  /**
   * Map template to task step
   */
  private getStepForTemplate(templateId: TemplateId): 'match' | 'resume' | 'interview' {
    switch (templateId) {
      case 'job_match':
      case 'resume_summary':
      case 'job_summary':
        return 'match'
      case 'resume_edit':
        return 'resume'
      case 'interview_prep':
        return 'interview'
      default:
        return 'match'
    }
  }
}

// Global executor instance
export const promptExecutor = new PromptExecutor()

/**
 * High-level convenience functions
 */

/**
 * Execute job matching analysis
 */
export async function executeJobMatch(
  resumeSummary: string,
  jobDescription: string,
  userId: string,
  serviceId: string,
  options?: PromptExecutionOptions
): Promise<PromptExecutionResult> {
  return promptExecutor.execute(
    'job_match',
    { resumeSummary, jobDescription },
    userId,
    serviceId,
    {
      enableAutoFix: true,
      validation: { strict: false },
      ...options,
    }
  )
}

/**
 * Execute resume editing
 */
export async function executeResumeEdit(
  resumeText: string,
  jobDescription: string,
  matchAnalysis: string,
  userId: string,
  serviceId: string,
  options?: PromptExecutionOptions
): Promise<PromptExecutionResult> {
  return promptExecutor.execute(
    'resume_edit',
    { resumeText, jobDescription, matchAnalysis },
    userId,
    serviceId,
    {
      enableAutoFix: true,
      validation: { strict: false },
      ...options,
    }
  )
}

/**
 * Execute interview preparation
 */
export async function executeInterviewPrep(
  resumeSummary: string,
  jobDescription: string,
  resumeEditSummary: string,
  userId: string,
  serviceId: string,
  options?: PromptExecutionOptions
): Promise<PromptExecutionResult> {
  return promptExecutor.execute(
    'interview_prep',
    { resumeSummary, jobDescription, resumeEditSummary },
    userId,
    serviceId,
    {
      enableAutoFix: true,
      validation: { strict: false },
      ...options,
    }
  )
}

/**
 * Execute summary generation
 */
export async function executeSummaryGeneration(
  resumeText: string,
  jobText: string,
  userId: string,
  serviceId: string,
  options?: PromptExecutionOptions
): Promise<{
  resumeSummary: PromptExecutionResult
  jobSummary: PromptExecutionResult
}> {
  const [resumeSummary, jobSummary] = await promptExecutor.executeParallel([
    {
      templateId: 'resume_summary',
      variables: { resumeText },
      userId,
      serviceId,
      options: {
        enableAutoFix: true,
        validation: { strict: false },
        ...options,
      },
    },
    {
      templateId: 'job_summary',
      variables: { jobText },
      userId,
      serviceId,
      options: {
        enableAutoFix: true,
        validation: { strict: false },
        ...options,
      },
    },
  ])
  
  return { resumeSummary, jobSummary }
}

/**
 * Execute complete workflow (A -> B -> C)
 */
export async function executeCompleteWorkflow(
  resumeText: string,
  jobText: string,
  userId: string,
  serviceId: string,
  options?: PromptExecutionOptions
): Promise<{
  summaries: { resumeSummary: PromptExecutionResult; jobSummary: PromptExecutionResult }
  jobMatch: PromptExecutionResult
  resumeEdit: PromptExecutionResult
  interviewPrep: PromptExecutionResult
}> {
  // Step 1: Generate summaries in parallel
  const summaries = await executeSummaryGeneration(
    resumeText,
    jobText,
    userId,
    serviceId,
    options
  )
  
  if (!summaries.resumeSummary.success || !summaries.jobSummary.success) {
    throw new Error('Summary generation failed')
  }
  
  // Step 2: Job matching analysis
  const jobMatch = await executeJobMatch(
    JSON.stringify(summaries.resumeSummary.data),
    jobText,
    userId,
    serviceId,
    options
  )
  
  if (!jobMatch.success) {
    throw new Error('Job matching analysis failed')
  }
  
  // Step 3: Resume editing
  const resumeEdit = await executeResumeEdit(
    resumeText,
    jobText,
    JSON.stringify(jobMatch.data),
    userId,
    serviceId,
    options
  )
  
  if (!resumeEdit.success) {
    throw new Error('Resume editing failed')
  }
  
  // Step 4: Interview preparation
  const interviewPrep = await executeInterviewPrep(
    JSON.stringify(summaries.resumeSummary.data),
    jobText,
    (resumeEdit.data as { summary?: string })?.summary || 'Resume optimized',
    userId,
    serviceId,
    options
  )
  
  if (!interviewPrep.success) {
    throw new Error('Interview preparation failed')
  }
  
  return {
    summaries,
    jobMatch,
    resumeEdit,
    interviewPrep,
  }
}