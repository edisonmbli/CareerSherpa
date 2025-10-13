/**
 * Security Validation Utilities
 * Input sanitization, validation, and security checks
 */

import { generateTextHash, generateBufferHash, generateRandomBytes, generateUUID } from './edge-crypto'
import { SECURITY_CONFIG } from './config'

/**
 * Sanitize text input to prevent XSS and injection attacks
 */
export function sanitizeText(input: string): string {
  if (!input || typeof input !== 'string') {
    return ''
  }

  let sanitized = input

  // Remove null bytes and control characters
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

  // Remove potentially dangerous HTML/script tags
  if (SECURITY_CONFIG.INPUT_VALIDATION.SANITIZE_HTML) {
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    sanitized = sanitized.replace(/javascript:/gi, '')
    sanitized = sanitized.replace(/on\w+\s*=/gi, '')
  }

  // Strip dangerous characters if configured
  if (SECURITY_CONFIG.INPUT_VALIDATION.STRIP_DANGEROUS_CHARS) {
    sanitized = sanitized.replace(/[<>'"&]/g, (char) => {
      const entities: Record<string, string> = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '&': '&amp;'
      }
      return entities[char] || char
    })
  }

  return sanitized.trim()
}

/**
 * Validate text length and content
 */
export function validateTextInput(input: string): { valid: boolean; error?: string } {
  if (!input || typeof input !== 'string') {
    return { valid: false, error: 'Input must be a non-empty string' }
  }

  if (input.length > SECURITY_CONFIG.INPUT_VALIDATION.MAX_TEXT_LENGTH) {
    return { 
      valid: false, 
      error: `Input exceeds maximum length of ${SECURITY_CONFIG.INPUT_VALIDATION.MAX_TEXT_LENGTH} characters` 
    }
  }

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /\b(eval|exec|system|shell_exec|passthru)\s*\(/i,
    /\b(drop|delete|truncate|alter)\s+table\b/i,
    /\bunion\s+select\b/i,
    /<script[^>]*>.*?<\/script>/i,
    /javascript\s*:/i
  ]

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(input)) {
      return { valid: false, error: 'Input contains potentially malicious content' }
    }
  }

  return { valid: true }
}

/**
 * Validate file upload security
 */
export function validateFileUpload(file: File, fileType: keyof typeof SECURITY_CONFIG.FILE_UPLOAD.ALLOWED_MIME_TYPES): { valid: boolean; error?: string } {
  const config = SECURITY_CONFIG.FILE_UPLOAD

  // Check file size
  if (file.size > config.MAX_FILE_SIZE) {
    return { 
      valid: false, 
      error: `File size exceeds maximum allowed size of ${config.MAX_FILE_SIZE / (1024 * 1024)}MB` 
    }
  }

  // Check MIME type
  const allowedTypes = config.ALLOWED_MIME_TYPES[fileType]
  if (!allowedTypes || !allowedTypes.includes(file.type as any)) {
    return { 
      valid: false, 
      error: `File type ${file.type} is not allowed for ${fileType}` 
    }
  }

  // Check file name for suspicious patterns
  const suspiciousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com', '.jar', '.js', '.vbs', '.ps1']
  const fileName = file.name.toLowerCase()
  
  for (const ext of suspiciousExtensions) {
    if (fileName.endsWith(ext)) {
      return { valid: false, error: 'Executable files are not allowed' }
    }
  }

  // Check for double extensions (e.g., file.pdf.exe)
  const parts = fileName.split('.')
  if (parts.length > 2) {
    const secondLastExt = '.' + parts[parts.length - 2]
    if (suspiciousExtensions.includes(secondLastExt)) {
      return { valid: false, error: 'Files with suspicious double extensions are not allowed' }
    }
  }

  return { valid: true }
}

/**
 * Generate secure hash for file integrity checking
 */
export async function generateFileHash(buffer: Buffer): Promise<string> {
  const uint8Array = new Uint8Array(buffer)
  return await generateBufferHash(uint8Array)
}

/**
 * Validate file header/magic bytes
 */
export function validateFileHeader(buffer: Buffer, expectedType: string): boolean {
  if (buffer.length < 4) return false

  const header = buffer.subarray(0, 8)
  
  switch (expectedType) {
    case 'application/pdf':
      return header.subarray(0, 4).toString() === '%PDF'
    
    case 'image/jpeg':
      return header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF
    
    case 'image/png':
      return header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))
    
    case 'image/webp':
      return header.subarray(0, 4).toString() === 'RIFF' && 
             buffer.subarray(8, 12).toString() === 'WEBP'
    
    case 'text/plain':
      // For text files, check if it's valid UTF-8
      try {
        buffer.toString('utf-8')
        return true
      } catch {
        return false
      }
    
    default:
      return true // Allow unknown types for now
  }
}

/**
 * Mask sensitive information in logs
 */
export function maskSensitiveData(data: any): any {
  if (!SECURITY_CONFIG.DATA_PROTECTION.MASK_PII_IN_LOGS) {
    return data
  }

  if (typeof data === 'string') {
    // Mask email addresses
    data = data.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '***@***.***')
    
    // Mask phone numbers
    data = data.replace(/\b\d{3}-?\d{3}-?\d{4}\b/g, '***-***-****')
    
    // Mask potential IDs (long alphanumeric strings)
    data = data.replace(/\b[a-zA-Z0-9]{20,}\b/g, (match: string) => 
      match.substring(0, 4) + '*'.repeat(match.length - 8) + match.substring(match.length - 4)
    )
  }

  if (typeof data === 'object' && data !== null) {
    const masked = { ...data }
    
    // Mask common sensitive fields
    const sensitiveFields = ['email', 'phone', 'ssn', 'password', 'token', 'key', 'secret']
    
    for (const field of sensitiveFields) {
      if (field in masked) {
        masked[field] = '***MASKED***'
      }
    }
    
    return masked
  }

  return data
}

/**
 * Rate limiting key generator
 */
export function generateRateLimitKey(userKey: string, action: string): string {
  return `rate_limit:${action}:${userKey}`
}

/**
 * Security audit log entry
 */
export interface SecurityAuditLog {
  timestamp: Date
  userKey: string
  action: string
  resource?: string
  success: boolean
  ipAddress?: string
  userAgent?: string
  details?: Record<string, any>
}

/**
 * Create security audit log entry
 */
export function createSecurityAuditLog(
  userKey: string,
  action: string,
  success: boolean,
  details?: Record<string, any>
): SecurityAuditLog {
  return {
    timestamp: new Date(),
    userKey: maskSensitiveData(userKey) as string,
    action,
    success,
    details: details ? maskSensitiveData(details) : undefined
  }
}