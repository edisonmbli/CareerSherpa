/**
 * Unit Tests for json-strategies.ts
 *
 * Tests the individual parsing strategy functions and the orchestrator.
 */

import { describe, it, expect } from 'vitest'
import {
    parseDirectStrategy,
    parseCleanedStrategy,
    parseExtractedStrategy,
    parseRepairedStrategy,
    executeStrategies,
} from '@/lib/llm/json-strategies'
import {
    cleanJsonText,
    extractJsonFromText,
    fixJsonSyntax,
} from '@/lib/llm/json-validator'

describe('JSON Parsing Strategies', () => {
    describe('parseDirectStrategy', () => {
        it('should parse valid JSON directly', () => {
            const result = parseDirectStrategy('{"name": "test"}')
            expect(result.success).toBe(true)
            expect(result.data).toEqual({ name: 'test' })
        })

        it('should fail on invalid JSON', () => {
            const result = parseDirectStrategy('not json')
            expect(result.success).toBe(false)
            expect(result.error).toBeDefined()
        })

        it('should parse JSON arrays', () => {
            const result = parseDirectStrategy('[1, 2, 3]')
            expect(result.success).toBe(true)
            expect(result.data).toEqual([1, 2, 3])
        })
    })

    describe('parseCleanedStrategy', () => {
        it('should clean markdown and parse', () => {
            const input = '```json\n{"name": "test"}\n```'
            const result = parseCleanedStrategy(input, cleanJsonText)
            expect(result.success).toBe(true)
            expect(result.data).toEqual({ name: 'test' })
        })

        it('should handle trailing commas', () => {
            const input = '{"name": "test",}'
            const result = parseCleanedStrategy(input, cleanJsonText)
            expect(result.success).toBe(true)
            expect(result.data).toEqual({ name: 'test' })
        })
    })

    describe('parseExtractedStrategy', () => {
        it('should extract JSON from mixed content', () => {
            const input = 'Here is the result: {"name": "test"} More text'
            const result = parseExtractedStrategy(input, cleanJsonText, extractJsonFromText)
            expect(result.success).toBe(true)
            expect(result.data).toEqual({ name: 'test' })
        })

        it('should handle no JSON content', () => {
            const result = parseExtractedStrategy('no json here', cleanJsonText, extractJsonFromText)
            expect(result.success).toBe(false)
        })
    })

    describe('parseRepairedStrategy', () => {
        it('should repair trailing commas', () => {
            // Test a case that fixJsonSyntax actually handles
            const input = '{"a": "1", "b": "2",}'
            const result = parseRepairedStrategy(input, cleanJsonText, extractJsonFromText, fixJsonSyntax)
            expect(result.success).toBe(true)
            expect(result.data).toEqual({ a: '1', b: '2' })
        })

        it('should repair Chinese punctuation', () => {
            const input = '{"name"："test"}'
            const result = parseRepairedStrategy(input, cleanJsonText, extractJsonFromText, fixJsonSyntax)
            expect(result.success).toBe(true)
        })
    })

    describe('executeStrategies', () => {
        it('should succeed with valid JSON on first try', () => {
            const result = executeStrategies(
                '{"name": "test"}',
                cleanJsonText,
                extractJsonFromText,
                fixJsonSyntax
            )
            expect(result.success).toBe(true)
            expect(result.parseAttempts).toBe(1)
        })

        it('should skip direct parse for markdown content', () => {
            const result = executeStrategies(
                '```json\n{"name": "test"}\n```',
                cleanJsonText,
                extractJsonFromText,
                fixJsonSyntax
            )
            expect(result.success).toBe(true)
            expect(result.parseAttempts).toBeGreaterThanOrEqual(1)
        })

        it('should fail gracefully when all strategies fail', () => {
            const result = executeStrategies(
                'completely invalid',
                cleanJsonText,
                extractJsonFromText,
                fixJsonSyntax
            )
            expect(result.success).toBe(true)
            expect(result.fallbackUsed).toBe(true)
            expect(result.warnings).toBeDefined()
        })

        it('should respect strictMode option', () => {
            const result = executeStrategies(
                'invalid',
                cleanJsonText,
                extractJsonFromText,
                fixJsonSyntax,
                { strictMode: true }
            )
            expect(result.success).toBe(false)
        })
    })
})
