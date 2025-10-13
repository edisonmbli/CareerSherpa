export const ENV = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? '',
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL ?? '',
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN ?? '',
  NEXT_PUBLIC_APP_BASE_URL: process.env.NEXT_PUBLIC_APP_BASE_URL ?? '',
  DATABASE_URL: process.env.DATABASE_URL ?? '',
  ZHIPUAI_API_KEY: process.env.ZHIPUAI_API_KEY ?? '',
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY ?? '',
  ZHIPU_TEXT_MODEL: process.env.ZHIPU_TEXT_MODEL ?? 'glm-4.5-flash',
  ZHIPU_VISION_MODEL:
    process.env.ZHIPU_VISION_MODEL ?? 'glm-4.1v-thinking-flash',
  SUMMARY_MAX_CHARS: Number(process.env.SUMMARY_MAX_CHARS ?? '8000'),
  
  // 配额管理配置
  FREE_QUOTA_LIMIT: Number(process.env.FREE_QUOTA_LIMIT ?? '3'), // 免费用户配额限制
  QUOTA_RESET_INTERVAL_HOURS: Number(process.env.QUOTA_RESET_INTERVAL_HOURS ?? '24'), // 配额重置间隔（小时）
  QUOTA_ANOMALY_THRESHOLD: Number(process.env.QUOTA_ANOMALY_THRESHOLD ?? '10'), // 异常使用阈值
  
  // 并发控制配置
  DEEPSEEK_MAX_WORKERS: Number(process.env.DEEPSEEK_MAX_WORKERS ?? '5'), // DeepSeek最大并发数
  GLM_MAX_WORKERS: Number(process.env.GLM_MAX_WORKERS ?? '5'), // GLM最大并发数
  WORKER_TIMEOUT_MS: Number(process.env.WORKER_TIMEOUT_MS ?? '60000'), // Worker超时时间（毫秒）
  QUEUE_MAX_SIZE: Number(process.env.QUEUE_MAX_SIZE ?? '100'), // 队列最大长度
  QUEUE_POSITION_UPDATE_INTERVAL_MS: Number(process.env.QUEUE_POSITION_UPDATE_INTERVAL_MS ?? '2000'), // 队列位置更新间隔
  
  // 性能优化配置
  CACHE_TTL_SECONDS: Number(process.env.CACHE_TTL_SECONDS ?? '300'), // 缓存TTL（秒）
  BATCH_OPERATION_SIZE: Number(process.env.BATCH_OPERATION_SIZE ?? '10'), // 批量操作大小
  CONCURRENCY_LOCK_TIMEOUT_MS: Number(process.env.CONCURRENCY_LOCK_TIMEOUT_MS ?? '30000'), // 并发锁超时时间
  
  // Stack Auth 配置
  NEXT_PUBLIC_STACK_PROJECT_ID: process.env.NEXT_PUBLIC_STACK_PROJECT_ID ?? '',
  NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY: process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY ?? '',
  STACK_SECRET_SERVER_KEY: process.env.STACK_SECRET_SERVER_KEY ?? '',
  

  
  // 缓存验证密钥
  CACHE_VALIDATION_SECRET: process.env.CACHE_VALIDATION_SECRET ?? 'default-secret-key',
}

export function isProdRedisReady() {
  return !!ENV.UPSTASH_REDIS_REST_URL && !!ENV.UPSTASH_REDIS_REST_TOKEN
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
