# Prisma + Neon Auth 多 Schema 共生与迁移策略（落地版）

本文面向 CareerShaper 项目，针对「Prisma + Neon Auth」在多 schema 下的迁移与演进问题提供成体系的解决方案，目标是：

- 彻底避免后期迭代时的“重置数据库”与迁移冲突
- 将 Neon 平台托管的 `neon_auth` 表与应用侧 `public` 表实现有机共生
- 维持稳定的 Prisma Migrate 工作流，并允许安全、可控地对应用侧数据表迭代升级

---

## TL;DR（结论先行）

- 把 `neon_auth`（平台托管的用户表）声明为「外部管理表」，让 Prisma Client 可读，但 Prisma Migrate 不再尝试创建/修改它。
- 保留跨 schema 的外键（应用表指向 `neon_auth.users_sync`），但通过「影子数据库初始化脚本」为 Prisma 的 shadow DB 提供占位结构，避免迁移生成期间失败。
- 将 `pgvector` 扩展的启用放到受控的迁移脚本中，并在 shadow DB 初始化脚本里也启用，避免 shadow DB 报「类型不存在」。
- 持续采用 `prisma db pull` 同步平台托管表结构变化，但不把这些变化纳入迁移历史；应用侧的表继续用 `prisma migrate dev/deploy` 以保持规范。

这组策略是 Prisma 官方“Externally Managed Tables”（外部管理表）与“Multi-schema”能力的组合使用，适配 Neon/Supabase 等平台托管的 schema，具有社区共识与文档支持。

---

## 1. 现状回顾（我们做过的尝试与失败原因）

- 多次 `migrate dev` 失败（P3006/P3018 等），核心场景有：
  - shadow database 没有 `pgvector` 扩展，导致 baseline 迁移中的 `vector(...)` 类型不可用；
  - Prisma 试图在迁移中创建 `neon_auth.users_sync`，但该表包含 Neon Auth 的复杂默认表达式（例如从 JSON 列中取值作为默认值），这在 `CREATE TABLE ... DEFAULT` 时会触发 `cannot use column reference in DEFAULT expression`；
  - 反复的 baseline 重写、人工删除迁移目录、强行 resolve 或 reset，短期可过，但长期必然破坏迁移历史稳定性。
- `db pull` 虽能把实际数据库状态拉回 `schema.prisma`，但把 `neon_auth` 一并拉入后，Prisma Migrate 又会尝试管理它，造成 drift（架构漂移）与迁移冲突。

根因：Prisma Migrate 假设“迁移文件即数据库真相”。当数据库里存在由平台或外部服务托管的 schema/table（如 Neon Auth）并且它们的 DDL 与 Prisma 的迁移模型不兼容时，shadow DB 校验就会失败，进而触发“建议 reset”的危险操作。

---

## 2. 社区最佳实践与官方建议（有据可依）

- Multi-schema（多 schema）与外部管理表：
  - Prisma 官方文档明确支持多 schema，并允许将某些表声明为“外部管理”，这样它们可被 Prisma Client 查询，但不会被 Prisma Migrate 改动。[Prisma Multi-schema 文档][1]、[Prisma 外部管理表文档][2]。
  - 外部管理表可与应用侧表建立关系；为让 Migrate 在生成迁移时正确处理外键，需要通过 `initShadowDb` 提供影子库占位表结构（至少主键列要匹配）。[Prisma Config 参考][3]。
- Supabase 官方也提示：平台托管的 schema（如 `auth`, `storage`）不要交给 Prisma 管理，否则会产生 drift；推荐用 baselining 或将其视为外部管理资源。[Supabase Prisma 故障排除][4]。
- Prisma 官方版本更新与博客亦强调：外部管理表是常见诉求（例如 Supabase 的 `auth.users`），应通过 `prisma.config.ts` 声明并结合 shadow DB 初始化脚本解决迁移期依赖问题。[Prisma 博客（v6.13 外部表 & pgvector）][5]。

---

