'use client'

import * as Sentry from '@sentry/nextjs'

const RECENT_SENTRY_EVENT_KEY = 'career_shaper_recent_sentry_event'
const RECENT_SENTRY_EVENT_TTL_MS = 10 * 60 * 1000

type RecentSentryEventRecord = {
  eventId: string
  runtime: 'web'
  occurredAt: number
  pathname?: string
}

function canUseSessionStorage() {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined'
}

function readRecentSentryEventRecord(): RecentSentryEventRecord | null {
  if (!canUseSessionStorage()) return null
  try {
    const raw = window.sessionStorage.getItem(RECENT_SENTRY_EVENT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<RecentSentryEventRecord>
    if (!parsed?.eventId || !parsed?.occurredAt) return null
    if (Date.now() - Number(parsed.occurredAt) > RECENT_SENTRY_EVENT_TTL_MS) {
      window.sessionStorage.removeItem(RECENT_SENTRY_EVENT_KEY)
      return null
    }
    return {
      eventId: parsed.eventId,
      runtime: 'web',
      occurredAt: Number(parsed.occurredAt),
      ...(parsed.pathname ? { pathname: parsed.pathname } : {}),
    }
  } catch {
    return null
  }
}

export function persistRecentSentryBrowserEvent(
  eventId: string | undefined,
  options: { pathname?: string } = {},
) {
  if (!eventId || !canUseSessionStorage()) return
  const record: RecentSentryEventRecord = {
    eventId,
    runtime: 'web',
    occurredAt: Date.now(),
    ...(options.pathname ? { pathname: options.pathname } : {}),
  }
  try {
    window.sessionStorage.setItem(RECENT_SENTRY_EVENT_KEY, JSON.stringify(record))
  } catch {}
}

export function getLastSentryEventId() {
  const currentEventId = Sentry.lastEventId() || undefined
  if (currentEventId) {
    persistRecentSentryBrowserEvent(currentEventId, {
      pathname: typeof window !== 'undefined' ? window.location.pathname : undefined,
    })
    return currentEventId
  }
  return readRecentSentryEventRecord()?.eventId
}

export function setSentryBrowserUser(user: {
  id?: string
  email?: string
  username?: string
} | null) {
  Sentry.setUser(user)
}

export function captureSentryBrowserException(error: unknown) {
  const eventId = Sentry.captureException(error)
  persistRecentSentryBrowserEvent(eventId, {
    pathname: typeof window !== 'undefined' ? window.location.pathname : undefined,
  })
  return eventId
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

  persistRecentSentryBrowserEvent(eventId, {
    pathname: typeof window !== 'undefined' ? window.location.pathname : undefined,
  })

  return eventId
}

export function getRecentSentryBrowserEvent() {
  const currentEventId = Sentry.lastEventId() || undefined
  if (currentEventId) {
    const record: RecentSentryEventRecord = {
      eventId: currentEventId,
      runtime: 'web',
      occurredAt: Date.now(),
      ...(typeof window !== 'undefined' ? { pathname: window.location.pathname } : {}),
    }
    persistRecentSentryBrowserEvent(record.eventId, {
      pathname: record.pathname,
    })
    return record
  }
  return readRecentSentryEventRecord()
}
