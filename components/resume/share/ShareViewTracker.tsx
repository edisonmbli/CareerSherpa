'use client'

import { useEffect, useRef, Suspense } from 'react'
import { trackShareEventAction } from '@/lib/actions/share.actions'
import { useSearchParams } from 'next/navigation'
import {
  getOrCreateShareSessionId,
  shouldTrackShareView,
} from '@/lib/analytics/shareSession'

function TrackerContent({
  shareKey,
  templateId,
  enabled,
}: {
  shareKey: string
  templateId: string
  enabled: boolean
}) {
  const tracked = useRef(false)
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!enabled) return
    if (tracked.current) return
    tracked.current = true

    if (!shouldTrackShareView(shareKey)) return
    const sessionId = getOrCreateShareSessionId()

    const payload = {
      shareId: shareKey,
      templateId,
      source: 'web',
      referrer: document.referrer,
      sessionId,
      utm_source: searchParams.get('utm_source'),
      utm_medium: searchParams.get('utm_medium'),
      utm_campaign: searchParams.get('utm_campaign'),
      utm_content: searchParams.get('utm_content'),
      utm_term: searchParams.get('utm_term'),
    }

    trackShareEventAction({
      eventName: 'RESUME_SHARE_VIEW',
      payload,
    })
  }, [enabled, shareKey, templateId, searchParams])

  return null
}

export function ShareViewTracker(props: {
  shareKey: string
  templateId: string
  enabled?: boolean
}) {
  const enabled = props.enabled !== false
  return (
    <Suspense fallback={null}>
      <TrackerContent shareKey={props.shareKey} templateId={props.templateId} enabled={enabled} />
    </Suspense>
  )
}