## 3. 可行方案（架构级）

### 方案 A：单 Prisma 工程 + 外部管理表（推荐）

- 在 `prisma.config.ts` 中启用 `externalTables`，声明 `neon_auth.users_sync` 为外部管理表，并在 `migrations.initShadowDb` 中：
  - 创建 `neon_auth` schema；
  - 创建占位的 `users_sync`（只需主键与被引用的列，例如 `id`, `deleted_at`）；
  - 启用 `pgvector` 扩展。
- `schema.prisma` 保留 `schemas = ["public", "neon_auth"]`，并定义 `users_sync` 模型，但迁移生成时不对其做任何 DDL。
- 应用侧表（`public`）继续使用 `migrate dev/deploy`；Neon 对 `neon_auth` 的升级通过 `db pull` 同步到本地 schema（只用于类型与关系推断），不参与迁移。

优点：

- 一套 Prisma Client 即可跨 schema 查询；
- 避免后期 drift 与“建议 reset”，不破坏历史迁移；
- 适配 Neon/Supabase 等平台托管 schema 的常见模式。

### 方案 B：双 Prisma 工程（分离客户端；可选）

- 将 `public` 与 `neon_auth` 分别维护在两套 schema 文件与 client 输出路径，`public` 参与迁移，`neon_auth` 只做 `db pull` 与查询。
- 缺点是复杂度上升，迁移脚本与 client 使用更分散；在当前项目规模下优先采用方案 A。

---

## 4. 落地步骤（不改动现有数据，稳妥推进）

注意：以下为“建议清单”，请按优先级与环境约束实施；生产环境只用 `migrate deploy`，避免 `reset`。

1. 创建 Prisma Config（声明外部管理表与影子库初始化）

- 文件：`prisma.config.ts`（示例草案）

```ts
import { defineConfig } from 'prisma/config'

export default defineConfig({
  experimental: { externalTables: true },
  // 如果你的 schema 文件不在默认位置，可显式指定：
  // schema: "prisma/schema.prisma",

  tables: {
    external: [
      // 完全限定名：schema.table
      'neon_auth.users_sync',
    ],
  },

  migrations: {
    // 供 shadow DB 在生成迁移前执行的初始化 SQL
    initShadowDb: `
      -- 确保存在 neon_auth schema
      CREATE SCHEMA IF NOT EXISTS neon_auth;

      -- 在影子库创建占位表（主键列必须存在，其它列按需）
      CREATE TABLE IF NOT EXISTS neon_auth.users_sync (
        id TEXT PRIMARY KEY,
        deleted_at TIMESTAMPTZ(6)
      );

      -- 影子库启用 pgvector，避免类型不存在
      CREATE EXTENSION IF NOT EXISTS vector;
    `,
  },
})
```

2. 保持 `schema.prisma` 的 multi-schema 设置，但不要让 Prisma 管理 `neon_auth` 的 DDL

- `datasource db` 保持：`schemas = ["neon_auth", "public"]`；
- 继续在 `schema.prisma` 里保留 `users_sync` 模型（`@@schema("neon_auth")`），以及应用侧表对它的关系定义（外键在 `public` 表上创建，外部表不被修改）。

3. 同步平台变更（只影响 Client，不影响迁移）

- 当 Neon Auth 更新 `users_sync` 结构时，执行：

```bash
pnpm dlx prisma db pull
```

- 之后：

```bash
pnpm dlx prisma generate
```

- 这会更新本地模型与客户端类型，不会生成迁移，也不会碰数据库的 `neon_auth`。

4. 应用侧表的正常迭代

- 新增应用表或列（例如 `LlmUsageLog`）：

```bash
pnpm dlx prisma migrate dev --name add_llm_usage_log
```

- 部署到生产：

```bash
pnpm dlx prisma migrate deploy
```

- 注意：生产不要使用 `reset`；若遇到 drift，请先审查是否涉及平台托管 schema。

5. 关于 `pgvector`

- 继续在迁移中显式启用：

