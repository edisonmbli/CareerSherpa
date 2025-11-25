import { create } from 'zustand'
import { z } from 'zod'
import { resolveUiFromEvent } from '@/lib/ui/sse-ui-map'

export type WorkbenchStatus =
  | 'IDLE'
  | 'OCR_PENDING'
  | 'SUMMARY_PENDING'
  | 'MATCH_PENDING'
  | 'MATCH_STREAMING'
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
    taskId: z.string().optional(),
  }),
  z.object({ type: z.literal('info'), code: z.string().optional() }),
])

interface WorkbenchState {
  currentServiceId: string | null
  status: WorkbenchStatus
  errorMessage: string | null
  streamingResponse: string
  startTask: (serviceId: string, initialStatus: WorkbenchStatus) => void
  setStatus: (status: WorkbenchStatus) => void
  appendStreamToken: (token: string) => void
  completeStream: () => void
  setError: (message: string) => void
  reset: () => void
  ingestEvent: (msg: any) => void
}

let __buffer = ''
let __timer: ReturnType<typeof setTimeout> | null = null
let __lastSid: string | null = null

export const useWorkbenchStore = create<WorkbenchState>((set) => ({
  currentServiceId: null,
  status: 'IDLE',
  errorMessage: null,
  streamingResponse: '',
  startTask: (serviceId, initialStatus) =>
    set({
      currentServiceId: serviceId,
      status: initialStatus,
      errorMessage: null,
      streamingResponse: '',
    }),
  setStatus: (status) => set({ status }),
  appendStreamToken: (token) =>
    set((s) => ({
      status: 'MATCH_STREAMING',
      streamingResponse: s.streamingResponse + token,
    })),
  completeStream: () => set({ status: 'COMPLETED' }),
  setError: (message) => set({ status: 'FAILED', errorMessage: message }),
  reset: () =>
    set({
      currentServiceId: null,
      status: 'IDLE',
      errorMessage: null,
      streamingResponse: '',
    }),
  ingestEvent: (msg: any) => {
    const parsed = sseEventSchema.safeParse(msg)
    if (!parsed.success) return
    const e = parsed.data as any
    const sid = typeof e._sid === 'string' ? e._sid : null
    if (sid && __lastSid === sid) {
      return
    }
    if (sid) __lastSid = sid
    if (e.type === 'start') {
      __buffer = ''
      if (__timer) {
        clearTimeout(__timer)
        __timer = null
      }
      set({ status: 'MATCH_STREAMING' })
      return
    }
    if (e.type === 'token') {
      const t = typeof e.text === 'string' ? e.text : ''
      if (t) {
        try {
          if (process.env.NODE_ENV !== 'production') {
            console.info('store_append_token', { len: t.length })
          }
        } catch {}
        __buffer += String(t)
        if (!__timer) {
          __timer = setTimeout(() => {
            const chunk = __buffer
            __buffer = ''
            __timer = null
            set((s) => ({
              status: 'MATCH_STREAMING',
              streamingResponse: s.streamingResponse + chunk,
            }))
          }, 500)
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
        try {
          if (process.env.NODE_ENV !== 'production') {
            console.info('store_append_token_batch', { len: text.length })
          }
        } catch {}
        __buffer += String(text)
        if (!__timer) {
          __timer = setTimeout(() => {
            const chunk = __buffer
            __buffer = ''
            __timer = null
            set((s) => ({
              status: 'MATCH_STREAMING',
              streamingResponse: s.streamingResponse + chunk,
            }))
          }, 120)
        }
      }
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
      set((s) => ({
        status: 'MATCH_STREAMING',
        streamingResponse: s.streamingResponse + chunk,
      }))
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
    if (r.status === 'FAILED') {
      set((s) => ({
        status: 'FAILED',
        errorMessage: r.errorKey || s.errorMessage,
      }))
      return
    }
  },
}))
