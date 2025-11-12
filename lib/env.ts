// Edge/Node 兼容的环境变量读取：仅使用 process.env
// Next.js 会在运行时/构建时注入 .env.local，无需手动加载。

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
  QUOTA_RESET_INTERVAL_HOURS: Number(process.env['QUOTA_RESET_INTERVAL_HOURS'] ?? '24'), // 配额重置间隔（小时）
  QUOTA_ANOMALY_THRESHOLD: Number(process.env['QUOTA_ANOMALY_THRESHOLD'] ?? '10'), // 异常使用阈值
  
  // 并发控制配置
  DEEPSEEK_MAX_WORKERS: Number(process.env['DEEPSEEK_MAX_WORKERS'] ?? '5'), // DeepSeek最大并发数
  GLM_MAX_WORKERS: Number(process.env['GLM_MAX_WORKERS'] ?? '5'), // GLM最大并发数
  WORKER_TIMEOUT_MS: Number(process.env['WORKER_TIMEOUT_MS'] ?? '60000'), // Worker超时时间（毫秒）
  QUEUE_MAX_SIZE: Number(process.env['QUEUE_MAX_SIZE'] ?? '100'), // 队列最大长度
  QUEUE_POSITION_UPDATE_INTERVAL_MS: Number(process.env['QUEUE_POSITION_UPDATE_INTERVAL_MS'] ?? '2000'), // 队列位置更新间隔
  
  // 性能优化配置
  CACHE_TTL_SECONDS: Number(process.env['CACHE_TTL_SECONDS'] ?? '300'), // 缓存TTL（秒）
  BATCH_OPERATION_SIZE: Number(process.env['BATCH_OPERATION_SIZE'] ?? '10'), // 批量操作大小
  CONCURRENCY_LOCK_TIMEOUT_MS: Number(process.env['CONCURRENCY_LOCK_TIMEOUT_MS'] ?? '30000'), // 并发锁超时时间
  
  // Stack Auth 配置
  NEXT_PUBLIC_STACK_PROJECT_ID: process.env['NEXT_PUBLIC_STACK_PROJECT_ID'] ?? '',
  NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY: process.env['NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY'] ?? '',
  STACK_SECRET_SERVER_KEY: process.env['STACK_SECRET_SERVER_KEY'] ?? '',
  

  
  // 缓存验证密钥
  CACHE_VALIDATION_SECRET: process.env['CACHE_VALIDATION_SECRET'] ?? 'default-secret-key',
  
  // 调试开关：启用后在关键 LLM 调用处输出详细日志（仅服务器侧）
  LLM_DEBUG: (process.env['LLM_DEBUG'] ?? '0').toLowerCase() === '1' || (process.env['LLM_DEBUG'] ?? '').toLowerCase() === 'true',

  // Redis Streams 合并写入配置
  // 时间窗口（毫秒）：在该窗口内的 token 事件被合并为一次写入
  STREAM_FLUSH_INTERVAL_MS: Number(process.env['STREAM_FLUSH_INTERVAL_MS'] ?? '400'),
  // 长度阈值（事件数量）：达到该数量立即触发 flush（窗口未到也立即写）
  STREAM_FLUSH_SIZE: Number(process.env['STREAM_FLUSH_SIZE'] ?? '8'),

  // Redis Streams 后处理配置（终止事件触发）
  // TTL（秒）：在收到 done/error 终止事件后为缓冲流键设置过期时间；<=0 表示禁用
  STREAM_TTL_SECONDS: Number(process.env['STREAM_TTL_SECONDS'] ?? '240'),
  // 修剪长度：在收到终止事件后使用 XTRIM MAXLEN 近似修剪；<=0 表示禁用
  STREAM_TRIM_MAXLEN: Number(process.env['STREAM_TRIM_MAXLEN'] ?? '256'),
}

export function isProdRedisReady() {
  return !!ENV.UPSTASH_REDIS_REST_URL && !!ENV.UPSTASH_REDIS_REST_TOKEN
}

export function isQstashReady() {
  return !!ENV.QSTASH_TOKEN && !!ENV.QSTASH_CURRENT_SIGNING_KEY && !!ENV.QSTASH_NEXT_SIGNING_KEY
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
  return !!ENV.NEXT_PUBLIC_STACK_PROJECT_ID && !!ENV.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY && !!ENV.STACK_SECRET_SERVER_KEY
}

export function getQuotaConfig() {
  return {
    freeLimit: ENV.FREE_QUOTA_LIMIT,
    resetIntervalHours: ENV.QUOTA_RESET_INTERVAL_HOURS,
    anomalyThreshold: ENV.QUOTA_ANOMALY_THRESHOLD
  }
}

export function getConcurrencyConfig() {
  return {
    deepseekMaxWorkers: ENV.DEEPSEEK_MAX_WORKERS,
    glmMaxWorkers: ENV.GLM_MAX_WORKERS,
    workerTimeoutMs: ENV.WORKER_TIMEOUT_MS,
    queueMaxSize: ENV.QUEUE_MAX_SIZE,
    queuePositionUpdateIntervalMs: ENV.QUEUE_POSITION_UPDATE_INTERVAL_MS
  }
}

export function getPerformanceConfig() {
  return {
    cacheTtlSeconds: ENV.CACHE_TTL_SECONDS,
    batchOperationSize: ENV.BATCH_OPERATION_SIZE,
    concurrencyLockTimeoutMs: ENV.CONCURRENCY_LOCK_TIMEOUT_MS
  }
}