```sql
-- 置于首个需要向量类型的迁移文件最顶部
CREATE EXTENSION IF NOT EXISTS vector;
```

- 影子库也通过 `initShadowDb` 启用，确保生成期稳定。

6. 出问题时的排查与补救

- 若再次出现 drift 指向 `neon_auth`：
  - 检查 `prisma.config.ts` 的 `tables.external` 是否包含 `neon_auth.users_sync`；
  - 检查 `initShadowDb` 是否创建了占位表与扩展；
  - 执行 `db pull` + `generate`，但不要把 `neon_auth` 的变更做成迁移；
- 若 drift 指向 `public`：
  - 按正常流程解决（增量迁移或必要时的 baselining），不要直接改已应用的迁移 SQL 文件。

---

## 5. 迁移与运维守则（避免“定时炸弹”）

- 严禁修改/删除已应用的迁移文件；如需热修复，使用新迁移做“修正”。
- 生产环境只用 `migrate deploy`；绝不做 `reset`。
- 平台托管 schema（`neon_auth`）只做 `db pull` 与 Client 更新，不参与迁移。
- Shadow DB 初始化脚本是关键护栏：保证迁移生成期不会因为外部表或扩展缺失而失败。
- 定期审计：每次平台升级或 `db pull` 后，确保 `schema.prisma` 与应用侧 DAL 一致。

---

## 6. 风险评估与权衡

- 外部管理表为 Preview 特性：需关注 Prisma 版本更新与文档变更；但其使用场景广泛（Supabase/Clerk/Auth0），社区已形成共识。
- 关系管理：Prisma 只在应用侧表上创建外键；不会修改外部表，符合平台托管边界。
- 一旦外部表结构变化（由平台驱动），我们需要执行 `db pull` + `generate` 更新模型类型，但不会触发迁移。
- 如未来决定完全去除 DB 级外键，可考虑 `referentialIntegrity = "prisma"` 的策略（由应用层保证一致性），但目前不建议做无谓牺牲。

---

## 参考与来源

- [1] Prisma 文档：Multi-schema（多 schema）
  https://www.prisma.io/docs/orm/prisma-schema/data-model/multi-schema
- [2] Prisma 文档：Externally managed tables（外部管理表，Preview）
  https://www.prisma.io/docs/orm/prisma-schema/data-model/externally-managed-tables
- [3] Prisma 文档：prisma.config.ts 参考（含 `tables.external` 与 `migrations.initShadowDb`）
  https://www.prisma.io/docs/orm/reference/prisma-config-reference
- [4] Supabase 文档：Prisma 故障排除（托管 schema 导致 drift 的说明）
  https://supabase.com/docs/guides/database/prisma/prisma-troubleshooting
- [5] Prisma 博客：v6.13.0（外部表与 pgvector 支持）
  https://www.prisma.io/blog/orm-6-13-0-ci-cd-workflows-and-pgvector-for-prisma-postgres

# 2. todo #2

下面给出基于你当前状态的可执行步骤与原因说明，严格避免再次 reset，并确保后续的迁移与迭代稳定。

**现状确认**

- 数据库现实状态：
  - `public` 为空。
  - `neon_auth` 下已有 `users_sync`（你已手工 re-enable）。
- 仓库状态：
  - 已创建 `prisma.config.ts`，声明 `neon_auth.users_sync` 为“外部管理表”，并在 `initShadowDb` 中创建影子库占位表与启用 `pgvector`。
  - `prisma/schema.prisma` 保留所有应用侧模型（均在 `public`），并包含 `LlmUsageLog`；同时也有 `users_sync` 的模型用于关系。

这正是我们需要的基础：让 Prisma Migrate 只管理应用侧 `public` 的表，`neon_auth.users_sync` 仅供查询和建立外键，不被迁移创建或修改。该策略符合 Prisma 的多 schema 与外部管理表最佳实践 [1][2][3][5]，也规避 Supabase/Neon 托管 schema 引发 drift 的问题 [4]。

