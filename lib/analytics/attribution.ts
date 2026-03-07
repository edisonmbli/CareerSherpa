export const ANALYTICS_ATTR_FIRST_TOUCH_COOKIE = 'cs_attr_ft'
export const ANALYTICS_ATTR_LAST_TOUCH_COOKIE = 'cs_attr_lt'

export type AttributionTouch = 'first' | 'last'

export type AcquisitionChannel =
  | 'resume_referral'
  | 'paid'
  | 'organic_search'
  | 'social'
  | 'referral'
  | 'direct'
  | 'unknown'

export interface AttributionSnapshot {
  touch: AttributionTouch
  channel: AcquisitionChannel
  landingPath?: string | undefined
  referrerDomain?: string | undefined
  utm_source?: string | null | undefined
  utm_medium?: string | null | undefined
  utm_campaign?: string | null | undefined
  utm_content?: string | null | undefined
  utm_term?: string | null | undefined
  src?: string | null | undefined
  shareId?: string | null | undefined
  anonymousId?: string | undefined
  sessionId?: string | undefined
  occurredAt?: string | undefined
}

function toOptionalString(
  input: unknown,
  maxLen: number,
): string | undefined {
  if (typeof input !== 'string') return undefined
  const trimmed = input.trim()
  if (!trimmed) return undefined
  return trimmed.slice(0, maxLen)
}

function toOptionalNullableString(
  input: unknown,
  maxLen: number,
): string | null | undefined {
  if (input === null) return null
  const value = toOptionalString(input, maxLen)
  return value === undefined ? undefined : value
}

export function extractDomainFromUrl(value?: string | null): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value)
    const host = url.hostname?.trim()
    return host || undefined
  } catch {
    return undefined
  }
}

export function deriveAcquisitionChannel(input: {
  src?: string | null | undefined
  shareId?: string | null | undefined
  utm_source?: string | null | undefined
  utm_medium?: string | null | undefined
  referrerDomain?: string | undefined
}): AcquisitionChannel {
  const src = (input.src || '').toLowerCase()
  const utmSource = (input.utm_source || '').toLowerCase()
  const utmMedium = (input.utm_medium || '').toLowerCase()
  const ref = (input.referrerDomain || '').toLowerCase()
  const hasShare = Boolean(input.shareId) || src === 'share' || utmSource === 'resume_share'

  if (hasShare) return 'resume_referral'
  if (
    /^(cpc|ppc|paid|paid_social|display|affiliate|ads)$/.test(utmMedium) ||
    /^(google_ads|meta_ads|tiktok_ads|linkedin_ads)$/.test(utmSource)
  ) {
    return 'paid'
  }
  if (
    /^(social|social_paid|social_organic)$/.test(utmMedium) ||
    /(twitter|x\.com|linkedin|facebook|instagram|reddit|tiktok|youtube)\./.test(ref)
  ) {
    return 'social'
  }
  if (
    /(google\.|bing\.|baidu\.|duckduckgo\.|yahoo\.)/.test(ref) &&
    !utmMedium
  ) {
    return 'organic_search'
  }
  if (ref) return 'referral'
  if (!utmSource && !utmMedium) return 'direct'
  return 'unknown'
}

export function sanitizeAttributionSnapshot(
  input: Partial<AttributionSnapshot>,
): AttributionSnapshot {
  const shareId =
    toOptionalNullableString(input.shareId, 120) ??
    toOptionalNullableString(input.utm_content, 120)
  const src = toOptionalNullableString(input.src, 24)
  const utmSource = toOptionalNullableString(input.utm_source, 80)
  const utmMedium = toOptionalNullableString(input.utm_medium, 80)
  const referrerDomain = toOptionalString(input.referrerDomain, 128)
  const channel = deriveAcquisitionChannel({
    src: src ?? undefined,
    shareId: shareId ?? undefined,
    utm_source: utmSource ?? undefined,
    utm_medium: utmMedium ?? undefined,
    referrerDomain,
  })

  return {
    touch: input.touch === 'last' ? 'last' : 'first',
    channel,
    landingPath: toOptionalString(input.landingPath, 256),
    referrerDomain,
    utm_source: utmSource,
    utm_medium: utmMedium,
    utm_campaign: toOptionalNullableString(input.utm_campaign, 80),
    utm_content: toOptionalNullableString(input.utm_content, 120),
    utm_term: toOptionalNullableString(input.utm_term, 120),
    src,
    shareId,
    anonymousId: toOptionalString(input.anonymousId, 80),
    sessionId: toOptionalString(input.sessionId, 80),
    occurredAt: toOptionalString(input.occurredAt, 64),
  }
}

export function serializeAttributionSnapshot(
  snapshot: AttributionSnapshot,
): string {
  return encodeURIComponent(JSON.stringify(snapshot))
}

export function parseAttributionSnapshotCookie(
  rawCookie: string | undefined,
): AttributionSnapshot | null {
  if (!rawCookie) return null
  try {
    const decoded = decodeURIComponent(rawCookie)
    const parsed = JSON.parse(decoded) as Partial<AttributionSnapshot>
    return sanitizeAttributionSnapshot(parsed)
  } catch {
    return null
  }
}
