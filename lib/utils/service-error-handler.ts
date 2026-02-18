/**
 * @file Secure Error Handler for Service Operations
 *
 * Implements a whitelist-based approach to error display:
 * - Only whitelisted error codes can be shown with specific i18n messages
 * - All unknown/technical errors map to a generic friendly message
 * - Prevents leaking internal error details (json_parse_failed, db errors, etc.)
 */

import { uiLog } from '@/lib/ui/sse-debug-logger'

export interface ErrorDicts {
  statusText?: {
    daily_limit?: string
    frequency_limit?: string
    resume_required?: string
    job_text_too_long?: string
    [key: string]: any
  }
  notification?: {
    rateLimitedTitle?: string
    rateLimitedDesc?: string
    dailyLimitDesc?: string
    serverErrorTitle?: string
    serverErrorDesc?: string
    matchFailedTitle?: string
    matchFailedDesc?: string
    [key: string]: any
  }
}

/**
 * Public error codes that are safe to display with specific messages.
 * All other error codes will be mapped to a generic "service unavailable" message.
 */
const PUBLIC_ERROR_WHITELIST = new Set([
  // Rate limiting / quota (user-actionable)
  'rate_limited',
  'daily_limit',
  'frequency_limit',
  'insufficient_quota',
  'backpressured',

  // Input validation (user-actionable)
  'resume_required',
  'job_text_too_long',
  'invalid_file_type',
  'file_too_large',

  // Retryable errors (user can retry)
])

/**
 * Maps error codes to localized UI titles and descriptions.
 *
 * Security: Only whitelisted error codes are shown with specific messages.
 * All unknown/technical errors (json_parse_failed, model_timeout, db_error, etc.)
 * are mapped to a generic friendly message to prevent information leakage.
 *
 * @param errorCode - The error code from server actions or backend
 * @param dicts - i18n dictionaries containing localized error messages
 */
export function getServiceErrorMessage(
  errorCode: string,
  dicts: ErrorDicts,
): { title: string; description: string } {
  // Normalize error code for comparison
  const normalizedCode = (errorCode || '').toLowerCase().trim()

  // Development mode: log raw error for debugging (never shown to users)
  if (process.env.NODE_ENV === 'development' && normalizedCode) {
    uiLog.debug('service_error_raw_code', { code: normalizedCode })
  }

  // === Whitelisted Business Errors (safe to show with specific messages) ===

  if (normalizedCode === 'rate_limited') {
    return {
      title: dicts.notification?.rateLimitedTitle || 'Request Rate Limited',
      description:
        dicts.notification?.rateLimitedDesc ||
        'System is busy. Please wait a moment.',
    }
  }

  if (
    normalizedCode === 'daily_limit' ||
    normalizedCode === 'insufficient_quota'
  ) {
    return {
      title: dicts.statusText?.daily_limit || 'Daily limit reached',
      description:
        dicts.notification?.dailyLimitDesc ||
        'You have reached your daily usage limit.',
    }
  }

  if (normalizedCode === 'frequency_limit') {
    return {
      title: dicts.statusText?.frequency_limit || 'Take a break ☕️',
      description: 'Too many requests. Please wait a moment.',
    }
  }

  if (normalizedCode === 'backpressured') {
    return {
      title: dicts.notification?.rateLimitedTitle || 'System Busy',
      description: 'High demand right now. Please try again in a few moments.',
    }
  }

  if (
    normalizedCode ===
    'service temporarily unavailable: please try again later.'
  ) {
    return {
      title:
        dicts.statusText?.['service_unavailable'] ||
        'Service Temporarily Unavailable',
      description:
        dicts.statusText?.['service_unavailable_desc'] ||
        'Please try again later.',
    }
  }

  if (normalizedCode === 'resume_required') {
    return {
      title: dicts.statusText?.resume_required || 'Resume Required',
      description: 'Please upload a resume before proceeding.',
    }
  }

  if (normalizedCode === 'job_text_too_long') {
    return {
      title: dicts.statusText?.job_text_too_long || 'Job Description Too Long',
      description: 'Please shorten the job description and try again.',
    }
  }

  if (normalizedCode === 'invalid_file_type') {
    return {
      title: 'Invalid File Type',
      description: 'Please upload a supported file format.',
    }
  }

  if (normalizedCode === 'file_too_large') {
    return {
      title: 'File Too Large',
      description: 'Please upload a smaller file.',
    }
  }

  if (normalizedCode === 'retry_available') {
    return {
      title: dicts.notification?.serverErrorTitle || 'Service Temporarily Unavailable',
      description:
        dicts.notification?.serverErrorDesc || 'Please try again later.',
    }
  }

  // === All Other Errors: Generic Fallback (SECURE - no information leakage) ===
  // This includes: json_parse_failed, model_timeout, db_connection_failed,
  // ocr_extracted_text_empty, validation_error, unknown_error, etc.

  return {
    title:
      dicts.notification?.serverErrorTitle || 'Service Temporarily Unavailable',
    description:
      dicts.notification?.serverErrorDesc || 'Please try again later.',
  }
}

/**
 * Checks if an error code is in the public whitelist.
 * Useful for conditional UI rendering (e.g., show retry button).
 */
export function isRetryableError(errorCode: string): boolean {
  const normalizedCode = (errorCode || '').toLowerCase().trim()
  return [
    'rate_limited',
    'frequency_limit',
    'backpressured',
  ].includes(normalizedCode)
}
