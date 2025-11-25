import { prisma } from '@/lib/prisma'
import type { AsyncTaskStatus } from '@prisma/client'

export async function upsertResume(userId: string, originalText: string) {
  const rec = await prisma.resume.upsert({
    where: { userId },
    update: { originalText, status: 'PENDING' as AsyncTaskStatus },
    create: { userId, originalText, status: 'PENDING' as AsyncTaskStatus },
  })
  return rec
}

export async function upsertDetailedResume(userId: string, originalText: string) {
  const rec = await prisma.detailedResume.upsert({
    where: { userId },
    update: { originalText, status: 'PENDING' as AsyncTaskStatus },
    create: { userId, originalText, status: 'PENDING' as AsyncTaskStatus },
  })
  return rec
}

export async function getLatestResume(userId: string) {
  return prisma.resume.findUnique({ where: { userId } })
}

export async function getLatestDetailedResume(userId: string) {
  return prisma.detailedResume.findUnique({ where: { userId } })
}

export async function getLatestResumeSummaryJson(userId: string) {
  const rec = await prisma.resume.findUnique({ where: { userId }, select: { resumeSummaryJson: true } })
  return rec?.resumeSummaryJson ?? null
}

export async function getLatestDetailedSummaryJson(userId: string) {
  const rec = await prisma.detailedResume.findUnique({ where: { userId }, select: { detailedSummaryJson: true } })
  return rec?.detailedSummaryJson ?? null
}

export async function getResumeOriginalTextById(resumeId: string) {
  if (!resumeId) return null
  const rec = await prisma.resume.findUnique({ where: { id: resumeId }, select: { originalText: true } })
  return rec?.originalText ?? null
}

export async function getDetailedResumeOriginalTextById(detailedResumeId: string) {
  if (!detailedResumeId) return null
  const rec = await prisma.detailedResume.findUnique({ where: { id: detailedResumeId }, select: { originalText: true } })
  return rec?.originalText ?? null
}

