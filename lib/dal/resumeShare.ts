import { prisma } from '@/lib/prisma'
import { logError } from '@/lib/logger'
import { nanoid } from 'nanoid'

/**
 * Get share configuration for a specific service (customized resume)
 */
export async function getResumeShare(serviceId: string) {
  // First find the customized resume id
  const customizedResume = await prisma.customizedResume.findUnique({
    where: { serviceId },
    select: { id: true },
  })

  if (!customizedResume) return null

  return prisma.resumeShare.findUnique({
    where: { customizedResumeId: customizedResume.id },
  })
}

export async function getResumeShareContextForUser(
  serviceId: string,
  userId: string,
) {
  if (!serviceId || !userId) return null
  const customizedResume = await prisma.customizedResume.findUnique({
    where: { serviceId },
    select: {
      id: true,
      resumeShare: true,
      service: { select: { userId: true } },
    },
  })
  if (!customizedResume || customizedResume.service.userId !== userId) {
    return null
  }
  return {
    customizedResumeId: customizedResume.id,
    share: customizedResume.resumeShare ?? null,
  }
}

/**
 * Create or update share configuration
 */
export async function upsertResumeShare(
  serviceId: string,
  data: {
    isEnabled: boolean
    expireAt?: Date | null
    avatarUrl?: string | null
    // If shareKey is not provided, we generate one for new records
    // We do NOT update shareKey if it exists
  },
) {
  const customizedResume = await prisma.customizedResume.findUnique({
    where: { serviceId },
    select: { id: true },
  })

  if (!customizedResume) {
    throw new Error('Customized resume not found')
  }

  // Check if share exists
  const existingShare = await prisma.resumeShare.findUnique({
    where: { customizedResumeId: customizedResume.id },
  })

  if (existingShare) {
    return prisma.resumeShare.update({
      where: { id: existingShare.id },
      data: {
        isEnabled: data.isEnabled,
        // Only update expireAt if provided (undefined means no change, null means clear)
        ...(data.expireAt !== undefined ? { expireAt: data.expireAt } : {}),
        ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
      },
    })
  } else {
    // Create new
    return prisma.resumeShare.create({
      data: {
        customizedResumeId: customizedResume.id,
        shareKey: nanoid(10), // Generate a 10-char short key
        isEnabled: data.isEnabled,
        expireAt: data.expireAt ?? null,
        ...(data.avatarUrl ? { avatarUrl: data.avatarUrl } : {}),
      },
    })
  }
}

export async function upsertResumeShareByCustomizedId(
  customizedResumeId: string,
  data: {
    isEnabled: boolean
    expireAt?: Date | null
    avatarUrl?: string | null
  },
) {
  const updateData: {
    isEnabled: boolean
    expireAt?: Date | null
    avatarUrl?: string | null
  } = {
    isEnabled: data.isEnabled,
  }
  if (data.expireAt !== undefined) {
    updateData.expireAt = data.expireAt
  }
  if (data.avatarUrl !== undefined) {
    updateData.avatarUrl = data.avatarUrl
  }
  return prisma.resumeShare.upsert({
    where: { customizedResumeId },
    update: updateData,
    create: {
      customizedResumeId,
      shareKey: nanoid(10),
      isEnabled: data.isEnabled,
      expireAt: data.expireAt ?? null,
      ...(data.avatarUrl ? { avatarUrl: data.avatarUrl } : {}),
    },
  })
}

export async function getExpiredResumeSharesWithAvatar(lookbackDays: number) {
  const now = new Date()
  const from = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000)
  return prisma.resumeShare.findMany({
    where: {
      expireAt: {
        lt: now,
        gte: from,
      },
      avatarUrl: { not: null },
    },
    select: { id: true, avatarUrl: true },
  })
}

export async function clearResumeShareAvatarUrls(ids: string[]) {
  if (!ids.length) return { count: 0 }
  return prisma.resumeShare.updateMany({
    where: { id: { in: ids } },
    data: { avatarUrl: null },
  })
}

export type GetSharedResumeResult =
  | { status: 'success'; data: any }
  | { status: 'not_found' }
  | { status: 'disabled' }
  | { status: 'expired' }

/**
 * Get full resume data by share key
 * Does NOT check for userId ownership
 * Checks for isEnabled and expireAt
 */
export async function getSharedResumeByKey(
  shareKey: string,
): Promise<GetSharedResumeResult> {
  const share = await prisma.resumeShare.findUnique({
    where: { shareKey },
    include: {
      customizedResume: {
        include: {
          service: {
            include: {
              resume: true,
              // We might not need detailedResume, job, match, interview for public view
              // But keep consistent with getServiceForUser if needed
              // For now, let's fetch minimal required data for rendering
            },
          },
        },
      },
    },
  })

  if (!share) return { status: 'not_found' }

  // Check validity
  if (!share.isEnabled) return { status: 'disabled' }
  if (share.expireAt && share.expireAt < new Date())
    return { status: 'expired' }

  // Increment view count (fire and forget, or await)
  // We await to ensure it's counted, but catch error to not block view
  prisma.resumeShare
    .update({
      where: { id: share.id },
      data: { viewCount: { increment: 1 } },
    })
    .catch((e) => {
      logError({
        reqId: share.id,
        route: 'dal/resumeShare',
        phase: 'increment_view_count_failed',
        error: e instanceof Error ? e : String(e),
      })
    })

  // Construct the return object similar to getServiceForUser structure
  // The page expects: service, resume, customizedResume
  const { customizedResume } = share
  const { service } = customizedResume
  const { resume } = service

  // Return a structure compatible with what the Resume Store expects
  // We flatten it a bit or return the service object with relations
  return {
    status: 'success',
    data: {
      ...service,
      resume,
      customizedResume,
      share: {
        avatarUrl: share.avatarUrl ?? null,
      },
      // We don't return other sensitive data like job, detailedResume unless needed
    },
  }
}
