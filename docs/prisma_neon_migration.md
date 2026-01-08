# Prisma + Neon Auth 安全迁移工作流复盘（成功案例）

本文总结了最近一次成功的迁移流程，梳理遇到的问题与解决方案，并提供可复制的 Step-by-step 指南，帮助今后更高效且安全地进行数据表结构变更。

## 背景与目标
- 目标：在不影响生产的前提下，完成 Prisma 迁移的生成、验证与发布，并确保与 Neon Auth 的外键关系保持一致。
- 场景：`LlmUsageLog` 表结构扩展、主键类型变更（`Int`→`String`），以及若干与 `neon_auth.users_sync(id)` 的外键恢复统一。

## 前置条件
- 项目使用 `prisma.config.ts`（Prisma CLI 不会自动加载 `.env`），因此迁移命令需要显式注入数据库连接字符串。
- 提供两个脚本：
  - `scripts/prisma-with-env.mjs`：Prisma CLI 环境注入封装。支持通过 `PRISMA_DATABASE_URL` 或 `DATABASE_URL` 指定数据库。
  - `scripts/neon-branch-workflow.mjs`：Neon 分支工作流（创建临时分支→验证迁移→发布→清理）。
- 已安装依赖：`@neondatabase/api-client`（用于 Neon API 操作）。

## 环境变量配置
将以下环境变量写入 `.env.local`（仅示例，实际值请使用你的 Neon 控制台生成的值）：

```
NEON_API_KEY=xxxxxx                 # Neon API Key（用于脚本管理分支）
NEON_PROJECT_ID=damp-smoke-55359446 # 项目 ID（示例：CareerSherpa）

# 可选：主分支连接（也可在命令中通过 PRISMA_DATABASE_URL 临时覆盖）
DATABASE_URL=postgresql://neondb_owner:***@ep-...-pooler.c-2.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require
```

## 快速步骤（Step-by-step）

### 1) 修改 Prisma Schema
- 在 `prisma/schema.prisma` 中完成结构变更（例如 `LlmUsageLog` 的字段拓展、主键类型从 `Int`→`String`）。
- 与 Neon Auth 对齐：所有用户外键统一指向 `neon_auth.users_sync(id)` 且保留合理的删除/更新策略（如 `CASCADE` / `SET NULL`）。
- 若涉及向量字段（pgvector），使用 `Unsupported("vector(2048)")` 并通过 DAL 层执行 raw SQL 写入/相似度查询。

### 2) 生成迁移 SQL（Diff）
当 `migrate dev` 报 drift 或无法生成清晰迁移时，推荐用 Diff 生成 SQL：

```
node scripts/prisma-with-env.mjs migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script
```

- 将输出的 SQL 保存为迁移文件，例如：
  - `prisma/migrations/20251106123000_m4_llm_usage_log_expansion/migration.sql`
- 注意：如果改用 `--from-migrations` 比较，需要提供 `--shadow-database-url`（建议仅在本地开发或临时数据库上执行）。

### 3) 在临时分支验证迁移
推荐使用自动工作流脚本（需要 `NEON_API_KEY`）：

```
pnpm run neon:branch:verify-and-deploy
```

- 脚本流程：创建临时分支 → 获取连接串 → 在临时分支执行 `migrate deploy` → 如全部成功则切回主分支执行发布 → 根据参数决定是否保留临时分支。
- 如果需要手动执行（或作为扩展操作），可以：
  1. 在 Neon 控制台或 SDK 里创建临时分支（命名建议：`temp-migrate-<feature>-<YYYYMMDD>`）。
  2. 拿到临时分支连接串，执行：
     ```
     PRISMA_DATABASE_URL="postgresql://...temp-branch.../neondb?sslmode=require" \
     node scripts/prisma-with-env.mjs migrate deploy
     ```
  3. 验证无报错，确保 SQL 变更、索引、外键均正确应用。

