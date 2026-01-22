import { describe, it, expect } from 'vitest'
import { useWorkbenchV2Store } from '@/lib/stores/workbench-v2.store'

describe('workbench-v2.store', () => {
  it('initializes and appends match content', () => {
    const s = useWorkbenchV2Store.getState()
    s.initialize('svc_1', 'free')
    s.setStatus('MATCH_PENDING')
    expect(useWorkbenchV2Store.getState().serviceId).toBe('svc_1')
    expect(useWorkbenchV2Store.getState().status).toBe('MATCH_PENDING')
    s.appendMatchContent('Hello')
    s.appendMatchContent(' World')
    expect(useWorkbenchV2Store.getState().content.matchContent).toBe('Hello World')
  })
  it('sets error state', () => {
    const s = useWorkbenchV2Store.getState()
    s.setStatus('MATCH_PENDING')
    s.setError('oops')
    expect(useWorkbenchV2Store.getState().status).toBe('MATCH_FAILED')
    expect(useWorkbenchV2Store.getState().errorMessage).toBe('oops')
  })
})
