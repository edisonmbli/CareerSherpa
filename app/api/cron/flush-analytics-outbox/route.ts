import { NextRequest, NextResponse } from 'next/server'
import { flushAnalyticsOutboxToPostHog } from '@/lib/analytics/outbox'
import { verifyCronAuthorization } from '@/lib/cron/auth'
import { logError } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const authResult = verifyCronAuthorization(req, 'api/cron/flush-analytics-outbox')
  if (authResult) return authResult

  try {
    const result = await flushAnalyticsOutboxToPostHog()
    const statusCode = result.success ? 200 : 500
    return NextResponse.json(result, { status: statusCode })
  } catch (error) {
    logError({
      reqId: 'cron-flush-analytics-outbox',
      route: 'api/cron/flush-analytics-outbox',
      phase: 'flush_failed',
      error: error instanceof Error ? error : String(error),
    })
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 },
    )
  }
}