### 4) 在主分支安全部署迁移
获得主分支连接串后执行：

```
PRISMA_DATABASE_URL="postgresql://...main-branch.../neondb?sslmode=require" \
node scripts/prisma-with-env.mjs migrate deploy
```

### 5) 删除临时分支
- 如使用自动脚本，可忽略或根据参数自动清理；手动执行则在 Neon 控制台/SDK 删除临时分支。

### 6) 生成 Prisma Client
在主分支连接上执行 Client 生成以同步类型：

```
PRISMA_DATABASE_URL="postgresql://...main-branch.../neondb?sslmode=require" \
node scripts/prisma-with-env.mjs generate
```

## 示例命令（基于成功案例）
- 生成 Diff（并保存为迁移文件）：
  ```
  node scripts/prisma-with-env.mjs migrate diff \
    --from-schema-datasource prisma/schema.prisma \
    --to-schema-datamodel prisma/schema.prisma \
    --script
  ```
- 在临时分支应用迁移：
  ```
  PRISMA_DATABASE_URL="postgresql://neondb_owner:***@ep-red-paper-.../neondb?sslmode=require" \
  node scripts/prisma-with-env.mjs migrate deploy
  ```
- 在主分支应用迁移：
  ```
  PRISMA_DATABASE_URL="postgresql://neondb_owner:***@ep-billowing-snow-.../neondb?sslmode=require" \
  node scripts/prisma-with-env.mjs migrate deploy
  ```
- 生成 Prisma Client：
  ```
  PRISMA_DATABASE_URL="postgresql://neondb_owner:***@ep-billowing-snow-.../neondb?sslmode=require" \
  node scripts/prisma-with-env.mjs generate
  ```

## 常见问题与排错
- 找不到 `DATABASE_URL`：
  - 原因：存在 `prisma.config.ts` 时，Prisma CLI 不会自动加载 `.env`。
  - 解决：使用 `scripts/prisma-with-env.mjs` 并显式提供 `PRISMA_DATABASE_URL` 或在命令前导出 `DATABASE_URL`。

- `migrate dev` 提示 schema drift（例如外键被移除）：
  - 现象：提示若干外键（如 `quotas`, `resumes`, `services` 等的 `user_id`）已移除，建议 reset。
  - 方案：使用 `migrate diff` 生成精确 SQL，恢复并统一外键至 `neon_auth.users_sync(id)`，避免生产环境 reset 导致数据丢失。

- 向量类型 `vector` 不被 Prisma 直接支持：
  - 解决：在 `schema.prisma` 用 `Unsupported("vector(2048)")` 并在 DAL 使用 `prisma.$executeRaw` / `prisma.$queryRaw` 操作向量。

- Neon 脚本报 `NEON_API_KEY` 缺失：
  - 解决：在 `.env.local` 设置 `NEON_API_KEY`；或改为手动获取连接串并用 `PRISMA_DATABASE_URL` 执行迁移。

- 需要 Shadow DB 的情况：
  - 当使用 `--from-migrations` 比较时，请提供 `--shadow-database-url` 指向一个空的临时数据库，用于安全生成差异。

## 设计约束与最佳实践
- 遵循 “Server Actions First” 与 DAL 统一数据访问；不要在组件或 API 路由中直接实例化 `PrismaClient`。
- 外键统一指向 `neon_auth.users_sync(id)` 并合理设置 `ON DELETE` / `ON UPDATE` 策略。
- 生产环境避免使用 `migrate dev` 或 `db push`，统一使用 `migrate deploy`。
- 危险操作：`npx prisma migrate reset --force` 会清空数据，仅在受控环境且明确确认后使用。
- 变更后务必 `generate` 以同步 TypeScript 类型，并检查受影响的 DAL 与业务逻辑：
  - 主键类型改为 `string`（`cuid()`）：请同步更新所有 ID 类型定义与写入逻辑。
  - 新增字段（如 `model_id`, `provider`, `task_template_id`, `total_tokens` 等）在 DAL 层补充写入赋值。

