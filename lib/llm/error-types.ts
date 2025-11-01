/**
 * LLM Provider 错误类型定义
 * 基于智谱AI和DeepSeek的常见错误消息
 */

export interface LLMErrorType {
  code: string | number
  message: string
  isRetryable: boolean
  retryAfterMs?: number
  category: 'rate_limit' | 'auth' | 'timeout' | 'server_error' | 'client_error' | 'quota' | 'unknown'
}

/**
 * 智谱AI 常见错误类型
 */
export const ZHIPU_ERROR_TYPES = {
  // 认证错误
  UNAUTHORIZED: {
    code: 401,
    message: 'unauthorized',
    isRetryable: false,
    category: 'auth'
  },
  
  // 参数错误
  INVALID_PARAMETER: {
    code: 1214,
    message: 'prompt 参数非法',
    isRetryable: false,
    category: 'client_error'
  },
  
  // 速率限制
  RATE_LIMIT: {
    code: 429,
    message: 'rate limit exceeded',
    isRetryable: true,
    retryAfterMs: 60000, // 1分钟后重试
    category: 'rate_limit'
  },
  
  // 服务器错误
  SERVER_ERROR: {
    code: 500,
    message: 'internal server error',
    isRetryable: true,
    retryAfterMs: 30000, // 30秒后重试
    category: 'server_error'
  },
  
  // 超时错误
  TIMEOUT: {
    code: 'timeout',
    message: 'request timeout',
    isRetryable: true,
    retryAfterMs: 10000, // 10秒后重试
    category: 'timeout'
  }
} as const

/**
 * DeepSeek 常见错误类型
 */
export const DEEPSEEK_ERROR_TYPES = {
  // 认证错误
  UNAUTHORIZED: {
    code: 401,
    message: 'no auth credentials found',
    isRetryable: false,
    category: 'auth'
  },
  
  // 余额不足
  INSUFFICIENT_BALANCE: {
    code: 402,
    message: 'insufficient balance',
    isRetryable: false,
    category: 'quota'
  },
  
  // 速率限制
  RATE_LIMIT: {
    code: 429,
    message: 'rate limit exceeded',
    isRetryable: true,
    retryAfterMs: 120000, // 2分钟后重试，DeepSeek限制较严格
    category: 'rate_limit'
  },
  
  // 高并发限制
  TOO_MANY_REQUESTS: {
    code: 429,
    message: 'too many requests',
    isRetryable: true,
    retryAfterMs: 120000, // 2分钟后重试
    category: 'rate_limit'
  },
  
  // 服务器错误
  SERVER_ERROR: {
    code: 500,
    message: 'internal server error',
    isRetryable: true,
    retryAfterMs: 30000, // 30秒后重试
    category: 'server_error'
  },
  
  // 超时错误
  TIMEOUT: {
    code: 'timeout',
    message: 'timeout',
    isRetryable: true,
    retryAfterMs: 15000, // 15秒后重试
    category: 'timeout'
  },
  
  // 代理错误
  PROXY_ERROR: {
    code: 'proxy_error',
    message: 'proxy error',
    isRetryable: true,
    retryAfterMs: 60000, // 1分钟后重试
    category: 'server_error'
  }
} as const

/**
 * 通用错误类型
 */
export const COMMON_ERROR_TYPES = {
  NETWORK_ERROR: {
    code: 'network_error',
    message: 'network error',
    isRetryable: true,
    retryAfterMs: 30000,
    category: 'server_error'
  },

  FETCH_FAILED: {
    code: 'fetch_failed',
    message: 'fetch failed',
    isRetryable: true,
    retryAfterMs: 20000, // 20秒后重试
    category: 'server_error'
  },

  UNKNOWN_ERROR: {
    code: 'unknown',
    message: 'unknown error',
    isRetryable: false,
    category: 'unknown'
  }
} as const

/**
 * 错误匹配器：根据错误消息和状态码识别错误类型
 */
