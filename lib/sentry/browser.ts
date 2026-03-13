'use client'

import * as Sentry from '@sentry/nextjs'

export function getLastSentryEventId() {
  return Sentry.lastEventId() || undefined
}

export function setSentryBrowserUser(user: {
  id?: string
  email?: string
  username?: string
} | null) {
  Sentry.setUser(user)
}

export function captureSentryBrowserException(error: unknown) {
  return Sentry.captureException(error)
}

export function captureSentryBrowserHandledError(
  error: unknown,
  context: {
    tag?: [string, string]
    section?: [string, Record<string, unknown>]
    extra?: Record<string, unknown>
  } = {},
) {
  let eventId: string | undefined

  Sentry.withScope((scope) => {
    if (context.tag) {
      scope.setTag(context.tag[0], context.tag[1])
    }
    if (context.section) {
      scope.setContext(context.section[0], context.section[1])
    }
    if (context.extra) {
      scope.setExtras(context.extra)
    }
    eventId = Sentry.captureException(error)
  })

  return eventId
}
