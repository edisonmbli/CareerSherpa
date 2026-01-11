const logInfo = (payload: any) => {
  try {
    const entry = { level: 'info', ts: new Date().toISOString(), ...payload }
    console.log(JSON.stringify(entry))
  } catch { }
}
const logError = (payload: any) => {
  try {
    const entry = { level: 'error', ts: new Date().toISOString(), ...payload }
    console.error(JSON.stringify(entry))
  } catch { }
}

/**
 * Unified JSON validation and error handling for LLM responses
 * This module provides robust JSON parsing with multiple fallback strategies
 */

import { executeStrategies } from './json-strategies'
import { jsonrepair } from 'jsonrepair'

/**
 * 使用 jsonrepair 库修复常见 JSON 语法错误
 * 比正则更可靠，能处理：缺逗号、缺引号、尾部逗号、单引号等
 */
export function repairJson(text: string): string {
  try {
    return jsonrepair(text)
  } catch {
    return text // 修复失败返回原文
  }
}

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
export function cleanJsonText(text: string): string {
  let cleaned = text.trim()

  // Remove DeepSeek R1 reasoning tags (thinking process)
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/g, '')

  // Remove all markdown code fences (iterative for nested cases)
  // Handles double-wrapped output like: ``` ```json {...} ``` ```
  while (cleaned.includes('```')) {
    cleaned = cleaned.replace(/```(?:json|javascript|js)?\s*/gi, '')
    cleaned = cleaned.replace(/\s*```/g, '')
  }

  // Remove any remaining backticks at start/end
  cleaned = cleaned.replace(/^`+/, '').replace(/`+$/, '')

  // Remove invisible characters and BOM
  cleaned = cleaned.replace(/^\uFEFF/, '').replace(/[\u200B-\u200D\uFEFF]/g, '')

  // Replace full-width spaces with regular spaces
  cleaned = cleaned.replace(/\u3000/g, ' ')

  // Remove trailing commas before closing brackets/braces
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1')

  // Remove any leading/trailing whitespace again
  cleaned = cleaned.trim()

  // Normalize quotes to standard quotes before escaping control characters
  // This prevents smart quotes from confusing the string tracking logic
  cleaned = fixQuotesInStrings(cleaned)

  // Escape control characters inside JSON strings
  cleaned = escapeControlCharsInStrings(cleaned)

  return cleaned
}

/**
 * Extract JSON from mixed content using bracket matching
 */
export function extractJsonFromText(text: string): string {
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

  // Handle incomplete JSON - try to close unclosed brackets
  const remaining = text.slice(firstBrace)
  const openCount = (remaining.match(new RegExp('\\' + openCh, 'g')) || [])
    .length
  const closeCount = (remaining.match(new RegExp('\\' + closeCh, 'g')) || [])
    .length
  const missingClosing = openCount - closeCount

  if (missingClosing > 0) {
    return remaining + closeCh.repeat(missingClosing)
  }

  return remaining
}

/**
 * Normalize quotes and repair unescaped quotes within strings
 * 
 * IMPORTANT: Only ASCII double quotes (") are treated as JSON structural delimiters.
 * Smart/curly quotes (", ", ') are always kept as-is within string content.
 * This prevents Chinese text like "业务-IT-产品" from breaking JSON parsing.
 */
export function fixQuotesInStrings(text: string): string {
  let result = ''
  let inString = false
  let escaped = false
  let i = 0

  while (i < text.length) {
    const char = text[i]

    if (escaped) {
      result += char
      escaped = false
      i++
      continue
    }

    if (char === '\\') {
      result += char
      escaped = true
      i++
      continue
    }

    // Only ASCII double quote is a JSON structural delimiter
    if (char === '"') {
      if (!inString) {
        // Start of JSON string
        inString = true
        result += '"'
      } else {
        // Inside string - check if this is a closing quote
        // Look ahead for structural delimiters
        const suffix = text.slice(i + 1)
        const isDelimiter = /^\s*[,\]\}:，：]/.test(suffix)

        if (isDelimiter) {
          // It's a closing quote
          inString = false
          result += '"'
        } else {
          // It's an unescaped quote inside the string - escape it
          result += '\\"'
        }
      }
    } else if (inString && (char === '\u201C' || char === '\u201D' || char === "'")) {
      // Smart quotes and single quotes inside strings: keep as-is
      // These are content, not JSON structure
      result += char
    } else if (!inString && (char === '\u201C' || char === '\u201D')) {
      // Smart quotes outside strings - LLM used wrong quote type for JSON structure
      // Convert to ASCII double quote
      inString = (char === '\u201C') // Opening smart quote starts string
      result += '"'
    } else {
      result += char
    }
    i++
  }

  return result
}


