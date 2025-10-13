/**
 * Security Configuration
 * Centralized security settings and policies for the application
 */

export const SECURITY_CONFIG = {
  // File upload security
  FILE_UPLOAD: {
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_MIME_TYPES: {
      resume: ['application/pdf', 'text/plain'],
      'detailed-resume': ['application/pdf', 'text/plain'],
      jd: ['application/pdf', 'text/plain', 'image/jpeg', 'image/png', 'image/webp']
    },
    SCAN_FOR_MALWARE: true,
    QUARANTINE_SUSPICIOUS_FILES: true
  },

  // Rate limiting
  RATE_LIMITS: {
    UPLOAD: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 10, // 10 uploads per window
      skipSuccessfulRequests: false
    },
    API: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100, // 100 API calls per window
      skipSuccessfulRequests: true
    },
    SERVICE_CREATION: {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 20, // 20 services per hour
      skipSuccessfulRequests: false
    }
  },

  // Input validation
  INPUT_VALIDATION: {
    MAX_TEXT_LENGTH: 50000, // 50KB of text
    SANITIZE_HTML: true,
    STRIP_DANGEROUS_CHARS: true,
    VALIDATE_ENCODING: true
  },

  // Authentication & Authorization
  AUTH: {
    REQUIRE_USER_KEY: true,
    VALIDATE_USER_PERMISSIONS: true,
    SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours
    ENFORCE_QUOTA_LIMITS: true
  },

  // Data protection
  DATA_PROTECTION: {
    ENCRYPT_SENSITIVE_DATA: true,
    MASK_PII_IN_LOGS: true,
    SECURE_FILE_STORAGE: true,
    AUTO_DELETE_TEMP_FILES: true
  },

  // Content Security
  CONTENT_SECURITY: {
    SCAN_FOR_MALICIOUS_CONTENT: true,
    BLOCK_EXECUTABLE_FILES: true,
    VALIDATE_FILE_HEADERS: true,
    CHECK_FILE_INTEGRITY: true
  },

  // Logging & Monitoring
  SECURITY_LOGGING: {
    LOG_FAILED_ATTEMPTS: true,
    LOG_SUSPICIOUS_ACTIVITY: true,
    ALERT_ON_ANOMALIES: true,
    RETENTION_DAYS: 90
  }
} as const

export type SecurityConfig = typeof SECURITY_CONFIG