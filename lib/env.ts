// Edge/Node 兼容的环境变量读取：仅使用 process.env
// Next.js 会在运行时/构建时注入 .env.local，无需手动加载。

import { CONCURRENCY_PERSISTENT_TTL_SECONDS } from '@/lib/constants'

export const ENV = {
  OPENAI_API_KEY: process.env['OPENAI_API_KEY'] ?? '',
  UPSTASH_REDIS_REST_URL: process.env['UPSTASH_REDIS_REST_URL'] ?? '',
  UPSTASH_REDIS_REST_TOKEN: process.env['UPSTASH_REDIS_REST_TOKEN'] ?? '',
  QSTASH_URL: process.env['QSTASH_URL'] ?? '',
  QSTASH_TOKEN: process.env['QSTASH_TOKEN'] ?? '',
  QSTASH_CURRENT_SIGNING_KEY: process.env['QSTASH_CURRENT_SIGNING_KEY'] ?? '',
  QSTASH_NEXT_SIGNING_KEY: process.env['QSTASH_NEXT_SIGNING_KEY'] ?? '',
  NEXT_PUBLIC_APP_BASE_URL: process.env['NEXT_PUBLIC_APP_BASE_URL'] ?? '',
  DATABASE_URL: process.env['DATABASE_URL'] ?? '',
  ZHIPUAI_API_KEY: process.env['ZHIPUAI_API_KEY'] ?? '',
  DEEPSEEK_API_KEY: process.env['DEEPSEEK_API_KEY'] ?? '',
  ZHIPU_TEXT_MODEL: process.env['ZHIPU_TEXT_MODEL'] ?? 'glm-4.5-flash',
  ZHIPU_VISION_MODEL:
    process.env['ZHIPU_VISION_MODEL'] ?? 'glm-4.1v-thinking-flash',
  SUMMARY_MAX_CHARS: Number(process.env['SUMMARY_MAX_CHARS'] ?? '8000'),

  // 配额管理配置
  FREE_QUOTA_LIMIT: Number(process.env['FREE_QUOTA_LIMIT'] ?? '3'), // 免费用户配额限制
  QUOTA_RESET_INTERVAL_HOURS: Number(
    process.env['QUOTA_RESET_INTERVAL_HOURS'] ?? '24',
  ), // 配额重置间隔（小时）
  QUOTA_ANOMALY_THRESHOLD: Number(
    process.env['QUOTA_ANOMALY_THRESHOLD'] ?? '10',
  ), // 异常使用阈值

  // 并发控制配置
  DEEPSEEK_MAX_WORKERS: Number(process.env['DEEPSEEK_MAX_WORKERS'] ?? '5'), // DeepSeek最大并发数
  GLM_MAX_WORKERS: Number(process.env['GLM_MAX_WORKERS'] ?? '5'), // GLM最大并发数
  WORKER_TIMEOUT_MS: Number(process.env['WORKER_TIMEOUT_MS'] ?? '300000'), // Worker超时时间（毫秒）
  QUEUE_MAX_SIZE: Number(process.env['QUEUE_MAX_SIZE'] ?? '100'), // 队列最大长度（默认）
  QUEUE_POSITION_UPDATE_INTERVAL_MS: Number(
    process.env['QUEUE_POSITION_UPDATE_INTERVAL_MS'] ?? '2000',
  ), // 队列位置更新间隔

  // 队列分级上限（覆盖默认）
  QUEUE_MAX_PAID_STREAM: Number(
    process.env['QUEUE_MAX_PAID_STREAM'] ??
      String(process.env['QUEUE_MAX_SIZE'] ?? '100'),
  ),
  QUEUE_MAX_FREE_STREAM: Number(
    process.env['QUEUE_MAX_FREE_STREAM'] ??
      String(process.env['QUEUE_MAX_SIZE'] ?? '100'),
  ),
  QUEUE_MAX_PAID_BATCH: Number(
    process.env['QUEUE_MAX_PAID_BATCH'] ??
      String(process.env['QUEUE_MAX_SIZE'] ?? '100'),
  ),
  QUEUE_MAX_FREE_BATCH: Number(
    process.env['QUEUE_MAX_FREE_BATCH'] ??
      String(process.env['QUEUE_MAX_SIZE'] ?? '100'),
  ),
  QUEUE_MAX_PAID_VISION: Number(
    process.env['QUEUE_MAX_PAID_VISION'] ??
      String(process.env['QUEUE_MAX_SIZE'] ?? '100'),
  ),
  QUEUE_MAX_FREE_VISION: Number(
    process.env['QUEUE_MAX_FREE_VISION'] ??
      String(process.env['QUEUE_MAX_SIZE'] ?? '100'),
  ),

  // 性能优化配置
  CACHE_TTL_SECONDS: Number(process.env['CACHE_TTL_SECONDS'] ?? '300'), // 缓存TTL（秒）
  BATCH_OPERATION_SIZE: Number(process.env['BATCH_OPERATION_SIZE'] ?? '10'), // 批量操作大小
  CONCURRENCY_LOCK_TIMEOUT_MS: Number(
    process.env['CONCURRENCY_LOCK_TIMEOUT_MS'] ?? '10000',
  ), // 并发锁超时时间
  CONCURRENCY_KEEP_ZERO_TTL_SECONDS: Number(
    process.env['CONCURRENCY_KEEP_ZERO_TTL_SECONDS'] ?? '30',
  ),
  CONCURRENCY_COUNTER_TTL_SECONDS: Number(
    process.env['CONCURRENCY_COUNTER_TTL_SECONDS'] ??
      String(
        Math.ceil(Number(process.env['WORKER_TIMEOUT_MS'] ?? '300000') / 1000),
      ),
  ),
  CONCURRENCY_PERSISTENT_TTL_SECONDS: Number(
    process.env['CONCURRENCY_PERSISTENT_TTL_SECONDS'] ??
      String(CONCURRENCY_PERSISTENT_TTL_SECONDS),
  ),

  // Stack Auth 配置
  NEXT_PUBLIC_STACK_PROJECT_ID:
    process.env['NEXT_PUBLIC_STACK_PROJECT_ID'] ?? '',
  NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY:
    process.env['NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY'] ?? '',
  STACK_SECRET_SERVER_KEY: process.env['STACK_SECRET_SERVER_KEY'] ?? '',

  // 缓存验证密钥
  CACHE_VALIDATION_SECRET:
    process.env['CACHE_VALIDATION_SECRET'] ?? 'default-secret-key',

  // 调试开关：启用后在关键 LLM 调用处输出详细日志（仅服务器侧）
  LLM_DEBUG:
    (process.env['LLM_DEBUG'] ?? '0').toLowerCase() === '1' ||
    (process.env['LLM_DEBUG'] ?? '').toLowerCase() === 'true',
  LLM_STRICT_MODE:
    (process.env['LLM_STRICT_MODE'] ?? '1').toLowerCase() === '1' ||
    (process.env['LLM_STRICT_MODE'] ?? '').toLowerCase() === 'true',
  RESUME_SCHEMA_V2_ENABLED:
    (process.env['RESUME_SCHEMA_V2_ENABLED'] ?? '1').toLowerCase() === '1' ||
    (process.env['RESUME_SCHEMA_V2_ENABLED'] ?? '').toLowerCase() === 'true',

  // Redis Streams 合并写入配置
  // 时间窗口（毫秒）：在该窗口内的 token 事件被合并为一次写入
  STREAM_FLUSH_INTERVAL_MS: Number(
    process.env['STREAM_FLUSH_INTERVAL_MS'] ?? '20',
  ),
  // 长度阈值（事件数量）：达到该数量立即触发 flush（窗口未到也立即写）
  STREAM_FLUSH_SIZE: Number(process.env['STREAM_FLUSH_SIZE'] ?? '5'),

  // Redis Streams 后处理配置（终止事件触发）
  // TTL（秒）：在收到 done/error 终止事件后为缓冲流键设置过期时间；<=0 表示禁用
  STREAM_TTL_SECONDS: Number(process.env['STREAM_TTL_SECONDS'] ?? '900'),
  // 修剪长度：在收到终止事件后使用 XTRIM MAXLEN 近似修剪；<=0 表示禁用
  STREAM_TRIM_MAXLEN: Number(process.env['STREAM_TRIM_MAXLEN'] ?? '2000'),

  // 用户级并发上限
  USER_MAX_ACTIVE_STREAM: Number(process.env['USER_MAX_ACTIVE_STREAM'] ?? '3'),
  USER_MAX_ACTIVE_BATCH: Number(process.env['USER_MAX_ACTIVE_BATCH'] ?? '3'),

  // 模型×tier并发上限（覆盖值）
  MAX_DS_REASONER_PAID: Number(process.env['MAX_DS_REASONER_PAID'] ?? '20'),
  MAX_DS_CHAT_PAID: Number(process.env['MAX_DS_CHAT_PAID'] ?? '20'),
  MAX_GLM_FLASH_FREE: Number(process.env['MAX_GLM_FLASH_FREE'] ?? '2'),
  MAX_GLM_VISION_PAID: Number(process.env['MAX_GLM_VISION_PAID'] ?? '3'),
  MAX_GLM_VISION_FREE: Number(process.env['MAX_GLM_VISION_FREE'] ?? '2'),
  MAX_GEMINI_FLASH_PAID: Number(process.env['MAX_GEMINI_FLASH_PAID'] ?? '20'),
  MAX_GEMINI_FLASH_FREE: Number(process.env['MAX_GEMINI_FLASH_FREE'] ?? '5'),
  MAX_TOTAL_WAIT_MS_STREAM: Number(
    process.env['MAX_TOTAL_WAIT_MS_STREAM'] ?? '480000',
  ),
  MAX_TOTAL_WAIT_MS_BATCH: Number(
    process.env['MAX_TOTAL_WAIT_MS_BATCH'] ?? '600000',
  ),

  // Gemini API (for Free tier)
  GEMINI_API_KEY: process.env['GEMINI_API_KEY'] ?? '',

  // Baidu OCR API (for Paid tier OCR)
  BAIDU_API_KEY: process.env['BAIDU_API_KEY'] ?? '',
  BAIDU_SECRET_KEY: process.env['BAIDU_SECRET_KEY'] ?? '',

  // Rate Limiting - User-centric (at server action level)
  // Free tier: 5 operations per 24 hours
  // Paid tier: 10 operations per 15 minutes
  RATE_LIMIT_FREE_DAILY: Number(process.env['RATE_LIMIT_FREE_DAILY'] ?? '5'),
  RATE_LIMIT_PAID_WINDOW_SEC: Number(
    process.env['RATE_LIMIT_PAID_WINDOW_SEC'] ?? '900',
  ),
  RATE_LIMIT_PAID_MAX: Number(process.env['RATE_LIMIT_PAID_MAX'] ?? '10'),
}

