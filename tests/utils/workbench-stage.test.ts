/**
 * Unit Tests for workbench-stage.ts
 *
 * Tests the deriveStage function and its helper functions
 * to ensure correct step calculation, CTA derivation, and status messages.
 */

import { describe, it, expect } from 'vitest'
import { deriveStage, type WorkbenchDict } from '@/lib/utils/workbench-stage'

// Mock dictionary for tests
const mockDict: WorkbenchDict = {
    workbench: {
        statusText: {
            retryMatch: 'Retry Match',
            failed: 'Failed',
            idle: 'Ready',
        },
        statusConsole: {
            customizing: 'Customizing...',
            customizeFailed: 'Customization Failed',
            customizeCompleted: 'Customization Completed',
            matchPending: 'Analyzing match degree...',
            matchCompleted: 'Match Analysis Completed',
            matchFailed: 'Match Analysis Failed',
        },
        customize: {
            start: 'Start Customization',
        },
        interviewUi: {
            start: 'Generate Interview Tips',
        },
    },
}

describe('deriveStage', () => {
    describe('Step Calculation', () => {
        it('should return step 1 when on match tab', () => {
            const result = deriveStage(
                'MATCH_PENDING',
                'IDLE',
                'IDLE',
                mockDict,
                false,
                'match',
                null,
                null
            )
            expect(result.currentStep).toBe(1)
        })

        it('should return step 2 when on customize tab', () => {
            const result = deriveStage(
                'MATCH_COMPLETED',
                'PENDING',
                'IDLE',
                mockDict,
                false,
                'customize',
                null,
                null
            )
            expect(result.currentStep).toBe(2)
        })

        it('should return step 3 when on interview tab', () => {
            const result = deriveStage(
                'MATCH_COMPLETED',
                'COMPLETED',
                'PENDING',
                mockDict,
                false,
                'interview',
                null,
                null
            )
            expect(result.currentStep).toBe(3)
        })
    })

    describe('Max Unlocked Step', () => {
        it('should unlock only step 1 when match is pending', () => {
            const result = deriveStage(
                'MATCH_PENDING',
                'IDLE',
                'IDLE',
                mockDict,
                false,
                'match',
                null,
                null
            )
            expect(result.maxUnlockedStep).toBe(1)
        })

        it('should unlock step 2 when customize is started', () => {
            // Note: Match completion alone does NOT unlock step 2
            // Users must click the CTA button to start customization
            const result = deriveStage(
                'MATCH_COMPLETED',
                'PENDING',  // Customize is in progress
                'IDLE',
                mockDict,
                false,
                'customize',
                null,
                null
            )
            expect(result.maxUnlockedStep).toBe(2)
        })

        it('should unlock step 3 when interview is pending', () => {
            const result = deriveStage(
                'MATCH_COMPLETED',
                'COMPLETED',
                'PENDING',
                mockDict,
                false,
                'interview',
                null,
                null
            )
            expect(result.maxUnlockedStep).toBe(3)
        })
    })

    describe('CTA Calculation', () => {
        it('should show retry CTA when match failed', () => {
            const result = deriveStage(
                'MATCH_FAILED',
                'IDLE',
                'IDLE',
                mockDict,
                false,
                'match',
                null,
                null
            )
            expect(result.cta).toEqual({
                show: true,
                label: 'Retry Match',
                action: 'retry_match',
                disabled: false,
            })
        })

        it('should show customize CTA when match completed', () => {
            const result = deriveStage(
                'MATCH_COMPLETED',
                'IDLE',
                'IDLE',
                mockDict,
                false,
                'match',
                null,
                null
            )
            expect(result.cta).toEqual({
                show: true,
                label: 'Start Customization',
                action: 'customize',
                disabled: false,
            })
        })

        it('should show interview CTA when customize completed', () => {
            const result = deriveStage(
                'MATCH_COMPLETED',
                'COMPLETED',
                'IDLE',
                mockDict,
                false,
                'customize',
                null,
                null
            )
            expect(result.cta).toEqual({
                show: true,
                label: 'Generate Interview Tips',
                action: 'interview',
                disabled: false,
            })
        })

        it('should disable CTA when isPending is true', () => {
            const result = deriveStage(
                'MATCH_COMPLETED',
                'IDLE',
                'IDLE',
                mockDict,
                true, // isPending
                'match',
                null,
                null
            )
            expect(result.cta?.disabled).toBe(true)
        })

        it('should return null CTA when interview completed', () => {
            const result = deriveStage(
                'MATCH_COMPLETED',
                'COMPLETED',
                'COMPLETED',
                mockDict,
                false,
                'interview',
                null,
                null
            )
            expect(result.cta).toBeNull()
        })
    })

    describe('Status Message', () => {
        it('should return match pending message', () => {
            const result = deriveStage(
                'MATCH_PENDING',
                'IDLE',
                'IDLE',
                mockDict,
                false,
                'match',
                null,
                null
            )
            expect(result.statusMessage).toBe('Analyzing match degree...')
        })

        it('should return match completed message', () => {
            const result = deriveStage(
                'MATCH_COMPLETED',
                'IDLE',
                'IDLE',
                mockDict,
                false,
                'match',
                null,
                null
            )
            expect(result.statusMessage).toBe('Match Analysis Completed')
        })

        it('should return customizing message on customize tab', () => {
            const result = deriveStage(
                'MATCH_COMPLETED',
                'PENDING',
                'IDLE',
                mockDict,
                false,
                'customize',
                null,
                null
            )
            expect(result.statusMessage).toBe('Customizing...')
        })
    })

    describe('Progress Value', () => {
        it('should use simulatedProgress for match pending (M9 dynamic stage)', () => {
            // Without simulatedProgress, should return fallback prog value
            const resultNoSim = deriveStage(
                'MATCH_PENDING',
                'IDLE',
                'IDLE',
                mockDict,
                false,
                'match',
                null,
                null
            )
            // Fallback progress (since useDynamic=true but simulatedProgress=0)
            expect(resultNoSim.progressValue).toBe(40)

            // With simulatedProgress, should use the simulated value
            const resultWithSim = deriveStage(
                'MATCH_PENDING',
                'IDLE',
                'IDLE',
                mockDict,
                false,
                'match',
                null,
                null,
                55  // simulatedProgress
            )
            expect(resultWithSim.progressValue).toBe(55)
        })

        it('should return 100% for match completed', () => {
            const result = deriveStage(
                'MATCH_COMPLETED',
                'IDLE',
                'IDLE',
                mockDict,
                false,
                'match',
                null,
                null
            )
            expect(result.progressValue).toBe(100)
        })

        it('should use simulatedProgress for customize pending', () => {
            // Without simulatedProgress, starts at MIN_PROGRESS (10%)
            const resultNoSim = deriveStage(
                'MATCH_COMPLETED',
                'PENDING',
                'IDLE',
                mockDict,
                false,
                'customize',
                null,
                null
            )
            expect(resultNoSim.progressValue).toBe(10)  // MIN_PROGRESS fallback

            // With simulatedProgress, should use the simulated value
            const resultWithSim = deriveStage(
                'MATCH_COMPLETED',
                'PENDING',
                'IDLE',
                mockDict,
                false,
                'customize',
                null,
                null,
                50  // simulatedProgress
            )
            expect(resultWithSim.progressValue).toBe(50)
        })
    })
})