export function escapeControlCharsInStrings(text: string): string {
  let result = ''
  let inString = false
  let escaped = false
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i)
    if (escaped) {
      result += ch
      escaped = false
      continue
    }
    if (ch === '\\') {
      result += ch
      escaped = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      result += ch
      continue
    }
    if (inString) {
      const code = ch.charCodeAt(0)
      if (code >= 0 && code < 32) {
        if (ch === '\n') {
          result += '\\n'
          continue
        }
        if (ch === '\r') {
          result += '\\r'
          continue
        }
        if (ch === '\t') {
          result += '\\t'
          continue
        }
        const hex = code.toString(16).padStart(4, '0')
        result += `\\u${hex}`
        continue
      }
    }
    result += ch
  }
  return result
}

export function fixJsonSyntax(text: string): string {
  let fixed = text

  // Step 1: 基础标准化 - 中文标点转英文
  fixed = fixed.replace(/，/g, ',')
  fixed = fixed.replace(/：/g, ':')

  // Step 2: 使用 jsonrepair 进行智能修复
  // 能处理：缺逗号、缺引号、尾部逗号、单引号等
  fixed = repairJson(fixed)

  // Step 3: 最终清理 - 移除可能残留的额外逗号
  fixed = fixed.replace(/,\s*([}\]])/g, '$1')
  fixed = fixed.replace(/,\s*,+/g, ',')

  return fixed
}

/**
 * Validate and parse JSON with multiple strategies
 *
 * Delegates to executeStrategies() which implements 4 parsing strategies:
 * 1. Direct - Parse as-is
 * 2. Clean - Remove markdown, normalize quotes
 * 3. Extract - Find JSON in mixed content
 * 4. Repair - Fix common syntax errors
 */
export function validateJson<T = any>(
  content: string,
  options: ValidationOptions = {}
): ValidationResult<T> {
  const { debug } = options

  // Entry logging for observability
  if (debug) {
    logInfo({
      reqId: debug.reqId ?? 'unknown',
      route: debug.route ?? 'json-validator',
      userKey: debug.userKey ?? 'unknown',
      phase: 'validation_start',
      contentLength: content.length,
      strictMode: options.strictMode ?? false,
      contentPreview: content.slice(0, 200),
      hasMarkdownCodeBlock: content.includes('```'),
      hasJsonKeywords: content.includes('{') && content.includes('}'),
    })
  }

  // Delegate to strategy executor
  const result = executeStrategies<T>(
    content,
    cleanJsonText,
    extractJsonFromText,
    fixJsonSyntax,
    options
  )

  // Exit logging
  if (debug) {
    if (result.success) {
      logInfo({
        reqId: debug.reqId ?? 'unknown',
        route: debug.route ?? 'json-validator',
        phase: 'validation_success',
        parseAttempts: result.parseAttempts,
        fallbackUsed: result.fallbackUsed ?? false,
      })
    } else {
      logError({
        reqId: debug.reqId ?? 'unknown',
        route: debug.route ?? 'json-validator',
        phase: 'validation_failed',
        error: result.error,
        parseAttempts: result.parseAttempts,
        warnings: result.warnings?.join('; '),
      })
    }
  }

  return result
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
      } else if (
        type === 'object' &&
        (typeof value !== 'object' || Array.isArray(value))
      ) {
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

  const result: ValidationResult<T> = {
    success: true,
    data: normalized as T,
  }

  if (warnings.length > 0) {
    result.warnings = warnings
  }

  return result
}

/**
 * Complete JSON validation pipeline
 */
export function validateLLMResponse<T = any>(
  content: string,
  expectedFields?: Record<
    string,
    'string' | 'string[]' | 'object' | 'object[]'
  >,
  options: ValidationOptions = {}
): ValidationResult<T> {
  // Step 1: Parse JSON
  const parseResult = validateJson<T>(content, options)

  if (!parseResult.success) {
    return parseResult
  }

  // Step 2: Validate schema if provided
  if (expectedFields && parseResult.data) {
    const schemaResult = validateJsonSchema<T>(
      parseResult.data,
      expectedFields,
      options
    )

    const result: ValidationResult<T> = {
      success: schemaResult.success,
    }

    if (schemaResult.data !== undefined) {
      result.data = schemaResult.data
    }

    if (schemaResult.error) {
      result.error = schemaResult.error
    }

    const allWarnings = [
      ...(parseResult.warnings || []),
      ...(schemaResult.warnings || []),
    ]

    if (allWarnings.length > 0) {
      result.warnings = allWarnings
    }

    if (parseResult.fallbackUsed) {
      result.fallbackUsed = parseResult.fallbackUsed
    }

    if (parseResult.parseAttempts !== undefined) {
      result.parseAttempts = parseResult.parseAttempts
    }

    return result
  }

  return parseResult
}
