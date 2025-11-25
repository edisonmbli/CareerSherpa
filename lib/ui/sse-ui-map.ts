import type { WorkbenchStatus } from '@/lib/stores/workbench.store'

export function resolveUiFromEvent(msg: any): {
  status?: WorkbenchStatus
  errorKey?: string
} {
  const t = String(msg?.type || '')
  const s = String(msg?.status || '')
  const c = String(msg?.code || '')
  const f = String(msg?.failureCode || '')
  if (t === 'token' || t === 'token_batch') return { status: 'MATCH_STREAMING' }
  if (t === 'done') return { status: 'COMPLETED' }
  if (t === 'error') return { status: 'FAILED', errorKey: String(msg?.message || 'stream_error') }
  if (t === 'start') return { status: 'MATCH_STREAMING' }
  if (t === 'status') {
    if (s === 'MATCH_STREAMING' || c === 'match_streaming') return { status: 'MATCH_STREAMING' }
    if (s === 'SUMMARY_PENDING' || c === 'summary_pending') return { status: 'SUMMARY_PENDING' }
    if (s === 'MATCH_COMPLETED' || c === 'match_completed') return { status: 'COMPLETED' }
    if (s === 'MATCH_FAILED' || c === 'match_failed') return { status: 'FAILED', errorKey: 'match_failed' }
    if (s === 'SUMMARY_FAILED' || c === 'summary_failed') {
      const key = f === 'PREVIOUS_OCR_FAILED' ? 'previous_ocr_failed' : 'summary_failed'
      return { status: 'FAILED', errorKey: key }
    }
    if (s === 'SUMMARY_COMPLETED' || c === 'summary_completed') return { status: 'MATCH_PENDING' }
  }
  if (t === 'info') {
    if (c === 'stream_idle') return { status: 'MATCH_STREAMING' }
  }
  return {}
}
