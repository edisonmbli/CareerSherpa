import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Hoist mock values, then apply the mock
const mockedEnv = vi.hoisted(() => ({
  ENV: {
    UPSTASH_REDIS_REST_URL: '',
    UPSTASH_REDIS_REST_TOKEN: '',
  },
  isProdRedisReady: () => false,
}))

// Force memory fallback by mocking env readiness before importing the module under test
vi.mock('@/lib/env', () => mockedEnv)

import { bumpPending, decPending, getPending } from '@/lib/redis/counter'

describe('redis backpressure counter (memory fallback)', () => {
  const key = 'test:counter:user:123'

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('increments until maxPending and then rejects', async () => {
    const ttlSec = 60
    const max = 2

    const r1 = await bumpPending(key, ttlSec, max)
    expect(r1.ok).toBe(true)
    expect(r1.pending).toBe(1)

    const r2 = await bumpPending(key, ttlSec, max)
    expect(r2.ok).toBe(true)
    expect(r2.pending).toBe(2)

    const r3 = await bumpPending(key, ttlSec, max)
    expect(r3.ok).toBe(false)
    expect(r3.pending).toBe(2)
    expect(r3.remaining).toBe(0)

    const p = await getPending(key)
    expect(p).toBe(2)

    const d1 = await decPending(key)
    expect(d1).toBe(1)

    const d2 = await decPending(key)
    expect(d2).toBe(0)

    const d3 = await decPending(key)
    expect(d3).toBe(0)
  })

  it('resets after TTL expires', async () => {
    const ttlSec = 1
    const max = 1

    const r1 = await bumpPending(key, ttlSec, max)
    expect(r1.ok).toBe(true)
    expect(r1.pending).toBe(1)

    const r2 = await bumpPending(key, ttlSec, max)
    expect(r2.ok).toBe(false)
    expect(r2.pending).toBe(1)

    // advance time past TTL
    vi.advanceTimersByTime(1100)
    // move system time ahead to ensure Date.now reflects expiry
    vi.setSystemTime(new Date('2025-01-01T00:00:01Z'))

    const r3 = await bumpPending(key, ttlSec, max)
    expect(r3.ok).toBe(true)
    expect(r3.pending).toBe(1)
  })
})