export class LLMErrorMatcher {
  /**
   * 匹配智谱AI错误
   */
  static matchZhipuError(error: any): LLMErrorType | null {
    const errorMessage = (error?.message || '').toLowerCase()
    const statusCode = error?.status || error?.code
    
    // 按状态码匹配
    if (statusCode === 401) return ZHIPU_ERROR_TYPES.UNAUTHORIZED
    if (statusCode === 429) return ZHIPU_ERROR_TYPES.RATE_LIMIT
    if (statusCode === 500) return ZHIPU_ERROR_TYPES.SERVER_ERROR
    if (statusCode === 1214) return ZHIPU_ERROR_TYPES.INVALID_PARAMETER
    
    // 按错误消息匹配
    if (errorMessage.includes('unauthorized')) return ZHIPU_ERROR_TYPES.UNAUTHORIZED
    if (errorMessage.includes('参数非法') || errorMessage.includes('invalid parameter')) {
      return ZHIPU_ERROR_TYPES.INVALID_PARAMETER
    }
    if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
      return ZHIPU_ERROR_TYPES.RATE_LIMIT
    }
    if (errorMessage.includes('timeout')) return ZHIPU_ERROR_TYPES.TIMEOUT
    if (errorMessage.includes('server error') || errorMessage.includes('internal error')) {
      return ZHIPU_ERROR_TYPES.SERVER_ERROR
    }
    
    return null
  }
  
  /**
   * 匹配DeepSeek错误
   */
  static matchDeepSeekError(error: any): LLMErrorType | null {
    const errorMessage = (error?.message || '').toLowerCase()
    const statusCode = error?.status || error?.code
    
    // 按状态码匹配
    if (statusCode === 401) return DEEPSEEK_ERROR_TYPES.UNAUTHORIZED
    if (statusCode === 402) return DEEPSEEK_ERROR_TYPES.INSUFFICIENT_BALANCE
    if (statusCode === 429) return DEEPSEEK_ERROR_TYPES.RATE_LIMIT
    if (statusCode === 500) return DEEPSEEK_ERROR_TYPES.SERVER_ERROR
    
    // 按错误消息匹配
    if (errorMessage.includes('no auth credentials') || errorMessage.includes('unauthorized')) {
      return DEEPSEEK_ERROR_TYPES.UNAUTHORIZED
    }
    if (errorMessage.includes('insufficient balance') || errorMessage.includes('balance is $0')) {
      return DEEPSEEK_ERROR_TYPES.INSUFFICIENT_BALANCE
    }
    if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
      return DEEPSEEK_ERROR_TYPES.TOO_MANY_REQUESTS
    }
    if (errorMessage.includes('proxy error')) return DEEPSEEK_ERROR_TYPES.PROXY_ERROR
    if (errorMessage.includes('timeout')) return DEEPSEEK_ERROR_TYPES.TIMEOUT
    if (errorMessage.includes('server error') || errorMessage.includes('internal error')) {
      return DEEPSEEK_ERROR_TYPES.SERVER_ERROR
    }
    
    return null
  }
  
  /**
   * 通用错误匹配
   */
  static matchCommonError(error: any): LLMErrorType {
    const errorMessage = (error?.message || '').toLowerCase()
    
    if (errorMessage.includes('network') || errorMessage.includes('connection')) {
      return COMMON_ERROR_TYPES.NETWORK_ERROR
    }
    
    if (errorMessage.includes('fetch failed')) {
      return COMMON_ERROR_TYPES.FETCH_FAILED
    }
    
    return COMMON_ERROR_TYPES.UNKNOWN_ERROR
  }
  
  /**
   * 根据provider类型匹配错误
   */
  static matchError(provider: string, error: any): LLMErrorType {
    let matchedError: LLMErrorType | null = null
    
    switch (provider.toLowerCase()) {
      case 'zhipu':
        matchedError = this.matchZhipuError(error)
        break
      case 'deepseek':
        matchedError = this.matchDeepSeekError(error)
        break
    }
    
    // 如果没有匹配到特定provider的错误，使用通用错误
    return matchedError || this.matchCommonError(error)
  }
}