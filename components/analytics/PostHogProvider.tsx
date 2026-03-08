'use client'

import { useEffect } from 'react'
import posthog from 'posthog-js'
import { PostHogProvider as PostHogReactProvider } from 'posthog-js/react'
import { PostHogIdentifyBridge } from '@/components/analytics/PostHogIdentifyBridge'

let hasInitialized = false

export function PostHogProvider(props: {
  children: React.ReactNode
  scope: 'workbench' | 'profile' | 'landing'
  locale?: string
}) {
  const enabled =
    (process.env['NEXT_PUBLIC_POSTHOG_ENABLED'] ?? 'false').toLowerCase() === 'true'
  const apiKey = process.env['NEXT_PUBLIC_POSTHOG_KEY'] ?? ''
  const host = process.env['NEXT_PUBLIC_POSTHOG_HOST'] ?? 'https://us.i.posthog.com'
  const shouldEnable = enabled && Boolean(apiKey)

  useEffect(() => {
    if (!shouldEnable) return
    if (!hasInitialized) {
      posthog.init(apiKey, {
        api_host: host,
        autocapture: true,
        capture_pageview: true,
        capture_pageleave: true,
        persistence: 'localStorage+cookie',
        person_profiles: 'identified_only',
        session_recording: {
          maskAllInputs: true,
          maskTextSelector:
            '[data-ph-mask], .ph-mask-text, .resume-paper, .public-resume-content',
          blockSelector: '[data-ph-block], .ph-no-capture',
        },
      })
      hasInitialized = true
    }

    // Replay only for workbench/profile. Landing keeps capture on and replay off.
    try {
      if (props.scope === 'landing') {
        if (posthog.sessionRecordingStarted()) {
          posthog.stopSessionRecording()
        }
      } else if (!posthog.sessionRecordingStarted()) {
        posthog.startSessionRecording()
      }
    } catch {}

    posthog.register({
      analytics_scope: props.scope,
      ...(props.locale ? { locale: props.locale } : {}),
    })
  }, [apiKey, host, props.scope, props.locale, shouldEnable])

  if (!shouldEnable) {
    return <>{props.children}</>
  }

  return (
    <PostHogReactProvider client={posthog}>
      <PostHogIdentifyBridge
        scope={props.scope}
        {...(props.locale ? { locale: props.locale } : {})}
      />
      {props.children}
    </PostHogReactProvider>
  )
}
