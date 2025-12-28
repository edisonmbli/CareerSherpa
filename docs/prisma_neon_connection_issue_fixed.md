-- V1

# Prisma × Neon 连接问题修复与避坑指南

本文档整理本项目中 Prisma Client 无法连接到 Neon 数据库（P1001）的问题根因、修复方式、代码改动、以及后续稳定使用建议，帮助后续安全避坑与快速定位。

## 背景与症状

- 现象：`neon`（`@neondatabase/serverless`）客户端可以正常连通和查询，但 Prisma Client 报错 `PrismaClientInitializationError (P1001)`，提示无法连接到指定的 Neon 主机端口。
- `.env.local` 中的 `DATABASE_URL` 已确认正确，且数据库本身在 Neon 控制台正常运行。
- 问题只存在于 Prisma 连接层，说明是 Prisma 与 Neon 的握手/网络细节不兼容，而非数据库或凭据问题。

## 根因分析

综合排查与多轮实验，导致 P1001 的主要因素有：

1. Prisma 默认“库引擎”（library engine）在部分环境下存在 TLS/SNI 或 IPv6 路由的边缘兼容问题，与 Neon 的 serverless 端点组合时更易暴露（尤其 macOS / IPv6 优先网络）。
2. 直连 compute endpoint 时，遇到冷启动或连接池兼容性不足可能更容易超时；Neon 官方建议优先通过 pooler（PgBouncer）连接，禁用 prepared statements 来提升稳定性。
3. `channel_binding` 参数对 Prisma 并不总是兼容；强制开启可能导致握手失败。
4. 超时时间设置过低，Neon serverless 的冷启动会导致连接在短窗口内失败，需要更充足的 `connect_timeout`/`pool_timeout`。

## 解决方案（代码层面）

为消除上述因素的组合影响，本项目做了以下变更：

1. 强制 Prisma 使用“二进制引擎”（binary engine）：
   - 在运行时设置 `PRISMA_CLIENT_ENGINE_TYPE=binary`，避免库引擎在 TLS/SNI/IPv6 上的潜在不稳定。
   - 在 `prisma/schema.prisma` 的 `generator client` 中设置 `engineType = "binary"`，并执行 `npx prisma generate`，将选择固化到编译期，避免旧版客户端忽略运行时变量。
2. 规范 Prisma 用的连接串，优先使用 Neon pooler 并禁用 prepared statements：
   - 构建 Prisma 专用连接串：
     - 移除 `channel_binding`；
     - 强制 `sslmode=require`；
     - 设置 `connect_timeout=10`、`pool_timeout=20`；
     - 在使用 pooler 主机时加入 `pgbouncer=true`；
     - 限制 `connection_limit=1`；
     - 偏好 IPv4 DNS 解析：`dns_result_order=ipv4first`（被忽略也无害）。
3. 在测试脚本中显式偏好 IPv4：
   - 通过 `NODE_OPTIONS=--dns-result-order=ipv4first` 使 Node 端优先使用 IPv4，以规避特定网络环境的 IPv6 路由问题。

经上述修复后，`neon` 与 `PrismaClient` 均能在同一脚本中成功连接并查询：

```
[DB TEST][neon] OK: { db: 'neondb', usr: 'neondb_owner' }
[DB TEST][prisma] OK: { db: 'neondb', usr: 'neondb_owner' }
```

## 变更文件一览

- `lib/prismaConnection.ts`
  - 新增并完善 Prisma 连接串构建器：移除 `channel_binding`、强制 `sslmode=require`、加入 `connect_timeout`/`pool_timeout`、在 pooler 主机上设置 `pgbouncer=true`、增加 `connection_limit=1`、设置 `dns_result_order=ipv4first`。
- `lib/prisma.ts`
  - 在实例化 `PrismaClient` 前设置 `PRISMA_CLIENT_ENGINE_TYPE=binary`（运行时环境变量方式）。
  - 统一通过 `getPrismaRuntimeUrl()` 使用 Prisma 适配过的连接串。
- `lib/db-migrations.ts`
  - 在 CLI 风格的迁移动作前设置 `PRISMA_CLIENT_ENGINE_TYPE=binary`，并使用 `buildPrismaUrl(ENV.DATABASE_URL)`。
- `scripts/db-connection-test.ts`
  - 在脚本开头设置 `PRISMA_CLIENT_ENGINE_TYPE=binary` 与 `NODE_OPTIONS=--dns-result-order=ipv4first`；
  - 使用 `buildPrismaUrl` 生成 Prisma 专用连接串；
  - 先后用 `neon` 与 `PrismaClient` 做最小查询，输出可读的诊断信息。
