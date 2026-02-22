import { prisma } from '@/lib/prisma'
import { logInfo } from '@/lib/logger'
import {
  ServiceStep,
  AsyncTaskStatus,
  ExecutionStatus,
  FailureCode,
} from '@prisma/client'

export async function createService(
  userId: string,
  resumeId: string,
  detailedResumeId?: string,
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

export async function getServiceStatus(serviceId: string) {
  return prisma.service.findUnique({
    where: { id: serviceId },
    select: { currentStatus: true },
  })
}

export async function getServiceStatusForUser(
  serviceId: string,
  userId: string,
) {
  return prisma.service.findFirst({
    where: { id: serviceId, userId },
    select: {
      currentStatus: true,
      updatedAt: true,
      match: { select: { updatedAt: true } },
      customizedResume: { select: { updatedAt: true } },
      interview: { select: { updatedAt: true } },
    },
  })
}

export async function getServiceIdsForMatch(serviceId: string) {
  if (!serviceId) return null
  return prisma.service.findUnique({
    where: { id: serviceId },
    select: {
      id: true,
      userId: true,
      resumeId: true,
      detailedResumeId: true,
      job: { select: { id: true } },
    },
  })
}

export async function createJobForService(
  serviceId: string,
  originalText?: string,
  originalImage?: string,
  imageUrl?: string,
) {
  return prisma.job.create({
    data: {
      serviceId,
      ...(originalText ? { originalText } : {}),
      ...(originalImage ? { originalImage } : {}),
      ...(imageUrl ? { imageUrl } : {}),
      status: 'PENDING' as AsyncTaskStatus,
    },
  })
}

export async function getServiceSummariesReadOnly(
  serviceId: string,
  userId?: string,
) {
  const svc = await prisma.service.findUnique({
    where: { id: serviceId },
    select: {
      resume: { select: { resumeSummaryJson: true } },
      detailedResume: { select: { detailedSummaryJson: true } },
      job: { select: { jobSummaryJson: true } },
      userId: true,
    },
  })
  if (userId && svc?.userId !== userId) return null
  return svc
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

export async function hasServiceForUser(serviceId: string, userId: string) {
  const service = await prisma.service.findFirst({
    where: { id: serviceId, userId },
    select: { id: true },
  })
  return Boolean(service)
}

export async function getServiceForUser(serviceId: string, userId: string) {
  const startedAt = Date.now()
  const service = await prisma.service.findFirst({
    where: { id: serviceId, userId },
    select: {
      id: true,
      currentStatus: true,
      executionSessionId: true,
      updatedAt: true,
      job: {
        select: {
          jobSummaryJson: true,
        },
      },
      match: {
        select: {
          status: true,
          matchSummaryJson: true,
          updatedAt: true,
        },
      },
      customizedResume: {
        select: {
          status: true,
          editedResumeJson: true,
          customizedResumeJson: true,
          sectionConfig: true,
          optimizeSuggestion: true,
          ops_json: true,
          updatedAt: true,
        },
      },
      interview: {
        select: {
          status: true,
          interviewTipsJson: true,
          updatedAt: true,
        },
      },
    },
  })
  let opsWasString = false
  let opsJson = service?.customizedResume?.ops_json as any
  if (typeof opsJson === 'string') {
    opsWasString = true
    try {
      opsJson = JSON.parse(opsJson)
    } catch {
      opsJson = null
    }
  }
  if (opsJson && typeof opsJson === 'object') {
    const rawStyleConfig = (opsJson as any)?.styleConfig
    if (typeof rawStyleConfig === 'string') {
      try {
        opsJson = {
          ...(opsJson as Record<string, unknown>),
          styleConfig: JSON.parse(rawStyleConfig),
        }
      } catch {
        opsJson = {
          ...(opsJson as Record<string, unknown>),
          styleConfig: {},
        }
      }
    }
  }
  const styleConfig = (opsJson as any)?.styleConfig || null
  logInfo({
    reqId: serviceId,
    route: 'dal/services',
    phase: 'workbench_service_fetch',
    serviceId,
    ...(userId ? { userKey: userId } : {}),
    ms: Date.now() - startedAt,
    ok: Boolean(service),
    hasOps: Boolean(service?.customizedResume?.ops_json),
    opsWasString,
    templateId: (opsJson as any)?.currentTemplate,
    styleKeys: styleConfig ? Object.keys(styleConfig) : [],
    styleSnapshot: styleConfig
      ? {
          themeColor: styleConfig?.themeColor,
          fontFamily: styleConfig?.fontFamily,
          fontSize: styleConfig?.fontSize,
          baseFontSize: styleConfig?.baseFontSize,
          lineHeight: styleConfig?.lineHeight,
          pageMargin: styleConfig?.pageMargin,
          sectionSpacing: styleConfig?.sectionSpacing,
          itemSpacing: styleConfig?.itemSpacing,
        }
      : null,
  })
  return service
}

export async function getServiceWithContext(serviceId: string) {
  return prisma.service.findUnique({
    where: { id: serviceId },
    include: {
      resume: true,
      detailedResume: true,
      job: true,
      match: true,
      interview: true,
    },
  })
}

export async function updateJobStatus(
  serviceId: string,
  status: AsyncTaskStatus,
) {
  return prisma.job.update({ where: { serviceId }, data: { status } })
}

export async function updateMatchStatus(
  serviceId: string,
  status: AsyncTaskStatus,
) {
  return prisma.match.update({ where: { serviceId }, data: { status } })
}

export async function updateCustomizedResumeStatus(
  serviceId: string,
  status: AsyncTaskStatus,
) {
  return prisma.customizedResume.update({
    where: { serviceId },
    data: { status },
  })
}

export async function updateInterviewStatus(
  serviceId: string,
  status: AsyncTaskStatus,
) {
  return prisma.interview.update({ where: { serviceId }, data: { status } })
}

export async function updateResumeStatus(
  resumeId: string,
  status: AsyncTaskStatus,
) {
  return prisma.resume.update({ where: { id: resumeId }, data: { status } })
}

export async function updateDetailedResumeStatus(
  detailedResumeId: string,
  status: AsyncTaskStatus,
) {
  return prisma.detailedResume.update({
    where: { id: detailedResumeId },
    data: { status },
  })
}

export async function setJobSummaryJson(
  serviceId: string,
  json: any,
  status: AsyncTaskStatus,
) {
  return prisma.job.update({
    where: { serviceId },
    data: { jobSummaryJson: json, status },
  })
}

export async function setMatchSummaryJson(
  serviceId: string,
  json: any,
  status: AsyncTaskStatus,
) {
  return prisma.match.update({
    where: { serviceId },
    data: { matchSummaryJson: json, status },
  })
}

export async function setResumeSummaryJson(
  resumeId: string,
  json: any,
  status: AsyncTaskStatus,
) {
  return prisma.resume.update({
    where: { id: resumeId },
    data: { resumeSummaryJson: json, status },
  })
}

export async function setDetailedResumeSummaryJson(
  detailedResumeId: string,
  json: any,
  status: AsyncTaskStatus,
) {
  return prisma.detailedResume.update({
    where: { id: detailedResumeId },
    data: { detailedSummaryJson: json, status },
  })
}

export async function setCustomizedResumeResult(
  serviceId: string,
  optimizeSuggestion: string | undefined,
  customizedResumeJson: any | undefined,
  status: AsyncTaskStatus,
) {
  const data: any = { status }
  if (typeof optimizeSuggestion !== 'undefined') {
    data.optimizeSuggestion = optimizeSuggestion
  }
  if (
    typeof customizedResumeJson !== 'undefined' &&
    customizedResumeJson !== null
  ) {
    data.customizedResumeJson = customizedResumeJson
    // Also initialize editedResumeJson
    data.editedResumeJson = customizedResumeJson
  }
  return prisma.customizedResume.update({
    where: { serviceId },
    data,
  })
}

export async function setInterviewTipsJson(
  serviceId: string,
  json: any,
  status: AsyncTaskStatus,
) {
  return prisma.interview.update({
    where: { serviceId },
    data: { interviewTipsJson: json, status },
  })
}

/**
 * Get all contextual data required for generating Interview Tips
 * @param serviceId - The service ID
 * @returns Object containing job summary, match analysis, customized resume, resume summary, and detailed resume
 */
export async function getInterviewContext(serviceId: string) {
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    select: {
      resume: {
        select: {
          resumeSummaryJson: true,
        },
      },
      detailedResume: {
        select: {
          detailedSummaryJson: true,
        },
      },
      job: {
        select: {
          jobSummaryJson: true,
        },
      },
      match: {
        select: {
          matchSummaryJson: true,
        },
      },
      customizedResume: {
        select: {
          customizedResumeJson: true,
        },
      },
    },
  })

  if (!service) {
    throw new Error(`Service ${serviceId} not found`)
  }

  if (!service.job?.jobSummaryJson) {
    throw new Error('Job summary not available (Step 1 not completed)')
  }

  if (!service.match?.matchSummaryJson) {
    throw new Error('Match analysis not available (Step 1 not completed)')
  }

  if (!service.customizedResume?.customizedResumeJson) {
    throw new Error('Customized resume not available (Step 2 not completed)')
  }

  return {
    jobSummaryJson: service.job.jobSummaryJson,
    matchSummaryJson: service.match.matchSummaryJson,
    customizedResumeJson: service.customizedResume.customizedResumeJson,
    resumeSummaryJson: service.resume?.resumeSummaryJson || null,
    detailedSummaryJson: service.detailedResume?.detailedSummaryJson || null,
  }
}

