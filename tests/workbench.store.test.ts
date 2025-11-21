import { describe, it, expect } from 'vitest'
import { useWorkbenchStore } from '@/lib/stores/workbench.store'

describe('workbench.store', () => {
  it('starts task and appends tokens', () => {
    const s = useWorkbenchStore.getState()
    s.startTask('svc_1', 'MATCH_PENDING')
    expect(useWorkbenchStore.getState().currentServiceId).toBe('svc_1')
    expect(useWorkbenchStore.getState().status).toBe('MATCH_PENDING')
    s.appendStreamToken('Hello')
    s.appendStreamToken(' World')
    expect(useWorkbenchStore.getState().streamingResponse).toBe('Hello World')
    expect(useWorkbenchStore.getState().status).toBe('MATCH_STREAMING')
    s.completeStream()
    expect(useWorkbenchStore.getState().status).toBe('COMPLETED')
  })
  it('sets error state', () => {
    const s = useWorkbenchStore.getState()
    s.setError('oops')
    expect(useWorkbenchStore.getState().status).toBe('FAILED')
    expect(useWorkbenchStore.getState().errorMessage).toBe('oops')
  })
})