- `prisma/schema.prisma`
  - 在 `generator client` 中设置 `engineType = "binary"` 并重新生成客户端，使二进制引擎生效。

## 环境与配置建议

- `.env.local` 中的 `DATABASE_URL` 建议使用 Neon pooler 主机（通常域名中包含 `-pooler`），并确保：
  - `sslmode=require`
  - 不要强制 `channel_binding=require`（Prisma 可能不兼容）
- 运行时设置：
  - `PRISMA_CLIENT_ENGINE_TYPE=binary`
  - 可选：`NODE_OPTIONS=--dns-result-order=ipv4first`（在 macOS/部分网络环境更稳）
  - 如果可行，优先在 `schema.prisma` 的 `generator client` 中配置 `engineType = "binary"` 并执行 `prisma generate`，避免因版本差异导致运行时变量未生效。
- Prisma 数据源：
  - 使用 App Router 的服务端组件/Server Actions，通过 DAL 调用 Prisma，避免在客户端读取非 `NEXT_PUBLIC_` 前缀的环境变量。

## Prisma/Neon 使用建议

- 优先经 pooler 连接（PgBouncer），并禁用 prepared statements（`pgbouncer=true`）以与 Prisma 更好协作。
- 避免直接连接 compute endpoint（移除 `-pooler`）作为默认路径，除非有明确需求，否则在 serverless 冷启动与长连接兼容性上更容易踩坑。
- 适度增加超时窗口（`connect_timeout`/`pool_timeout`），在 CI 或首次请求场景能显著降低 P1001 的概率。
- 若存在需要快速唤醒 compute 的链路，可在启动/首个请求前使用 `@neondatabase/serverless` 做一次轻量查询作为预热。

## 故障排查清单

当再次出现 P1001 或连接不稳时，可按以下顺序自查：

- 是否使用了 pooler 主机？如果不是，先切换为 pooler。
- 连接串是否包含并且仅包含必要参数：`sslmode=require`、（pooler 时）`pgbouncer=true`、`connect_timeout`、`pool_timeout`、`connection_limit=1`。
- 是否移除了 `channel_binding` 参数？
- 运行时是否设置了 `PRISMA_CLIENT_ENGINE_TYPE=binary`？
- 是否在问题环境下偏好 IPv4（`NODE_OPTIONS=--dns-result-order=ipv4first`）？
- Neon 控制台是否显示 compute 正在运行，如有冷启动，适度增加 `connect_timeout` 并重试。
- 使用 `neon` 客户端跑一条最小查询，确认数据库本身可用；若 `neon` 可但 Prisma 不可，优先检查上述引擎/参数。

## 常见问答（FAQ）

**Q：为何不推荐默认直连 compute endpoint？**  
A：直连 compute 在 serverless 冷启动、长连接与 prepared statements 方面更容易触发超时/兼容问题。pooler（PgBouncer）在这些方面更加稳健，适合作为默认入口。

**Q：`channel_binding` 是否必须？**  
A：对 Prisma 来说不是必须，且强制开启可能导致握手不兼容。移除后在 `sslmode=require` 下依然安全可靠。

**Q：是否需要在 `schema.prisma` 中配置 `directUrl`？**  
A：本项目未使用 `directUrl`。若以后需要（如特定 CLI 场景），也建议指向 pooler 并保持与上面一致的参数策略。

## 附：连接测试脚本输出示例

```
[DB TEST] DATABASE_URL loaded from .env.local
[DB TEST] host=ep-***-pooler.c-*.us-east-1.aws.neon.tech db=neondb user=neondb_owner sslmode=require
[DB TEST][neon] OK: { db: 'neondb', usr: 'neondb_owner' }
[DB TEST][prisma] OK: { db: 'neondb', usr: 'neondb_owner' }
```

## 风险与注意事项

- 切勿在生产环境随意执行数据库重置（参见 `DANGER_DO_NOT_RESET_DATABASE.md`）。如需重置，请严格按流程并确认备份与迁移影响。
- 所有数据库操作必须通过 DAL（`lib/dal/*`）进行，严禁在组件/Server Actions 直接实例化 `PrismaClient`。
- 客户端代码不得读取非 `NEXT_PUBLIC_` 前缀的环境变量。

-- V2

# Prisma Neon Adapter 集成说明

