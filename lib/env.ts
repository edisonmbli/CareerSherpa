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
