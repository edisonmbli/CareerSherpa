'use client'

import { useEffect } from 'react'
import { useUser } from '@stackframe/stack'
import posthog from 'posthog-js'
import { trackSignupCompletedAction } from '@/lib/actions/landing.actions'
import { setSentryBrowserUser } from '@/lib/sentry/browser'

let activeDistinctId: string | null = null
const signupTrackedUsers = new Set<string>()

function asOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

export function PostHogIdentifyBridge(props: {
  locale?: string
  scope: 'workbench' | 'profile' | 'landing'
}) {
  const user = useUser() as any
  const userId = asOptionalString(user?.id)
  const email =
    asOptionalString(user?.primaryEmail) ||
    asOptionalString(user?.email) ||
    asOptionalString(user?.user?.primaryEmail) ||
    asOptionalString(user?.user?.email)
  const plan =
    asOptionalString(user?.plan) ||
    asOptionalString(user?.metadata?.plan) ||
    asOptionalString(user?.user?.metadata?.plan)
  const name =
    asOptionalString(user?.displayName) ||
    asOptionalString(user?.name) ||
    asOptionalString(user?.user?.displayName)

  useEffect(() => {
    const enabled =
      (process.env['NEXT_PUBLIC_POSTHOG_ENABLED'] ?? 'false').toLowerCase() === 'true'
    if (!enabled) return

    if (!userId) {
      if (activeDistinctId) {
        posthog.reset()
        activeDistinctId = null
      }
      setSentryBrowserUser(null)
      return
    }

    posthog.identify(userId, {
      ...(email ? { email } : {}),
      ...(name ? { name } : {}),
      ...(plan ? { plan } : {}),
      ...(props.locale ? { locale: props.locale } : {}),
      analytics_scope: props.scope,
    })
    setSentryBrowserUser({
      id: userId,
      ...(email ? { email } : {}),
      ...(name ? { username: name } : {}),
    })
    activeDistinctId = userId

    if (!signupTrackedUsers.has(userId)) {
      signupTrackedUsers.add(userId)
      void trackSignupCompletedAction({ method: 'stack_auth' }).catch(() => {})
    }
  }, [email, name, plan, props.locale, props.scope, userId])

  return null
}
