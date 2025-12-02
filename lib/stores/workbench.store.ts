import { create } from 'zustand'
import { z } from 'zod'
import { resolveUiFromEvent } from '@/lib/ui/sse-ui-map'

export type WorkbenchStatus =
  | 'IDLE'
  | 'OCR_PENDING'
  | 'OCR_COMPLETED'
  | 'OCR_FAILED'
  | 'SUMMARY_PENDING'
  | 'SUMMARY_COMPLETED'
  | 'SUMMARY_FAILED'
  | 'MATCH_PENDING'
  | 'MATCH_STREAMING'
  | 'MATCH_FAILED'
  | 'COMPLETED'
  | 'FAILED'

const sseEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('token'), text: z.string().optional() }),
  z.object({
    type: z.literal('token_batch'),
    text: z.string().optional(),
    data: z.string().optional(),
  }),
  z.object({ type: z.literal('done') }),
  z.object({ type: z.literal('error'), message: z.string().optional() }),
  z.object({ type: z.literal('start') }),
  z.object({
    type: z.literal('status'),
    status: z
      .enum([
        'OCR_PENDING',
        'OCR_COMPLETED',
        'OCR_FAILED',
        'SUMMARY_PENDING',
        'MATCH_PENDING',
        'MATCH_STREAMING',
        'MATCH_COMPLETED',
        'MATCH_FAILED',
        'SUMMARY_COMPLETED',
        'SUMMARY_FAILED',
      ])
      .optional(),
    code: z
      .enum([
        'summary_pending',
        'summary_completed',
        'match_streaming',
        'match_completed',
        'match_failed',
        'summary_failed',
      ])
      .optional(),
    failureCode: z.string().optional(),
    errorMessage: z.string().optional(),
    taskId: z.string().optional(),
  }),
  z.object({ type: z.literal('info'), code: z.string().optional() }),
  z.object({ type: z.literal('ocr_result'), text: z.string().optional() }),
  z.object({ type: z.literal('summary_result'), json: z.any().optional() }),
  z.object({ type: z.literal('match_result'), json: z.any().optional() }),
])

interface WorkbenchState {
  currentServiceId: string | null
  status: WorkbenchStatus
  errorMessage: string | null
  statusDetail: string | null
  streamingResponse: string
  ocrResult: string | null
  summaryResult: any | null
  matchResult: any | null
  isConnected: boolean
  startTask: (serviceId: string, initialStatus: WorkbenchStatus) => void
  setStatus: (status: WorkbenchStatus) => void
  appendStreamToken: (token: string) => void
  completeStream: () => void
  setError: (message: string) => void
  reset: () => void
  setConnectionStatus: (connected: boolean) => void
  ingestEvent: (msg: any) => void
}

let __buffer = ''
let __timer: ReturnType<typeof setTimeout> | null = null
let __lastSid: string | null = null

