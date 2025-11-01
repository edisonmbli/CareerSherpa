'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorDisplay, SimpleErrorDisplay } from '@/components/ui/error-display'
import { Badge } from '@/components/ui/badge'
import { type ErrorSeverity } from '@/lib/errors/error-mapping'

interface DemoError {
  title: string
  message: string
  suggestion?: string
  severity: ErrorSeverity
  retryable: boolean
  retryAfter?: number
  contactSupport: boolean
  details?: any
}

const demoErrors: Record<string, DemoError> = {
  unauthorized: {
    title: 'Authentication Required',
    message: 'Please sign in to access this feature.',
    suggestion: 'Click the sign-in button to authenticate your account.',
    severity: 'warning',
    retryable: false,
    contactSupport: false
  },
  quota_exceeded: {
    title: 'Usage Limit Reached',
    message: 'You have reached your monthly usage limit.',
    suggestion: 'Upgrade your plan or wait until next month for your quota to reset.',
    severity: 'warning',
    retryable: false,
    contactSupport: true
  },
  rate_limited: {
    title: 'Too Many Requests',
    message: 'You are making requests too quickly.',
    suggestion: 'Please wait a moment before trying again.',
    severity: 'info',
    retryable: true,
    retryAfter: 30,
    contactSupport: false
  },
  network_error: {
    title: 'Network Connection Error',
    message: 'Unable to connect to our servers.',
    suggestion: 'Check your internet connection and try again.',
    severity: 'error',
    retryable: true,
    retryAfter: 5,
    contactSupport: false
  },
  internal_error: {
    title: 'Internal Server Error',
    message: 'An unexpected error occurred on our end.',
    suggestion: 'Our team has been notified. Please try again later.',
    severity: 'critical',
    retryable: true,
    retryAfter: 10,
    contactSupport: true,
    details: {
      errorId: 'ERR-2024-001',
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    }
  }
}

export default function ErrorDemoPage() {
  const [selectedError, setSelectedError] = useState<string | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  const handleRetry = () => {
    console.log('重试操作...')
    setSelectedError(null)
  }

  const handleContactSupport = () => {
    console.log('联系客服...')
    // 这里可以集成实际的客服系统
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold">错误处理系统演示</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          这个页面展示了我们的错误处理系统如何为用户提供友好的错误信息和恢复建议。
          点击下面的按钮来模拟不同类型的错误。
        </p>
      </div>

      {/* 错误触发按钮 */}
      <Card>
        <CardHeader>
          <CardTitle>模拟错误场景</CardTitle>
          <CardDescription>
            点击下面的按钮来触发不同严重级别的错误
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(demoErrors).map(([errorCode, error]) => (
              <Button
                key={errorCode}
                variant="outline"
                className="h-auto p-4 flex flex-col items-start space-y-2"
                onClick={() => setSelectedError(errorCode)}
              >
                <div className="flex items-center space-x-2">
                  <Badge 
                    variant={
                      error.severity === 'critical' ? 'destructive' :
                      error.severity === 'error' ? 'destructive' :
                      error.severity === 'warning' ? 'default' : 'secondary'
                    }
                  >
                    {error.severity}
                  </Badge>
                  <span className="font-medium">{error.title}</span>
                </div>
                <p className="text-sm text-muted-foreground text-left">
                  {error.message}
                </p>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 错误显示区域 */}
      {selectedError && (
        <Card>
          <CardHeader>
            <CardTitle>错误显示组件</CardTitle>
            <CardDescription>
              当前显示的错误: {selectedError}
            </CardDescription>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
              >
                {showDetails ? '隐藏' : '显示'}详细信息
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedError(null)}
              >
                清除错误
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ErrorDisplay
              title={demoErrors[selectedError]!.title}
              message={demoErrors[selectedError]!.message}
              suggestion={demoErrors[selectedError]!.suggestion}
              severity={demoErrors[selectedError]!.severity}
              retryable={demoErrors[selectedError]!.retryable}
              retryAfter={demoErrors[selectedError]!.retryAfter}
              contactSupport={demoErrors[selectedError]!.contactSupport}
              details={showDetails ? demoErrors[selectedError]!.details : undefined}
              onRetry={handleRetry}
              onContactSupport={handleContactSupport}
            />
          </CardContent>
        </Card>
      )}

      {/* 简化错误显示示例 */}
      <Card>
        <CardHeader>
          <CardTitle>简化错误显示组件</CardTitle>
          <CardDescription>
            用于简单场景的轻量级错误显示
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SimpleErrorDisplay
            error={{
              title: "简单错误示例",
              message: "这是一个简化的错误显示组件，适用于不需要复杂交互的场景。",
              severity: "info",
              retryable: false,
              contactSupport: false
            }}
          />
          
          <SimpleErrorDisplay
            error={{
              title: "警告示例",
              message: "这是一个警告级别的错误，通常用于提醒用户注意某些问题。",
              severity: "warning",
              retryable: false,
              contactSupport: false
            }}
          />
          
          <SimpleErrorDisplay
            error={{
              title: "严重错误示例",
              message: "这是一个严重错误，需要用户立即关注和处理。",
              severity: "critical",
              retryable: true,
              contactSupport: true
            }}
          />
        </CardContent>
      </Card>

      {/* 使用指南 */}
      <Card>
        <CardHeader>
          <CardTitle>使用指南</CardTitle>
          <CardDescription>
            如何在你的应用中集成错误处理系统
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="prose prose-sm max-w-none">
            <h3>1. 在 Server Actions 中使用</h3>
            <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
              <code>{`import { errorHandler } from '@/lib/errors/error-handler'

export async function myServerAction() {
  try {
    // 你的业务逻辑
    const result = await someOperation()
    return { success: true, data: result }
  } catch (error) {
    // 使用错误处理器
    return errorHandler.handleError(error, 'operation_failed', {
      userId: 'user-123',
      action: 'my-server-action'
    })
  }
}`}</code>
            </pre>

            <h3>2. 在客户端组件中显示错误</h3>
            <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
              <code>{`'use client'
import { ErrorDisplay } from '@/components/ui/error-display'

export function MyComponent() {
  const [error, setError] = useState(null)
  
  const handleAction = async () => {
    const result = await myServerAction()
    if (!result.success) {
      setError(result.error)
    }
  }
  
  return (
    <div>
      {error && (
        <ErrorDisplay
          title={error.title}
          message={error.message}
          severity={error.severity}
          retryable={error.retryable}
          onRetry={() => {
            setError(null)
            handleAction()
          }}
        />
      )}
    </div>
  )
}`}</code>
            </pre>

            <h3>3. 错误严重级别</h3>
            <ul>
              <li><Badge variant="secondary">info</Badge> - 信息性消息，不影响功能</li>
              <li><Badge variant="default">warning</Badge> - 警告，可能影响用户体验</li>
              <li><Badge variant="destructive">error</Badge> - 错误，影响功能但可恢复</li>
              <li><Badge variant="destructive">critical</Badge> - 严重错误，需要立即处理</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}