**核心策略**

- 让 Prisma 只为 `public` 创建/演进表；`neon_auth` 全部视为外部管理。
- 在影子库（生成迁移时用于一致性校验的临时库）通过 `initShadowDb` 打桩：
  - 创建 `neon_auth.users_sync` 的占位结构（至少主键与被引用列）。
  - 启用 `pgvector`，避免生成期报 “vector 类型不存在”。
- 在真实数据库中，首个迁移显式启用 `pgvector`，之后创建应用侧表与外键（指向外部管理的 `users_sync`）。

**具体操作步骤（不改动现有代码）**

1. 备份旧的迁移（建议，仅本地操作）

- 若你的 `prisma/migrations/20241106000000_baseline` 曾包含 `neon_auth` 相关 DDL，最好先归档或删除该目录，避免 Prisma 试图重放不兼容的历史迁移。

```bash
rm -rf prisma/migrations/20241106000000_baseline
```

- 说明：这只影响本地迁移目录，不会触碰数据库。当前数据库 `public` 为空，重新生成 baseline 是最安全的做法（避免历史污染）。参考 Prisma 对“历史冲突/外部修改导致 drift”的处理建议 [5][4]。

2. 生成“启用 pgvector”的空迁移（只生成文件，不立即执行）

```bash
pnpm dlx prisma migrate dev --name enable_pgvector --create-only
```

- 打开刚生成的 `prisma/migrations/<timestamp>_enable_pgvector/migration.sql`，在文件首行插入：
  - `CREATE EXTENSION IF NOT EXISTS vector;`
- 说明：虽然你的 `initShadowDb` 已为影子库启用扩展，但真实数据库也必须在首次迁移显式启用，以支持后续 `KnowledgeEntry.embedding Unsupported("vector(2048)")`。此做法与 Prisma 关于 pgvector 的推荐一致 [5]。

3. 生成并应用应用侧 schema 的初始化迁移（在 `public` 创建所有模型、外键与索引）

```bash
pnpm dlx prisma migrate dev --name init_app_schema
```

- 期待效果：
  - Prisma 会根据 `schema.prisma` 创建 `public` 下所有表（含 `LlmUsageLog` 与其它业务表），并建立指向 `neon_auth.users_sync` 的外键。
  - 因你已在 `prisma.config.ts` 声明 `neon_auth.users_sync` 为外部管理表，迁移中不会尝试创建/修改 `neon_auth.users_sync`，从而避免此前的 `DEFAULT` 表达式错误。
- 若出现 drift 提示涉及 `neon_auth`，优先检查两点：
  - `prisma.config.ts` 中是否包含 `tables.external: ["neon_auth.users_sync"]`；
  - `migrations.initShadowDb` 是否包含 `CREATE SCHEMA neon_auth;` 与占位 `users_sync`（主键列与被引用列至少一致），以及 `CREATE EXTENSION vector;`。

4. 生成 Prisma Client（保持类型与模型最新）

```bash
pnpm dlx prisma generate
```

5. 验证数据结构

- 可使用 Prisma Studio 或你现有的测试用例（例如 `tests/quotas.test.ts`）验证 `public` 表已存在并可写入。

```bash
pnpm dlx prisma studio
```

6. 部署到生产（当你需要时）

```bash
pnpm dlx prisma migrate deploy
```

- 说明：生产只使用 `deploy`，严禁 `reset`。平台托管的 `neon_auth` 如有结构变更，通过 `db pull` 拉取到本地更新模型，仍不参与迁移（保持外部管理表策略）：

```bash
pnpm dlx prisma db pull
pnpm dlx prisma generate
```

**常见问题与回退策略**

- 若 `migrate dev` 仍提示需要 reset：
  - 通常是历史迁移目录与数据库 `_prisma_migrations` 不一致导致。当前 `public` 为空，且我们已重建 baseline 的策略是最安全的：确保本地迁移目录仅包含我们刚生成的两步迁移（`enable_pgvector` + `init_app_schema`），再执行 `migrate dev`。这样不会动 `neon_auth`。