export const useWorkbenchStore = create<WorkbenchState>((set, get) => ({
  currentServiceId: null,
  status: 'IDLE',
  errorMessage: null,
  statusDetail: null,
  streamingResponse: '',
  ocrResult: null,
  summaryResult: null,
  matchResult: null,
  isConnected: false,
  startTask: (serviceId, initialStatus) =>
    set({
      currentServiceId: serviceId,
      status: initialStatus,
      errorMessage: null,
      streamingResponse: '',
      statusDetail: null,
      ocrResult: null,
      summaryResult: null,
      matchResult: null,
      isConnected: true,
    }),
  setStatus: (status) => set({ status }),
  appendStreamToken: (token) =>
    set((s) => {
      const current = s.streamingResponse
      // Heuristic: if token starts with current text, it's likely an accumulated update (replace)
      // If token is identical to current, it's a duplicate (ignore or replace)
      if (current && token.startsWith(current)) {
        return {
          status: 'MATCH_STREAMING',
          streamingResponse: token,
        }
      }
      return {
        status: 'MATCH_STREAMING',
        streamingResponse: current + token,
      }
    }),
  completeStream: () => set({ status: 'COMPLETED', isConnected: false }),
  setError: (message) =>
    set({ status: 'FAILED', errorMessage: message, isConnected: false }),
  reset: () =>
    set({
      currentServiceId: null,
      status: 'IDLE',
      errorMessage: null,
      statusDetail: null,
      streamingResponse: '',
      ocrResult: null,
      summaryResult: null,
      matchResult: null,
      isConnected: false,
    }),
  setConnectionStatus: (connected) => set({ isConnected: connected }),
  ingestEvent: (msg: any) => {
    const parsed = sseEventSchema.safeParse(msg)
    if (!parsed.success) return
    const e = parsed.data as any
    const sid = typeof e._sid === 'string' ? e._sid : null
    if (sid && __lastSid === sid) {
      return
    }
    if (sid) __lastSid = sid

    set({ isConnected: true })

    if (e.type === 'start') {
      __buffer = ''
      if (__timer) {
        clearTimeout(__timer)
        __timer = null
      }
      set((s) => {
        if (s.status !== 'MATCH_STREAMING') {
          return { status: 'MATCH_STREAMING', streamingResponse: '' }
        }
        return { streamingResponse: '' }
      })
      return
    }
    if (e.type === 'ocr_result') {
      set({ ocrResult: e.text || null })
      return
    }
    if (e.type === 'summary_result') {
      set({ summaryResult: e.json || null })
      return
    }
    if (e.type === 'match_result') {
      set({ matchResult: e.json || null, status: 'COMPLETED' })
      return
    }
    if (e.type === 'info' && e.code) {
      set({ statusDetail: e.code })
      return
    }
    if (e.type === 'status') {
      if (e.code) set({ statusDetail: e.code })
      if (e.status) {
        const s = e.status
        // Map server statuses to UI statuses
        let nextStatus: WorkbenchStatus | null = null
        if (s === 'MATCH_STREAMING') nextStatus = 'MATCH_STREAMING'
        else if (
          s === 'MATCH_COMPLETED' ||
          s === 'match_completed' ||
          s === 'COMPLETED'
        )
          nextStatus = 'COMPLETED'
        else if (s === 'MATCH_FAILED' || s === 'match_failed')
          nextStatus = 'MATCH_FAILED'
        else if (s === 'SUMMARY_FAILED') nextStatus = 'SUMMARY_FAILED'
        else if (s === 'OCR_FAILED') nextStatus = 'OCR_FAILED'
        else if (s === 'SUMMARY_COMPLETED') nextStatus = 'SUMMARY_COMPLETED'
        else if (s === 'SUMMARY_PENDING') nextStatus = 'SUMMARY_PENDING'
        else if (s === 'OCR_PENDING') nextStatus = 'OCR_PENDING'
        else if (s === 'OCR_COMPLETED') nextStatus = 'OCR_COMPLETED'
        else if (s === 'MATCH_PENDING') nextStatus = 'MATCH_PENDING'

        if (nextStatus) {
          set({ status: nextStatus, statusDetail: e.code })
        }
      }
      if (e.errorMessage) {
        set({ errorMessage: e.errorMessage })
      } else if (e.failureCode) {
        set({ errorMessage: e.failureCode })
      }
      return
    }
    if (e.type === 'token') {
      const t = typeof e.text === 'string' ? e.text : ''
      if (t) {
        __buffer += String(t)
        if (!__timer) {
          __timer = setTimeout(() => {
            const chunk = __buffer
            __buffer = ''
            __timer = null
            set((s) => {
              const current = s.streamingResponse
              if (
                current &&
                chunk.startsWith(current) &&
                chunk.length > current.length
              ) {
                return {
                  status: 'MATCH_STREAMING',
                  streamingResponse: chunk,
                }
              }
              return {
                status: 'MATCH_STREAMING',
                streamingResponse: current + chunk,
              }
            })
          }, 30) // Reduced from 500ms to 30ms for smoother flow
        }
      }
      return
    }
    if (e.type === 'token_batch') {
      const text =
        typeof e.text === 'string'
          ? e.text
          : typeof e.data === 'string'
          ? e.data
          : ''
      if (text) {
        __buffer += String(text)
        if (!__timer) {
          __timer = setTimeout(() => {
            const chunk = __buffer
            __buffer = ''
            __timer = null
            set((s) => {
              const current = s.streamingResponse
              if (
                current &&
                chunk.startsWith(current) &&
                chunk.length > current.length
              ) {
                return {
                  status: 'MATCH_STREAMING',
                  streamingResponse: chunk,
                }
              }
              return {
                status: 'MATCH_STREAMING',
                streamingResponse: current + chunk,
              }
            })
          }, 30) // Reduced from 120ms to 30ms
        }
      }
      return
    }
    if (e.type === 'done') {
      set((s) => {
        if (s.status === 'MATCH_STREAMING') {
          return { status: 'COMPLETED', isConnected: false }
        }
        return { isConnected: false }
      })
      return
    }
    const r = resolveUiFromEvent(e)
    if (!r.status && !r.errorKey) return
    if (__buffer) {
      const chunk = __buffer
      __buffer = ''
      if (__timer) {
        clearTimeout(__timer)
        __timer = null
      }
      set((s) => {
        const current = s.streamingResponse
        if (
          current &&
          chunk.startsWith(current) &&
          chunk.length > current.length
        ) {
          return {
            status: 'MATCH_STREAMING',
            streamingResponse: chunk,
          }
        }
        return {
          status: 'MATCH_STREAMING',
          streamingResponse: current + chunk,
        }
      })
    }
    if (r.status === 'MATCH_STREAMING') {
      try {
        if (process.env.NODE_ENV !== 'production') {
          console.info('store_status', { status: 'MATCH_STREAMING' })
        }
      } catch {}
      set({ status: 'MATCH_STREAMING' })
      return
    }
    if (r.status === 'SUMMARY_PENDING') {
      set({ status: 'SUMMARY_PENDING' })
      return
    }
    if (r.status === 'MATCH_PENDING') {
      try {
        if (process.env.NODE_ENV !== 'production') {
          console.info('store_status', { status: 'MATCH_PENDING' })
        }
      } catch {}
      __buffer = ''
      if (__timer) {
        clearTimeout(__timer)
        __timer = null
      }
      set({ status: 'MATCH_PENDING', streamingResponse: '' })
      return
    }
    if (r.status === 'COMPLETED') {
      set({ status: 'COMPLETED' })
      return
    }
    if (r.status === 'OCR_PENDING') {
      set({ status: 'OCR_PENDING' })
      return
    }
    if (r.status === 'OCR_COMPLETED') {
      set({ status: 'OCR_COMPLETED' })
      return
    }
    if (r.status === 'SUMMARY_COMPLETED') {
      set({ status: 'SUMMARY_COMPLETED' })
      return
    }
    if (
      r.status === 'FAILED' ||
      r.status === 'MATCH_FAILED' ||
      r.status === 'OCR_FAILED' ||
      r.status === 'SUMMARY_FAILED'
    ) {
      if (r.errorMessage) {
        set({ status: r.status, errorMessage: r.errorMessage })
      } else if (r.errorKey) {
        set({ status: r.status, errorMessage: r.errorKey })
      } else {
        set({ status: r.status })
      }
      return
    }
    if (r.status) {
      set({ status: r.status })
    }
  },
}))
