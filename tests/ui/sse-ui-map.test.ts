import { describe, it, expect } from 'vitest'
import { resolveUiFromEvent } from '@/lib/ui/sse-ui-map'

describe('sse-ui-map: resolveUiFromEvent', () => {
  it('maps token events to MATCH_STREAMING', () => {
    const r1 = resolveUiFromEvent({ type: 'token', text: 'abc' })
    const r2 = resolveUiFromEvent({ type: 'token_batch', data: 'abc' })
    expect(r1.status).toBe('MATCH_STREAMING')
    expect(r2.status).toBe('MATCH_STREAMING')
  })

  it('maps done to COMPLETED', () => {
    const r = resolveUiFromEvent({ type: 'done' })
    expect(r.status).toBe('COMPLETED')
  })

  it('maps SUMMARY_FAILED without failureCode to summary_failed', () => {
    const r = resolveUiFromEvent({ type: 'status', status: 'SUMMARY_FAILED' })
    expect(r.status).toBe('FAILED')
    expect(r.errorKey).toBe('summary_failed')
  })

  it('maps SUMMARY_FAILED with PREVIOUS_OCR_FAILED to previous_ocr_failed', () => {
    const r = resolveUiFromEvent({
      type: 'status',
      status: 'SUMMARY_FAILED',
      failureCode: 'PREVIOUS_OCR_FAILED',
    })
    expect(r.status).toBe('FAILED')
    expect(r.errorKey).toBe('previous_ocr_failed')
  })

  it('maps summary_completed to MATCH_PENDING', () => {
    const r = resolveUiFromEvent({ type: 'status', code: 'summary_completed' })
    expect(r.status).toBe('MATCH_PENDING')
  })
})