- 若影子库仍报 `vector` 类型不存在：
  - 再次确认 `prisma.config.ts` 的 `initShadowDb` 已包含 `CREATE EXTENSION IF NOT EXISTS vector;`。
- 若未来 Neon Auth 升级 `users_sync` 结构：
  - 使用 `db pull` 同步模型与关系，重新 `generate`，不要把这些变化做成迁移；应用侧迭代继续 `migrate dev/deploy`。参考外部管理表与多 schema 指南 [2][1]。

**为什么这套方案可行**

- Prisma 官方提出“外部管理表”用于 Supabase/Clerk/Auth0 等托管服务的用户/会话等数据表，不应由迁移修改，但可被 Client 查询并建立关系；生成迁移时，通过 `initShadowDb` 在影子库打桩，避免生成期失败 [2][3]。
- 多 schema 下，Prisma Migrate 仅对受管的 schema/table 生成与应用迁移；托管 schema 由平台演进，通过 `db pull` 更新本地模型 [1]。
- Supabase 官方明确指出：把托管 schema 交给 Prisma 管理会导致 drift；建议基于 baselining 或外部管理表策略解决 [4]。
- pgvector 的启用应在迁移中显式处理，Prisma 博客与文档也提供了可行方案 [5]。

如需，我可以代你把“启用 pgvector”的 SQL 插入到刚生成的迁移文件顶部，并在不触碰其他代码的前提下，确认 `init_app_schema` 正常生成与应用。你也可以按上述步骤先自行操作，我再协助验证与补充。

参考文献

- [1] Prisma 文档：Multi-schema（多 schema） https://www.prisma.io/docs/orm/prisma-schema/data-model/multi-schema
- [2] Prisma 文档：Externally managed tables（外部管理表，Preview） https://www.prisma.io/docs/orm/prisma-schema/data-model/externally-managed-tables
- [3] Prisma 文档：prisma.config.ts 参考（含 `tables.external` 与 `migrations.initShadowDb`） https://www.prisma.io/docs/orm/reference/prisma-config-reference
- [4] Supabase 文档：Prisma 故障排除（托管 schema 导致 drift） https://supabase.com/docs/guides/database/prisma/prisma-troubleshooting
- [5] Prisma 博客：v6.13.0（外部表与 pgvector 支持） https://www.prisma.io/blog/orm-6-13-0-ci-cd-workflows-and-pgvector-for-prisma-postgres

# 3. todo #3

核心结论

- Neon Auth 的 neon_auth.users_sync 表必须由插件托管，你的迁移里手工创建或改造它，Neon Console 就会报错。我们已经把它标记为“外部托管”，并在影子库（仅用于生成迁移的临时库）里用占位结构兜底，避免 Prisma 生成迁移时再报错。
- 应用侧 schema.prisma 的 users_sync 模型与 Neon 插件自动生成的真实表字段不完全一致是可以接受的，只要你不尝试通过 Prisma 迁移去“修改”这个表。关系外键只依赖 id ，这是稳定的。
- 不建议在生产环境用“无迁移文件”的方式维护（ db push ），但可以采用安全流程来彻底避免你担心的数据清空风险。
  为什么 Neon 不认你刚才创建的 users_sync

- Neon Auth 插件认为 neon_auth.users_sync 是它的“系统表”，必须由插件创建与管理。
- 你在迁移里创建了占位表（即便是 IF NOT EXISTS ），Neon Console 会检测到这不是它管理的版本，进而报错。
- 当前我们已经把 neon_auth.users_sync 配置为 external（外部托管），并在影子库里创建占位表仅为生成迁移服务，不会作用到你的实际数据库。这样 Prisma 在生成/应用迁移时不会再对它发号施令。
  字段不一致会不会有问题

