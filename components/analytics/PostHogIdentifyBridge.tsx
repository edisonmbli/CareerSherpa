'use client'

import { useEffect } from 'react'
import { useUser } from '@stackframe/stack'
import posthog from 'posthog-js'

let activeDistinctId: string | null = null

function asOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

export function PostHogIdentifyBridge(props: { locale?: string; scope: 'workbench' | 'profile' }) {
  const user = useUser() as any

  useEffect(() => {
    const enabled =
      (process.env['NEXT_PUBLIC_POSTHOG_ENABLED'] ?? 'false').toLowerCase() === 'true'
    if (!enabled) return

    const userId = asOptionalString(user?.id)
    if (!userId) {
      if (activeDistinctId) {
        posthog.reset()
        activeDistinctId = null
      }
      return
    }

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

    posthog.identify(userId, {
      ...(email ? { email } : {}),
      ...(name ? { name } : {}),
      ...(plan ? { plan } : {}),
      ...(props.locale ? { locale: props.locale } : {}),
      analytics_scope: props.scope,
    })
    activeDistinctId = userId
  }, [props.locale, props.scope, user?.id, user?.primaryEmail, user?.email, user?.name, user?.displayName])

  return null
}