## 附录
- 参考脚本：
  - `scripts/prisma-with-env.mjs`（Prisma 环境注入）
  - `scripts/neon-branch-workflow.mjs`（Neon 分支工作流）
- 参考命令：
  - 拉取当前数据库结构（只打印）：`pnpm dlx prisma db pull --print`
  - 部署迁移：`node scripts/prisma-with-env.mjs migrate deploy`
  - 生成 Client：`node scripts/prisma-with-env.mjs generate`

---
如需我将某次具体变更整理为“可直接复制执行”的命令清单（带分支名与迁移名），请告知变更内容与命名规范。我们也可以将工作流脚本扩展为：自动命名临时分支、在完成后默认删除临时分支，并输出对账信息（已应用迁移列表、外键校验结果等）。

## TL;DR 速查清单（Runbook）
- 修改 `prisma/schema.prisma`（确保外键统一指向 `neon_auth.users_sync(id)`）。
- 生成 SQL Diff 并保存为迁移文件：
  - `node scripts/prisma-with-env.mjs migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script`
  - 将输出保存到 `prisma/migrations/<timestamp>_<name>/migration.sql`
- 在临时分支验证：
  - 自动：`pnpm run neon:branch:verify-and-deploy`
  - 或手工：`PRISMA_DATABASE_URL="postgresql://...temp-branch.../neondb?sslmode=require" node scripts/prisma-with-env.mjs migrate deploy`
- 在主分支发布：
  - `PRISMA_DATABASE_URL="postgresql://...main-branch.../neondb?sslmode=require" node scripts/prisma-with-env.mjs migrate deploy`
- 清理临时分支（若未自动清理）：在 Neon 控制台或用 SDK 删除。
- 生成 Prisma Client：
  - `PRISMA_DATABASE_URL="postgresql://...main-branch.../neondb?sslmode=require" node scripts/prisma-with-env.mjs generate`

## 脚本参数与环境说明
- `scripts/neon-branch-workflow.mjs`（示例命令：`pnpm run neon:branch:verify-and-deploy`）
  - 必需环境：`NEON_API_KEY`、`NEON_PROJECT_ID`（可在 `.env.local` 配置）。
  - 典型流程：创建临时分支 → 迁移验证 → 主分支发布 → 清理临时分支。
  - 常用参数：
    - `--keep-branch` 保留临时分支（默认建议删除以降低维护成本）。
  - 无法使用 API 时的替代方案：手动从 Neon 控制台获取临时分支/主分支连接串，分别以 `PRISMA_DATABASE_URL` 注入执行 `migrate deploy`。

## Shadow DB 设置（用于复杂 Diff）
- 当需要 `--from-migrations` 对比迁移目录时，需提供 `--shadow-database-url` 指向一个空库：
  - 在 Neon 创建一个临时数据库或临时分支中的新数据库。
  - 示例：
    ```
    SHADOW_DATABASE_URL="postgresql://...shadow-db.../neondb?sslmode=require"
    node scripts/prisma-with-env.mjs migrate diff \
      --from-migrations prisma/migrations \
      --to-schema-datamodel prisma/schema.prisma \
      --shadow-database-url "$SHADOW_DATABASE_URL" \
      --script
    ```
  - 注意：Shadow DB 不用于生产数据，只作为生成迁移差异的临时对照。

## 命名规范建议
- 迁移文件夹：`<YYYYMMDDHHMMSS>_<scope>_<short_description>`（如：`20251106123000_m4_llm_usage_log_expansion`）。
- 临时分支：`temp-migrate-<feature>-<YYYYMMDD>`（如：`temp-migrate-llm-usage-logs-20251106`）。

