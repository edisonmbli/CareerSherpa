import { ENV, getSentryBaseUrl } from '@/lib/env'

export type SentryRuntimeSource = 'web' | 'worker'

export type SentryFeedbackLinkOptions = {
  eventId?: string
  runtime?: SentryRuntimeSource
}

export type SentryFeedbackLinks = {
  eventUrl?: string
  searchUrl?: string
  project?: string
  runtime: SentryRuntimeSource
}

type ResolvedEventRecord = {
  eventId?: string
  id?: string
  groupId?: string
  groupID?: string
  projectSlug?: string
  projectName?: string
}

const SENTRY_FETCH_TIMEOUT_MS = 4000

function asOptionalString(value: unknown) {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

function getProjectForRuntime(runtime: SentryRuntimeSource) {
  if (runtime === 'worker') {
    return asOptionalString(ENV.SENTRY_WORKER_PROJECT)
  }
  return asOptionalString(ENV.SENTRY_PROJECT)
}

function buildIssueSearchUrl(params: {
  org: string
  project?: string
  eventId: string
}) {
  const base = `${getSentryBaseUrl()}/organizations/${encodeURIComponent(params.org)}/issues/`
  const url = new URL(base)
  if (params.project) {
    url.searchParams.set('project', params.project)
  }
  url.searchParams.set('query', params.eventId)
  return url.toString()
}

function buildIssueEventUrl(params: {
  org: string
  groupId: string
  eventId: string
  project?: string
}) {
  const base = `${getSentryBaseUrl()}/organizations/${encodeURIComponent(params.org)}/issues/${encodeURIComponent(params.groupId)}/events/${encodeURIComponent(params.eventId)}/`
  const url = new URL(base)
  if (params.project) {
    url.searchParams.set('project', params.project)
  }
  return url.toString()
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SENTRY_FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function resolveEventRecord(
  org: string,
  eventId: string,
): Promise<ResolvedEventRecord | null> {
  if (!ENV.SENTRY_AUTH_TOKEN) return null

  const baseUrl = getSentryBaseUrl()
  const response = await fetchWithTimeout(
    `${baseUrl}/api/0/organizations/${encodeURIComponent(org)}/eventids/${encodeURIComponent(eventId)}/`,
    {
      headers: {
        authorization: `Bearer ${ENV.SENTRY_AUTH_TOKEN}`,
        'content-type': 'application/json',
      },
      cache: 'no-store',
    },
  ).catch(() => null)

  if (!response || !response.ok) return null

  const payload = await response.json().catch(() => null)
  if (!Array.isArray(payload) || !payload.length) return null

  const resolved = payload[0] as ResolvedEventRecord
  return resolved || null
}

export async function buildSentryFeedbackLinks(
  options: SentryFeedbackLinkOptions,
): Promise<SentryFeedbackLinks | null> {
  const eventId = asOptionalString(options.eventId)
  if (!eventId) return null

  const runtime = options.runtime || 'web'
  const org = asOptionalString(ENV.SENTRY_ORG)
  const configuredProject = getProjectForRuntime(runtime)

  if (!org) {
    return {
      runtime,
      ...(configuredProject ? { project: configuredProject } : {}),
    }
  }

  const resolved = await resolveEventRecord(org, eventId)
  const project =
    asOptionalString(resolved?.projectSlug) || configuredProject || undefined
  const resolvedEventId =
    asOptionalString(resolved?.eventId) || asOptionalString(resolved?.id) || eventId
  const groupId = asOptionalString(resolved?.groupId) || asOptionalString(resolved?.groupID)

  return {
    runtime,
    ...(project ? { project } : {}),
    searchUrl: buildIssueSearchUrl({
      org,
      ...(project ? { project } : {}),
      eventId: resolvedEventId,
    }),
    ...(groupId
      ? {
          eventUrl: buildIssueEventUrl({
            org,
            groupId,
            eventId: resolvedEventId,
            ...(project ? { project } : {}),
          }),
        }
      : {}),
  }
}

export function buildSentryFeedbackFallbackLinks(
  options: SentryFeedbackLinkOptions,
): SentryFeedbackLinks | null {
  const eventId = asOptionalString(options.eventId)
  if (!eventId) return null

  const runtime = options.runtime || 'web'
  const org = asOptionalString(ENV.SENTRY_ORG)
  const project = getProjectForRuntime(runtime)

  if (!org) {
    return {
      runtime,
      ...(project ? { project } : {}),
    }
  }

  return {
    runtime,
    ...(project ? { project } : {}),
    searchUrl: buildIssueSearchUrl({
      org,
      ...(project ? { project } : {}),
      eventId,
    }),
  }
}
