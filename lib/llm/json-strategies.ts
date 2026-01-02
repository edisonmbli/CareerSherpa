/**
 * JSON Parsing Strategies
 *
 * This module provides individual parsing strategy functions for LLM JSON responses.
 * Each strategy represents a different approach to parsing potentially malformed JSON.
 *
 * Strategies are ordered from simplest to most aggressive:
 * 1. Direct - Parse as-is
 * 2. Clean - Remove markdown, normalize quotes
 * 3. Extract - Find JSON within mixed content
 * 4. Repair - Fix common syntax errors
 */

import type { ValidationOptions, ValidationResult } from './json-validator'

// Re-export helpers for use by strategies
export { cleanJsonText, extractJsonFromText, fixJsonSyntax } from './json-validator'

/**
 * Strategy result type
 */
export interface StrategyResult<T = unknown> {
    success: boolean
    data?: T
    error?: string
}

/**
 * Logging helper - structured info log
 */
function logStrategyInfo(payload: Record<string, unknown>) {
    try {
        const entry = { level: 'info', ts: new Date().toISOString(), ...payload }
        console.log(JSON.stringify(entry))
    } catch {
        // non-fatal: logging should not break parsing
    }
}

/**
 * Strategy 1: Direct parsing
 *
 * Attempts to parse content directly without any preprocessing.
 * Best for well-formed JSON responses.
 *
 * @param content - Raw content to parse
 * @param options - Validation options for debug logging
 * @returns Strategy result with parsed data or error
 */
export function parseDirectStrategy<T = unknown>(
    content: string,
    options?: ValidationOptions
): StrategyResult<T> {
    const { debug } = options || {}

    try {
        const parsed = JSON.parse(content)

        if (debug) {
            logStrategyInfo({
                reqId: debug.reqId ?? 'unknown',
                route: debug.route ?? 'json-strategies',
                phase: 'direct_parse_success',
                dataType: typeof parsed,
                isArray: Array.isArray(parsed),
            })
        }

        return { success: true, data: parsed }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)

        if (debug) {
            logStrategyInfo({
                reqId: debug.reqId ?? 'unknown',
                route: debug.route ?? 'json-strategies',
                phase: 'direct_parse_failed',
                error: errorMessage,
                errorPosition: errorMessage.match(/position (\d+)/)?.[1],
            })
        }

        return { success: false, error: errorMessage }
    }
}

/**
 * Strategy 2: Clean and parse
 *
 * Cleans the content by removing markdown code fences, normalizing quotes,
 * escaping control characters, and then parses.
 *
 * @param content - Raw content to parse
 * @param cleanFn - Cleaning function to apply
 * @param options - Validation options for debug logging
 * @returns Strategy result with parsed data or error
 */
export function parseCleanedStrategy<T = unknown>(
    content: string,
    cleanFn: (text: string) => string,
    options?: ValidationOptions
): StrategyResult<T> {
    const { debug } = options || {}

    try {
        const cleaned = cleanFn(content)

        if (debug) {
            logStrategyInfo({
                reqId: debug.reqId ?? 'unknown',
                route: debug.route ?? 'json-strategies',
                phase: 'cleaned_parse_attempt',
                originalLength: content.length,
                cleanedLength: cleaned.length,
            })
        }

        const parsed = JSON.parse(cleaned)

        if (debug) {
            logStrategyInfo({
                reqId: debug.reqId ?? 'unknown',
                route: debug.route ?? 'json-strategies',
                phase: 'cleaned_parse_success',
                cleanedLength: cleaned.length,
            })
        }

        return { success: true, data: parsed }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)

        if (debug) {
            logStrategyInfo({
                reqId: debug.reqId ?? 'unknown',
                route: debug.route ?? 'json-strategies',
                phase: 'cleaned_parse_failed',
                error: errorMessage,
            })
        }

        return { success: false, error: errorMessage }
    }
}

/**
 * Strategy 3: Extract and parse
 *
 * Extracts JSON from mixed content using bracket matching,
 * then parses the extracted portion.
 *
 * @param content - Raw content to parse
 * @param cleanFn - Cleaning function to apply first
 * @param extractFn - Extraction function to find JSON
 * @param options - Validation options for debug logging
 * @returns Strategy result with parsed data or error
 */
export function parseExtractedStrategy<T = unknown>(
    content: string,
    cleanFn: (text: string) => string,
    extractFn: (text: string) => string,
    options?: ValidationOptions
): StrategyResult<T> {
    const { debug } = options || {}

    try {
        const cleaned = cleanFn(content)
        const extracted = extractFn(cleaned)

        if (debug) {
            logStrategyInfo({
                reqId: debug.reqId ?? 'unknown',
                route: debug.route ?? 'json-strategies',
                phase: 'extracted_parse_attempt',
                extractedLength: extracted?.length ?? 0,
                hasExtracted: !!extracted,
            })
        }

        if (!extracted) {
            return { success: false, error: 'No JSON content found' }
        }

        const parsed = JSON.parse(extracted)

        if (debug) {
            logStrategyInfo({
                reqId: debug.reqId ?? 'unknown',
                route: debug.route ?? 'json-strategies',
                phase: 'extracted_parse_success',
                extractedLength: extracted.length,
            })
        }

        return { success: true, data: parsed }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)

        if (debug) {
            logStrategyInfo({
                reqId: debug.reqId ?? 'unknown',
                route: debug.route ?? 'json-strategies',
                phase: 'extracted_parse_failed',
                error: errorMessage,
            })
        }

        return { success: false, error: errorMessage }
    }
}

