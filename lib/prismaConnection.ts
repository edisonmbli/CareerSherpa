import { ENV } from '@/lib/env'

/**
 * 构建适用于 Prisma 的 Neon 连接串
 * - 去除不兼容的 `channel_binding` 参数（Prisma 引擎可能不支持）
 * - 强制 `sslmode=require`
 * - 设置 `pgbouncer=true` 以禁用预处理语句，兼容 Neon 的连接池
 */
export function buildPrismaUrl(originalUrl: string): string {
  if (!originalUrl || typeof originalUrl !== 'string') {
    throw new Error('Invalid DATABASE_URL for Prisma')
  }
  let u: URL
  try {
    u = new URL(originalUrl)
  } catch (e) {
    throw new Error('Malformed DATABASE_URL for Prisma')
  }

  // Neon 推荐开启 channel binding，但 Prisma 引擎可能不支持。
  // 为避免握手失败，明确移除该参数。
  u.searchParams.delete('channel_binding')

  // 强制 SSL
  const sslmode = u.searchParams.get('sslmode')
  if (!sslmode) {
    u.searchParams.set('sslmode', 'require')
  }

  // 移除非 libpq 标准参数，避免困惑；若需 IPv4 优先，请在进程级设置 NODE_OPTIONS 或系统级配置
  u.searchParams.delete('dns_result_order')

  // 为避免 Neon 端点冷启动引发的连接超时，提高连接等待时长
  if (!u.searchParams.get('connect_timeout')) {
    u.searchParams.set('connect_timeout', '15')
  }
  // 提高 Prisma 连接池等待超时（默认约 10s）
  if (!u.searchParams.get('pool_timeout')) {
    u.searchParams.set('pool_timeout', '60')
  }

  // 使用 Neon pooler 主机，确保连接稳定并由 PgBouncer 唤醒 compute
  const isPoolerHost = u.hostname.includes('-pooler')
  if (isPoolerHost) {
    u.searchParams.set('pgbouncer', 'true')
  } else {
    // 非 pooler 主机，移除 pgbouncer 参数
    u.searchParams.delete('pgbouncer')
  }

  // 移除连接并发限制，由 Prisma Runtime 自行控制，避免被动超时
  u.searchParams.delete('connection_limit')

  // 不再设置 Neon 特有的 options/endpoint 参数，避免不被 Prisma 透传导致混淆
  u.searchParams.delete('options')

  return u.toString()
}

/**
 * 返回运行时的 Prisma 连接串（从 ENV.DATABASE_URL 派生并适配）
 */
export function getPrismaRuntimeUrl(): string {
  const raw = ENV.DATABASE_URL
  if (!raw) throw new Error('Missing DATABASE_URL in environment')
  return buildPrismaUrl(raw)
}