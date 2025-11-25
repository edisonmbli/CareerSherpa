import { prisma } from '@/lib/prisma'
import type {
  ServiceStep,
  AsyncTaskStatus,
  ExecutionStatus,
  FailureCode,
} from '@prisma/client'

export async function createService(
  userId: string,
  resumeId: string,
  detailedResumeId?: string
) {
  return prisma.service.create({
    data: {
      userId,
      resumeId,
      ...(detailedResumeId ? { detailedResumeId } : {}),
      currentStep: 'MATCH' as ServiceStep,
    },
  })
}

export async function createJobForService(
  serviceId: string,
  originalText?: string,
  originalImage?: string
) {
  return prisma.job.create({
    data: {
      serviceId,
      ...(originalText ? { originalText } : {}),
      ...(originalImage ? { originalImage } : {}),
      status: 'PENDING' as AsyncTaskStatus,
    },
  })
}

export async function ensureMatchRecord(serviceId: string) {
  const exists = await prisma.match.findUnique({ where: { serviceId } })
  if (exists) return exists
  return prisma.match.create({
    data: { serviceId, status: 'PENDING' as AsyncTaskStatus },
  })
}

export async function ensureCustomizedResumeRecord(serviceId: string) {
  const exists = await prisma.customizedResume.findUnique({
    where: { serviceId },
  })
  if (exists) return exists
  return prisma.customizedResume.create({
    data: { serviceId, status: 'PENDING' as AsyncTaskStatus },
  })
}

export async function ensureInterviewRecord(serviceId: string) {
  const exists = await prisma.interview.findUnique({ where: { serviceId } })
  if (exists) return exists
  return prisma.interview.create({
    data: { serviceId, status: 'PENDING' as AsyncTaskStatus },
  })
}

export async function getServiceWithContext(serviceId: string) {
  return prisma.service.findUnique({
    where: { id: serviceId },
    include: { resume: true, detailedResume: true, job: true, match: true },
  })
}

export async function updateJobStatus(
  serviceId: string,
  status: AsyncTaskStatus
) {
  return prisma.job.update({ where: { serviceId }, data: { status } })
}

export async function updateMatchStatus(
  serviceId: string,
  status: AsyncTaskStatus
) {
  return prisma.match.update({ where: { serviceId }, data: { status } })
}

export async function updateCustomizedResumeStatus(
  serviceId: string,
  status: AsyncTaskStatus
) {
  return prisma.customizedResume.update({
    where: { serviceId },
    data: { status },
  })
}

export async function updateInterviewStatus(
  serviceId: string,
  status: AsyncTaskStatus
) {
  return prisma.interview.update({ where: { serviceId }, data: { status } })
}

export async function updateResumeStatus(
  resumeId: string,
  status: AsyncTaskStatus
) {
  return prisma.resume.update({ where: { id: resumeId }, data: { status } })
}

export async function updateDetailedResumeStatus(
  detailedResumeId: string,
  status: AsyncTaskStatus
) {
  return prisma.detailedResume.update({
    where: { id: detailedResumeId },
    data: { status },
  })
}

export async function setJobSummaryJson(
  serviceId: string,
  json: any,
  status: AsyncTaskStatus
) {
  return prisma.job.update({
    where: { serviceId },
    data: { jobSummaryJson: json, status },
  })
}

export async function setMatchSummaryJson(
  serviceId: string,
  json: any,
  status: AsyncTaskStatus
) {
  return prisma.match.update({
    where: { serviceId },
    data: { matchSummaryJson: json, status },
  })
}

export async function setResumeSummaryJson(
  resumeId: string,
  json: any,
  status: AsyncTaskStatus
) {
  return prisma.resume.update({
    where: { id: resumeId },
    data: { resumeSummaryJson: json, status },
  })
}

export async function setDetailedResumeSummaryJson(
  detailedResumeId: string,
  json: any,
  status: AsyncTaskStatus
) {
  return prisma.detailedResume.update({
    where: { id: detailedResumeId },
    data: { detailedSummaryJson: json, status },
  })
}

export async function setCustomizedResumeResult(
  serviceId: string,
  markdownText: string | undefined,
  opsJson: any | undefined,
  status: AsyncTaskStatus
) {
  const data: any = { status }
  if (typeof markdownText !== 'undefined') {
    data.markdownText = markdownText
  }
  if (typeof opsJson !== 'undefined' && opsJson !== null) {
    data.opsJson = opsJson
  }
  return prisma.customizedResume.update({
    where: { serviceId },
    data,
  })
}