- 不会影响外键与应用的主流程。建议仅将 users_sync 用作用户主键来源（ id 字段），不要依赖其非关键字段（例如 name/email/created_at ）。
- 如果你需要展示用户的名字/邮箱，建议改为通过 Neon Auth 的 API 或你自己的用户缓存/映射来获取，而不是直接读 users_sync 的列。
- 若你确实想在 Prisma 里“看见”这些字段以便读取：可以保留 users_sync 模型并使用 @default(dbgenerated(...)) / @db.\* 类型去映射它们，但务必保持“只读”，且已设置为 external，避免迁移去改变它。
  是否需要 pull / push 对齐

- 可选但不强制。你可以用 prisma db pull --print 把 Neon 当前的真实结构打印出来，仅参考 users_sync 模型那一段，手工更新到你的 schema.prisma 中（保持 external，绝不迁移该表）。这样 Prisma Client 查询时更贴近真实结构。
- 不要对 users_sync 做 db push 或生成迁移。外部托管意味着让 Prisma 忽略该表的结构差异，不参与迁移修改。
  后续维护如何尽量避免生产事故

- 生产环境只用 prisma migrate deploy ，绝不使用 reset 、 dev 、 db push 。这三者都可能清数据或直接改结构。
- 在 Neon 用“分支”做变更隔离：
  - 创建 Neon 临时分支（copy-on-write，近乎零风险）。
  - 指向该分支跑 prisma migrate dev ，生成迁移并验证功能。
  - 分支验证通过后再在主分支执行 prisma migrate deploy ，这样不会清数据、不会触碰外部托管的表。
- 开发环境可以用 prisma db push 快速迭代，但建议只对非关键表使用，并避免“数据破坏”操作（不要加 --accept-data-loss ）。最终还是用 migrate dev 生成正式迁移文件，提交并在生产用 migrate deploy 。
- 永远把外部系统托管的对象（如 neon_auth.users_sync 、第三方扩展或受控视图）加入 prisma.config.ts 的 external 列表，并在 initShadowDb 里准备占位表/扩展（仅影子库），避免“类型不存在/外键未准备”的迁移失败。
  我们当前项目的安全状态

- neon_auth.users_sync 已标记为 external，并且影子库会在迁移生成阶段创建占位结构与 pgvector 扩展，避免你再次遇到“类型不存在/表未就位”的报错。
- 初始迁移已落地且数据库与迁移历史一致；后续我们不再改动历史迁移（避免 drift），变更都用新迁移文件。
  推荐的操作流（简版）

- 开发分支： prisma db push （仅开发用）→ prisma migrate dev （生成迁移）
- 验证分支（Neon 临时分支）：指向该分支运行迁移与回归测试
- 生产主分支： prisma migrate deploy
- 禁用： migrate reset 、修改已应用的历史迁移、对 external 表做结构变更

# Neon 分支工作流脚本

- 新增脚本与命令：
  - 文件： scripts/neon-branch-workflow.mjs
  - 命令： neon:branch:verify-and-deploy （默认保留临时分支）
  - 依赖：已安装 @neondatabase/api-client
- 工作流步骤（单命令完成）：
  - 创建临时分支（命名如 tmp-migrate-YYYYMMDD-HHMMSS ）
  - 获取临时分支连接串，执行 prisma migrate status → prisma migrate deploy 验证迁移
  - 切回主分支连接串，执行 prisma migrate deploy 安全部署
  - 默认保留临时分支，可传参关闭
- 环境变量（需在 .env.local 或系统环境中配置）：
  - NEON_API_KEY （必填）
  - NEON_PROJECT_ID （必填）
  - NEON_DATABASE_NAME （可选，未提供则用默认数据库）
  - NEON_ROLE_NAME （可选，未提供则用项目默认角色）
- 运行示例：

  - 创建、验证并部署（保留临时分支）： pnpm run neon:branch:verify-and-deploy
  - 指定分支名： pnpm run neon:branch:verify-and-deploy -- --branch-name tmp-feature-x
  - 仅演示不执行迁移： pnpm run neon:branch:verify-and-deploy -- --dry-run
  - 验证后删除临时分支： node scripts/neon-branch-workflow.mjs （不加 --keep-branch ）
    实现细节