export async function updateCustomizedResumeEditedData(
  serviceId: string,
  editedResumeJson?: any,
  sectionConfig?: any,
  opsJson?: any,
) {
  // Build update data object dynamically - only include provided fields
  const updateData: {
    editedResumeJson?: any
    sectionConfig?: any
    ops_json?: any
  } = {}

  if (editedResumeJson !== undefined) {
    updateData.editedResumeJson = editedResumeJson
  }
  if (sectionConfig !== undefined) {
    updateData.sectionConfig = sectionConfig
  }
  if (opsJson !== undefined) {
    updateData.ops_json = opsJson
  }

  // Skip update if nothing to change
  if (Object.keys(updateData).length === 0) {
    return null
  }

  return prisma.customizedResume.update({
    where: { serviceId },
    data: updateData,
  })
}

export async function resetCustomizedResumeEditedData(serviceId: string) {
  const record = await prisma.customizedResume.findUnique({
    where: { serviceId },
    select: { customizedResumeJson: true },
  })

  if (!record || !record.customizedResumeJson) {
    throw new Error('Original resume data not found')
  }

  return prisma.customizedResume.update({
    where: { serviceId },
    data: {
      editedResumeJson: record.customizedResumeJson,
    },
  })
}

export async function getJobOriginalTextById(
  jobId: string,
): Promise<string | null> {
  const rec = await prisma.job.findUnique({
    where: { id: jobId },
    select: { originalText: true },
  })
  return rec?.originalText ?? null
}