export async function setInterviewTipsJson(
  serviceId: string,
  json: any,
  status: AsyncTaskStatus
) {
  return prisma.interview.update({
    where: { serviceId },
    data: { interviewTipsJson: json, status },
  })
}

export async function updateCustomizedResumeMarkdown(
  serviceId: string,
  markdownText: string
) {
  return prisma.customizedResume.update({
    where: { serviceId },
    data: { markdownText },
  })
}

export async function getJobOriginalTextById(
  jobId: string
): Promise<string | null> {
  const rec = await prisma.job.findUnique({
    where: { id: jobId },
    select: { originalText: true },
  })
  return rec?.originalText ?? null
}

export async function updateJobOriginalText(
  serviceId: string,
  originalText: string
) {
  return prisma.job.update({ where: { serviceId }, data: { originalText } })
}

export async function getJobOriginalImageById(jobId: string) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { originalImage: true },
  })
  return job?.originalImage ?? null
}

export async function updateServiceExecutionStatus(
  serviceId: string,
  status: ExecutionStatus,
  options?: {
    failureCode?: FailureCode | null
    executionSessionId?: string | null
  }
) {
  const data: any = {
    currentStatus: status,
    lastUpdatedAt: new Date(),
  }
  if (options) {
    if (typeof options.failureCode !== 'undefined') {
      data.failureCode = options.failureCode
    }
    if (typeof options.executionSessionId !== 'undefined') {
      data.executionSessionId = options.executionSessionId
    }
  }
  return prisma.service.update({ where: { id: serviceId }, data })
}

export async function txMarkSummaryCompleted(serviceId: string) {
  return prisma.$transaction([
    prisma.job.update({
      where: { serviceId },
      data: { status: 'COMPLETED' as any },
    }),
    prisma.service.update({
      where: { id: serviceId },
      data: {
        currentStatus: 'SUMMARY_COMPLETED' as any,
        lastUpdatedAt: new Date(),
        failureCode: null,
      },
    }),
    prisma.match.update({
      where: { serviceId },
      data: { status: 'PENDING' as any },
    }),
  ])
}

export async function txMarkSummaryFailed(
  serviceId: string,
  failureCode?: FailureCode | null
) {
  return prisma.$transaction([
    prisma.job.update({
      where: { serviceId },
      data: { status: 'FAILED' as any },
    }),
    prisma.service.update({
      where: { id: serviceId },
      data: {
        currentStatus: 'SUMMARY_FAILED' as any,
        lastUpdatedAt: new Date(),
        failureCode: failureCode ?? null,
      },
    }),
  ])
}

export async function txMarkMatchPending(serviceId: string) {
  return prisma.$transaction([
    prisma.match.update({
      where: { serviceId },
      data: { status: 'PENDING' as any },
    }),
    prisma.service.update({
      where: { id: serviceId },
      data: {
        currentStatus: 'MATCH_PENDING' as any,
        lastUpdatedAt: new Date(),
        failureCode: null,
      },
    }),
  ])
}

export async function txMarkMatchStreaming(serviceId: string) {
  return prisma.service.update({
    where: { id: serviceId },
    data: {
      currentStatus: 'MATCH_STREAMING' as any,
      lastUpdatedAt: new Date(),
    },
  })
}

export async function txMarkMatchCompleted(serviceId: string) {
  return prisma.$transaction([
    prisma.match.update({
      where: { serviceId },
      data: { status: 'COMPLETED' as any },
    }),
    prisma.service.update({
      where: { id: serviceId },
      data: {
        currentStatus: 'MATCH_COMPLETED' as any,
        lastUpdatedAt: new Date(),
        failureCode: null,
      },
    }),
  ])
}

export async function txMarkMatchFailed(
  serviceId: string,
  failureCode?: FailureCode | null
) {
  return prisma.$transaction([
    prisma.match.update({
      where: { serviceId },
      data: { status: 'FAILED' as any },
    }),
    prisma.service.update({
      where: { id: serviceId },
      data: {
        currentStatus: 'MATCH_FAILED' as any,
        lastUpdatedAt: new Date(),
        failureCode: failureCode ?? null,
      },
    }),
  ])
}