- scripts/prisma-with-env.mjs ：新增 Prisma 包装脚本，自动加载 .env.local ，并支持通过 PRISMA_DATABASE_URL 覆盖 DATABASE_URL 。项目中的 db:\* 命令已切换到该包装脚本。
- package.json ：
  - 新增 neon:branch:verify-and-deploy 命令
  - 依赖新增 @neondatabase/api-client
- 脚本行为：

  - 使用 Neon SDK 列出分支、创建分支、获取连接串、删除分支
  - 在临时分支上执行 migrate deploy 验证迁移，随后在主分支执行 migrate deploy 安全部署
  - 不触碰 reset ，不对 external 表做结构操作
    后续建议

- 首次使用前，先在 .env.local 写入：
  - NEON_API_KEY=...
  - NEON_PROJECT_ID=...
- 如果你希望每次验证后自动删除临时分支，将命令改为：
  - \"neon:branch:verify-and-deploy\": \"node scripts/neon-branch-workflow.mjs\"
- 如需在分支上额外做检查，可在脚本里增加：
  - prisma migrate status 后附加集成测试或只读 SQL 验证（例如检查扩展 vector 是否安装）

# 迁移案例

问题已定位：你直接运行 `npx prisma migrate dev` 时，Prisma 检测到存在 `prisma.config.ts`，于是“不再自动加载 .env 文件”，导致当前进程没有 `DATABASE_URL`，从而抛出 P1012。报错里的提示正是这一点：Prisma config detected, skipping environment variable loading → Environment variable not found: DATABASE_URL。

**为什么会这样**

- 你启用了 `prisma.config.ts`（我们也在其中配置了 external/影子库初始化），Prisma CLI 在这种模式下不再帮你加载 `.env.*`，默认认为“环境变量由宿主进程负责注入”。
- 直接用 `npx prisma ...` 没有注入 `DATABASE_URL`，因此失败。

**快速修复**

- 使用我加的包装脚本，它会读取 `.env.local` 并注入 `DATABASE_URL`：
  - 生成迁移文件（建议先只生成不执行）：`node scripts/prisma-with-env.mjs migrate dev --name m4_llm_usage_log_expansion --create-only`
  - 或直接生成并应用到当前连接的数据库：`node scripts/prisma-with-env.mjs migrate dev --name m4_llm_usage_log_expansion`
- 或者在终端里显式注入环境变量再跑 `npx prisma`：
  - `export DATABASE_URL='你的Neon连接串' && npx prisma migrate dev --name m4_llm_usage_log_expansion`
- 不建议把变量搬到 `.env`，我们项目规范是 `.env.local`，包装脚本已处理加载。

**更安全的流程（推荐）**

- 先生成迁移文件但不执行：`node scripts/prisma-with-env.mjs migrate dev --name m4_llm_usage_log_expansion --create-only`
- 用我加的 Neon 工作流脚本在临时分支验证、再部署到主分支：
  - 创建临时分支并在分支验证迁移：`pnpm run neon:branch:verify-and-deploy`
  - 如需指定分支名：`pnpm run neon:branch:verify-and-deploy -- --branch-name tmp-llm-log-expansion`
  - 验证后默认保留临时分支（你可以去 Neon 控制台查看），若要自动删除，把命令改为：`node scripts/neon-branch-workflow.mjs`
- 生产环境始终用 `migrate deploy`，不要用 `migrate dev` 或 `db push`。

**关于你对 LlmUsageLog 的结构扩充**

- 你把 `id` 从 `Int @default(autoincrement())` 改为 `String @default(cuid())`，这是主键类型变更，Prisma 通常会生成 `ALTER TABLE` 或建议重建索引/列，存在数据时可能需要“USING id::text”之类转换语句。若当前库无关键数据（你之前做过 reset），风险较小。
- 为稳妥，建议按上述“更安全的流程”先在 Neon 临时分支上验证，再部署主分支。

