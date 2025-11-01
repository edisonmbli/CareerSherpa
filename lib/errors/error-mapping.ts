/**
 * 错误映射系统 - 将系统错误代码转换为用户友好的消息
 * 支持多语言和不同的错误严重级别
 */

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical'
export type SupportedLocale = 'en' | 'zh'

export interface UserFriendlyError {
  title: string
  message: string
  suggestion?: string
  severity: ErrorSeverity
  actionable: boolean
  retryable: boolean
  contactSupport: boolean
}

export interface ErrorMappingEntry {
  en: UserFriendlyError
  zh: UserFriendlyError
}

/**
 * 错误代码到用户友好消息的映射表
 */
export const ERROR_MAPPINGS: Record<string, ErrorMappingEntry> = {
  // 认证相关错误
  unauthorized: {
    en: {
      title: 'Authentication Required',
      message: 'Please sign in to access this feature.',
      suggestion: 'Click the sign-in button to authenticate your account.',
      severity: 'warning',
      actionable: true,
      retryable: false,
      contactSupport: false
    },
    zh: {
      title: '需要身份验证',
      message: '请登录以访问此功能。',
      suggestion: '点击登录按钮验证您的账户。',
      severity: 'warning',
      actionable: true,
      retryable: false,
      contactSupport: false
    }
  },

  forbidden: {
    en: {
      title: 'Access Denied',
      message: 'You do not have permission to perform this action.',
      suggestion: 'Contact your administrator if you believe this is an error.',
      severity: 'error',
      actionable: false,
      retryable: false,
      contactSupport: true
    },
    zh: {
      title: '访问被拒绝',
      message: '您没有执行此操作的权限。',
      suggestion: '如果您认为这是错误，请联系管理员。',
      severity: 'error',
      actionable: false,
      retryable: false,
      contactSupport: true
    }
  },

  // 配额相关错误
  quota_exceeded: {
    en: {
      title: 'Usage Limit Reached',
      message: 'You have reached your monthly usage limit.',
      suggestion: 'Upgrade your plan or wait until next month for more credits.',
      severity: 'warning',
      actionable: true,
      retryable: false,
      contactSupport: false
    },
    zh: {
      title: '使用限额已达上限',
      message: '您已达到本月的使用限额。',
      suggestion: '升级您的套餐或等到下个月获得更多积分。',
      severity: 'warning',
      actionable: true,
      retryable: false,
      contactSupport: false
    }
  },

  rate_limited: {
    en: {
      title: 'Too Many Requests',
      message: 'You are making requests too quickly.',
      suggestion: 'Please wait a moment and try again.',
      severity: 'info',
      actionable: true,
      retryable: true,
      contactSupport: false
    },
    zh: {
      title: '请求过于频繁',
      message: '您的请求速度过快。',
      suggestion: '请稍等片刻后重试。',
      severity: 'info',
      actionable: true,
      retryable: true,
      contactSupport: false
    }
  },

  too_many_pending_services: {
    en: {
      title: 'Too Many Active Jobs',
      message: 'You have too many jobs running simultaneously.',
      suggestion: 'Wait for some jobs to complete before starting new ones.',
      severity: 'warning',
      actionable: true,
      retryable: true,
      contactSupport: false
    },
    zh: {
      title: '活跃任务过多',
      message: '您同时运行的任务过多。',
      suggestion: '等待一些任务完成后再开始新任务。',
      severity: 'warning',
      actionable: true,
      retryable: true,
      contactSupport: false
    }
  },

  // 数据验证错误
  missing_fields: {
    en: {
      title: 'Missing Information',
      message: 'Some required fields are missing.',
      suggestion: 'Please fill in all required fields and try again.',
      severity: 'warning',
      actionable: true,
      retryable: true,
      contactSupport: false
    },
    zh: {
      title: '信息缺失',
      message: '缺少一些必填字段。',
      suggestion: '请填写所有必填字段后重试。',
      severity: 'warning',
      actionable: true,
      retryable: true,
      contactSupport: false
    }
  },

  invalid_resume_or_job: {
    en: {
      title: 'Invalid File Format',
      message: 'The uploaded resume or job description format is not supported.',
      suggestion: 'Please upload a PDF, DOC, or TXT file and try again.',
      severity: 'warning',
      actionable: true,
      retryable: true,
      contactSupport: false
    },
    zh: {
      title: '文件格式无效',
      message: '上传的简历或职位描述格式不受支持。',
      suggestion: '请上传PDF、DOC或TXT文件后重试。',
      severity: 'warning',
      actionable: true,
      retryable: true,
      contactSupport: false
    }
  },

  language_inconsistent: {
    en: {
      title: 'Language Mismatch',
      message: 'The language of your resume and job description do not match.',
      suggestion: 'Please ensure both documents are in the same language.',
      severity: 'warning',
      actionable: true,
      retryable: true,
      contactSupport: false
    },
    zh: {
      title: '语言不匹配',
      message: '您的简历和职位描述语言不一致。',
      suggestion: '请确保两个文档使用相同的语言。',
      severity: 'warning',
      actionable: true,
      retryable: true,
      contactSupport: false
    }
  },

  // 系统错误
  timeout: {
    en: {
      title: 'Request Timeout',
      message: 'The operation took too long to complete.',
      suggestion: 'Please try again. If the problem persists, contact support.',
      severity: 'error',
      actionable: true,
      retryable: true,
      contactSupport: true
    },
    zh: {
      title: '请求超时',
      message: '操作耗时过长。',
      suggestion: '请重试。如果问题持续存在，请联系技术支持。',
      severity: 'error',
      actionable: true,
      retryable: true,
      contactSupport: true
    }
  },

  upstream_error: {
    en: {
      title: 'Service Temporarily Unavailable',
      message: 'Our AI service is temporarily experiencing issues.',
      suggestion: 'Please try again in a few minutes.',
      severity: 'error',
      actionable: true,
      retryable: true,
      contactSupport: false
    },
    zh: {
      title: '服务暂时不可用',
      message: '我们的AI服务暂时遇到问题。',
      suggestion: '请几分钟后重试。',
      severity: 'error',
      actionable: true,
      retryable: true,
      contactSupport: false
    }
  },

  internal_error: {
    en: {
      title: 'Something Went Wrong',
      message: 'An unexpected error occurred on our end.',
      suggestion: 'Please try again. If the problem continues, contact our support team.',
      severity: 'critical',
      actionable: true,
      retryable: true,
      contactSupport: true
    },
    zh: {
      title: '出现了问题',
      message: '我们这边发生了意外错误。',
      suggestion: '请重试。如果问题持续，请联系我们的支持团队。',
      severity: 'critical',
      actionable: true,
      retryable: true,
      contactSupport: true
    }
  },

  // 网络相关错误
  network_error: {
    en: {
      title: 'Connection Problem',
      message: 'Unable to connect to our servers.',
      suggestion: 'Check your internet connection and try again.',
      severity: 'error',
      actionable: true,
      retryable: true,
      contactSupport: false
    },
    zh: {
      title: '连接问题',
      message: '无法连接到我们的服务器。',
      suggestion: '检查您的网络连接后重试。',
      severity: 'error',
      actionable: true,
      retryable: true,
      contactSupport: false
    }
  },

  // 重复请求
  duplicate_request: {
    en: {
      title: 'Duplicate Request',
      message: 'This request is already being processed.',
      suggestion: 'Please wait for the current operation to complete.',
      severity: 'info',
      actionable: false,
      retryable: false,
      contactSupport: false
    },
    zh: {
      title: '重复请求',
      message: '此请求正在处理中。',
      suggestion: '请等待当前操作完成。',
      severity: 'info',
      actionable: false,
      retryable: false,
      contactSupport: false
    }
  },

  // 服务不存在
  service_not_found: {
    en: {
      title: 'Service Not Found',
      message: 'The requested service could not be found.',
      suggestion: 'Please check the service ID and try again.',
      severity: 'warning',
      actionable: true,
      retryable: false,
      contactSupport: false
    },
    zh: {
      title: '服务未找到',
      message: '找不到请求的服务。',
      suggestion: '请检查服务ID后重试。',
      severity: 'warning',
      actionable: true,
      retryable: false,
      contactSupport: false
    }
  }
}

