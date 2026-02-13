'use client'

import { useEffect, useRef, Suspense } from 'react'
import { trackShareEventAction } from '@/lib/actions/share.actions'
import { useSearchParams } from 'next/navigation'

function TrackerContent({ shareKey, templateId }: { shareKey: string, templateId: string }) {
  const tracked = useRef(false)
  const searchParams = useSearchParams()

  useEffect(() => {
    if (tracked.current) return
    tracked.current = true

    const payload = {
      shareId: shareKey,
      templateId,
      source: 'web',
      referrer: document.referrer,
      utm_source: searchParams.get('utm_source'),
      utm_medium: searchParams.get('utm_medium'),
      utm_campaign: searchParams.get('utm_campaign'),
    }

    trackShareEventAction({
      eventName: 'RESUME_SHARE_VIEW',
      payload,
    })
  }, [shareKey, templateId, searchParams])

  return null
}

export function ShareViewTracker(props: { shareKey: string, templateId: string }) {
  return (
    <Suspense fallback={null}>
      <TrackerContent {...props} />
    </Suspense>
  )
}
