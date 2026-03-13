'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { captureSentryBrowserException } from '@/lib/sentry/browser'

type ResultState = {
  target: 'client' | 'server' | 'edge' | null
  message: string | null
}

export function SentryDevPanel() {
  const [result, setResult] = useState<ResultState>({ target: null, message: null })
  const [pending, setPending] = useState<'server' | 'edge' | null>(null)

  const triggerClient = () => {
    const eventId = captureSentryBrowserException(
      new Error('career_shaper_web_client_debug_error'),
    )
    setResult({
      target: 'client',
      message: eventId
        ? `Client event captured: ${eventId}`
        : 'Client exception sent. Check browser console and Sentry.',
    })
  }

  const triggerRoute = async (target: 'server' | 'edge') => {
    setPending(target)
    try {
      const response = await fetch(`/api/dev/sentry/${target}`, {
        method: 'GET',
        cache: 'no-store',
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'sentry_debug_route_failed')
      }
      setResult({
        target,
        message: payload?.eventId
          ? `${target} event captured: ${payload.eventId}`
          : `${target} route executed. Check Sentry for the latest event.`,
      })
    } catch (error) {
      setResult({
        target,
        message:
          error instanceof Error ? error.message : 'sentry_debug_route_failed',
      })
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-slate-950">Sentry debug panel</h2>
        <p className="max-w-2xl text-sm leading-6 text-slate-600">
          Use these controls to validate client, server route, and edge route Sentry ingestion from local development.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={triggerClient}>Trigger client exception</Button>
        <Button
          variant="outline"
          disabled={pending === 'server'}
          onClick={() => void triggerRoute('server')}
        >
          {pending === 'server' ? 'Sending...' : 'Trigger server route exception'}
        </Button>
        <Button
          variant="outline"
          disabled={pending === 'edge'}
          onClick={() => void triggerRoute('edge')}
        >
          {pending === 'edge' ? 'Sending...' : 'Trigger edge route exception'}
        </Button>
      </div>

      {result.message ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <span className="font-medium uppercase tracking-[0.12em] text-slate-500">
            {result.target || 'status'}
          </span>
          <p className="mt-1">{result.message}</p>
        </div>
      ) : null}
    </div>
  )
}