## 验证检查清单（发布前必做）
- 表结构：主键类型、非空约束、默认值是否按预期。
- 外键：统一指向 `neon_auth.users_sync(id)`，且 `ON DELETE` / `ON UPDATE` 策略正确（如 `CASCADE` / `SET NULL`）。
- 索引：包含查询热点的复合索引（如 `user_id + created_at DESC`、`task_template_id + created_at DESC`）。
- 兼容性：DAL/Service 中的类型与写入逻辑已同步（尤其 ID 类型从 `number`→`string`）。
- 示例读写：对新增列执行一次写入/读取以确认兼容。

## 回滚与热修策略
- 发现问题但未发布到主分支：在临时分支上修复迁移 SQL，重新验证即可。
- 已发布到主分支：
  - 快速热修：创建新的修复迁移并 `migrate deploy`。
  - 分支回退（Neon 提供）：可基于父分支 LSN 创建回退分支，用于比对或恢复数据（建议通过 Neon 控制台/SDK操作，谨慎使用）。
  - 避免 `reset`：生产环境不使用 `migrate reset`，除非明确确认且有数据备份方案。

## 方法选择矩阵
- `migrate deploy`：生产与验证分支的标准发布方式。
- `migrate dev`：本地开发，可能触发 reset；不用于生产。
- `db pull --print`：拉取数据库实际结构用于对齐参考。
- `migrate diff`：在 drift 情况下生成精确 SQL 迁移，避免重置数据。

## 本次成功案例的关键经验
- 现象：`migrate dev` 报告 drift（若干外键被移除），提示 reset。
- 解决：改用 `migrate diff` 生成精确 SQL，恢复并统一所有 `user_id` 外键到 `neon_auth.users_sync(id)`；随后在临时分支验证成功后再发布。
- 兼容：将 `LlmUsageLog.id` 改为 `TEXT`（删除序列）、`cost` 改为 `double precision`、新增若干审计/统计字段，并补充复合索引以提升查询性能。
- 工具：因 `prisma.config.ts` 存在，需要使用封装脚本显式注入 `PRISMA_DATABASE_URL`；自动分支脚本需配置 `NEON_API_KEY` 才能执行。

## 后续建议（可选增强）
- 将 `neon-branch-workflow` 扩展为：默认自动删除临时分支、自动命名、输出对账信息（已应用迁移列表、外键校验结果、索引存在性检查）。
- 在 CI 中集成：
  - 在 PR 合并前运行 `migrate diff` 生成迁移并校验 SQL 规范（禁止危险语句如全表 `DROP`）。
  - 在预览环境（Neon 分支）运行 `migrate deploy` 并执行 e2e 校验。

## 端到端示例：LlmUsageLog 结构变更（简化示意）

> 以下示例为简化模型片段与 DAL 写入逻辑，目的是展示变更方向与调用方式；请以项目中的真实 `schema.prisma` 和 `lib/dal/llmUsageLog.ts` 为准进行适配。

### 模型（前后对比的要点）
```prisma
// 变更前（示意）：主键为 Int，自增；部分字段非空约束较严格
model LlmUsageLog {
  id          Int      @id @default(autoincrement())
  model_name  String
  cost        Decimal?
  created_at  DateTime @default(now())
}

// 变更后（示意）：主键改为 String（cuid），新增审计/统计字段、放宽约束与类型调整
model LlmUsageLog {
  id              String   @id @default(cuid())
  model_id        String
  model_name      String?
  provider        String
  is_stream       Boolean  @default(false)
  is_success      Boolean  @default(true)
  latency_ms      Int
  total_tokens    Int      @default(0)
  cost            Float?
  service_id      String?
  task_template_id String
  user_id          String?
  created_at       DateTime @default(now())
  @@index([user_id, created_at(sort: Desc)], name: "llm_usage_logs_user_id_created_at_idx")
  @@index([task_template_id, created_at(sort: Desc)], name: "llm_usage_logs_task_template_id_created_at_idx")
}
```

