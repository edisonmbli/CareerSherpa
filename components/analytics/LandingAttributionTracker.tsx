'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { trackLandingAttributionAction } from '@/lib/actions/landing.actions'
import {
  ANALYTICS_ATTR_FIRST_TOUCH_COOKIE,
  ANALYTICS_ATTR_LAST_TOUCH_COOKIE,
  extractDomainFromUrl,
  parseAttributionSnapshotCookie,
  sanitizeAttributionSnapshot,
  serializeAttributionSnapshot,
} from '@/lib/analytics/attribution'

const COOKIE_MAX_AGE_SEC = 90 * 24 * 60 * 60
const ANON_ID_STORAGE_KEY = 'cs_attr_anon_id'
const SESSION_ID_STORAGE_KEY = 'cs_attr_session_id'
const SESSION_SENT_KEY = 'cs_attr_landing_sent'

function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function getOrSetStorageKey(storage: Storage, key: string, prefix: string): string {
  const existing = storage.getItem(key)
  if (existing) return existing
  const created = generateId(prefix)
  storage.setItem(key, created)
  return created
}

function getCookie(name: string): string | undefined {
  const cookie = document.cookie
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`))
  if (!cookie) return undefined
  return cookie.slice(name.length + 1)
}

function setCookie(name: string, value: string, maxAgeSec: number): void {
  const encodedValue = value
  document.cookie = `${name}=${encodedValue}; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax`
}

export function LandingAttributionTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!pathname) return

    const anonymousId = getOrSetStorageKey(localStorage, ANON_ID_STORAGE_KEY, 'anon')
    const sessionId = getOrSetStorageKey(sessionStorage, SESSION_ID_STORAGE_KEY, 'sess')
    const sentMarker = sessionStorage.getItem(SESSION_SENT_KEY)

    const utm_source = searchParams.get('utm_source')
    const utm_medium = searchParams.get('utm_medium')
    const utm_campaign = searchParams.get('utm_campaign')
    const utm_content = searchParams.get('utm_content')
    const utm_term = searchParams.get('utm_term')
    const src = searchParams.get('src')
    const shareId = searchParams.get('share_id') || utm_content
    const referrerDomain = extractDomainFromUrl(document.referrer)

    const firstTouchRaw = getCookie(ANALYTICS_ATTR_FIRST_TOUCH_COOKIE)
    const firstTouch = parseAttributionSnapshotCookie(firstTouchRaw)

    const baseSnapshot = {
      landingPath: pathname,
      referrerDomain,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_content,
      utm_term,
      src,
      shareId,
      anonymousId,
      sessionId,
      occurredAt: new Date().toISOString(),
    }

    if (!firstTouch) {
      const snapshot = sanitizeAttributionSnapshot({
        touch: 'first',
        ...baseSnapshot,
      })
      setCookie(
        ANALYTICS_ATTR_FIRST_TOUCH_COOKIE,
        serializeAttributionSnapshot(snapshot),
        COOKIE_MAX_AGE_SEC,
      )
      if (!sentMarker) {
        void trackLandingAttributionAction(snapshot)
        sessionStorage.setItem(SESSION_SENT_KEY, '1')
      }
    }

    const lastTouchSnapshot = sanitizeAttributionSnapshot({
      touch: 'last',
      ...baseSnapshot,
    })
    setCookie(
      ANALYTICS_ATTR_LAST_TOUCH_COOKIE,
      serializeAttributionSnapshot(lastTouchSnapshot),
      COOKIE_MAX_AGE_SEC,
    )
    if (!sentMarker && firstTouch) {
      void trackLandingAttributionAction(lastTouchSnapshot)
      sessionStorage.setItem(SESSION_SENT_KEY, '1')
    }
  }, [pathname, searchParams])

  return null
}
