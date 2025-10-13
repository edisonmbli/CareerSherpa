/**
 * Security Middleware
 * Request validation, rate limiting, and security checks
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rateLimiter'
import { SECURITY_CONFIG } from './config'
import { createSecurityAuditLog, generateRateLimitKey } from './validation'
import { logError, logInfo } from '@/lib/logger'

// Edge Runtime compatible UUID generation
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

export interface SecurityContext {
  userKey: string
  ipAddress: string
  userAgent: string
  route: string
  method: string
  reqId: string
}

/**
 * Extract security context from request
 */
export function extractSecurityContext(req: NextRequest): SecurityContext {
  const userKey = req.headers.get('x-user-key') || 'anonymous'
  const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
  const userAgent = req.headers.get('user-agent') || 'unknown'
  const route = req.nextUrl.pathname
  const method = req.method
  const reqId = generateUUID()

  return {
    userKey,
    ipAddress,
    userAgent,
    route,
    method,
    reqId
  }
}

/**
 * Validate request headers for security
 */
export function validateRequestHeaders(req: NextRequest): { valid: boolean; error?: string } {
  const headers = req.headers

  // Check for required security headers in production
  if (process.env.NODE_ENV === 'production') {
    const requiredHeaders = ['user-agent', 'accept']
    
    for (const header of requiredHeaders) {
      if (!headers.get(header)) {
        return { valid: false, error: `Missing required header: ${header}` }
      }
    }
  }

  // Check for suspicious headers
  const suspiciousHeaders = [
    'x-forwarded-host',
    'x-original-url',
    'x-rewrite-url'
  ]

  for (const header of suspiciousHeaders) {
    const value = headers.get(header)
    if (value && value.includes('..')) {
      return { valid: false, error: `Suspicious header value detected: ${header}` }
    }
  }

  // Validate Content-Type for POST requests
  if (req.method === 'POST') {
    const contentType = headers.get('content-type')
    if (!contentType) {
      return { valid: false, error: 'Missing Content-Type header for POST request' }
    }

    // Allow specific content types
    const allowedContentTypes = [
      'application/json',
      'multipart/form-data',
      'application/x-www-form-urlencoded'
    ]

    const isAllowed = allowedContentTypes.some(type => contentType.includes(type))
    if (!isAllowed) {
      return { valid: false, error: `Unsupported Content-Type: ${contentType}` }
    }
  }

  return { valid: true }
}

/**
 * Apply rate limiting based on route and user
 */