export async function updateJobOriginalText(
  serviceId: string,
  originalText: string,
) {
  return prisma.job.update({ where: { serviceId }, data: { originalText } })
}

/**
 * @desc Clear job image data after OCR/summary is completed
 * @param serviceId Service ID for the job record
 * @returns Updated job record
 */
export async function clearJobImageData(serviceId: string) {
  return prisma.job.update({
    where: { serviceId },
    data: { originalImage: null, imageUrl: null },
  })
}

export async function getJobOriginalImageById(id: string) {
  const job = await prisma.job.findUnique({
    where: { id },
    select: { originalImage: true, imageUrl: true },
  })
  return job?.imageUrl || job?.originalImage
}

export async function updateServiceExecutionStatus(
  serviceId: string,
  status: ExecutionStatus,
  options?: {
    failureCode?: FailureCode | null
    executionSessionId?: string | null
  },
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
      data: { status: AsyncTaskStatus.COMPLETED },
    }),
    prisma.service.update({
      where: { id: serviceId },
      data: {
        currentStatus: ExecutionStatus.SUMMARY_COMPLETED,
        lastUpdatedAt: new Date(),
        failureCode: null,
      },
    }),
    prisma.match.update({
      where: { serviceId },
      data: { status: AsyncTaskStatus.PENDING },
    }),
  ])
}

export async function txMarkSummaryFailed(
  serviceId: string,
  failureCode?: FailureCode | null,
) {
  // Safe handling of failure code to ensure it's a valid enum or null
  const validFailureCode =
    failureCode && Object.values(FailureCode).includes(failureCode)
      ? failureCode
      : String(failureCode) === 'llm_error'
        ? FailureCode.JSON_PARSE_FAILED // Map legacy 'llm_error' to a valid enum
        : null

  return prisma.$transaction([
    prisma.job.update({
      where: { serviceId },
      data: { status: AsyncTaskStatus.FAILED },
    }),
    prisma.service.update({
      where: { id: serviceId },
      data: {
        currentStatus: ExecutionStatus.SUMMARY_FAILED,
        lastUpdatedAt: new Date(),
        failureCode: validFailureCode,
      },
    }),
  ])
}

export async function txMarkMatchPending(serviceId: string) {
  return prisma.$transaction([
    prisma.match.update({
      where: { serviceId },
      data: { status: AsyncTaskStatus.PENDING },
    }),
    prisma.service.update({
      where: { id: serviceId },
      data: {
        currentStatus: ExecutionStatus.MATCH_PENDING,
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
      currentStatus: ExecutionStatus.MATCH_STREAMING,
      lastUpdatedAt: new Date(),
    },
  })
}

export async function txMarkMatchCompleted(
  serviceId: string,
  matchSummaryJson?: any,
) {
  return prisma.$transaction([
    prisma.match.update({
      where: { serviceId },
      data: {
        status: AsyncTaskStatus.COMPLETED,
        ...(matchSummaryJson ? { matchSummaryJson } : {}),
      },
    }),
    prisma.service.update({
      where: { id: serviceId },
      data: {
        currentStatus: ExecutionStatus.MATCH_COMPLETED,
        lastUpdatedAt: new Date(),
        failureCode: null,
      },
    }),
  ])
}

export async function txMarkMatchFailed(
  serviceId: string,
  failureCode?: FailureCode | null,
) {
  // Safe handling of failure code to ensure it's a valid enum or null
  const validFailureCode =
    failureCode && Object.values(FailureCode).includes(failureCode)
      ? failureCode
      : String(failureCode) === 'llm_error'
        ? FailureCode.JSON_PARSE_FAILED // Map legacy 'llm_error' to a valid enum
        : null

  return prisma.$transaction([
    prisma.match.update({
      where: { serviceId },
      data: { status: AsyncTaskStatus.FAILED },
    }),
    prisma.service.update({
      where: { id: serviceId },
      data: {
        currentStatus: ExecutionStatus.MATCH_FAILED,
        lastUpdatedAt: new Date(),
        failureCode: validFailureCode,
      },
    }),
  ])
}
