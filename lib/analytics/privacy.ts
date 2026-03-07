import { createHash } from 'crypto'
import { ENV } from '@/lib/env'

export function normalizeEmail(input: string): string {
  return String(input || '').trim().toLowerCase()
}

export function hashEmailForAnalytics(input: string): string {
  const email = normalizeEmail(input)
  const salt = ENV.ANALYTICS_HASH_SALT || 'career-shaper-analytics'
  return createHash('sha256').update(`${salt}:${email}`).digest('hex')
}

export function extractEmailDomain(input: string): string | undefined {
  const email = normalizeEmail(input)
  const at = email.lastIndexOf('@')
  if (at <= 0 || at >= email.length - 1) return undefined
  return email.slice(at + 1)
}

export function extractReferrerDomain(referrer?: string | null): string | undefined {
  if (!referrer) return undefined
  try {
    const url = new URL(referrer)
    return url.hostname || undefined
  } catch {
    return undefined
  }
}
