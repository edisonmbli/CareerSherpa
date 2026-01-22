/**
 * Unit Tests for SSE Event Processor
 *
 * Tests the event parsing, status mapping, and helper functions
 */

import { describe, it, expect } from 'vitest'
import {
    processSseEvent,
    getTokenTarget,
    shouldSwitchTask,
    getTaskPrefix,
} from '@/lib/ui/sse-event-processor'

describe('sse-event-processor', () => {
    describe('processSseEvent', () => {
        describe('status events', () => {
            it('should map JOB_VISION_PENDING status', () => {
                const result = processSseEvent({
                    type: 'status',
                    status: 'JOB_VISION_PENDING',
                })

                expect(result?.newStatus).toBe('JOB_VISION_PENDING')
            })

            it('should map job_vision_queued code', () => {
                const result = processSseEvent({
                    type: 'status',
                    code: 'job_vision_queued',
                })

                expect(result?.newStatus).toBe('JOB_VISION_PENDING')
                expect(result?.statusDetail).toBe('job_vision_queued')
            })

            it('should extract error message from failureCode', () => {
                const result = processSseEvent({
                    type: 'status',
                    status: 'JOB_VISION_FAILED',
                    failureCode: 'rate_limited',
                })

                expect(result?.newStatus).toBe('JOB_VISION_FAILED')
                expect(result?.errorMessage).toBe('rate_limited')
            })

            it('should prefer errorMessage over failureCode', () => {
                const result = processSseEvent({
                    type: 'status',
                    status: 'MATCH_FAILED',
                    failureCode: 'code',
                    errorMessage: 'Detailed error',
                })

                expect(result?.errorMessage).toBe('Detailed error')
            })

            it('should extract next taskId', () => {
                const result = processSseEvent({
                    type: 'status',
                    status: 'SUMMARY_COMPLETED',
                    taskId: 'match_123_456',
                })

                expect(result?.nextTaskId).toBe('match_123_456')
            })

            it('should map COMPLETED to MATCH_COMPLETED', () => {
                const result = processSseEvent({
                    type: 'status',
                    status: 'COMPLETED',
                })

                expect(result?.newStatus).toBe('MATCH_COMPLETED')
            })
        })

        describe('token events', () => {
            it('should extract token text', () => {
                const result = processSseEvent({
                    type: 'token',
                    text: 'Hello world',
                })

                expect(result?.tokenChunk).toBe('Hello world')
            })

            it('should extract token_batch text', () => {
                const result = processSseEvent({
                    type: 'token_batch',
                    text: 'Batch content',
                })

                expect(result?.tokenChunk).toBe('Batch content')
            })

            it('should fallback to data field in token_batch', () => {
                const result = processSseEvent({
                    type: 'token_batch',
                    data: 'Data content',
                })

                expect(result?.tokenChunk).toBe('Data content')
            })

            it('should return null for empty token', () => {
                const result = processSseEvent({
                    type: 'token',
                    text: '',
                })

                expect(result).toBeNull()
            })
        })

        describe('lifecycle events', () => {
            it('should recognize start event', () => {
                const result = processSseEvent({ type: 'start' })
                expect(result?.streamStarted).toBe(true)
            })

            it('should recognize done event', () => {
                const result = processSseEvent({ type: 'done' })
                expect(result?.streamCompleted).toBe(true)
            })
        })

        describe('error events', () => {
            it('should extract error message', () => {
                const result = processSseEvent({
                    type: 'error',
                    message: 'Stream error',
                })

                expect(result?.errorMessage).toBe('Stream error')
            })

            it('should fallback to error field', () => {
                const result = processSseEvent({
                    type: 'error',
                    error: 'Connection lost',
                })

                expect(result?.errorMessage).toBe('Connection lost')
            })
        })

        describe('result events', () => {
            it('should extract OCR text', () => {
                const result = processSseEvent({
                    type: 'ocr_result',
                    text: 'Extracted text',
                })

                expect(result?.ocrText).toBe('Extracted text')
            })

            it('should extract summary result', () => {
                const json = { company: 'Test', title: 'Engineer' }
                const result = processSseEvent({
                    type: 'summary_result',
                    json,
                })

                expect(result?.visionResult).toEqual(json)
            })

            it('should extract match result', () => {
                const json = { score: 85, assessment: 'Good' }
                const result = processSseEvent({
                    type: 'match_result',
                    json,
                })

                expect(result?.matchResult).toEqual(json)
            })
        })

        describe('info events', () => {
            it('should extract status detail from code', () => {
                const result = processSseEvent({
                    type: 'info',
                    code: 'queue_position_3',
                })

                expect(result?.statusDetail).toBe('queue_position_3')
            })
        })

        describe('invalid events', () => {
            it('should return null for invalid schema', () => {
                const result = processSseEvent({ invalid: 'event' })
                expect(result).toBeNull()
            })

            it('should return null for unknown type', () => {
                const result = processSseEvent({ type: 'unknown' })
                expect(result).toBeNull()
            })
        })
    })

    describe('getTokenTarget', () => {
        it('should return vision for JOB_VISION states', () => {
            expect(getTokenTarget('JOB_VISION_PENDING')).toBe('vision')
            expect(getTokenTarget('JOB_VISION_STREAMING')).toBe('vision')
        })

        it('should return vision for SUMMARY_PENDING', () => {
            expect(getTokenTarget('SUMMARY_PENDING')).toBe('vision')
        })

        it('should return match for MATCH states', () => {
            expect(getTokenTarget('MATCH_PENDING')).toBe('match')
            expect(getTokenTarget('MATCH_STREAMING')).toBe('match')
        })

        it('should return null for completed states', () => {
            expect(getTokenTarget('MATCH_COMPLETED')).toBeNull()
            expect(getTokenTarget('JOB_VISION_COMPLETED')).toBeNull()
        })

        it('should return null for failed states', () => {
            expect(getTokenTarget('MATCH_FAILED')).toBeNull()
        })
    })

    describe('shouldSwitchTask', () => {
        it('should switch from JOB_VISION_COMPLETED to MATCH_PENDING', () => {
            expect(shouldSwitchTask('JOB_VISION_COMPLETED', 'MATCH_PENDING')).toBe(true)
        })

        it('should switch from SUMMARY_COMPLETED to MATCH_STREAMING', () => {
            expect(shouldSwitchTask('SUMMARY_COMPLETED', 'MATCH_STREAMING')).toBe(true)
        })

        it('should not switch within same phase', () => {
            expect(shouldSwitchTask('JOB_VISION_PENDING', 'JOB_VISION_STREAMING')).toBe(false)
        })

        it('should not switch backwards', () => {
            expect(shouldSwitchTask('MATCH_STREAMING', 'JOB_VISION_PENDING')).toBe(false)
        })
    })

    describe('getTaskPrefix', () => {
        it('should return job for early stages', () => {
            expect(getTaskPrefix('JOB_VISION_PENDING')).toBe('job')
            expect(getTaskPrefix('JOB_VISION_STREAMING')).toBe('job')
            expect(getTaskPrefix('OCR_PENDING')).toBe('job')
            expect(getTaskPrefix('SUMMARY_PENDING')).toBe('job')
        })

        it('should return match for match stages', () => {
            expect(getTaskPrefix('MATCH_PENDING')).toBe('match')
            expect(getTaskPrefix('MATCH_STREAMING')).toBe('match')
            expect(getTaskPrefix('MATCH_COMPLETED')).toBe('match')
        })

        it('should return customize for customize stages', () => {
            expect(getTaskPrefix('CUSTOMIZE_PENDING')).toBe('customize')
            expect(getTaskPrefix('CUSTOMIZE_COMPLETED')).toBe('customize')
        })

        it('should return interview for interview stages', () => {
            expect(getTaskPrefix('INTERVIEW_PENDING')).toBe('interview')
            expect(getTaskPrefix('INTERVIEW_COMPLETED')).toBe('interview')
        })
    })
})
