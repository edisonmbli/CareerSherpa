import { NextRequest, NextResponse } from 'next/server'
import {
  clearResumeShareAvatarUrls,
  getExpiredResumeSharesWithAvatar,
} from '@/lib/dal/resumeShare'
import { logError, logInfo } from '@/lib/logger'
import { deleteShareAvatar } from '@/lib/storage/avatar-server'

export const dynamic = 'force-dynamic'

const LOOKBACK_DAYS = 5

export async function GET(req: NextRequest) {
  const cronSecret = process.env['CRON_SECRET']
  const authHeader = req.headers.get('authorization')

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  try {
    const records = await getExpiredResumeSharesWithAvatar(LOOKBACK_DAYS)
    if (!records.length) {
      return NextResponse.json({
        success: true,
        checked: 0,
        deleted: 0,
        failed: 0,
        cleared: 0,
      })
    }

    const deletions = await Promise.allSettled(
      records.map(async (record) => {
        if (!record.avatarUrl) return { id: record.id }
        await deleteShareAvatar(record.avatarUrl)
        return { id: record.id }
      }),
    )

    const successIds: string[] = []
    let failed = 0
    for (const result of deletions) {
      if (result.status === 'fulfilled' && result.value?.id) {
        successIds.push(result.value.id)
      } else if (result.status === 'rejected') {
        failed += 1
        logError({
          reqId: 'cron-cleanup-share-avatars',
          route: 'api/cron/cleanup-share-avatars',
          phase: 'delete_failed',
          error: result.reason instanceof Error ? result.reason : String(result.reason),
        })
      }
    }

    const cleared = await clearResumeShareAvatarUrls(successIds)
    logInfo({
      reqId: 'cron-cleanup-share-avatars',
      route: 'api/cron/cleanup-share-avatars',
      phase: 'cleanup_complete',
      checked: records.length,
      deleted: successIds.length,
      failed,
      cleared: cleared.count,
    })

    return NextResponse.json({
      success: true,
      checked: records.length,
      deleted: successIds.length,
      failed,
      cleared: cleared.count,
    })
  } catch (error) {
    logError({
      reqId: 'cron-cleanup-share-avatars',
      route: 'api/cron/cleanup-share-avatars',
      phase: 'cleanup_failed',
      error: error instanceof Error ? error : String(error),
    })
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 },
    )
  }
}
