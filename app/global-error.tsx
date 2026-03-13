'use client'

import { useEffect } from 'react'
import NextError from 'next/error'
import { captureSentryBrowserHandledError } from '@/lib/sentry/browser'

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string }
}) {
  useEffect(() => {
    captureSentryBrowserHandledError(error, {
      tag: ['runtime', 'web'],
      section: [
        'global_error_boundary',
        {
          route: 'app/global-error',
          phase: 'render_boundary',
          digest: error.digest ?? null,
        },
      ],
      extra: {
        route: 'app/global-error',
        phase: 'render_boundary',
        runtime: 'web',
        digest: error.digest ?? null,
      },
    })
  }, [error])

  return (
    <html>
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  )
}