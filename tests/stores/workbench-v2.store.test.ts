/**
 * Unit Tests for Workbench V2 Store
 *
 * Tests the clean SSE state machine implementation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useWorkbenchV2Store } from '@/lib/stores/workbench-v2.store'

describe('workbench-v2.store', () => {
    beforeEach(() => {
        // Reset store before each test
        useWorkbenchV2Store.getState().reset()
    })

    describe('initialize', () => {
        it('should set initial state correctly', () => {
            useWorkbenchV2Store.getState().initialize('service-123', 'free')

            const state = useWorkbenchV2Store.getState()
            expect(state.serviceId).toBe('service-123')
            expect(state.tier).toBe('free')
            expect(state.status).toBe('IDLE')
            expect(state.errorMessage).toBeNull()
            expect(state.content.visionContent).toBe('')
            expect(state.content.matchContent).toBe('')
        })

        it('should work with paid tier', () => {
            useWorkbenchV2Store.getState().initialize('service-456', 'paid')

            const state = useWorkbenchV2Store.getState()
            expect(state.tier).toBe('paid')
        })
    })

    describe('setStatus', () => {
        beforeEach(() => {
            useWorkbenchV2Store.getState().initialize('test', 'free')
        })

        it('should update status correctly', () => {
            useWorkbenchV2Store.getState().setStatus('JOB_VISION_PENDING')

            expect(useWorkbenchV2Store.getState().status).toBe('JOB_VISION_PENDING')
        })

        it('should start progress simulation for pending states', () => {
            useWorkbenchV2Store.getState().setStatus('JOB_VISION_PENDING')

            const { progress } = useWorkbenchV2Store.getState()
            expect(progress.isActive).toBe(true)
            expect(progress.baseProgress).toBe(0)
            expect(progress.targetProgress).toBe(10)
        })

        it('should set correct progress range for streaming states', () => {
            useWorkbenchV2Store.getState().setStatus('JOB_VISION_STREAMING')

            const { progress } = useWorkbenchV2Store.getState()
            expect(progress.baseProgress).toBe(10)
            expect(progress.targetProgress).toBe(40)
        })

        it('should stop simulation for completed states', () => {
            useWorkbenchV2Store.getState().setStatus('MATCH_COMPLETED')

            const { progress } = useWorkbenchV2Store.getState()
            expect(progress.isActive).toBe(false)
            expect(progress.baseProgress).toBe(100)
        })
    })

    describe('content management', () => {
        beforeEach(() => {
            useWorkbenchV2Store.getState().initialize('test', 'free')
        })

        it('should append vision content', () => {
            const store = useWorkbenchV2Store.getState()
            store.appendVisionContent('Hello ')
            store.appendVisionContent('World')

            expect(useWorkbenchV2Store.getState().content.visionContent).toBe('Hello World')
        })

        it('should set vision result and update content', () => {
            const json = { company: 'Test Corp', jobTitle: 'Engineer' }
            useWorkbenchV2Store.getState().setVisionResult(json)

            const { content } = useWorkbenchV2Store.getState()
            expect(content.visionJson).toEqual(json)
            expect(content.visionContent).toContain('Test Corp')
        })

        it('should handle accumulated match chunks (replacement)', () => {
            const store = useWorkbenchV2Store.getState()
            store.appendMatchContent('AB')
            store.appendMatchContent('ABC') // Accumulated, should replace
            store.appendMatchContent('ABCD') // Accumulated, should replace

            expect(useWorkbenchV2Store.getState().content.matchContent).toBe('ABCD')
        })

        it('should handle incremental match chunks (append)', () => {
            const store = useWorkbenchV2Store.getState()
            store.appendMatchContent('Hello')
            store.appendMatchContent(' World') // Incremental, should append

            expect(useWorkbenchV2Store.getState().content.matchContent).toBe('Hello World')
        })

        it('should set match result and update status', () => {
            const json = { score: 85, assessment: 'Good match' }
            useWorkbenchV2Store.getState().setMatchResult(json)

            const state = useWorkbenchV2Store.getState()
            expect(state.content.matchJson).toEqual(json)
            expect(state.status).toBe('MATCH_COMPLETED')
            expect(state.progress.isActive).toBe(false)
        })
    })

    describe('error handling', () => {
        beforeEach(() => {
            useWorkbenchV2Store.getState().initialize('test', 'free')
        })

        it('should set error and map to failed status', () => {
            useWorkbenchV2Store.getState().setStatus('JOB_VISION_STREAMING')
            useWorkbenchV2Store.getState().setError('LLM call failed')

            const state = useWorkbenchV2Store.getState()
            expect(state.status).toBe('JOB_VISION_FAILED')
            expect(state.errorMessage).toBe('LLM call failed')
        })

        it('should stop progress on error', () => {
            useWorkbenchV2Store.getState().setStatus('MATCH_STREAMING')
            useWorkbenchV2Store.getState().setError('Network error')

            expect(useWorkbenchV2Store.getState().progress.isActive).toBe(false)
        })
    })

    describe('progress simulation', () => {
        beforeEach(() => {
            useWorkbenchV2Store.getState().initialize('test', 'free')
        })

        it('should calculate progress based on elapsed time', () => {
            const store = useWorkbenchV2Store.getState()

            // Set up progress with known values
            store.setStatus('JOB_VISION_STREAMING') // 10-40% in 30s

            // Mock time passing
            const startedAt = useWorkbenchV2Store.getState().progress.startedAt!
            vi.spyOn(Date, 'now').mockReturnValue(startedAt + 15000) // 50% of duration

            const progress = store.updateProgress()

            // Should be roughly halfway between 10 and 40 (with easing)
            expect(progress).toBeGreaterThan(20)
            expect(progress).toBeLessThan(40)
        })

        it('should cap progress at target', () => {
            const store = useWorkbenchV2Store.getState()
            store.setStatus('JOB_VISION_STREAMING')

            // Mock time way past duration
            const startedAt = useWorkbenchV2Store.getState().progress.startedAt!
            vi.spyOn(Date, 'now').mockReturnValue(startedAt + 100000) // Way past 30s

            const progress = store.updateProgress()
            expect(progress).toBeLessThanOrEqual(40) // Should not exceed target
        })
    })

    describe('connection state', () => {
        beforeEach(() => {
            useWorkbenchV2Store.getState().initialize('test', 'free')
        })

        it('should track connection status', () => {
            useWorkbenchV2Store.getState().setConnected(true, 'task-123')

            const { connection } = useWorkbenchV2Store.getState()
            expect(connection.isConnected).toBe(true)
            expect(connection.currentTaskId).toBe('task-123')
        })

        it('should increment reconnect count on disconnect', () => {
            const store = useWorkbenchV2Store.getState()
            store.setConnected(true, 'task-123')
            store.setConnected(false)
            store.setConnected(false)

            expect(useWorkbenchV2Store.getState().connection.reconnectCount).toBe(2)
        })

        it('should reset reconnect count on successful connect', () => {
            const store = useWorkbenchV2Store.getState()
            store.setConnected(false)
            store.setConnected(false)
            store.setConnected(true, 'task-123')

            expect(useWorkbenchV2Store.getState().connection.reconnectCount).toBe(0)
        })
    })

    describe('Free tier progress ranges', () => {
        beforeEach(() => {
            useWorkbenchV2Store.getState().initialize('test', 'free')
        })

        it('should have correct ranges for Free tier flow', () => {
            const store = useWorkbenchV2Store.getState()

            // JOB_VISION_PENDING: 0-10%
            store.setStatus('JOB_VISION_PENDING')
            expect(useWorkbenchV2Store.getState().progress.baseProgress).toBe(0)
            expect(useWorkbenchV2Store.getState().progress.targetProgress).toBe(10)

            // JOB_VISION_STREAMING: 10-40%
            store.setStatus('JOB_VISION_STREAMING')
            expect(useWorkbenchV2Store.getState().progress.baseProgress).toBe(10)
            expect(useWorkbenchV2Store.getState().progress.targetProgress).toBe(40)

            // MATCH_PENDING: 40-50%
            store.setStatus('MATCH_PENDING')
            expect(useWorkbenchV2Store.getState().progress.baseProgress).toBe(40)
            expect(useWorkbenchV2Store.getState().progress.targetProgress).toBe(50)

            // MATCH_STREAMING: 50-99%
            store.setStatus('MATCH_STREAMING')
            expect(useWorkbenchV2Store.getState().progress.baseProgress).toBe(50)
            expect(useWorkbenchV2Store.getState().progress.targetProgress).toBe(99)
        })
    })

    describe('Paid tier progress ranges', () => {
        beforeEach(() => {
            useWorkbenchV2Store.getState().initialize('test', 'paid')
        })

        it('should have correct ranges for Paid tier flow', () => {
            const store = useWorkbenchV2Store.getState()

            // OCR_PENDING: 0-10%
            store.setStatus('OCR_PENDING')
            expect(useWorkbenchV2Store.getState().progress.baseProgress).toBe(0)
            expect(useWorkbenchV2Store.getState().progress.targetProgress).toBe(10)

            // SUMMARY_PENDING: 10-35%
            store.setStatus('SUMMARY_PENDING')
            expect(useWorkbenchV2Store.getState().progress.baseProgress).toBe(10)
            expect(useWorkbenchV2Store.getState().progress.targetProgress).toBe(35)

            // PREMATCH_PENDING: 35-60%
            store.setStatus('PREMATCH_PENDING')
            expect(useWorkbenchV2Store.getState().progress.baseProgress).toBe(35)
            expect(useWorkbenchV2Store.getState().progress.targetProgress).toBe(60)

            // MATCH_STREAMING: 70-99%
            store.setStatus('MATCH_STREAMING')
            expect(useWorkbenchV2Store.getState().progress.baseProgress).toBe(70)
            expect(useWorkbenchV2Store.getState().progress.targetProgress).toBe(99)
        })
    })
})
