import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/worker/common', () => ({
  parseWorkerBody: vi.fn(),
  getUserHasQuota: vi.fn(),
  hasImage: vi.fn(),
  getTtlSec: vi.fn(),
  getChannel: vi.fn(),
  publishEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/dal/services', () => ({
  setMatchSummaryJson: vi.fn().mockResolvedValue(undefined),
  setInterviewTipsJson: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/dal/coinLedger', () => ({
  recordRefund: vi.fn().mockResolvedValue({ id: 'refund1' }),
  markDebitSuccess: vi.fn().mockResolvedValue({ id: 'debit1' }),
}))

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/env', () => ({ ENV: { WORKER_TIMEOUT_MS: 1000, QUEUE_MAX_SIZE: 10, LLM_DEBUG: false } }))

import { onToken, streamWriteResults, streamHandleTransactions } from '@/lib/worker/handlers'
import { publishEvent } from '@/lib/worker/common'
import { setMatchSummaryJson, setInterviewTipsJson } from '@/lib/dal/services'
import { recordRefund, markDebitSuccess } from '@/lib/dal/coinLedger'

describe('worker/handlers: onToken', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('publishes token event with correct payload', async () => {
    await onToken('cs:events:u:s:t', 't1', 'hello', 'req1', 'trace1')
    expect(publishEvent).toHaveBeenCalledTimes(1)
    const args = (publishEvent as any).mock.calls[0]
    expect(args[0]).toBe('cs:events:u:s:t')
    expect(args[1]).toMatchObject({
      type: 'token',
      taskId: 't1',
      text: 'hello',
      stage: 'stream',
      requestId: 'req1',
      traceId: 'trace1',
    })
  })
})

describe('worker/handlers: streamWriteResults', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('handles job_match JSON parsing failure and writes markdown with FAILED', async () => {
    const exec = { result: { raw: 'not-json' } }
    await streamWriteResults('job_match' as any, 'svc1', exec, {}, 'u1', 'req1')
    expect(setMatchSummaryJson).toHaveBeenCalledTimes(1)
    expect(setMatchSummaryJson).toHaveBeenCalledWith('svc1', { markdown: 'not-json' }, 'FAILED')
  })

  it('handles interview_prep JSON parsing failure and writes markdown with COMPLETED', async () => {
    const exec = { result: { raw: 'bad-json' } }
    await streamWriteResults('interview_prep' as any, 'svc2', exec, {}, 'u2', 'req2')
    expect(setInterviewTipsJson).toHaveBeenCalledTimes(1)
    expect(setInterviewTipsJson).toHaveBeenCalledWith('svc2', { markdown: 'bad-json' }, 'COMPLETED')
  })
})

describe('worker/handlers: streamHandleTransactions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('job_match parse failure triggers refund', async () => {
    const exec = { result: { raw: 'oops', usageLogId: 'ul1' } }
    const vars = { wasPaid: true, cost: 10, debitId: 'deb1', serviceId: 'svc-ledger' }
    await streamHandleTransactions('job_match' as any, exec, vars, 'svc-ledger', 'u1', 'req1')
    expect(recordRefund).toHaveBeenCalledTimes(1)
    const arg = (recordRefund as any).mock.calls[0][0]
    expect(arg.userId).toBe('u1')
    expect(arg.amount).toBe(10)
    expect(arg.relatedId).toBe('deb1')
    expect(arg.serviceId).toBe('svc-ledger')
    expect(arg.templateId).toBe('job_match')
    expect(markDebitSuccess).not.toHaveBeenCalled()
  })

  it('job_match parse success marks debit success', async () => {
    const exec = { result: { raw: '{"a":"b"}', usageLogId: 'ul2' } }
    const vars = { wasPaid: true, cost: 5, debitId: 'deb2' }
    await streamHandleTransactions('job_match' as any, exec, vars, 'svcX', 'u2', 'req2')
    expect(markDebitSuccess).toHaveBeenCalledTimes(1)
    expect(markDebitSuccess).toHaveBeenCalledWith('deb2', 'ul2')
    expect(recordRefund).not.toHaveBeenCalled()
  })

  it('non-job_match marks debit success when paid', async () => {
    const exec = { result: { raw: 'irrelevant', usageLogId: 'ul3' } }
    const vars = { wasPaid: true, cost: 8, debitId: 'deb3' }
    await streamHandleTransactions('interview_prep' as any, exec, vars, 'svcY', 'u3', 'req3')
    expect(markDebitSuccess).toHaveBeenCalledTimes(1)
    expect(markDebitSuccess).toHaveBeenCalledWith('deb3', 'ul3')
    expect(recordRefund).not.toHaveBeenCalled()
  })
})