export async function applyRateLimit(context: SecurityContext): Promise<{ allowed: boolean; error?: string }> {
  const { userKey, route, method, reqId } = context

  try {
    const rateLimit = await checkRateLimit(route, userKey, false)

    if (!rateLimit.ok) {
      // Log rate limit violation
      const auditLog = createSecurityAuditLog(
        userKey,
        'rate_limit_exceeded',
        false,
        { route, method, retryAfter: rateLimit.retryAfter }
      )
      
      logError({
        reqId,
        route,
        userKey,
        phase: 'rate_limit',
        error: 'Rate limit exceeded',
        auditLog
      })

      return { 
        allowed: false, 
        error: `Rate limit exceeded. Try again in ${rateLimit.retryAfter || 300} seconds.` 
      }
    }

    return { allowed: true }
  } catch (error) {
    logError({
      reqId,
      route,
      userKey,
      phase: 'rate_limit_check',
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    // Allow request if rate limiting fails (fail open)
    return { allowed: true }
  }
}

/**
 * Validate user authentication and authorization
 */
export function validateUserAuth(context: SecurityContext): { authorized: boolean; error?: string } {
  const { userKey, route, reqId } = context

  if (!SECURITY_CONFIG.AUTH.REQUIRE_USER_KEY) {
    return { authorized: true }
  }

  // Check if user key is provided
  if (!userKey || userKey === 'anonymous') {
    return { 
      authorized: false, 
      error: 'Authentication required. Please provide a valid user key.' 
    }
  }

  // Validate user key format (basic validation)
  if (userKey.length < 3 || userKey.length > 100) {
    return { 
      authorized: false, 
      error: 'Invalid user key format.' 
    }
  }

  // Check for suspicious user key patterns
  const suspiciousPatterns = [
    /[<>'"&]/,
    /javascript:/i,
    /\bscript\b/i,
    /\beval\b/i
  ]

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(userKey)) {
      const auditLog = createSecurityAuditLog(
        userKey,
        'suspicious_user_key',
        false,
        { route, pattern: pattern.toString() }
      )

      logError({
        reqId,
        route,
        userKey,
        phase: 'auth_validation',
        error: 'Suspicious user key detected',
        auditLog
      })

      return { 
        authorized: false, 
        error: 'Invalid user key format.' 
      }
    }
  }

  return { authorized: true }
}

/**
 * Security middleware for API routes
 */
export async function securityMiddleware(req: NextRequest): Promise<NextResponse | null> {
  const context = extractSecurityContext(req)

  try {
    // 1. Validate request headers
    const headerValidation = validateRequestHeaders(req)
    if (!headerValidation.valid) {
      const auditLog = createSecurityAuditLog(
        context.userKey,
        'invalid_headers',
        false,
        { error: headerValidation.error }
      )

      logError({
        reqId: context.reqId,
        route: context.route,
        userKey: context.userKey,
        phase: 'header_validation',
        error: headerValidation.error,
        auditLog
      })

      return NextResponse.json(
        { error: 'Invalid request headers', code: 'INVALID_HEADERS' },
        { status: 400 }
      )
    }

    // 2. Apply rate limiting
    const rateLimitResult = await applyRateLimit(context)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: rateLimitResult.error, code: 'RATE_LIMIT_EXCEEDED' },
        { status: 429 }
      )
    }

    // 3. Validate user authentication
    const authResult = validateUserAuth(context)
    if (!authResult.authorized) {
      const auditLog = createSecurityAuditLog(
        context.userKey,
        'unauthorized_access',
        false,
        { error: authResult.error }
      )

      logError({
        reqId: context.reqId,
        route: context.route,
        userKey: context.userKey,
        phase: 'auth_validation',
        error: authResult.error,
        auditLog
      })

      return NextResponse.json(
        { error: authResult.error, code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    // Log successful security validation
    logInfo({
      reqId: context.reqId,
      route: context.route,
      userKey: context.userKey,
      phase: 'security_validation',
      message: 'Request passed security checks'
    })

    return null // Continue to next middleware/handler
  } catch (error) {
    const auditLog = createSecurityAuditLog(
      context.userKey,
      'security_middleware_error',
      false,
      { error: error instanceof Error ? error.message : 'Unknown error' }
    )

    logError({
      reqId: context.reqId,
      route: context.route,
      userKey: context.userKey,
      phase: 'security_middleware',
      error: error instanceof Error ? error.message : 'Unknown error',
      auditLog
    })

    // Fail open - allow request to continue
    return null
  }
}

/**
 * CSRF protection for Server Actions
 */
export function validateCSRFToken(formData: FormData, expectedOrigin?: string): boolean {
  // Server Actions in Next.js have built-in CSRF protection
  // This is an additional layer for extra security
  
  const token = formData.get('csrf_token') as string
  const origin = formData.get('origin') as string

  // If no token is provided, rely on Next.js built-in protection
  if (!token) {
    return true
  }

  // Validate origin if provided
  if (expectedOrigin && origin !== expectedOrigin) {
    return false
  }

  // Basic token validation (in production, use proper CSRF token validation)
  return token.length > 10 && /^[a-zA-Z0-9]+$/.test(token)
}

/**
 * Content Security Policy headers
 */
export function getCSPHeaders(): Record<string, string> {
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Note: unsafe-* should be removed in production
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ].join('; ')

  return {
    'Content-Security-Policy': csp,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
  }
}