### DAL 写入逻辑（示意 TypeScript）
```ts
// lib/dal/llmUsageLog.ts（示意片段）
import { prisma } from '@/lib/prisma'

export async function createUsageLog(input: {
  modelId: string
  provider: string
  modelName?: string
  isStream?: boolean
  isSuccess?: boolean
  latencyMs: number
  totalTokens?: number
  cost?: number
  serviceId?: string
  taskTemplateId: string
  userId?: string
}) {
  return prisma.llmUsageLog.create({
    data: {
      id: undefined, // 由 cuid() 默认生成
      model_id: input.modelId,
      provider: input.provider,
      model_name: input.modelName,
      is_stream: input.isStream ?? false,
      is_success: input.isSuccess ?? true,
      latency_ms: input.latencyMs,
      total_tokens: input.totalTokens ?? 0,
      cost: input.cost,
      service_id: input.serviceId,
      task_template_id: input.taskTemplateId,
      user_id: input.userId,
    },
  })
}
```

### 常用校验 SQL 清单
- 检查索引：
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'llm_usage_logs';
```
- 检查外键：
```sql
SELECT conname AS fk_name, pg_get_constraintdef(oid) AS fk_def
FROM pg_constraint
WHERE conrelid = 'public.llm_usage_logs'::regclass AND contype = 'f';
```
- 检查列与类型：
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'llm_usage_logs'
ORDER BY ordinal_position;
```

### 迁移后冒烟测试（建议）
- 在临时分支与主分支各执行一次写入 + 查询：
  - 写入：创建一条 `llm_usage_logs` 记录，包含 `latency_ms`、`total_tokens`、`task_template_id` 等关键字段。
  - 查询：
    - 按 `user_id + created_at DESC` 分页查询最近记录；
    - 按 `task_template_id + created_at DESC` 查询最近使用情况；
    - 汇总统计（例如 `AVG(latency_ms)`, `SUM(total_tokens)`）以验证类型与默认值的正确性。

## Drift 处理 SOP（详细）
1. 观察 `migrate dev` 提示（如外键被移除）：谨慎，生产不可 `reset`。
2. 使用 `migrate diff` 生成精确 SQL：
   - 优先 `--from-schema-datasource` 与 `--to-schema-datamodel`，快速比对当前库与模型。
   - 如需严格按迁移历史对比，改用 `--from-migrations`，但务必提供 `--shadow-database-url`。
3. 将生成的 SQL 保存为迁移文件夹并审阅（外键、索引、类型变更是否符合预期）。
4. 在临时分支 `migrate deploy` 验证，必要时增量修正 SQL。
5. 验证通过后对主分支 `migrate deploy`，最后生成 Prisma Client 并执行冒烟测试。

## 失败恢复 SOP（详细）
- 临时分支失败：修正 SQL 后重试即可，不影响主分支。
- 主分支已应用但出现问题：
  - 立刻创建“热修”迁移（修复索引/约束/类型），`migrate deploy`。
  - 必要时使用 Neon 的分支机制基于父分支 LSN 快速创建对照分支做比对和数据救援（避免直接 reset）。
  - 有数据迁移需求时，编写幂等性脚本（含回滚路径），先在临时分支演练。

## CI 集成示例（片段）
```yaml
# .github/workflows/migrations.yml（示意）
name: Migrations
on:
  pull_request:
    branches: [ main ]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: pnpm install --frozen-lockfile
      - name: Generate SQL diff
        run: |
          node scripts/prisma-with-env.mjs migrate diff \
            --from-schema-datasource prisma/schema.prisma \
            --to-schema-datamodel prisma/schema.prisma \
            --script | tee diff.sql
      - name: Check unsafe statements
        run: |
          if grep -E '(DROP\s+TABLE|TRUNCATE|DELETE\s+FROM\s+[^\s]+$)' diff.sql; then \
            echo "Unsafe statements detected" && exit 1; \
          fi
```