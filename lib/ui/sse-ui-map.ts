import type { WorkbenchStatus } from '@/lib/stores/workbench.store'

export function resolveUiFromEvent(msg: any): {
  status?: WorkbenchStatus
  errorKey?: string
  errorMessage?: string | undefined
} {
  const t = String(msg?.type || '')
  const s = String(msg?.status || '')
  const c = String(msg?.code || '')
  const f = String(msg?.failureCode || '')
  const em = msg?.errorMessage ? String(msg.errorMessage) : undefined

  if (t === 'token' || t === 'token_batch') return { status: 'MATCH_STREAMING' }
  if (t === 'done') return { status: 'COMPLETED' }
  if (t === 'error')
    return {
      status: 'FAILED',
      errorKey: String(msg?.message || 'stream_error'),
      errorMessage: String(msg?.error || msg?.message || ''),
    }
  if (t === 'start') return { status: 'MATCH_STREAMING' }
  if (t === 'status') {
    if (s === 'MATCH_STREAMING' || c === 'match_streaming')
      return { status: 'MATCH_STREAMING' }
    if (s === 'OCR_PENDING' || c === 'ocr_pending')
      return { status: 'OCR_PENDING' }
    if (s === 'SUMMARY_PENDING' || c === 'summary_pending')
      return { status: 'SUMMARY_PENDING' }
    if (s === 'MATCH_COMPLETED' || c === 'match_completed')
      return { status: 'COMPLETED' }
    if (s === 'MATCH_FAILED' || c === 'match_failed')
      return {
        status: 'MATCH_FAILED',
        errorKey: 'match_failed',
        errorMessage: em,
      }
    if (s === 'SUMMARY_FAILED' || c === 'summary_failed') {
      const key =
        f === 'PREVIOUS_OCR_FAILED' ? 'previous_ocr_failed' : 'summary_failed'
      return {
        status: f === 'PREVIOUS_OCR_FAILED' ? 'OCR_FAILED' : 'SUMMARY_FAILED',
        errorKey: key,
        errorMessage: em,
      }
    }
    if (s === 'OCR_FAILED' || c === 'ocr_failed')
      return { status: 'OCR_FAILED', errorKey: 'ocr_failed', errorMessage: em }
    if (s === 'SUMMARY_COMPLETED' || c === 'summary_completed')
      return { status: 'MATCH_PENDING' }
    if (s === 'OCR_COMPLETED' || c === 'ocr_completed')
      return { status: 'SUMMARY_PENDING' }
    if (s === 'CUSTOMIZE_PENDING' || c === 'customize_pending')
      return { status: 'CUSTOMIZE_PENDING' }
    if (s === 'CUSTOMIZE_COMPLETED' || c === 'customize_completed')
      return { status: 'CUSTOMIZE_COMPLETED' }
    if (s === 'CUSTOMIZE_FAILED' || c === 'customize_failed')
      return { status: 'CUSTOMIZE_FAILED', errorKey: 'customize_failed', errorMessage: em }
  }
  if (t === 'info') {
    if (c === 'stream_idle') return { status: 'MATCH_STREAMING' }
  }
  return {}
}