**后续操作**

- 完成迁移后，重新生成客户端以同步类型：
  - `pnpm run db:generate`
- 如遇“变更需要重置数据”提示，请不要在生产库上执行，先在临时分支验证迁移效果。

你现在可以直接执行：

- 仅生成迁移：`node scripts/prisma-with-env.mjs migrate dev --name m4_llm_usage_log_expansion --create-only`
- 临时分支验证并部署：`pnpm run neon:branch:verify-and-deploy`

如果需要，我可以帮你跑一次临时分支验证（可 dry-run 或保留分支），告诉我是否现在执行以及是否保留临时分支。

问题已定位：你直接运行 `npx prisma migrate dev` 时，Prisma 检测到存在 `prisma.config.ts`，于是“不再自动加载 .env 文件”，导致当前进程没有 `DATABASE_URL`，从而抛出 P1012。报错里的提示正是这一点：Prisma config detected, skipping environment variable loading → Environment variable not found: DATABASE_URL。

**为什么会这样**

- 你启用了 `prisma.config.ts`（我们也在其中配置了 external/影子库初始化），Prisma CLI 在这种模式下不再帮你加载 `.env.*`，默认认为“环境变量由宿主进程负责注入”。
- 直接用 `npx prisma ...` 没有注入 `DATABASE_URL`，因此失败。

**快速修复**

- 使用我加的包装脚本，它会读取 `.env.local` 并注入 `DATABASE_URL`：
  - 生成迁移文件（建议先只生成不执行）：`node scripts/prisma-with-env.mjs migrate dev --name m4_llm_usage_log_expansion --create-only`
  - 或直接生成并应用到当前连接的数据库：`node scripts/prisma-with-env.mjs migrate dev --name m4_llm_usage_log_expansion`
- 或者在终端里显式注入环境变量再跑 `npx prisma`：
  - `export DATABASE_URL='你的Neon连接串' && npx prisma migrate dev --name m4_llm_usage_log_expansion`
- 不建议把变量搬到 `.env`，我们项目规范是 `.env.local`，包装脚本已处理加载。

**更安全的流程（推荐）**

- 先生成迁移文件但不执行：`node scripts/prisma-with-env.mjs migrate dev --name m4_llm_usage_log_expansion --create-only`
- 用我加的 Neon 工作流脚本在临时分支验证、再部署到主分支：
  - 创建临时分支并在分支验证迁移：`pnpm run neon:branch:verify-and-deploy`
  - 如需指定分支名：`pnpm run neon:branch:verify-and-deploy -- --branch-name tmp-llm-log-expansion`
  - 验证后默认保留临时分支（你可以去 Neon 控制台查看），若要自动删除，把命令改为：`node scripts/neon-branch-workflow.mjs`
- 生产环境始终用 `migrate deploy`，不要用 `migrate dev` 或 `db push`。

**关于你对 LlmUsageLog 的结构扩充**

- 你把 `id` 从 `Int @default(autoincrement())` 改为 `String @default(cuid())`，这是主键类型变更，Prisma 通常会生成 `ALTER TABLE` 或建议重建索引/列，存在数据时可能需要“USING id::text”之类转换语句。若当前库无关键数据（你之前做过 reset），风险较小。
- 为稳妥，建议按上述“更安全的流程”先在 Neon 临时分支上验证，再部署主分支。

**后续操作**

- 完成迁移后，重新生成客户端以同步类型：
  - `pnpm run db:generate`
- 如遇“变更需要重置数据”提示，请不要在生产库上执行，先在临时分支验证迁移效果。

你现在可以直接执行：

- 仅生成迁移：`node scripts/prisma-with-env.mjs migrate dev --name m4_llm_usage_log_expansion --create-only`
- 临时分支验证并部署：`pnpm run neon:branch:verify-and-deploy`

如果需要，我可以帮你跑一次临时分支验证（可 dry-run 或保留分支），告诉我是否现在执行以及是否保留临时分支。