/**
 * Strategy 4: Repair and parse
 *
 * Applies aggressive syntax repair to fix common LLM JSON errors,
 * then parses the repaired content.
 *
 * @param content - Raw content to parse
 * @param cleanFn - Cleaning function to apply
 * @param extractFn - Extraction function to find JSON
 * @param repairFn - Syntax repair function
 * @param options - Validation options for debug logging
 * @returns Strategy result with parsed data or error
 */
export function parseRepairedStrategy<T = unknown>(
    content: string,
    cleanFn: (text: string) => string,
    extractFn: (text: string) => string,
    repairFn: (text: string) => string,
    options?: ValidationOptions
): StrategyResult<T> {
    const { debug } = options || {}

    try {
        const cleaned = cleanFn(content)
        const extracted = extractFn(cleaned) || cleaned
        const repaired = repairFn(extracted)

        if (debug) {
            logStrategyInfo({
                reqId: debug.reqId ?? 'unknown',
                route: debug.route ?? 'json-strategies',
                phase: 'repaired_parse_attempt',
                originalLength: content.length,
                cleanedLength: cleaned.length,
                extractedLength: extracted.length,
                repairedLength: repaired.length,
            })
        }

        const parsed = JSON.parse(repaired)

        if (debug) {
            logStrategyInfo({
                reqId: debug.reqId ?? 'unknown',
                route: debug.route ?? 'json-strategies',
                phase: 'repaired_parse_success',
                repairedLength: repaired.length,
            })
        }

        return { success: true, data: parsed }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)

        if (debug) {
            logStrategyInfo({
                reqId: debug.reqId ?? 'unknown',
                route: debug.route ?? 'json-strategies',
                phase: 'repaired_parse_failed',
                error: errorMessage,
            })
        }

        return { success: false, error: errorMessage }
    }
}

/**
 * Execute all strategies in order until one succeeds
 *
 * @param content - Raw content to parse
 * @param cleanFn - Cleaning function
 * @param extractFn - Extraction function
 * @param repairFn - Repair function
 * @param options - Validation options
 * @returns Final validation result
 */
export function executeStrategies<T = unknown>(
    content: string,
    cleanFn: (text: string) => string,
    extractFn: (text: string) => string,
    repairFn: (text: string) => string,
    options: ValidationOptions = {}
): ValidationResult<T> {
    const { enableFallback = true, maxAttempts = 4, strictMode = false } = options
    const warnings: string[] = []
    let parseAttempts = 0

    // Skip direct parse if markdown detected
    const hasMarkdown = content.includes('```')

    // Strategy 1: Direct parsing
    if (!hasMarkdown && parseAttempts < maxAttempts) {
        parseAttempts++
        const result = parseDirectStrategy<T>(content, options)
        if (result.success && result.data !== undefined) {
            return {
                success: true,
                data: result.data as T,
                parseAttempts,
                ...(warnings.length > 0 && { warnings }),
            }
        }
        if (strictMode) {
            return { success: false, error: `Strict mode: ${result.error}`, parseAttempts }
        }
        warnings.push(`Direct parse failed: ${result.error}`)
    }

    // Strategy 2: Clean and parse
    if (parseAttempts < maxAttempts) {
        parseAttempts++
        const result = parseCleanedStrategy<T>(content, cleanFn, options)
        if (result.success && result.data !== undefined) {
            return {
                success: true,
                data: result.data as T,
                parseAttempts,
                ...(warnings.length > 0 && { warnings }),
            }
        }
        warnings.push(`Cleaned parse failed: ${result.error}`)
    }

    // Strategy 3: Extract and parse
    if (parseAttempts < maxAttempts) {
        parseAttempts++
        const result = parseExtractedStrategy<T>(content, cleanFn, extractFn, options)
        if (result.success && result.data !== undefined) {
            return {
                success: true,
                data: result.data as T,
                parseAttempts,
                ...(warnings.length > 0 && { warnings }),
            }
        }
        warnings.push(`Extracted parse failed: ${result.error}`)
    }

    // Strategy 4: Repair and parse
    if (parseAttempts < maxAttempts && enableFallback) {
        parseAttempts++
        const result = parseRepairedStrategy<T>(content, cleanFn, extractFn, repairFn, options)
        if (result.success && result.data !== undefined) {
            return {
                success: true,
                data: result.data as T,
                fallbackUsed: true,
                parseAttempts,
                ...(warnings.length > 0 && { warnings }),
            }
        }
        warnings.push(`Repaired parse failed: ${result.error}`)
    }

    // All strategies failed
    return {
        success: false,
        error: `All parsing strategies failed after ${parseAttempts} attempts`,
        warnings,
        parseAttempts,
    }
}
