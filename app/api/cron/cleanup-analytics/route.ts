import { NextRequest, NextResponse } from 'next/server'
import { cleanupOldAnalyticsEvents } from '@/lib/dal/analyticsEvent'

export const dynamic = 'force-dynamic' // Ensure Vercel doesn't cache this

export async function GET(req: NextRequest) {
  // Verify CRON_SECRET if present in env
  // Vercel automatically adds this header when invoking cron jobs
  const cronSecret = process.env['CRON_SECRET']
  const authHeader = req.headers.get('authorization')

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  try {
    const result = await cleanupOldAnalyticsEvents()
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('[Cron] Cleanup failed:', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
