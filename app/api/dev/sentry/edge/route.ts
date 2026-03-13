import { NextResponse } from 'next/server'
import { captureHandledError, setContext, setTag } from '@/lib/sentry/universal'
import { getSentryEnvironment, getSentryRelease, isWebSentryEnabled } from '@/lib/env'

export const runtime = 'edge'

export async function GET() {
  await setTag('runtime', 'web')
  await setContext('sentry_debug', {
    route: 'api/dev/sentry/edge',
    mode: 'handled',
  })

  const eventId = await captureHandledError(
    new Error('career_shaper_web_edge_debug_error'),
    {
      tag: ['runtime', 'web'],
      section: [
        'sentry_debug',
        {
          route: 'api/dev/sentry/edge',
          runtime: 'edge',
        },
      ],
      extra: {
        route: 'api/dev/sentry/edge',
        source: 'edge_debug_route',
      },
    },
  )

  return NextResponse.json({
    ok: true,
    runtime: 'edge',
    eventId: eventId || null,
    enabled: isWebSentryEnabled(),
    environment: getSentryEnvironment(),
    release: getSentryRelease() || null,
  })
}
