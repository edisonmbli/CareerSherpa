import { ENV } from '@/lib/env'
import type { FeedbackDispatchPayload } from '@/lib/feedback/schema'

type PostHogLinkContext = Pick<
  FeedbackDispatchPayload['context'],
  'posthogDistinctId' | 'posthogSessionId' | 'posthogReplayUrl'
>

export type PostHogFeedbackLinks = {
  personUrl?: string
  replayUrl?: string
  projectId?: string
  appBaseUrl?: string
}

function asOptionalString(value: unknown) {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

function normalizePostHogAppBase(input?: string) {
  const value = asOptionalString(input)
  if (!value) return null

  try {
    const parsed = new URL(value)
    const path = parsed.pathname.replace(/\/+$/, '')
    const projectMatch = path.match(/^\/project\/([^/]+)(?:\/.*)?$/)
    return {
      appBaseUrl: parsed.origin,
      projectIdFromPath: projectMatch?.[1]
        ? decodeURIComponent(projectMatch[1])
        : undefined,
    }
  } catch {
    return {
      appBaseUrl: value.replace(/\/+$/, ''),
      projectIdFromPath: undefined,
    }
  }
}

function parseReplayUrl(replayUrl?: string) {
  const value = asOptionalString(replayUrl)
  if (!value) return null

  const match = value.match(/^(https?:\/\/[^/]+)\/project\/([^/]+)\/replay\/([^/?#]+)/)
  if (!match) return null
  const appBaseUrl = match[1]
  const projectId = match[2]
  if (!appBaseUrl || !projectId) return null

  return {
    appBaseUrl,
    projectId: decodeURIComponent(projectId),
  }
}

function applyTemplate(
  template: string,
  values: Record<string, string | undefined>,
) {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => {
    return values[key] || ''
  })
}

export function buildPostHogFeedbackLinks(
  context: PostHogLinkContext,
): PostHogFeedbackLinks {
  const distinctId = asOptionalString(context.posthogDistinctId)
  const sessionId = asOptionalString(context.posthogSessionId)
  const replayUrl = asOptionalString(context.posthogReplayUrl)
  const parsedReplay = parseReplayUrl(replayUrl)
  const normalizedAppBase = normalizePostHogAppBase(ENV.POSTHOG_APP_BASE_URL)
  const appBaseUrl = normalizedAppBase?.appBaseUrl || parsedReplay?.appBaseUrl
  const projectId =
    asOptionalString(ENV.POSTHOG_PROJECT_ID) ||
    normalizedAppBase?.projectIdFromPath ||
    parsedReplay?.projectId

  let personUrl: string | undefined
  const personUrlTemplate = asOptionalString(ENV.POSTHOG_PERSON_URL_TEMPLATE)
  if (personUrlTemplate && distinctId) {
    personUrl = applyTemplate(personUrlTemplate, {
      appBaseUrl,
      projectId,
      distinctId,
      sessionId,
      replayUrl,
    })
  } else if (appBaseUrl && projectId && distinctId) {
    personUrl = `${appBaseUrl}/project/${encodeURIComponent(projectId)}/person/${encodeURIComponent(distinctId)}`
  }

  return {
    ...(personUrl ? { personUrl } : {}),
    ...(replayUrl ? { replayUrl } : {}),
    ...(projectId ? { projectId } : {}),
    ...(appBaseUrl ? { appBaseUrl } : {}),
  }
}
