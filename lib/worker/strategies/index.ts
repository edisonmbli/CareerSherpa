import { MatchStrategy } from './match'
import { SummaryStrategy } from './summary'
import { OcrExtractStrategy } from './ocr'
import { CustomizeStrategy, InterviewStrategy } from './common_tasks'
import { WorkerStrategy } from './interface'

const strategies: Record<string, WorkerStrategy> = {
    job_match: new MatchStrategy(),
    job_summary: new SummaryStrategy('job_summary'),
    resume_summary: new SummaryStrategy('resume_summary'),
    detailed_resume_summary: new SummaryStrategy('detailed_resume_summary'),
    ocr_extract: new OcrExtractStrategy(),
    resume_customize: new CustomizeStrategy(),
    interview_prep: new InterviewStrategy(),
}

export function getStrategy(templateId: string): WorkerStrategy | undefined {
    return strategies[templateId]
}