本项目已将 Prisma 连接方式切换为 Neon Driver Adapter（HTTP/Fetch 通道），以提升在本地与 Vercel Serverless 环境下的连接稳定性。

## 变更概览

- `lib/prisma.ts` 使用 `@prisma/adapter-neon` + `@neondatabase/serverless` 初始化 PrismaClient。
- 移除二进制引擎强制设置，避免与适配器冲突或造成误导。
- `lib/db-migrations.ts` 也统一使用 Neon Adapter，以保证运行时的 schema 校验与查询一致走 HTTP/Fetch 通道。
- 新增测试 `tests/db-connection-adapter.test.ts` 验证本机连接稳定性（`SELECT 1`）。

## 环境变量

- `DATABASE_URL`：保持现有格式，确保包含 `sslmode=require`。项目内部的 `buildPrismaUrl/getPrismaRuntimeUrl` 会强制修正 SSL 与超时参数。
- 不再需要设置 `PRISMA_CLIENT_ENGINE_TYPE`。
- 可选：如果历史上设置过 `NODE_OPTIONS=--dns-result-order=ipv4first`，可以保留，但对 HTTP/Fetch 通道收益有限。

## 本地开发

1. 安装依赖：
   - `@prisma/adapter-neon`
   - `@neondatabase/serverless`
2. 生成客户端：
   - `pnpm exec prisma generate`
3. 运行连接测试：
   - `pnpm vitest run tests/db-connection-adapter.test.ts`

## Vercel 部署注意事项

- Serverless 函数生命周期短、并发高，HTTP/Fetch 通道更适配。
- 确保 `DATABASE_URL` 在 Vercel 项目设置中已配置，且包含 `sslmode=require`。
- 无需引入 `ws` 依赖；我们在 Node 环境通过 `neonConfig.poolQueryViaFetch = true` 强制走 fetch。
- 部署后建议添加健康检查（调用一个简单的 Server Action 使用 `prisma.$queryRaw\`SELECT 1\``），验证冷启动与并发场景下稳定性。

## 回滚与备选方案

- 如遇到特定场景适配器不满足需求，可将 `lib/prisma.ts` 改回二进制/TCP 初始化方式，但不建议在 Vercel 使用。
- 如果需要进一步稳定，可在调用层加入轻量的重试与预热逻辑（Guardian 模块）。

## 常见问题

- 连接超时：确认 `DATABASE_URL` 可达，并留意 `buildPrismaUrl` 已设置 `connect_timeout=15s` 与 `pool_timeout=60s`。
- 生成失败：确保 Prisma 版本与 Client 已正确生成（`pnpm exec prisma generate`）。

---

## 附加：健康检查与守护模块用法

### 健康检查 API 路由

- 路径：`/api/health`
- 行为：执行 `SELECT 1`，返回 `{ ok: boolean, latencyMs: number }`
- 用途：Vercel 上线后做可用性检测与冷启动验证。

示例（curl）：

```
curl -s https://<your-vercel-domain>/api/health | jq
```

### Server Action 健康检查

- 文件：`lib/actions/dbHealth.actions.ts`
- 函数：`checkDbHealth()` 返回 `{ ok, latencyMs, error? }`
- 用途：页面或管理后台触发一次健康检测与预热。

示例：

```ts
import { checkDbHealth } from '@/lib/actions/dbHealth.actions'

export async function triggerHealthCheck() {
  const res = await checkDbHealth()
  return res
}
```

### Prisma 连接守护模块（DAL 可复用）

- 文件：`lib/guard/prismaGuard.ts`
- 导出：
  - `prewarmPrisma()`：执行一次 `SELECT 1` 预热。
  - `withPrismaGuard(fn, { attempts, prewarm, baseDelayMs })`：为 Prisma 操作提供重试与指数退避。

在 DAL 中使用示例（已集成）：

```ts
import { withPrismaGuard } from '@/lib/guard/prismaGuard'
import { prisma } from '@/lib/prisma'

export async function getUserByStackId(id: string) {
  if (!id || typeof id !== 'string') return null
  return await withPrismaGuard(async (client) => {
    const user = await client.users_sync.findUnique({ where: { id } })
    return user ?? null
  }, { attempts: 3, prewarm: true })
}
```

### 何时使用守护模块

- Server Actions 中的首个数据库操作（易受冷启动影响）。
- 高并发下容易触发短时 P1001 的场景（建议 `attempts>=3`）。
- 关键写操作前的预热（`prewarm: true`）。
