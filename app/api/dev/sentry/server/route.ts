import { NextResponse } from 'next/server'
import { captureHandledError, setContext, setTag } from '@/lib/sentry/universal'
import { getSentryEnvironment, getSentryRelease, isWebSentryEnabled } from '@/lib/env'

export const runtime = 'nodejs'

export async function GET() {
  await setTag('runtime', 'web')
  await setContext('sentry_debug', {
    route: 'api/dev/sentry/server',
    mode: 'handled',
  })

  const eventId = await captureHandledError(
    new Error('career_shaper_web_server_debug_error'),
    {
      tag: ['runtime', 'web'],
      section: [
        'sentry_debug',
        {
          route: 'api/dev/sentry/server',
          runtime: 'nodejs',
        },
      ],
      extra: {
        route: 'api/dev/sentry/server',
        source: 'server_debug_route',
      },
    },
  )

  return NextResponse.json({
    ok: true,
    runtime: 'nodejs',
    eventId: eventId || null,
    enabled: isWebSentryEnabled(),
    environment: getSentryEnvironment(),
    release: getSentryRelease() || null,
  })
}
