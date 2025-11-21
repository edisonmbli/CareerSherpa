import { logInfo, logError } from '../logger'

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

  // Remove all markdown code fences (more aggressive approach)
  // Handle various code fence patterns
  cleaned = cleaned.replace(/^```(?:json|javascript|js)?\s*/gim, '')
  cleaned = cleaned.replace(/\s*```\s*$/gm, '')
  cleaned = cleaned.replace(/```(?:json|javascript|js)?\s*/gim, '')
  cleaned = cleaned.replace(/\s*```/gm, '')

  // Remove any remaining backticks at start/end
  cleaned = cleaned.replace(/^`+/, '').replace(/`+$/, '')

  // Remove invisible characters and BOM
  cleaned = cleaned.replace(/^\uFEFF/, '').replace(/[\u200B-\u200D\uFEFF]/g, '')

  // Normalize quotes (smart quotes to regular quotes)
  // 注意：不要将字符串内的单引号替换为双引号，这会破坏JSON结构
  cleaned = cleaned.replace(/[""]/g, '"')
  // 只替换可能作为字符串边界的智能单引号，保留字符串内容中的普通单引号
  cleaned = cleaned.replace(/^'|'$/g, '"').replace(/'(\s*:\s*)/g, '"$1').replace(/(\s*,\s*)'/g, '$1"')

  // Replace full-width spaces with regular spaces
  cleaned = cleaned.replace(/\u3000/g, ' ')

  // Remove trailing commas before closing brackets/braces
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1')

  // Remove any leading/trailing whitespace again
  cleaned = cleaned.trim()

  // Escape control characters inside JSON strings
  cleaned = escapeControlCharsInStrings(cleaned)

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
 * Fix quotes within JSON strings to prevent parsing errors
 */
function fixQuotesInStrings(text: string): string {
  let result = ''
  let inString = false
  let escaped = false
  let i = 0

  while (i < text.length) {
    const char = text[i]
    const nextChar = text[i + 1]

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

    if (char === '"') {
      if (!inString) {
        // 开始字符串
        inString = true
        result += char
      } else {
        // 可能结束字符串，检查后面是否是JSON结构字符
        const afterQuote = text.slice(i + 1).match(/^\s*[,\]\}:]/);
        if (afterQuote) {
          // 确实是字符串结束
          inString = false
          result += char
        } else {
          // 字符串内的引号，需要转义
          result += '\\"'
        }
      }
    } else if (inString && char === "'") {
      // 字符串内的单引号，保持原样（JSON标准允许）
      result += char
    } else {
      result += char
    }

    i++
  }

  return result
}