export function isProdRedisReady() {
  return (
    !!ENV.UPSTASH_REDIS_REST_URL &&
    !!ENV.UPSTASH_REDIS_REST_TOKEN &&
    process.env.NODE_ENV !== 'test'
  )
}

export function isQstashReady() {
  return (
    !!ENV.QSTASH_TOKEN &&
    !!ENV.QSTASH_CURRENT_SIGNING_KEY &&
    !!ENV.QSTASH_NEXT_SIGNING_KEY
  )
}

export function assertRequiredKeysForRun() {
  if (!ENV.OPENAI_API_KEY) {
    throw new Error('missing_OPENAI_API_KEY')
  }
}

export function isDbReady() {
  return !!ENV.DATABASE_URL
}

export function isZhipuReady() {
  return !!ENV.ZHIPUAI_API_KEY
}

export function isStackAuthReady() {
  return (
    !!ENV.NEXT_PUBLIC_STACK_PROJECT_ID &&
    !!ENV.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY &&
    !!ENV.STACK_SECRET_SERVER_KEY
  )
}

export function getQuotaConfig() {
  return {
    freeLimit: ENV.FREE_QUOTA_LIMIT,
    resetIntervalHours: ENV.QUOTA_RESET_INTERVAL_HOURS,
    anomalyThreshold: ENV.QUOTA_ANOMALY_THRESHOLD,
  }
}

