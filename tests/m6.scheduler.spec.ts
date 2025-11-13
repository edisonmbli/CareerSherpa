import { describe, it, expect } from 'vitest'
import { bumpPending, decPending } from '@/lib/redis/counter'
import { getConcurrencyConfig } from '@/lib/env'

describe('M6 scheduler basics', () => {
  it('producer-side queue backpressure respects max size', async () => {
    const key = 'bp:test:q_paid_stream'
    const cfg = getConcurrencyConfig()
    const ttlSec = 2
    const max = 3
    const r1 = await bumpPending(key, ttlSec, max)
    const r2 = await bumpPending(key, ttlSec, max)
    const r3 = await bumpPending(key, ttlSec, max)
    const r4 = await bumpPending(key, ttlSec, max)
    expect(r1.ok && r2.ok && r3.ok).toBe(true)
    expect(r4.ok).toBe(false)
    await decPending(key)
    await decPending(key)
    await decPending(key)
  })
})

