export const ENV = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? '',
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL ?? '',
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN ?? '',
  NEXT_PUBLIC_APP_BASE_URL: process.env.NEXT_PUBLIC_APP_BASE_URL ?? '',
}

export function isProdRedisReady() {
  return !!ENV.UPSTASH_REDIS_REST_URL && !!ENV.UPSTASH_REDIS_REST_TOKEN
}

export function assertRequiredKeysForRun() {
  if (!ENV.OPENAI_API_KEY) {
    throw new Error('missing_OPENAI_API_KEY')
  }
}