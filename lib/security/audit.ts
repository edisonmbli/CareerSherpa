/**
 * Security Audit System
 * Comprehensive logging and monitoring of security events
 */

import { logInfo, logError } from '@/lib/logger'

// Edge Runtime compatible UUID generation
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

export interface SecurityEvent {
  id: string
  timestamp: string
  userKey: string
  ipAddress?: string
  userAgent?: string
  eventType: SecurityEventType
  severity: SecuritySeverity
  success: boolean
  details: Record<string, unknown>
  route?: string
  method?: string
  reqId?: string
}

export type SecurityEventType = 
  | 'authentication_attempt'
  | 'authorization_check'
  | 'rate_limit_exceeded'
  | 'suspicious_activity'
  | 'file_upload'
  | 'input_validation_failed'
  | 'csrf_token_invalid'
  | 'malicious_content_detected'
  | 'data_access'
  | 'configuration_change'
  | 'security_scan'
  | 'error_occurred'

export type SecuritySeverity = 'low' | 'medium' | 'high' | 'critical'

/**
 * Create a security audit event
 */
export function createSecurityEvent(
  userKey: string,
  eventType: SecurityEventType,
  success: boolean,
  details: Record<string, unknown> = {},
  severity: SecuritySeverity = 'medium',
  context?: {
    ipAddress?: string
    userAgent?: string
    route?: string
    method?: string
    reqId?: string
  }
): SecurityEvent {
  return {
    id: generateUUID(),
    timestamp: new Date().toISOString(),
    userKey,
    eventType,
    severity,
    success,
    details,
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
    route: context?.route,
    method: context?.method,
    reqId: context?.reqId
  }
}

/**
 * Log security event
 */
export function logSecurityEvent(event: SecurityEvent): void {
  const logData = {
    reqId: event.reqId || generateUUID(),
    route: event.route || 'unknown',
    userKey: event.userKey,
    phase: 'security_audit',
    securityEvent: {
      id: event.id,
      type: event.eventType,
      severity: event.severity,
      success: event.success,
      timestamp: event.timestamp,
      details: event.details,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      method: event.method
    }
  }

  if (event.success) {
    logInfo(logData)
  } else {
    logError({
      ...logData,
      error: `Security event failed: ${event.eventType}`
    })
  }
}

/**
 * Audit authentication attempts
 */
export function auditAuthenticationAttempt(
  userKey: string,
  success: boolean,
  context: {
    ipAddress?: string
    userAgent?: string
    route?: string
    method?: string
    reqId?: string
    reason?: string
  }
): void {
  const event = createSecurityEvent(
    userKey,
    'authentication_attempt',
    success,
    {
      reason: context.reason,
      timestamp: new Date().toISOString()
    },
    success ? 'low' : 'medium',
    context
  )

  logSecurityEvent(event)
}

/**
 * Audit authorization checks
 */
export function auditAuthorizationCheck(
  userKey: string,
  resource: string,
  action: string,
  success: boolean,
  context: {
    ipAddress?: string
    userAgent?: string
    route?: string
    method?: string
    reqId?: string
    reason?: string
  }
): void {
  const event = createSecurityEvent(
    userKey,
    'authorization_check',
    success,
    {
      resource,
      action,
      reason: context.reason,
      timestamp: new Date().toISOString()
    },
    success ? 'low' : 'high',
    context
  )

  logSecurityEvent(event)
}

/**
 * Audit rate limiting events
 */
export function auditRateLimitEvent(
  userKey: string,
  exceeded: boolean,
  context: {
    ipAddress?: string
    userAgent?: string
    route?: string
    method?: string
    reqId?: string
    limit?: number
    current?: number
    windowMs?: number
  }
): void {
  const event = createSecurityEvent(
    userKey,
    'rate_limit_exceeded',
    !exceeded,
    {
      limit: context.limit,
      current: context.current,
      windowMs: context.windowMs,
      timestamp: new Date().toISOString()
    },
    exceeded ? 'medium' : 'low',
    context
  )

  logSecurityEvent(event)
}

/**
 * Audit suspicious activity
 */
export function auditSuspiciousActivity(
  userKey: string,
  activityType: string,
  details: Record<string, unknown>,
  context: {
    ipAddress?: string
    userAgent?: string
    route?: string
    method?: string
    reqId?: string
  }
): void {
  const event = createSecurityEvent(
    userKey,
    'suspicious_activity',
    false,
    {
      activityType,
      ...details,
      timestamp: new Date().toISOString()
    },
    'high',
    context
  )

  logSecurityEvent(event)
}

/**
 * Audit file upload events
 */
export function auditFileUpload(
  userKey: string,
  filename: string,
  fileSize: number,
  mimeType: string,
  success: boolean,
  context: {
    ipAddress?: string
    userAgent?: string
    route?: string
    method?: string
    reqId?: string
    reason?: string
    scanResult?: string
  }
): void {
  const event = createSecurityEvent(
    userKey,
    'file_upload',
    success,
    {
      filename,
      fileSize,
      mimeType,
      reason: context.reason,
      scanResult: context.scanResult,
      timestamp: new Date().toISOString()
    },
    success ? 'low' : 'medium',
    context
  )

  logSecurityEvent(event)
}

/**
 * Audit input validation failures
 */
export function auditInputValidationFailure(
  userKey: string,
  inputType: string,
  validationError: string,
  context: {
    ipAddress?: string
    userAgent?: string
    route?: string
    method?: string
    reqId?: string
    inputLength?: number
  }
): void {
  const event = createSecurityEvent(
    userKey,
    'input_validation_failed',
    false,
    {
      inputType,
      validationError,
      inputLength: context.inputLength,
      timestamp: new Date().toISOString()
    },
    'medium',
    context
  )

  logSecurityEvent(event)
}

