import { prisma } from '@/lib/prisma'
import type { ServiceStep, AsyncTaskStatus } from '@prisma/client'

export async function createService(userId: string, resumeId: string, detailedResumeId?: string) {
  return prisma.service.create({
    data: {
      userId,
      resumeId,
      ...(detailedResumeId ? { detailedResumeId } : {}),
      currentStep: 'MATCH' as ServiceStep,
    },
  })
}

export async function createJobForService(serviceId: string, originalText?: string, originalImage?: string) {
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
  return prisma.match.create({ data: { serviceId, status: 'PENDING' as AsyncTaskStatus } })
}

export async function ensureCustomizedResumeRecord(serviceId: string) {
  const exists = await prisma.customizedResume.findUnique({ where: { serviceId } })
  if (exists) return exists
  return prisma.customizedResume.create({ data: { serviceId, status: 'PENDING' as AsyncTaskStatus } })
}

export async function ensureInterviewRecord(serviceId: string) {
  const exists = await prisma.interview.findUnique({ where: { serviceId } })
  if (exists) return exists
  return prisma.interview.create({ data: { serviceId, status: 'PENDING' as AsyncTaskStatus } })
}

export async function updateJobStatus(serviceId: string, status: AsyncTaskStatus) {
  return prisma.job.update({ where: { serviceId }, data: { status } })
}

export async function updateMatchStatus(serviceId: string, status: AsyncTaskStatus) {
  return prisma.match.update({ where: { serviceId }, data: { status } })
}

export async function updateCustomizedResumeStatus(serviceId: string, status: AsyncTaskStatus) {
  return prisma.customizedResume.update({ where: { serviceId }, data: { status } })
}

export async function updateInterviewStatus(serviceId: string, status: AsyncTaskStatus) {
  return prisma.interview.update({ where: { serviceId }, data: { status } })
}
