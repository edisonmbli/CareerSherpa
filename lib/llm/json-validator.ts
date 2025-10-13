import { logInfo, logError } from '@/lib/logger'

/**
 * Unified JSON validation and error handling for LLM responses
 * This module provides robust JSON parsing with multiple fallback strategies
 */

export interface ValidationResult<T = any> {
  success: boolean
  data?: T
  error?: string
  warnings?: string[]
  fallbackUsed?: boolean
  parseAttempts?: number
}

export interface ValidationOptions {
  debug?: {
    reqId?: string
    route?: string
    userKey?: string
  }
  enableFallback?: boolean
  maxAttempts?: number
  strictMode?: boolean
}

/**
 * Clean and normalize JSON text before parsing
 */
function cleanJsonText(text: string): string {
  let cleaned = text.trim()
  
  // Remove code fences
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '')
  cleaned = cleaned.replace(/\s*```$/i, '')
  
  // Remove invisible characters
  cleaned = cleaned.replace(/^\uFEFF/, '').replace(/[\u200B-\u200D\uFEFF]/g, '')
  
  // Normalize quotes
  cleaned = cleaned.replace(/[""]/g, '"').replace(/['']/g, '"')
  
  // Replace full-width spaces
  cleaned = cleaned.replace(/\u3000/g, ' ')
  
  // Remove trailing commas
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1')
  
  return cleaned
}

/**
 * Extract JSON from mixed content using bracket matching
 */
function extractJsonFromText(text: string): string {
  let firstBrace = -1
  
  // Find first opening bracket
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '{' || ch === '[') {
      firstBrace = i
      break
    }
  }
  
  if (firstBrace < 0) return ''
  
  const openCh = text[firstBrace]
  const closeCh = openCh === '{' ? '}' : ']'
  let depth = 0
  let inStr = false
  let escaped = false
  
  for (let i = firstBrace; i < text.length; i++) {
    const c = text[i]
    
    if (escaped) {
      escaped = false
      continue
    }
    
    if (c === '\\') {
      escaped = true
      continue
    }
    
    if (c === '"') {
      inStr = !inStr
      continue
    }
    
    if (!inStr) {
      if (c === openCh) depth++
      else if (c === closeCh) depth--
      
      if (depth === 0) {
        return text.slice(firstBrace, i + 1)
      }
    }
  }
  
  return text.slice(firstBrace)
}

/**
 * Fix common JSON syntax issues
 */
function fixJsonSyntax(text: string): string {
  let fixed = text
  
  // Fix unescaped newlines in strings
  fixed = fixed.replace(/"([^"\\]*)(\n|\r)([^"]*?)"/g, (match, before, newline, after) => {
    return `"${before}\\n${after}"`
  })
  
  // Fix unescaped quotes in strings (basic heuristic)
  fixed = fixed.replace(/"([^"]*)"([^,:}\]]*)"([^"]*?)"/g, (match, before, middle, after) => {
    if (middle.includes(':') || middle.includes(',')) {
      return match // Likely not a string content issue
    }
    return `"${before}\\"${middle}\\"${after}"`
  })
  
  return fixed
}

/**
 * Validate and parse JSON with multiple strategies
 */
export function validateJson<T = any>(
  content: string,
  options: ValidationOptions = {}
): ValidationResult<T> {
  const { debug, enableFallback = true, maxAttempts = 3, strictMode = false } = options
  const warnings: string[] = []
  let parseAttempts = 0
  
  if (debug) {
    logInfo({
      reqId: debug.reqId ?? 'unknown',
      route: debug.route ?? 'json-validator',
      userKey: debug.userKey ?? 'unknown',
      phase: 'validation_start',
      contentLength: content.length,
      strictMode,
    })
  }
  
  // Strategy 1: Direct parsing
  parseAttempts++
  try {
    const parsed = JSON.parse(content)
    
    if (debug) {
      logInfo({
        reqId: debug.reqId ?? 'unknown',
        route: debug.route ?? 'json-validator',
        userKey: debug.userKey ?? 'unknown',
        phase: 'direct_parse_success',
        parseAttempts,
      })
    }
    
    return {
      success: true,
      data: parsed,
      warnings: warnings.length > 0 ? warnings : undefined,
      parseAttempts,
    }
  } catch (error) {
    if (strictMode) {
      return {
        success: false,
        error: `Strict mode: ${error instanceof Error ? error.message : 'Parse failed'}`,
        parseAttempts,
      }
    }
    
    warnings.push(`Direct parse failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
  
  // Strategy 2: Clean and parse
  if (parseAttempts < maxAttempts) {
    parseAttempts++
    try {
      const cleaned = cleanJsonText(content)
      const parsed = JSON.parse(cleaned)
      
      if (debug) {
        logInfo({
          reqId: debug.reqId ?? 'unknown',
          route: debug.route ?? 'json-validator',
          userKey: debug.userKey ?? 'unknown',
          phase: 'cleaned_parse_success',
          parseAttempts,
          cleanedLength: cleaned.length,
        })
      }
      
      return {
        success: true,
        data: parsed,
        warnings: warnings.length > 0 ? warnings : undefined,
        parseAttempts,
      }
    } catch (error) {
      warnings.push(`Cleaned parse failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  // Strategy 3: Extract and parse
  if (parseAttempts < maxAttempts) {
    parseAttempts++
    try {
      const cleaned = cleanJsonText(content)
      const extracted = extractJsonFromText(cleaned)
      
      if (extracted) {
        const parsed = JSON.parse(extracted)
        
        if (debug) {
          logInfo({
            reqId: debug.reqId ?? 'unknown',
            route: debug.route ?? 'json-validator',
            userKey: debug.userKey ?? 'unknown',
            phase: 'extracted_parse_success',
            parseAttempts,
            extractedLength: extracted.length,
          })
        }
        
        return {
          success: true,
          data: parsed,
          warnings: warnings.length > 0 ? warnings : undefined,
          parseAttempts,
        }
      }
    } catch (error) {
      warnings.push(`Extracted parse failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  // Strategy 4: Fix syntax and parse
  if (parseAttempts < maxAttempts && enableFallback) {
    parseAttempts++
    try {
      const cleaned = cleanJsonText(content)
      const extracted = extractJsonFromText(cleaned) || cleaned
      const fixed = fixJsonSyntax(extracted)
      const parsed = JSON.parse(fixed)
      
      if (debug) {
        logInfo({
          reqId: debug.reqId ?? 'unknown',
          route: debug.route ?? 'json-validator',
          userKey: debug.userKey ?? 'unknown',
          phase: 'fixed_parse_success',
          parseAttempts,
          fixedLength: fixed.length,
        })
      }
      
      return {
        success: true,
        data: parsed,
        warnings: warnings.length > 0 ? warnings : undefined,
        fallbackUsed: true,
        parseAttempts,
      }
    } catch (error) {
      warnings.push(`Fixed parse failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  // All strategies failed
  if (debug) {
    logError({
      reqId: debug.reqId ?? 'unknown',
      route: debug.route ?? 'json-validator',
      userKey: debug.userKey ?? 'unknown',
      phase: 'all_strategies_failed',
      parseAttempts,
      warnings: warnings.join('; '),
      contentSample: content.slice(0, 200),
    })
  }
  
  return {
    success: false,
    error: `All parsing strategies failed after ${parseAttempts} attempts`,
    warnings,
    parseAttempts,
  }
}

/**
 * Validate JSON against a schema structure
 */
export function validateJsonSchema<T = any>(
  data: any,
  expectedFields: Record<string, 'string' | 'string[]' | 'object' | 'object[]'>,
  options: ValidationOptions = {}
): ValidationResult<T> {
  const { debug } = options
  const warnings: string[] = []
  
  if (!data || typeof data !== 'object') {
    return {
      success: false,
      error: 'Data is not an object',
    }
  }
  
  // Fill missing fields
  const normalized = { ...data }
  
  for (const [field, type] of Object.entries(expectedFields)) {
    if (!(field in normalized)) {
      if (type === 'string[]' || type === 'object[]') {
        normalized[field] = []
      } else if (type === 'string') {
        normalized[field] = ''
      } else if (type === 'object') {
        normalized[field] = {}
      }
      warnings.push(`Missing field '${field}' filled with default value`)
    } else {
      // Type validation
      const value = normalized[field]
      if (type === 'string' && typeof value !== 'string') {
        normalized[field] = String(value || '')
        warnings.push(`Field '${field}' converted to string`)
      } else if (type === 'string[]' && !Array.isArray(value)) {
        normalized[field] = []
        warnings.push(`Field '${field}' converted to empty array`)
      } else if (type === 'object' && (typeof value !== 'object' || Array.isArray(value))) {
        normalized[field] = {}
        warnings.push(`Field '${field}' converted to empty object`)
      } else if (type === 'object[]' && !Array.isArray(value)) {
        normalized[field] = []
        warnings.push(`Field '${field}' converted to empty array`)
      }
    }
  }
  
  if (debug && warnings.length > 0) {
    logInfo({
      reqId: debug.reqId ?? 'unknown',
      route: debug.route ?? 'json-validator',
      userKey: debug.userKey ?? 'unknown',
      phase: 'schema_validation',
      warnings: warnings.join('; '),
      fieldsNormalized: Object.keys(expectedFields).length,
    })
  }
  
  return {
    success: true,
    data: normalized as T,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}

/**
 * Complete JSON validation pipeline
 */
export function validateLLMResponse<T = any>(
  content: string,
  expectedFields?: Record<string, 'string' | 'string[]' | 'object' | 'object[]'>,
  options: ValidationOptions = {}
): ValidationResult<T> {
  // Step 1: Parse JSON
  const parseResult = validateJson<T>(content, options)
  
  if (!parseResult.success) {
    return parseResult
  }
  
  // Step 2: Validate schema if provided
  if (expectedFields && parseResult.data) {
    const schemaResult = validateJsonSchema<T>(parseResult.data, expectedFields, options)
    
    return {
      success: schemaResult.success,
      data: schemaResult.data,
      error: schemaResult.error,
      warnings: [
        ...(parseResult.warnings || []),
        ...(schemaResult.warnings || []),
      ],
      fallbackUsed: parseResult.fallbackUsed,
      parseAttempts: parseResult.parseAttempts,
    }
  }
  
  return parseResult
}