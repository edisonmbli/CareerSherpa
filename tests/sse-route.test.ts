import { describe, it, expect } from 'vitest'
import { GET } from '@/app/api/sse-stream/route'

describe('SSE Route', () => {
  it('returns 400 when missing params', async () => {
    const req = new Request('http://localhost/api/sse-stream')
    const res = await GET(req as any)
    expect(res.status).toBe(400)
  })

  it('returns event-stream headers when params provided', async () => {
    const req = new Request('http://localhost/api/sse-stream?userId=u&serviceId=s&taskId=t')
    const res = await GET(req as any)
    expect(res.headers.get('Content-Type')).toContain('text/event-stream')
    expect(res.headers.get('Cache-Control')).toContain('no-cache')
  })
})