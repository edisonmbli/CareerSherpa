import { NextRequest, NextResponse } from 'next/server'
import { logError } from '@/lib/logger'

export function verifyCronAuthorization(
  req: NextRequest,
  route: string,
): NextResponse | null {
  const cronSecret = process.env['CRON_SECRET']?.trim()
  const authHeader = req.headers.get('authorization')
  const isProduction = process.env['NODE_ENV'] === 'production'

  if (isProduction && !cronSecret) {
    logError({
      reqId: `cron-auth-${route}`,
      route,
      phase: 'missing_cron_secret',
      error: 'CRON_SECRET is required in production',
    })
    return NextResponse.json(
      { success: false, error: 'cron_secret_missing' },
      { status: 500 },
    )
  }

  // Keep local development convenient when CRON_SECRET is not configured.
  if (!cronSecret) return null

  if (authHeader !== `Bearer ${cronSecret}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  return null
}
