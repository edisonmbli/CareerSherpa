'use client'

import React, { useState, useEffect } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  AlertTriangle, 
  XCircle, 
  Info, 
  CheckCircle, 
  RefreshCw, 
  Mail, 
  Clock,
  AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UserFriendlyError, ErrorSeverity } from '@/lib/errors/error-mapping'

export interface ErrorDisplayProps {
  title: string
  message: string
  suggestion?: string | undefined
  severity: ErrorSeverity
  retryable: boolean
  retryAfter?: number | undefined
  contactSupport: boolean
  onRetry?: () => void
  onContactSupport?: () => void
  onDismiss?: () => void
  className?: string
  showDetails?: boolean
  details?: {
    code?: string
    originalError?: string
    context?: Record<string, any>
  } | undefined
}

const severityConfig = {
  info: {
    icon: Info,
    variant: 'default' as const,
    badgeVariant: 'secondary' as const,
    iconColor: 'text-blue-500',
    title: 'Information'
  },
  warning: {
    icon: AlertTriangle,
    variant: 'default' as const,
    badgeVariant: 'outline' as const,
    iconColor: 'text-yellow-500',
    title: 'Warning'
  },
  error: {
    icon: AlertCircle,
    variant: 'destructive' as const,
    badgeVariant: 'destructive' as const,
    iconColor: 'text-red-500',
    title: 'Error'
  },
  critical: {
    icon: XCircle,
    variant: 'destructive' as const,
    badgeVariant: 'destructive' as const,
    iconColor: 'text-red-600',
    title: 'Critical Error'
  }
}

export function ErrorDisplay({
  title,
  message,
  suggestion,
  severity,
  retryable,
  retryAfter,
  contactSupport,
  onRetry,
  onContactSupport,
  onDismiss,
  className,
  showDetails = false,
  details
}: ErrorDisplayProps) {
  const [retryCountdown, setRetryCountdown] = React.useState(retryAfter || 0)
  const [isRetrying, setIsRetrying] = React.useState(false)
  const [showDetailsExpanded, setShowDetailsExpanded] = React.useState(false)

  const config = severityConfig[severity]
  const Icon = config.icon

  // 倒计时逻辑
  React.useEffect(() => {
    if (retryCountdown > 0) {
      const timer = setTimeout(() => {
        setRetryCountdown(prev => prev - 1)
      }, 1000)
      return () => clearTimeout(timer)
    }
    // 当 retryCountdown <= 0 时，返回 undefined（可选的清理函数）
    return undefined
  }, [retryCountdown])

  const handleRetry = async () => {
    if (!onRetry || isRetrying || retryCountdown > 0) return
    
    setIsRetrying(true)
    try {
      await onRetry()
    } finally {
      setIsRetrying(false)
    }
  }

  const handleContactSupport = () => {
    if (onContactSupport) {
      onContactSupport()
    } else {
      // 默认行为：打开邮件客户端
      const subject = encodeURIComponent(`Support Request: ${title}`)
      const body = encodeURIComponent(
        `Error Details:\n\n` +
        `Title: ${title}\n` +
        `Message: ${message}\n` +
        `Code: ${details?.code || 'Unknown'}\n` +
        `Time: ${new Date().toISOString()}\n\n` +
        `Please describe what you were doing when this error occurred:\n\n`
      )
      window.open(`mailto:support@careershaper.com?subject=${subject}&body=${body}`)
    }
  }

  return (
    <Alert variant={config.variant} className={cn('relative', className)}>
      <div className="flex items-start gap-3">
        <Icon className={cn('h-5 w-5 mt-0.5 flex-shrink-0', config.iconColor)} />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <AlertTitle className="text-sm font-medium">{title}</AlertTitle>
            <Badge variant={config.badgeVariant} className="text-xs">
              {config.title}
            </Badge>
          </div>
          
          <AlertDescription className="text-sm text-muted-foreground mb-3">
            {message}
          </AlertDescription>
          
          {suggestion && (
            <div className="mb-3 p-2 bg-muted/50 rounded-md">
              <p className="text-xs text-muted-foreground">
                <strong>建议：</strong> {suggestion}
              </p>
            </div>
          )}
          
          {/* 操作按钮 */}
          <div className="flex flex-wrap gap-2">
            {retryable && onRetry && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleRetry}
                disabled={isRetrying || retryCountdown > 0}
                className="h-8"
              >
                <RefreshCw className={cn(
                  'h-3 w-3 mr-1',
                  isRetrying && 'animate-spin'
                )} />
                {retryCountdown > 0 
                  ? `重试 (${retryCountdown}s)` 
                  : isRetrying 
                    ? '重试中...' 
                    : '重试'
                }
              </Button>
            )}
            
            {contactSupport && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleContactSupport}
                className="h-8"
              >
                <Mail className="h-3 w-3 mr-1" />
                联系支持
              </Button>
            )}
            
            {onDismiss && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onDismiss}
                className="h-8"
              >
                关闭
              </Button>
            )}
            
            {showDetails && details && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowDetailsExpanded(!showDetailsExpanded)}
                className="h-8"
              >
                {showDetailsExpanded ? '隐藏详情' : '显示详情'}
              </Button>
            )}
          </div>
          
          {/* 详细信息展开 */}
          {showDetailsExpanded && details && (
            <div className="mt-3 p-3 bg-muted/30 rounded-md border">
              <h4 className="text-xs font-medium mb-2">错误详情</h4>
              <div className="space-y-1 text-xs text-muted-foreground font-mono">
                {details.code && (
                  <div>
                    <span className="font-medium">错误代码:</span> {details.code}
                  </div>
                )}
                {details.originalError && (
                  <div>
                    <span className="font-medium">原始错误:</span> {details.originalError}
                  </div>
                )}
                {details.context && (
                  <div>
                    <span className="font-medium">上下文:</span>
                    <pre className="mt-1 text-xs overflow-x-auto">
                      {JSON.stringify(details.context, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Alert>
  )
}

// 便捷组件：简化的错误显示
export function SimpleErrorDisplay({
  error,
  onRetry,
  onDismiss,
  className
}: {
  error: {
    title: string
    message: string
    suggestion?: string
    severity: ErrorSeverity
    retryable: boolean
    retryAfter?: number
    contactSupport: boolean
    code?: string
  }
  onRetry?: () => void
  onDismiss?: () => void
  className?: string
}) {
  return (
    <ErrorDisplay
      title={error.title}
      message={error.message}
      suggestion={error.suggestion}
      severity={error.severity}
      retryable={error.retryable}
      retryAfter={error.retryAfter}
      contactSupport={error.contactSupport}
      {...(onRetry && { onRetry })}
      {...(onDismiss && { onDismiss })}
      {...(className && { className })}
      showDetails={!!error.code}
      details={error.code ? { code: error.code } : undefined}
    />
  )
}

// Toast 错误显示
export function ErrorToast({
  error,
  onRetry
}: {
  error: {
    title: string
    message: string
    severity: ErrorSeverity
    retryable: boolean
  }
  onRetry?: () => void
}) {
  const config = severityConfig[error.severity]
  const Icon = config.icon

  return (
    <div className="flex items-start gap-3 p-4">
      <Icon className={cn('h-4 w-4 mt-0.5 flex-shrink-0', config.iconColor)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{error.title}</p>
        <p className="text-xs text-muted-foreground mt-1">{error.message}</p>
        {error.retryable && onRetry && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onRetry}
            className="h-6 px-2 mt-2"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            重试
          </Button>
        )}
      </div>
    </div>
  )
}