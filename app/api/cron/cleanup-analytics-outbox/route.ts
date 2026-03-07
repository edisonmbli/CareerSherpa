import { NextRequest, NextResponse } from 'next/server'
import { cleanupExportedAnalyticsOutbox } from '@/lib/dal/analyticsEvent'
import { verifyCronAuthorization } from '@/lib/cron/auth'
import { logError } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const OUTBOX_RETENTION_DAYS = Number(
  process.env['ANALYTICS_OUTBOX_RETENTION_DAYS'] ?? '7',
)

export async function GET(req: NextRequest) {
  const authResult = verifyCronAuthorization(req, 'api/cron/cleanup-analytics-outbox')
  if (authResult) return authResult

  try {
    const result = await cleanupExportedAnalyticsOutbox(OUTBOX_RETENTION_DAYS)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    logError({
      reqId: 'cron-cleanup-analytics-outbox',
      route: 'api/cron/cleanup-analytics-outbox',
      phase: 'cleanup_failed',
      error: error instanceof Error ? error : String(error),
    })
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 },
    )
  }
}
