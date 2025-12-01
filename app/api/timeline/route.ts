export async function POST(req: Request) {
  try {
    const body = await req.json()
    const serviceId = String(body?.serviceId || '')
    const phase = String(body?.phase || '')
    const meta = (body?.meta || {}) as Record<string, any>
    if (!serviceId || !phase) return new Response('bad_request', { status: 400 })
    const { markTimeline } = await import('@/lib/observability/timeline')
    await markTimeline(serviceId, phase, meta)
    return Response.json({ ok: true })
  } catch {
    return new Response('bad_request', { status: 400 })
  }
}