function escapeControlCharsInStrings(text: string): string {
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

function fixJsonSyntax(text: string): string {
  let fixed = text

  // 首先处理字符串中的引号问题
  fixed = fixQuotesInStrings(fixed)

  // 多次迭代修复，处理复杂的嵌套情况
  for (let i = 0; i < 3; i++) {
    const before = fixed
    
    // 1. 修复对象属性之间缺少逗号（字符串值）
    // "key": "value" \n "nextKey": -> "key": "value", "nextKey":
    fixed = fixed.replace(/("\s*:\s*"[^"]*")\s*\n\s*(")/g, '$1,\n  $2')
    fixed = fixed.replace(/("\s*:\s*"[^"]*")\s+(")/g, '$1, $2')

    // 2. 修复对象属性之间缺少逗号（数组值）
    // "key": [...] \n "nextKey": -> "key": [...], "nextKey":
    fixed = fixed.replace(/("\s*:\s*\[[^\]]*\])\s*\n\s*(")/g, '$1,\n  $2')
    fixed = fixed.replace(/("\s*:\s*\[[^\]]*\])\s+(")/g, '$1, $2')

    // 3. 修复对象属性之间缺少逗号（对象值）
    // "key": {...} \n "nextKey": -> "key": {...}, "nextKey":
    fixed = fixed.replace(/("\s*:\s*\{[^}]*\})\s*\n\s*(")/g, '$1,\n  $2')
    fixed = fixed.replace(/("\s*:\s*\{[^}]*\})\s+(")/g, '$1, $2')

    // 4. 修复对象属性之间缺少逗号（基本类型值）
    // "key": value \n "nextKey": -> "key": value, "nextKey":
    fixed = fixed.replace(/("\s*:\s*(?:true|false|null|\d+(?:\.\d+)?))\s*\n\s*(")/g, '$1,\n  $2')
    fixed = fixed.replace(/("\s*:\s*(?:true|false|null|\d+(?:\.\d+)?))\s+(")/g, '$1, $2')

    // 5. 修复数组中字符串元素之间缺少逗号
    // "item1" \n "item2" -> "item1", "item2"
    fixed = fixed.replace(/("[^"]*")\s*\n\s*("[^"]*")/g, '$1,\n  $2')
    fixed = fixed.replace(/("[^"]*")\s+("[^"]*")/g, '$1, $2')

    // 6. 修复数组中字符串和数字之间缺少逗号
    fixed = fixed.replace(/("[^"]*")\s*\n\s*(\d+(?:\.\d+)?)/g, '$1,\n  $2')
    fixed = fixed.replace(/("[^"]*")\s+(\d+(?:\.\d+)?)/g, '$1, $2')
    fixed = fixed.replace(/(\d+(?:\.\d+)?)\s*\n\s*("[^"]*")/g, '$1,\n  $2')
    fixed = fixed.replace(/(\d+(?:\.\d+)?)\s+("[^"]*")/g, '$1, $2')

    // 7. 修复数组中字符串和布尔值之间缺少逗号
    fixed = fixed.replace(/("[^"]*")\s*\n\s*(true|false|null)/g, '$1,\n  $2')
    fixed = fixed.replace(/("[^"]*")\s+(true|false|null)/g, '$1, $2')
    fixed = fixed.replace(/(true|false|null)\s*\n\s*("[^"]*")/g, '$1,\n  $2')
    fixed = fixed.replace(/(true|false|null)\s+("[^"]*")/g, '$1, $2')

    // 8. 修复数组中数字和布尔值之间缺少逗号
    fixed = fixed.replace(/(\d+(?:\.\d+)?)\s*\n\s*(true|false|null)/g, '$1,\n  $2')
    fixed = fixed.replace(/(\d+(?:\.\d+)?)\s+(true|false|null)/g, '$1, $2')
    fixed = fixed.replace(/(true|false|null)\s*\n\s*(\d+(?:\.\d+)?)/g, '$1,\n  $2')
    fixed = fixed.replace(/(true|false|null)\s+(\d+(?:\.\d+)?)/g, '$1, $2')

    // 9. 修复数组中对象之间缺少逗号
    // } \n { -> }, {
    fixed = fixed.replace(/(\})\s*\n\s*(\{)/g, '$1,\n  $2')
    fixed = fixed.replace(/(\})\s+(\{)/g, '$1, $2')

    // 10. 修复数组中数组之间缺少逗号
    // ] \n [ -> ], [
    fixed = fixed.replace(/(\])\s*\n\s*(\[)/g, '$1,\n  $2')
    fixed = fixed.replace(/(\])\s+(\[)/g, '$1, $2')

    // 11. 修复数组结束后缺少逗号
    // ] \n "key": -> ], "key":
    fixed = fixed.replace(/(\])\s*\n\s*(")/g, '$1,\n  $2')
    fixed = fixed.replace(/(\])\s+(")/g, '$1, $2')

    // 12. 修复对象结束后缺少逗号
    // } \n "key": -> }, "key":
    fixed = fixed.replace(/(\})\s*\n\s*(")/g, '$1,\n  $2')
    fixed = fixed.replace(/(\})\s+(")/g, '$1, $2')

    // 如果没有变化，停止迭代
    if (fixed === before) {
      break
    }
  }

  // 清理多余的逗号
  fixed = fixed.replace(/,\s*([}\]])/g, '$1')
  fixed = fixed.replace(/,\s*,+/g, ',')

  return fixed
}

/**
 * Validate and parse JSON with multiple strategies
 */
export function validateJson<T = any>(
  content: string,
  options: ValidationOptions = {}
): ValidationResult<T> {
  const {
    debug,
    enableFallback = true,
    maxAttempts = 4,
    strictMode = false,
  } = options
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
      contentPreview: content.slice(0, 200),
      contentSample: content.slice(0, 500), // 增加更多内容样本
      hasMarkdownCodeBlock: content.includes('```'),
      hasJsonKeywords: content.includes('{') && content.includes('}'),
      originalContent: content, // 记录完整的原始内容
    })
  }

  // 智能检测：如果内容包含markdown代码块，直接跳过直接解析
  const hasMarkdownCodeBlock = content.includes('```')

  // Strategy 1: Direct parsing (只在没有markdown代码块时执行)
  if (!hasMarkdownCodeBlock) {
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
          dataType: typeof parsed,
          isArray: Array.isArray(parsed),
          objectKeys:
            typeof parsed === 'object' && parsed !== null
              ? Object.keys(parsed)
              : undefined,
        })
      }

      const result: ValidationResult<T> = {
        success: true,
        data: parsed,
        parseAttempts,
      }

      if (warnings.length > 0) {
        result.warnings = warnings
      }

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      if (debug) {
        logInfo({
          reqId: debug.reqId ?? 'unknown',
          route: debug.route ?? 'json-validator',
          userKey: debug.userKey ?? 'unknown',
          phase: 'direct_parse_failed',
          error: errorMessage,
          parseAttempts,
          contentLength: content.length,
          contentPreview: content.slice(0, 300), // 增加错误时的内容预览
          // 尝试提取错误位置信息
          errorPosition: errorMessage.match(/position (\d+)/)?.[1],
          errorLine: errorMessage.match(/line (\d+)/)?.[1],
        })
      }

      if (strictMode) {
        return {
          success: false,
          error: `Strict mode: ${errorMessage}`,
          parseAttempts,
        }
      }

      warnings.push(`Direct parse failed: ${errorMessage}`)
    }
  } else if (debug) {
    logInfo({
      reqId: debug.reqId ?? 'unknown',
      route: debug.route ?? 'json-validator',
      userKey: debug.userKey ?? 'unknown',
      phase: 'markdown_detected_skip_direct_parse',
    })
  }

  // Strategy 2: Clean and parse
  if (parseAttempts < maxAttempts) {
    parseAttempts++
    try {
      const cleaned = cleanJsonText(content)
      
      if (debug) {
        logInfo({
          reqId: debug.reqId ?? 'unknown',
          route: debug.route ?? 'json-validator',
          userKey: debug.userKey ?? 'unknown',
          phase: 'cleaned_parse_attempt',
          parseAttempts,
          originalLength: content.length,
          cleanedLength: cleaned.length,
          cleanedPreview: cleaned.slice(0, 300),
        })
      }
      
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

      const result: ValidationResult<T> = {
        success: true,
        data: parsed,
        parseAttempts,
      }

      if (warnings.length > 0) {
        result.warnings = warnings
      }

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      if (debug) {
        logInfo({
          reqId: debug.reqId ?? 'unknown',
          route: debug.route ?? 'json-validator',
          userKey: debug.userKey ?? 'unknown',
          phase: 'cleaned_parse_failed',
          error: errorMessage,
          parseAttempts,
          cleanedContent: cleanJsonText(content).slice(0, 500), // 记录清理后的内容
          errorPosition: errorMessage.match(/position (\d+)/)?.[1],
        })
      }
      
      warnings.push(`Cleaned parse failed: ${errorMessage}`)
    }
  }

  // Strategy 3: Extract and parse
  if (parseAttempts < maxAttempts) {
    parseAttempts++
    try {
      const cleaned = cleanJsonText(content)
      const extracted = extractJsonFromText(cleaned)

      if (debug) {
        logInfo({
          reqId: debug.reqId ?? 'unknown',
          route: debug.route ?? 'json-validator',
          userKey: debug.userKey ?? 'unknown',
          phase: 'extracted_parse_attempt',
          parseAttempts,
          extractedContent: extracted ? extracted.slice(0, 500) : 'null',
          extractedLength: extracted ? extracted.length : 0,
          hasExtracted: !!extracted,
        })
      }

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

        const result: ValidationResult<T> = {
          success: true,
          data: parsed,
          parseAttempts,
        }

        if (warnings.length > 0) {
          result.warnings = warnings
        }

        return result
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      if (debug) {
        logInfo({
          reqId: debug.reqId ?? 'unknown',
          route: debug.route ?? 'json-validator',
          userKey: debug.userKey ?? 'unknown',
          phase: 'extracted_parse_failed',
          error: errorMessage,
          parseAttempts,
          extractedContent: extractJsonFromText(cleanJsonText(content))?.slice(0, 500) || 'null',
          errorPosition: errorMessage.match(/position (\d+)/)?.[1],
        })
      }
      
      warnings.push(`Extracted parse failed: ${errorMessage}`)
    }
  }

  // Strategy 4: Fix syntax and parse
  if (parseAttempts < maxAttempts && enableFallback) {
    parseAttempts++
    try {
      const cleaned = cleanJsonText(content)
      const extracted = extractJsonFromText(cleaned) || cleaned
      const fixed = fixJsonSyntax(extracted)
      
      if (debug) {
        logInfo({
          reqId: debug.reqId ?? 'unknown',
          route: debug.route ?? 'json-validator',
          userKey: debug.userKey ?? 'unknown',
          phase: 'fixed_parse_attempt',
          parseAttempts,
          originalLength: content.length,
          cleanedLength: cleaned.length,
          extractedLength: extracted.length,
          fixedLength: fixed.length,
          fixedContent: fixed.slice(0, 500), // 记录修复后的内容
        })
      }
      
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

      const result: ValidationResult<T> = {
        success: true,
        data: parsed,
        fallbackUsed: true,
        parseAttempts,
      }

      if (warnings.length > 0) {
        result.warnings = warnings
      }

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      if (debug) {
        logInfo({
          reqId: debug.reqId ?? 'unknown',
          route: debug.route ?? 'json-validator',
          userKey: debug.userKey ?? 'unknown',
          phase: 'fixed_parse_failed',
          error: errorMessage,
          parseAttempts,
          fixedContent: fixJsonSyntax(extractJsonFromText(cleanJsonText(content)) || cleanJsonText(content)).slice(0, 500),
          errorPosition: errorMessage.match(/position (\d+)/)?.[1],
        })
      }
      
      warnings.push(`Fixed parse failed: ${errorMessage}`)
    }
  }

  // All strategies failed
  const errorMessage = `All parsing strategies failed after ${parseAttempts} attempts. Warnings: ${warnings.join(
    '; '
  )}`

  if (debug) {
    logError({
      reqId: debug.reqId ?? 'unknown',
      route: debug.route ?? 'json-validator',
      userKey: debug.userKey ?? 'unknown',
      phase: 'all_strategies_failed',
      parseAttempts,
      warnings: warnings.join('; '),
      contentSample: content.slice(0, 200),
      contentLength: content.length,
      hasMarkdownCodeBlock,
      enableFallback,
      strictMode,
      // 添加所有处理步骤的内容样本
      processedSamples: {
        cleaned: cleanJsonText(content).slice(0, 300),
        extracted: extractJsonFromText(cleanJsonText(content))?.slice(0, 300) || 'null',
        fixed: fixJsonSyntax(extractJsonFromText(cleanJsonText(content)) || cleanJsonText(content)).slice(0, 300),
      },
    })
  }

  return {
    success: false,
    error: errorMessage,
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
