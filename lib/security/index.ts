/**
 * Security Module Index
 * Centralized exports for all security utilities
 */

// Configuration
export { SECURITY_CONFIG } from './config'

// Validation utilities
export {
  sanitizeText,
  validateTextInput,
  validateFileUpload,
  generateFileHash,
  validateFileHeader,
  maskSensitiveData,
  generateRateLimitKey,
  createSecurityAuditLog,
  type SecurityAuditLog
} from './validation'

// Sanitization utilities
export {
  escapeHtml,
  stripHtml,
  sanitizeTextInput,
  sanitizeFilename,
  sanitizeUrl,
  sanitizeJsonInput,
  validateEmail,
  validatePhoneNumber,
  sanitizeForLogging,
  sanitizeRateLimitKey,
  sanitizeApiInput
} from './sanitization'

// Import for internal use
import { sanitizeTextInput } from './sanitization'
import { validateFileUpload } from './validation'
import { sanitizeApiInput, sanitizeForLogging } from './sanitization'
import { SECURITY_CONFIG } from './config'

// Middleware
export {
  securityMiddleware,
  extractSecurityContext,
  validateRequestHeaders,
  applyRateLimit,
  validateUserAuth,
  validateCSRFToken,
  getCSPHeaders,
  type SecurityContext
} from './middleware'

// Audit system
export {
  createSecurityEvent,
  logSecurityEvent,
  auditAuthenticationAttempt,
  auditAuthorizationCheck,
  auditRateLimitEvent,
  auditSuspiciousActivity,
  auditFileUpload,
  auditInputValidationFailure,
  auditDataAccess,
  auditMaliciousContentDetection,
  auditConfigurationChange,
  getSecurityEventSummary,
  detectSecurityAnomalies,
  type SecurityEvent,
  type SecurityEventType,
  type SecuritySeverity
} from './audit'

// Security utilities for common use cases
export const SecurityUtils = {
  // Input validation and sanitization
  validateAndSanitizeInput: (input: string): string => {
    return sanitizeTextInput(input)
  },

  // File security check
  validateFileSecurely: (file: File, fileType: keyof typeof SECURITY_CONFIG.FILE_UPLOAD.ALLOWED_MIME_TYPES = 'resume'): { valid: boolean; error?: string } => {
    try {
      return validateFileUpload(file, fileType)
    } catch (error) {
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : 'File validation failed' 
      }
    }
  },

  // API input sanitization
  sanitizeApiRequest: (data: Record<string, unknown>): Record<string, unknown> => {
    return sanitizeApiInput(data)
  },

  // Logging sanitization
  sanitizeForAudit: (data: unknown): unknown => {
    return sanitizeForLogging(data)
  }
}

// Security constants
export const SECURITY_CONSTANTS = {
  MAX_FILE_SIZE: SECURITY_CONFIG.FILE_UPLOAD.MAX_FILE_SIZE,
  MAX_TEXT_LENGTH: SECURITY_CONFIG.INPUT_VALIDATION.MAX_TEXT_LENGTH,
  RATE_LIMIT_WINDOW: SECURITY_CONFIG.RATE_LIMITS.API.windowMs,
  ALLOWED_MIME_TYPES: Object.keys(SECURITY_CONFIG.FILE_UPLOAD.ALLOWED_MIME_TYPES)
} as const