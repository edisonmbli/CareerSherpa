/**
 * Unit Tests for useServiceStatus hook
 *
 * Tests the status mapping and helper functions.
 */

import { describe, it, expect } from 'vitest'
import {
    mapServerStatus,
    isTerminalStatus,
    isFailureStatus,
} from '@/lib/hooks/useServiceStatus'

describe('useServiceStatus', () => {
    describe('mapServerStatus', () => {
        it('should return IDLE for undefined status', () => {
            expect(mapServerStatus(undefined)).toBe('IDLE')
        })

        it('should return IDLE for empty string', () => {
            expect(mapServerStatus('')).toBe('IDLE')
        })

        it('should map OCR_PENDING correctly', () => {
            expect(mapServerStatus('OCR_PENDING')).toBe('OCR_PENDING')
            expect(mapServerStatus('ocr_pending')).toBe('OCR_PENDING')
        })

        it('should map MATCH_COMPLETED correctly', () => {
            expect(mapServerStatus('MATCH_COMPLETED')).toBe('MATCH_COMPLETED')
        })

        it('should map all valid statuses', () => {
            const validStatuses = [
                'OCR_PENDING',
                'OCR_COMPLETED',
                'OCR_FAILED',
                'SUMMARY_PENDING',
                'SUMMARY_COMPLETED',
                'SUMMARY_FAILED',
                'MATCH_PENDING',
                'MATCH_STREAMING',
                'MATCH_COMPLETED',
                'MATCH_FAILED',
                'CUSTOMIZE_PENDING',
                'CUSTOMIZE_COMPLETED',
                'CUSTOMIZE_FAILED',
                'INTERVIEW_PENDING',
                'INTERVIEW_COMPLETED',
                'INTERVIEW_FAILED',
            ]

            validStatuses.forEach((status) => {
                expect(mapServerStatus(status)).toBe(status)
            })
        })

        it('should return IDLE for unknown status', () => {
            expect(mapServerStatus('UNKNOWN_STATUS')).toBe('IDLE')
        })
    })

    describe('isTerminalStatus', () => {
        it('should return true for COMPLETED statuses', () => {
            expect(isTerminalStatus('MATCH_COMPLETED')).toBe(true)
            expect(isTerminalStatus('CUSTOMIZE_COMPLETED')).toBe(true)
            expect(isTerminalStatus('INTERVIEW_COMPLETED')).toBe(true)
            expect(isTerminalStatus('COMPLETED')).toBe(true)
        })

        it('should return true for FAILED statuses', () => {
            expect(isTerminalStatus('MATCH_FAILED')).toBe(true)
            expect(isTerminalStatus('OCR_FAILED')).toBe(true)
            expect(isTerminalStatus('FAILED')).toBe(true)
        })

        it('should return false for PENDING statuses', () => {
            expect(isTerminalStatus('OCR_PENDING')).toBe(false)
            expect(isTerminalStatus('MATCH_PENDING')).toBe(false)
            expect(isTerminalStatus('IDLE')).toBe(false)
        })
    })

    describe('isFailureStatus', () => {
        it('should return true for failure statuses', () => {
            expect(isFailureStatus('MATCH_FAILED')).toBe(true)
            expect(isFailureStatus('SUMMARY_FAILED')).toBe(true)
            expect(isFailureStatus('OCR_FAILED')).toBe(true)
            expect(isFailureStatus('CUSTOMIZE_FAILED')).toBe(true)
            expect(isFailureStatus('INTERVIEW_FAILED')).toBe(true)
        })

        it('should return false for non-failure statuses', () => {
            expect(isFailureStatus('IDLE')).toBe(false)
            expect(isFailureStatus('MATCH_COMPLETED')).toBe(false)
            expect(isFailureStatus('MATCH_PENDING')).toBe(false)
        })
    })
})
