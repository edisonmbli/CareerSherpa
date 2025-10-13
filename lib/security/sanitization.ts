/**
 * Input Sanitization Utilities
 * Comprehensive input cleaning and validation for security
 */

import { SECURITY_CONFIG } from './config'

/**
 * HTML entities to escape
 */
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#96;',
  '=': '&#x3D;'
}

/**
 * Escape HTML entities to prevent XSS
 */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"'`=/]/g, (match) => HTML_ENTITIES[match] || match)
}

/**
 * Remove potentially dangerous HTML tags and attributes
 */
export function stripHtml(text: string): string {
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&[a-zA-Z0-9#]+;/g, '')
}

/**
 * Sanitize text input by removing dangerous content
 */
export function sanitizeTextInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return ''
  }

  let sanitized = input

  // Remove null bytes and control characters
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

  // Remove potential script injections
  sanitized = sanitized.replace(/javascript:/gi, '')
  sanitized = sanitized.replace(/vbscript:/gi, '')
  sanitized = sanitized.replace(/data:/gi, '')
  sanitized = sanitized.replace(/on\w+\s*=/gi, '')

  // Remove SQL injection patterns
  sanitized = sanitized.replace(/(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/gi, '')

  // Remove excessive whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim()

  // Truncate to maximum length
  if (sanitized.length > SECURITY_CONFIG.INPUT_VALIDATION.MAX_TEXT_LENGTH) {
    sanitized = sanitized.substring(0, SECURITY_CONFIG.INPUT_VALIDATION.MAX_TEXT_LENGTH)
  }

  return sanitized
}

/**
 * Sanitize filename to prevent directory traversal
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return 'untitled'
  }

  let sanitized = filename

  // Remove directory traversal patterns
  sanitized = sanitized.replace(/\.\./g, '')
  sanitized = sanitized.replace(/[\/\\]/g, '')

  // Remove dangerous characters
  sanitized = sanitized.replace(/[<>:"|?*\x00-\x1f]/g, '')

  // Remove leading/trailing dots and spaces
  sanitized = sanitized.replace(/^[\s.]+|[\s.]+$/g, '')

  // Ensure filename is not empty
  if (!sanitized) {
    sanitized = 'untitled'
  }

  // Truncate to reasonable length
  if (sanitized.length > 255) {
    const ext = sanitized.substring(sanitized.lastIndexOf('.'))
    const name = sanitized.substring(0, sanitized.lastIndexOf('.'))
    sanitized = name.substring(0, 255 - ext.length) + ext
  }

  return sanitized
}

/**
 * Validate and sanitize URL
 */
export function sanitizeUrl(url: string): string | null {
  if (!url || typeof url !== 'string') {
    return null
  }

  try {
    const parsed = new URL(url)
    
    // Only allow safe protocols
    const allowedProtocols = ['http:', 'https:', 'mailto:']
    if (!allowedProtocols.includes(parsed.protocol)) {
      return null
    }

    // Prevent javascript: and data: URLs
    if (parsed.protocol === 'javascript:' || parsed.protocol === 'data:') {
      return null
    }

    return parsed.toString()
  } catch {
    return null
  }
}

/**
 * Sanitize JSON input to prevent prototype pollution
 */
export function sanitizeJsonInput(input: unknown): unknown {
  if (input === null || input === undefined) {
    return input
  }

  if (typeof input === 'string') {
    return sanitizeTextInput(input)
  }

  if (typeof input === 'number' || typeof input === 'boolean') {
    return input
  }

  if (Array.isArray(input)) {
    return input.map(item => sanitizeJsonInput(item))
  }

  if (typeof input === 'object') {
    const sanitized: Record<string, unknown> = {}
    
    for (const [key, value] of Object.entries(input)) {
      // Prevent prototype pollution
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue
      }

      // Sanitize key
      const sanitizedKey = sanitizeTextInput(key)
      if (sanitizedKey) {
        sanitized[sanitizedKey] = sanitizeJsonInput(value)
      }
    }

    return sanitized
  }

  return input
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email) && email.length <= 254
}

/**
 * Validate phone number format (basic)
 */
export function validatePhoneNumber(phone: string): boolean {
  if (!phone || typeof phone !== 'string') {
    return false
  }

  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '')
  
  // Check if it's a reasonable length (7-15 digits)
  return digits.length >= 7 && digits.length <= 15
}

/**
 * Sanitize user input for logging (mask sensitive data)
 */
export function sanitizeForLogging(input: unknown): unknown {
  if (typeof input === 'string') {
    let sanitized = input

    // Mask email addresses
    sanitized = sanitized.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '***@***.***')

    // Mask phone numbers
    sanitized = sanitized.replace(/\b\d{3}-?\d{3}-?\d{4}\b/g, '***-***-****')

    // Mask credit card numbers
    sanitized = sanitized.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '****-****-****-****')

    // Mask social security numbers
    sanitized = sanitized.replace(/\b\d{3}-?\d{2}-?\d{4}\b/g, '***-**-****')

    return sanitized
  }

  if (Array.isArray(input)) {
    return input.map(item => sanitizeForLogging(item))
  }

  if (typeof input === 'object' && input !== null) {
    const sanitized: Record<string, unknown> = {}
    
    for (const [key, value] of Object.entries(input)) {
      // Mask sensitive field names
      const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth', 'credential']
      const isSensitive = sensitiveFields.some(field => key.toLowerCase().includes(field))
      
      if (isSensitive) {
        sanitized[key] = '***MASKED***'
      } else {
        sanitized[key] = sanitizeForLogging(value)
      }
    }

    return sanitized
  }

  return input
}

/**
 * Rate limit key sanitization
 */
export function sanitizeRateLimitKey(key: string): string {
  if (!key || typeof key !== 'string') {
    return 'anonymous'
  }

  // Remove special characters and limit length
  let sanitized = key.replace(/[^a-zA-Z0-9_-]/g, '')
  
  if (sanitized.length > 50) {
    sanitized = sanitized.substring(0, 50)
  }

  return sanitized || 'anonymous'
}

/**
 * Comprehensive input sanitization for API requests
 */
export function sanitizeApiInput(input: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(input)) {
    // Skip prototype pollution keys
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue
    }

    const sanitizedKey = sanitizeTextInput(key)
    if (!sanitizedKey) {
      continue
    }

    if (typeof value === 'string') {
      sanitized[sanitizedKey] = sanitizeTextInput(value)
    } else if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        sanitized[sanitizedKey] = value.map(item => 
          typeof item === 'string' ? sanitizeTextInput(item) : item
        )
      } else {
        sanitized[sanitizedKey] = sanitizeJsonInput(value)
      }
    } else {
      sanitized[sanitizedKey] = value
    }
  }

  return sanitized
}