/**
 * Audit data access events
 */
export function auditDataAccess(
  userKey: string,
  dataType: string,
  operation: string,
  success: boolean,
  context: {
    ipAddress?: string
    userAgent?: string
    route?: string
    method?: string
    reqId?: string
    recordId?: string
    reason?: string
  }
): void {
  const event = createSecurityEvent(
    userKey,
    'data_access',
    success,
    {
      dataType,
      operation,
      recordId: context.recordId,
      reason: context.reason,
      timestamp: new Date().toISOString()
    },
    success ? 'low' : 'high',
    context
  )

  logSecurityEvent(event)
}

/**
 * Audit malicious content detection
 */
export function auditMaliciousContentDetection(
  userKey: string,
  contentType: string,
  threatType: string,
  blocked: boolean,
  context: {
    ipAddress?: string
    userAgent?: string
    route?: string
    method?: string
    reqId?: string
    contentLength?: number
    scanEngine?: string
  }
): void {
  const event = createSecurityEvent(
    userKey,
    'malicious_content_detected',
    blocked,
    {
      contentType,
      threatType,
      contentLength: context.contentLength,
      scanEngine: context.scanEngine,
      timestamp: new Date().toISOString()
    },
    'high',
    context
  )

  logSecurityEvent(event)
}

/**
 * Audit security configuration changes
 */
export function auditConfigurationChange(
  userKey: string,
  configType: string,
  oldValue: unknown,
  newValue: unknown,
  context: {
    ipAddress?: string
    userAgent?: string
    route?: string
    method?: string
    reqId?: string
  }
): void {
  const event = createSecurityEvent(
    userKey,
    'configuration_change',
    true,
    {
      configType,
      oldValue,
      newValue,
      timestamp: new Date().toISOString()
    },
    'medium',
    context
  )

  logSecurityEvent(event)
}

/**
 * Get security event summary for monitoring
 */
export function getSecurityEventSummary(events: SecurityEvent[]): {
  total: number
  byType: Record<SecurityEventType, number>
  bySeverity: Record<SecuritySeverity, number>
  successRate: number
  recentFailures: SecurityEvent[]
} {
  const summary = {
    total: events.length,
    byType: {} as Record<SecurityEventType, number>,
    bySeverity: {} as Record<SecuritySeverity, number>,
    successRate: 0,
    recentFailures: [] as SecurityEvent[]
  }

  if (events.length === 0) {
    return summary
  }

  let successCount = 0

  for (const event of events) {
    // Count by type
    summary.byType[event.eventType] = (summary.byType[event.eventType] || 0) + 1

    // Count by severity
    summary.bySeverity[event.severity] = (summary.bySeverity[event.severity] || 0) + 1

    // Count successes
    if (event.success) {
      successCount++
    } else {
      // Collect recent failures (last 24 hours)
      const eventTime = new Date(event.timestamp)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      
      if (eventTime > oneDayAgo) {
        summary.recentFailures.push(event)
      }
    }
  }

  summary.successRate = (successCount / events.length) * 100
  summary.recentFailures.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  return summary
}

/**
 * Check for security anomalies
 */
export function detectSecurityAnomalies(events: SecurityEvent[]): {
  anomalies: Array<{
    type: string
    severity: SecuritySeverity
    description: string
    count: number
    timeframe: string
  }>
  riskScore: number
} {
  const anomalies: Array<{
    type: string
    severity: SecuritySeverity
    description: string
    count: number
    timeframe: string
  }> = []

  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
  const recentEvents = events.filter(e => new Date(e.timestamp) > oneHourAgo)

  // Check for excessive failed authentication attempts
  const failedAuth = recentEvents.filter(e => 
    e.eventType === 'authentication_attempt' && !e.success
  )
  
  if (failedAuth.length > 10) {
    anomalies.push({
      type: 'excessive_failed_auth',
      severity: 'high',
      description: `${failedAuth.length} failed authentication attempts in the last hour`,
      count: failedAuth.length,
      timeframe: '1 hour'
    })
  }

  // Check for rate limit violations
  const rateLimitViolations = recentEvents.filter(e => 
    e.eventType === 'rate_limit_exceeded'
  )
  
  if (rateLimitViolations.length > 5) {
    anomalies.push({
      type: 'excessive_rate_limits',
      severity: 'medium',
      description: `${rateLimitViolations.length} rate limit violations in the last hour`,
      count: rateLimitViolations.length,
      timeframe: '1 hour'
    })
  }

  // Check for suspicious activity
  const suspiciousActivity = recentEvents.filter(e => 
    e.eventType === 'suspicious_activity'
  )
  
  if (suspiciousActivity.length > 0) {
    anomalies.push({
      type: 'suspicious_activity_detected',
      severity: 'critical',
      description: `${suspiciousActivity.length} suspicious activities detected in the last hour`,
      count: suspiciousActivity.length,
      timeframe: '1 hour'
    })
  }

  // Calculate risk score (0-100)
  let riskScore = 0
  
  for (const anomaly of anomalies) {
    switch (anomaly.severity) {
      case 'low':
        riskScore += 10
        break
      case 'medium':
        riskScore += 25
        break
      case 'high':
        riskScore += 50
        break
      case 'critical':
        riskScore += 75
        break
    }
  }

  riskScore = Math.min(riskScore, 100)

  return { anomalies, riskScore }
}