/**
 * Unit Tests for task-context utilities
 */

import { describe, it, expect } from 'vitest'
import {
    buildTaskId,
    parseTaskId,
    isTaskType,
    getTaskTypeFromId,
    type TaskType,
} from '@/lib/types/task-context'

describe('task-context', () => {
    describe('buildTaskId', () => {
        it('should build taskId for match type', () => {
            const taskId = buildTaskId('match', 'svc123', 'sess456')
            expect(taskId).toBe('match_svc123_sess456')
        })

        it('should build taskId for customize type', () => {
            const taskId = buildTaskId('customize', 'svc-abc', 'session-xyz')
            expect(taskId).toBe('customize_svc-abc_session-xyz')
        })

        it('should build taskId for interview type', () => {
            const taskId = buildTaskId('interview', 'svc007', 'uuid-123')
            expect(taskId).toBe('interview_svc007_uuid-123')
        })
    })

    describe('parseTaskId', () => {
        it('should parse valid match taskId', () => {
            const ctx = parseTaskId('match_svc123_sess456')
            expect(ctx).toEqual({
                taskType: 'match',
                serviceId: 'svc123',
                sessionId: 'sess456',
                taskId: 'match_svc123_sess456',
            })
        })

        it('should parse valid customize taskId', () => {
            const ctx = parseTaskId('customize_svc-abc_session-xyz')
            expect(ctx).toEqual({
                taskType: 'customize',
                serviceId: 'svc-abc',
                sessionId: 'session-xyz',
                taskId: 'customize_svc-abc_session-xyz',
            })
        })

        it('should parse valid interview taskId', () => {
            const ctx = parseTaskId('interview_svc007_uuid-123')
            expect(ctx).toEqual({
                taskType: 'interview',
                serviceId: 'svc007',
                sessionId: 'uuid-123',
                taskId: 'interview_svc007_uuid-123',
            })
        })

        it('should handle legacy job_ prefix as match', () => {
            const ctx = parseTaskId('job_svc123_sess456')
            expect(ctx?.taskType).toBe('match')
        })

        it('should handle legacy format without sessionId', () => {
            const ctx = parseTaskId('match_svc123')
            expect(ctx).toEqual({
                taskType: 'match',
                serviceId: 'svc123',
                sessionId: '',
                taskId: 'match_svc123',
            })
        })

        it('should handle sessionId with underscores', () => {
            const ctx = parseTaskId('customize_svc123_uuid_with_underscores')
            expect(ctx).toEqual({
                taskType: 'customize',
                serviceId: 'svc123',
                sessionId: 'uuid_with_underscores',
                taskId: 'customize_svc123_uuid_with_underscores',
            })
        })

        it('should return null for empty string', () => {
            expect(parseTaskId('')).toBeNull()
        })

        it('should return null for invalid prefix', () => {
            expect(parseTaskId('unknown_svc123_sess456')).toBeNull()
        })

        it('should return null for string without underscore', () => {
            expect(parseTaskId('invalidformat')).toBeNull()
        })
    })

    describe('isTaskType', () => {
        it('should return true for matching type', () => {
            expect(isTaskType('customize_svc_sess', 'customize')).toBe(true)
            expect(isTaskType('match_svc_sess', 'match')).toBe(true)
            expect(isTaskType('interview_svc_sess', 'interview')).toBe(true)
        })

        it('should return false for non-matching type', () => {
            expect(isTaskType('customize_svc_sess', 'match')).toBe(false)
            expect(isTaskType('match_svc_sess', 'interview')).toBe(false)
        })
    })

    describe('getTaskTypeFromId', () => {
        it('should extract task type', () => {
            expect(getTaskTypeFromId('customize_svc_sess')).toBe('customize')
            expect(getTaskTypeFromId('match_svc_sess')).toBe('match')
            expect(getTaskTypeFromId('interview_svc_sess')).toBe('interview')
        })

        it('should return null for invalid taskId', () => {
            expect(getTaskTypeFromId('')).toBeNull()
            expect(getTaskTypeFromId('invalid')).toBeNull()
        })
    })
})