export function getConcurrencyConfig() {
  return {
    deepseekMaxWorkers: ENV.DEEPSEEK_MAX_WORKERS,
    glmMaxWorkers: ENV.GLM_MAX_WORKERS,
    workerTimeoutMs: ENV.WORKER_TIMEOUT_MS,
    queueMaxSize: ENV.QUEUE_MAX_SIZE,
    queuePositionUpdateIntervalMs: ENV.QUEUE_POSITION_UPDATE_INTERVAL_MS,
    queueLimits: {
      paidStream: ENV.QUEUE_MAX_PAID_STREAM,
      freeStream: ENV.QUEUE_MAX_FREE_STREAM,
      paidBatch: ENV.QUEUE_MAX_PAID_BATCH,
      freeBatch: ENV.QUEUE_MAX_FREE_BATCH,
      paidVision: ENV.QUEUE_MAX_PAID_VISION,
      freeVision: ENV.QUEUE_MAX_FREE_VISION,
    },
    userMaxActive: {
      stream: ENV.USER_MAX_ACTIVE_STREAM,
      batch: ENV.USER_MAX_ACTIVE_BATCH,
    },
    modelTierLimits: {
      dsReasonerPaid: ENV.MAX_DS_REASONER_PAID,
      dsChatPaid: ENV.MAX_DS_CHAT_PAID,
      glmFlashFree: ENV.MAX_GLM_FLASH_FREE,
      glmVisionPaid: ENV.MAX_GLM_VISION_PAID,
      glmVisionFree: ENV.MAX_GLM_VISION_FREE,
      geminiFlashPaid: ENV.MAX_GEMINI_FLASH_PAID,
      geminiFlashFree: ENV.MAX_GEMINI_FLASH_FREE,
    },
  }
}

export function getPerformanceConfig() {
  return {
    cacheTtlSeconds: ENV.CACHE_TTL_SECONDS,
    batchOperationSize: ENV.BATCH_OPERATION_SIZE,
    concurrencyLockTimeoutMs: ENV.CONCURRENCY_LOCK_TIMEOUT_MS,
    maxTotalWaitMs: {
      stream: ENV.MAX_TOTAL_WAIT_MS_STREAM,
      batch: ENV.MAX_TOTAL_WAIT_MS_BATCH,
    },
  }
}