/**
 * 获取用户友好的错误信息
 */
export function getUserFriendlyError(
  errorCode: string,
  locale: SupportedLocale = 'en',
  fallbackMessage?: string
): UserFriendlyError {
  const mapping = ERROR_MAPPINGS[errorCode]
  
  if (mapping && mapping[locale]) {
    return mapping[locale]
  }
  
  // 如果没有找到映射，返回通用错误
  const genericError: UserFriendlyError = {
    title: locale === 'zh' ? '未知错误' : 'Unknown Error',
    message: fallbackMessage || (locale === 'zh' ? '发生了未知错误' : 'An unknown error occurred'),
    suggestion: locale === 'zh' ? '请重试或联系技术支持。' : 'Please try again or contact support.',
    severity: 'error',
    actionable: true,
    retryable: true,
    contactSupport: true
  }
  
  return genericError
}

/**
 * 检查错误是否可重试
 */
export function isRetryableError(errorCode: string): boolean {
  const mapping = ERROR_MAPPINGS[errorCode]
  return mapping?.en.retryable ?? true
}

/**
 * 检查错误是否需要联系支持
 */
export function shouldContactSupport(errorCode: string): boolean {
  const mapping = ERROR_MAPPINGS[errorCode]
  return mapping?.en.contactSupport ?? false
}

/**
 * 获取错误严重级别
 */
export function getErrorSeverity(errorCode: string): ErrorSeverity {
  const mapping = ERROR_MAPPINGS[errorCode]
  return mapping?.en.severity ?? 'error'
}

/**
 * 安全地序列化对象，处理循环引用和不可序列化的值
 */
function safeStringify(obj: any, space?: number): string {
  const seen = new WeakSet()
  
  const replacer = (key: string, value: any) => {
    // 处理循环引用
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular Reference]'
      }
      seen.add(value)
    }
    
    // 处理函数
    if (typeof value === 'function') {
      return '[Function]'
    }
    
    // 处理 undefined
    if (value === undefined) {
      return '[Undefined]'
    }
    
    // 处理 Symbol
    if (typeof value === 'symbol') {
      return value.toString()
    }
    
    // 处理 BigInt
    if (typeof value === 'bigint') {
      return value.toString()
    }
    
    // 处理 Error 对象
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack
      }
    }
    
    return value
  }
  
  try {
    return JSON.stringify(obj, replacer, space)
  } catch (error) {
    // 如果仍然失败，返回一个安全的字符串表示
    return `[Serialization Error: ${error instanceof Error ? error.message : 'Unknown error'}]`
  }
}

/**
 * 格式化错误消息用于日志记录
 */
export function formatErrorForLogging(
  errorCode: string,
  originalError?: Error | string,
  context?: Record<string, any>
): string {
  const userError = getUserFriendlyError(errorCode, 'en')
  const originalMessage = originalError instanceof Error ? originalError.message : originalError
  
  const logData = {
    errorCode,
    userFriendlyTitle: userError.title,
    userFriendlyMessage: userError.message,
    originalError: originalMessage,
    severity: userError.severity,
    retryable: userError.retryable,
    contactSupport: userError.contactSupport,
    context
  }
  
  return safeStringify(logData, 2)
}