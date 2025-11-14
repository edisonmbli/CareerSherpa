export function getRequestMeta(req: Request, taskId: string) {
  const headers = new Headers(req.headers)
  const requestId =
    headers.get('x-request-id') ||
    headers.get('x-vercel-id') ||
    (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`)
  const traceparent = headers.get('traceparent') || ''
  const traceId = (traceparent && traceparent.split('-')[1]) || headers.get('x-trace-id') || taskId
  return { requestId, traceId }
}

