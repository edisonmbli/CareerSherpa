import { create } from 'zustand'

export type WorkbenchStatus = 'IDLE' | 'OCR_PENDING' | 'SUMMARY_PENDING' | 'MATCH_PENDING' | 'MATCH_STREAMING' | 'COMPLETED' | 'FAILED'

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
}

export const useWorkbenchStore = create<WorkbenchState>((set) => ({
  currentServiceId: null,
  status: 'IDLE',
  errorMessage: null,
  streamingResponse: '',
  startTask: (serviceId, initialStatus) => set({ currentServiceId: serviceId, status: initialStatus, errorMessage: null, streamingResponse: '' }),
  setStatus: (status) => set({ status }),
  appendStreamToken: (token) => set((s) => ({ status: 'MATCH_STREAMING', streamingResponse: s.streamingResponse + token })),
  completeStream: () => set({ status: 'COMPLETED' }),
  setError: (message) => set({ status: 'FAILED', errorMessage: message }),
  reset: () => set({ currentServiceId: null, status: 'IDLE', errorMessage: null, streamingResponse: '' }),
}))