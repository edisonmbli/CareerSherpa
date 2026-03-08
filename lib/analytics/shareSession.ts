'use client'

const SHARE_SESSION_KEY = 'cs_share_session_id'
const SHARE_VIEW_TS_PREFIX = 'cs_share_view_ts:'
export const SHARE_VIEW_DEDUPE_WINDOW_MS = 30 * 60 * 1000

function randomPart(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {}
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function getOrCreateShareSessionId(): string {
  if (typeof window === 'undefined') return `sess_${randomPart()}`
  try {
    const existing = window.sessionStorage.getItem(SHARE_SESSION_KEY)
    if (existing) return existing
    const created = `sess_${randomPart()}`
    window.sessionStorage.setItem(SHARE_SESSION_KEY, created)
    return created
  } catch {
    return `sess_${randomPart()}`
  }
}

export function shouldTrackShareView(
  shareId: string,
  dedupeWindowMs: number = SHARE_VIEW_DEDUPE_WINDOW_MS,
): boolean {
  if (!shareId || typeof window === 'undefined') return true
  try {
    const key = `${SHARE_VIEW_TS_PREFIX}${shareId}`
    const now = Date.now()
    const raw = window.sessionStorage.getItem(key)
    const prev = raw ? Number(raw) : 0
    if (Number.isFinite(prev) && prev > 0 && now - prev < dedupeWindowMs) {
      return false
    }
    window.sessionStorage.setItem(key, String(now))
    return true
  } catch {
    return true
  }
}
