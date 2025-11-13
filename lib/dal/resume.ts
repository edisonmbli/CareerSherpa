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

