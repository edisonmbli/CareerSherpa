# 无需 Webhook：Neon Auth 最佳实践

在 Neon Auth 机制下，您不再需要传统的 Webhook 同步方式。Neon 会自动将认证层（Stack Auth）中的用户资料近实时同步到您的数据库 `neon_auth.users_sync` 表中。业务侧应通过 Stack Auth SDK 完成所有用户资料的增删改操作，数据层仅负责“读”取，并通过 SQL 直接与业务表进行关联和分析。

## 结论与核心思路

- **Neon Auth 自动同步**：Neon Auth 会将 Stack Auth 中的用户资料近实时同步到 `neon_auth.users_sync` 表。
- **移除 Webhook 逻辑**：您的业务不再需要为 Clerk 等服务编写的 Webhook 同步逻辑。
- **Stack Auth SDK 统一操作**：所有用户资料的增删改都应通过 Stack Auth SDK 完成。
- **数据层只读**：`users_sync` 表仅用于读取和关联，不应直接修改。

## 如何与业务逻辑交互（实战范式）

### 1. 读数据：用 SQL 直接关联 `users_sync`

- **只读用户资料**：`neon_auth.users_sync` 包含用户的 `id`、`name`、`email`、时间戳和 `raw_json` 等只读信息。
- **过滤活跃用户**：查询活跃用户时，务必添加 `deleted_at IS NULL` 过滤条件。
- **典型 JOIN 示例**：
  ```sql
  SELECT t.*, u.id AS user_id, u.name AS user_name, u.email AS user_email
  FROM public.todos t
  LEFT JOIN neon_auth.users_sync u ON t.owner = u.id
  WHERE u.deleted_at IS NULL
  ORDER BY t.id;
  ```

### 2. 写数据：用 Stack Auth SDK（不要动 `users_sync`）

- **统一通过 SDK 操作**：用户资料更新、注销、团队/权限管理等操作，应统一通过 `@stackframe/stack` 提供的对象与方法（如 `useUser()`、`stackServerApp.getUser()`、`user.update()`、`user.delete()`）完成。Neon 会将这些变更同步至 `users_sync`。
- **服务器组件获取当前用户**：

  ```typescript
  import { stackServerApp } from '@/stack/server'

  export default async function ServerComponent() {
    const user = await stackServerApp.getUser()
    // 用 user.id 作为业务写入的外键
  }
  ```

### 3. 外键与建模：以 `users_sync(id)` 为主键来源

- **引用 `neon_auth.users_sync(id)`**：您的业务表应引用 `neon_auth.users_sync(id)` 作为外键，而不是修改 Neon Auth 的表结构。
- **创建表示例**：
  ```sql
  CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    content TEXT,
    author_id TEXT NOT NULL REFERENCES neon_auth.users_sync(id) ON DELETE CASCADE
  );
  ```

### 4. 自定义业务资料：单独维护 Profile 扩展表

- **建立 `user_profiles` 表**：如果需要存储更多字段（如地址、偏好、计费状态等），应建立自己的 `user_profiles` 表。
- **使用 `users_sync.id` 关联**：通过 `users_sync.id` 作为主键/外键进行关联。
- **资料真实来源仍是 SDK**：用户资料的真实来源仍是 Stack Auth SDK，`users_sync` 仅供读取和关联。
- **推荐扩展表结构**：
  ```sql
  -- 推荐在扩展表里保留 user_id TEXT UNIQUE NOT NULL REFERENCES neon_auth.users_sync(id)
  -- 并根据需要加索引与审计列。
  ```

### 5. 授权到数据库层（可选但很有价值）

- **对接 JWT 与 Neon RLS**：若希望在数据库层面实现行级访问控制，可将 Stack Auth 的 JWT 与 Neon RLS 对接。
- **使用 `pg_session_jwt` 扩展**：在 Postgres 中定义 RLS 策略，查询时可使用 `auth.user_id()` 自动按当前用户过滤，减少显式 `WHERE` 条件。

## 与 Clerk 的差异与迁移建议

### 差异点

- **Clerk 时代**：通常通过 Webhook 将用户数据推送到业务 `users` 表，需要自行处理数据落地和一致性。
- **Neon Auth**：将这部分“平台化”，由 Neon 直接维护 `users_sync` 的近实时副本，减少了自建同步、补偿和重试的复杂性。

### 迁移建议

- **外键迁移**：将现有业务表中以 Clerk 的 `user_id` 为外键的字段，迁移为以 Neon/Stack Auth 的 `id` 为外键。
  - **平滑过渡**：若历史数据需要平滑过渡，可维护一个“映射表”（`clerk_user_id -> neon_user_id`）进行一次性数据迁移，然后统一切换到新外键。
- **保留业务逻辑**：保留原业务扩展表与业务逻辑，仅将“用户权威数据源”改为 `users_sync`，并将所有用户属性变更入口迁移到 Stack Auth SDK。
- **事件驱动替代方案**：若有依赖用户事件的下游流程（过去靠 Clerk Webhooks 触发），现在的替代方案是：
  - 在**应用层**监听/驱动事件（例如用户变更成功后，在服务里发送 Message/Emit Domain Event），由下游订阅处理。
  - **不建议**给 `users_sync` 加触发器或直接在该表上建立逻辑（官方不建议改动 Neon Auth 表结构）。

## 性能与一致性要点（社区经验综合）

- **近实时同步语义**：`users_sync` 的写入由 Neon Auth 服务驱动，通常很快，但并非强实时事务一致。
  - **强一致场景**：建议在“业务写操作”成功后使用 SDK 返回的用户状态作为权威。
  - **读多分析多/页面展示**：使用 `users_sync` 即可。
- **软删除语义**：按照官方约定，使用 `deleted_at IS NULL` 过滤活跃用户，避免将已删除用户关联到业务数据。
- **索引与查询习惯**：
  - 在您的业务表为 `author_id / owner` 等外键添加索引。
  - 对常用的用户筛选条件（例如 `email`）可基于扩展表建立索引。
  - **不建议**在 `users_sync` 上添加您自己的索引或触发器（避免破坏同步机制）。
- **审计与可用性**：
  - 需要完整用户快照时可读取 `raw_json`。
  - 审计日志建议在应用层记录（例如自行维护 `audit_logs`），而不是修改 `users_sync`。

## 代码片段与模板

### 业务写入（以当前登录用户作为外键）

```typescript
'use server'
import { stackServerApp } from '@/stack/server'
import { neon } from '@neondatabase/serverless'

export async function createTodo(task: string) {
  const user = await stackServerApp.getUser({ or: 'redirect' })
  const sql = neon(process.env.DATABASE_URL!)
  await sql`
    INSERT INTO todos (task, user_id)
    VALUES (${task}, ${user!.id})
  `
}
```

### 仅读用户扩展资料（您自建的扩展表）

```sql
SELECT p.*
FROM user_profiles p
JOIN neon_auth.users_sync u ON p.user_id = u.id
WHERE u.deleted_at IS NULL AND u.id = $1;
```

## 什么时候仍然需要“事件驱动”

如果您的系统有强需求在“用户变更发生时立即触发下游流程”（例如计费、外部工单、CRM 同步），Neon Auth 不提供内置 Webhooks 配置入口。通常做法是：

- **应用层封装 Use Case**：在应用层封装用户变更的 Use Case（例如“更新用户资料”），在调用 `user.update()` 成功后，发送消息到您的事件总线（Kafka/NATS/SQS/任务队列），由下游订阅处理。
- **避免 `users_sync` 触发器**：如果需要“数据库层观察”，不要给 `users_sync` 加触发器；可以改为在您自己的扩展表上加触发器，或使用应用事件/变更数据捕获（CDC）实现。

以上模式能与 Neon Auth 的“只读副本 + SDK 写入”设计保持一致，同时满足企业级的事件驱动架构。

## 延伸资料

- [官方总览与设计要点](https://neon.com/docs/neon-auth/overview)（强调“无需自建同步，直接用 users_sync”）
- [工作原理与前后对比](https://neon.com/docs/neon-auth/how-it-works)（含示例）
- [AI Rules 页面](https://neon.com/docs/ai/ai-rules-neon-auth)（含完整集成与最佳实践、SQL 片段）
- [与 RLS 的联合使用](https://neon.com/docs/guides/neon-rls-stack-auth)（把用户身份下沉到数据库策略）

## 总结

采用 Neon Auth 后，您可以移除 Clerk 的 Webhook 同步，统一通过 **SDK 写 + `users_sync` 读 + 外键关联** 的范式来实现业务交互。如需强实时的流程驱动，改为**“应用层事件”**而非数据库触发，既安全又与官方架构契合。

# Prisma Neon Auth 集成

在 Prisma 中，将 `neon_auth.users_sync` 作为跨 schema 的只读模型进行查询，所有用户写入操作通过 Stack Auth SDK 进行，并通过业务表外键引用 `users_sync(id)`。

## 总体原则

Neon Auth 将用户资料近实时镜像到数据库的 `neon_auth.users_sync` 表；这张表是只读副本。您在**应用层**使用 Stack Auth SDK 获取和更新当前用户，**数据库层**使用 Prisma 查询 `users_sync` 并通过外键引用它。这样无需 Webhook，同步由 Neon 托管。 <mcreference link="https://neon.com/docs/neon-auth/best-practices" index="1">1</mcreference>

## Prisma 多 Schema 建模（推荐做法）

- **在 Prisma 的 `datasource` 中启用多 schema，并包含 `neon_auth`**：

  ```prisma
  // prisma/schema.prisma
  generator client {
    provider = "prisma-client-js"
  }

  datasource db {
    provider = "postgresql"
    url      = env("DATABASE_URL")
    // 关键：同时包含 public 与 neon_auth
    schemas  = ["public", "neon_auth"]
  }
  ```

  多 schema 是 Prisma 官方支持的功能，模型通过 `@@schema("neon_auth")` 指定所在数据库 schema。 <mcreference link="https://www.prisma.io/docs/orm/prisma-schema/data-model/multi-schema" index="2">2</mcreference>

- **为 `users_sync` 建立只读模型（不要在代码中对其进行 `create`/`update`/`delete` 操作）**：

  ```prisma
  // 映射 neon_auth.users_sync
  model NeonUserSync {
    @@schema("neon_auth")
    @@map("users_sync")

    id         String    @id @db.Text
    name       String?   @db.Text
    email      String?   @db.Text
    created_at DateTime?
    updated_at DateTime?
    deleted_at DateTime?
    raw_json   Json

    // 可选：反向关系，便于 include author 等
    posts Post[]
  }

  // 您的业务表，外键引用 users_sync(id)
  model Post {
    id        Int       @id @default(autoincrement())
    title     String
    content   String?
    authorId  String    @db.Text

    author    NeonUserSync @relation(fields: [authorId], references: [id], onDelete: Cascade)

    @@index([authorId])
    @@map("posts")
  }
  ```

  - 通过 `@@schema("neon_auth")` 将模型归属到 `neon_auth`。 <mcreference link="https://www.prisma.io/docs/orm/prisma-schema/data-model/multi-schema" index="2">2</mcreference>
  - 外键行为（`CASCADE` / `SET NULL`）应根据数据性质选择；Neon 官方建议针对“个人数据使用 `CASCADE`、内容使用 `SET NULL`”。 <mcreference link="https://neon.com/docs/neon-auth/best-practices" index="1">1</mcreference>

- **迁移管理建议**：
  - 先在 Neon Console 启用 Neon Auth，让 `neon_auth.users_sync` 由平台创建；再使用 `prisma db pull` 将现有表拉入 Schema，避免您本地迁移去“创建或改动”这张托管表。 <mcreference link="https://www.prisma.io/docs/orm/prisma-schema/data-model/multi-schema" index="2">2</mcreference>
  - 保持 `users_sync` 为“外部托管表”的心智模型：所有结构变化都由 Neon 管理；您的迁移仅改动业务 schema（`public`）。

## Next.js 代码交互范式

- **获取当前用户（应用层）使用 Stack Auth SDK，然后使用该 `user.id` 作为业务写入外键；读取用户资料通过 Prisma 查询 `users_sync`**：

  ```typescript
  // app/actions.ts (Server Action)
  'use server'
  import { stackServerApp } from '@/stack/server'
  import { prisma } from '@/lib/prisma'

  export async function createPost(data: { title: string; content?: string }) {
    const user = await stackServerApp.getUser({ or: 'redirect' })
    await prisma.post.create({
      data: {
        title: data.title,
        content: data.content,
        authorId: user!.id, // 关键：外键引用 users_sync(id)
      },
    })
  }
  ```

- **查询时过滤软删除，并可在关系上做条件（等价于 SQL 的 `LEFT JOIN + deleted_at` 过滤）**：
  ```typescript
  // 列出当前用户的帖子（过滤已删除用户）
  const posts = await prisma.post.findMany({
    where: {
      authorId: user.id,
      author: { deleted_at: null },
    },
    orderBy: { id: 'desc' },
    include: { author: true },
  })
  ```
  官方建议查询用户相关数据时使用 `LEFT JOIN` 并过滤 `deleted_at IS NULL`。 <mcreference link="https://neon.com/docs/neon-auth/best-practices" index="1">1</mcreference>

## 事件与一致性（社区经验）

- `users_sync` 是近实时镜像，通常 <1 秒；强一致的“写后读”业务，建议以 SDK 返回的用户状态为准；展示/分析使用 `users_sync` 即可。 <mcreference link="https://neon.com/docs/neon-auth/best-practices" index="1">1</mcreference>
- 需要“用户变更驱动下游流程”（过去依赖 Clerk Webhook）的场景，改为在应用层封装用例：`user.update()` 成功后发送消息到队列/事件总线，而非在 `users_sync` 上添加触发器（该表由 Neon 管理）。 <mcreference link="https://neon.com/docs/neon-auth/best-practices" index="1">1</mcreference>

## Prisma 与运行环境的最佳实践

- **Next.js 热更新下避免多实例**：
  ```typescript
  // lib/prisma.ts
  import { PrismaClient } from '@prisma/client'
  const globalForPrisma = global as unknown as { prisma: PrismaClient }
  export const prisma = globalForPrisma.prisma || new PrismaClient()
  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
  ```
  <mcreference link="https://www.prisma.io/docs/orm/more/help-and-troubleshooting/nextjs-help" index="3">3</mcreference>
- 多 schema 的查询语法与单 schema 相同；关系可跨 schema 正常工作。 <mcreference link="https://www.prisma.io/docs/orm/prisma-schema/data-model/multi-schema" index="2">2</mcreference>
- **部署与连接优化**：Neon + Next.js 生产环境建议使用 Prisma Accelerate 或 Neon serverless 适配器以优化连接与边缘环境支持（与 auth 无关但对整体稳定性重要）。 <mcreference link="https://www.prisma.io/docs/guides/nextjs" index="4">4</mcreference>

## RLS（可选但实用）

如果您想将访问控制下沉到数据库层，Neon 提供与 Stack/Neon Auth JWT 的 RLS 集成流程；在表上声明行级策略后，查询将按用户身份自动过滤，减少在 Prisma 查询中显式添加条件的负担。 <mcreference link="https://neon.com/docs/neon-auth/best-practices" index="1">1</mcreference>

## 常见坑与建议

- **不要在 Prisma 中对 `neon_auth.users_sync` 进行写操作或结构修改**；只读查询与外键关联即可。 <mcreference link="https://neon.com/docs/neon-auth/best-practices" index="1">1</mcreference>
- **初次用户创建与同步有小延迟时**，避免使用“必须命中 `INNER JOIN`”的查询；使用 `LEFT JOIN` 逻辑或在应用层做容错。 <mcreference link="https://neon.com/docs/neon-auth/best-practices" index="1">1</mcreference>
- **迁移顺序**：启用 Neon Auth → 平台建表 → `prisma db pull` → 只在您的业务 schema 上进行 `migrate`。 <mcreference link="https://www.prisma.io/docs/orm/prisma-schema/data-model/multi-schema" index="2">2</mcreference>

## 总结

将 `users_sync` 视为“跨 schema 的只读权威用户源”，在 Prisma 中建立只读模型并用外键关联业务表；所有用户写操作和生命周期事件通过 Stack Auth SDK 执行。查询时注意软删除与近实时延迟；需要强事件驱动时在应用层发送事件而不是依赖数据库表触发。这样的架构最契合 Neon Auth 的设计与社区最佳实践。 <mcreference link="https://neon.com/docs/neon-auth/best-practices" index="1">1</mcreference> <mcreference link="https://www.prisma.io/docs/orm/prisma-schema/data-model/multi-schema" index="2">2</mcreference> <mcreference link="https://www.prisma.io/docs/orm/more/help-and-troubleshooting/nextjs-help" index="3">3</mcreference> <mcreference link="https://www.prisma.io/docs/guides/nextjs" index="4">4</mcreference>

# Auth Layout Component Error Fix

这类错位通常由全局样式冲突或主题未正确包裹导致；把 `StackTheme`/`StackProvider` 放在布局根部、消除 Tailwind/全局 CSS 对第三方组件的重置和覆写，是解决的关键。

## 为什么会“错位”

Neon Auth 的 UI 组件依赖 React 上下文和一组 CSS 变量来控制配色与尺寸。如果你的项目存在以下情况，就可能出现按钮尺寸、间距、对齐、输入框样式等错位：

- 全局样式重置或组件库样式（如 Tailwind 的 `preflight`、`Normalize`、定制 `base` 样式）覆盖了按钮、输入的默认样式。
- 没有用 `StackTheme` 和 `StackProvider` 在布局根部包裹，或包裹顺序错误。
- SSR 与客户端首次渲染不一致（`hydration mismatch`），或字体/图标加载迟滞引起布局跳动。

参考 `StackTheme` 可自定义变量和主题包裹方式：[Colors and Styles](url://99) · [StackTheme](url://97)。

## 排查与修复（专家清单）

### 栈级包裹与顺序

- 在 `app/layout.tsx` 顶层按顺序包裹：`StackProvider` 最外层，其内是 `StackTheme`，再是你的页面内容。确保 Neon Auth 的 `handler` 路由页也在该布局之下。
- **示例**：

```tsx
// app/layout.tsx
import { StackProvider } from '@stackframe/stack'
import { StackTheme } from '@stackframe/stack'

const theme = {
  light: { primary: '#0EA5E9' },
  dark: { primary: '#22C55E' },
  radius: '8px',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>
        <StackProvider>
          <StackTheme theme={theme}>{children}</StackTheme>
        </StackProvider>
      </body>
    </html>
  )
}
```

主题变量与用法见：[Colors and Styles](url://99)。

### 消除全局样式冲突

- 检查是否有针对通用标签（`button`, `input`, `a`, `form`, `svg`, `img`）的全局 CSS（含 UI 库样式或 CSS Modules 的 `:global`）改变了 `display`、`line-height`、`box-sizing`、`padding`、`border` 等。
- 若使用 Tailwind，优先避免在全局 `base` 层重定义这些元素。必要时，在 Neon Auth 容器上做局部“样式隔离”：

```css
/* 针对 auth 容器，降低外部样式影响 */
.auth-scope :where(button, input, a) {
  all: unset; /* 先清空继承/重置的外部规则 */
  all: revert; /* 恢复浏览器默认，再交给组件自身样式 */
}
/* 恢复必要的可点击/可输入行为 */
.auth-scope button {
  cursor: pointer;
}
.auth-scope input {
  all: revert;
}
```

把 Neon Auth 的页面根节点（如 `/handler/sign-in`）包在 `<div className="auth-scope">...</div>` 下，使外部重置不再污染其内部。更温和的做法是删减你项目的 `base` 层规则，避免覆盖第三方组件。

### Tailwind 专项建议

- Tailwind `Preflight` 会重置表单控件与排版，常致第三方组件样式错位。可选策略：
  - 尽量不要在 `@layer base` 中重写 `button`/`input`/`a` 的核心属性；
  - 若问题集中在 auth 页，可在该页根容器使用上面的局部隔离办法；
  - 极端情况下才考虑关闭 `Preflight`（`corePlugins: { preflight: false }`），但这会影响全站，需要搭配你自己的 `reset`。
- 避免给组件祖先容器设置影响布局的通用规则（如 `* { box-sizing: content-box }`、`line-height` 过小、`letter-spacing` 非常规等）。

### Hydration 与字体/图标

- 打开浏览器控制台，检查是否有 “`Hydration mismatch`” 警告。若存在，确保使用的 Neon Auth 组件位于 `client` 组件内（文档组件如 `SignIn`/`SignUp` 是 `client` 组件；不要在 `server-only` 场景里包裹它们）。
- 字体与图标加载可能造成首帧跳动，建议使用 Next.js 的 `next/font`（如 Inter），并在全局应用，减少 FOUT/FOIT 导致的高度变化。
- 图片徽标（GitHub/Google）受全局 `img { display: block; }`/`vertical-align` 影响时，按上面的局部隔离或局部修正解决。

### 容器布局与约束

- 不要在 Neon Auth 组件的直接父容器上施加强制的 `display: flex` 对齐或极端的 `gap`/`justify` 规则，尽量让组件自身控制栅格。
- 若放置在自定义卡片内，确保卡片的 `padding` 与宽度不会压缩内层控件。推荐设置一个最小宽度或使用组件默认宽度。

### 主题变量与暗色模式

- 颜色与半径使用合法 CSS 值，如 `'hsl(215, 90%, 50%)'`、`'#fff'`、`'8px'`；不要传数字类型。
- 如果项目使用暗色模式切换，确保 `StackTheme` 的 `light`/`dark` 分支与你的全局 `data-theme` 或 `class` 切换不冲突；`StackTheme` 自带的上下文不依赖全局 `class`。参考：[Colors and Styles](url://99)。

## 验证方法

- 对比官方模板的布局与样式，若在模板中显示正常，说明是你项目的全局样式或布局造成冲突。模板地址：[Next.js 模板](url://47) · [UI Components](url://86)。
- 在你的项目中暂时移除全局样式（注释掉 `base.css` 或关闭 Tailwind 全局导入），若错位消失，即可定位到具体冲突。

## 常见“雷区”总结

- 全局设置了非常规的 `line-height` 或 `letter-spacing`，导致按钮文字溢出或垂直不居中。
- 对 `button`、`input`、`a` 使用了 `display: flex` 并强制 `align-items`，破坏组件内部布局。
- 使用通配选择器 `*` 覆盖了 `box-sizing` 或 `font-size`，造成 `padding`/边框计算异常。
- 未在根布局中包裹 `StackTheme`，CSS 变量未注入，导致颜色/半径缺省。
- `Hydration mismatch` 或字体跳变导致首帧布局闪动。

如需继续深挖配色与主题自定义，可参考：[Colors and Styles](url://99)；组件清单在：[UI Components](url://86)；Next.js 集成流程见：[Next.js 指南](url://47)。

# Neon Typescript SDK Rules

---

description: Use these rules to manage your Neon projects, branches, databases, and other resources programmatically using the Neon TypeScript SDK.
globs: _.ts, _.tsx
alwaysApply: false

---

## Neon TypeScript SDK integration guidelines

This file provides comprehensive rules and best practices for interacting with the Neon API using the `@neondatabase/api-client` TypeScript SDK. Following these guidelines will enable an AI Agent like you to build robust, efficient, and error-tolerant integrations with Neon.

The SDK is a wrapper around the Neon REST API and provides typed methods for managing all Neon resources, including projects, branches, endpoints, roles, and databases.

### Neon Core Concepts

To effectively use the Neon Typescript SDK, it's essential to understand the hierarchy and purpose of its core resources. The following table provides a high-level overview of each concept.

| Concept          | Description                                                                                                                        | Analogy/Purpose                                                                                                 | Key Relationship                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Organization     | The highest-level container, managing billing, users, and multiple projects.                                                       | A GitHub Organization or a company's cloud account.                                                             | Contains one or more Projects.                                                                        |
| Project          | The primary container that contains all related database resources for a single application or service.                            | A Git repository or a top-level folder for an application.                                                      | Lives within an Organization (or a personal account). Contains Branches.                              |
| Branch           | A lightweight, copy-on-write clone of a database's state at a specific point in time.                                              | A `git branch`. Used for isolated development, testing, staging, or previews without duplicating storage costs. | Belongs to a Project. Contains its own set of Databases and Roles, cloned from its parent.            |
| Compute Endpoint | The actual running PostgreSQL instance that you connect to. It provides the CPU and RAM for processing queries.                    | The "server" or "engine" for your database. It can be started, suspended (scaled to zero), and resized.         | Is attached to a single Branch. Your connection string points to a Compute Endpoint's hostname.       |
| Database         | A logical container for your data (tables, schemas, views) within a branch. It follows standard PostgreSQL conventions.            | A single database within a PostgreSQL server instance.                                                          | Exists within a Branch. A branch can have multiple databases.                                         |
| Role             | A PostgreSQL role used for authentication (logging in) and authorization (permissions to access data).                             | A database user account with a username and password.                                                           | Belongs to a Branch. Roles from a parent branch are copied to child branches upon creation.           |
| API Key          | A secret token used to authenticate requests to the Neon API. Keys have different scopes (Personal, Organization, Project-scoped). | A password for programmatic access, allowing you to manage all other Neon resources.                            | Authenticates actions on Organizations, Projects, Branches, etc.                                      |
| Operation        | An asynchronous action performed by the Neon control plane, such as creating a branch or starting a compute.                       | A background job or task. Its status can be polled to know when an action is complete.                          | Associated with a Project and often a specific Branch or Endpoint. Essential for scripting API calls. |

### Installation

To begin, install the SDK package into your project:

```bash
npm install @neondatabase/api-client
```

### Understanding API Key Types

When performing actions via the API, you must select the correct type of API key based on the required scope and permissions. There are three types:

1. Personal API Key

   - Scope: Accesses all projects that the user who created the key is a member of.
   - Permissions: The key has the same permissions as its owner. If the user's access is revoked from an organization, the key loses access too.
   - Best For: Individual use, scripting, and tasks tied to a specific user's permissions.
   - Created By: Any user.

2. Organization API Key

   - Scope: Accesses all projects and resources within an entire organization.
   - Permissions: Has admin-level access across the organization, independent of any single user. It remains valid even if the creator leaves the organization.
   - Best For: CI/CD pipelines, organization-wide automation, and service accounts that need broad access.
   - Created By: Organization administrators only.

3. Project-scoped API Key
   - Scope: Access is strictly limited to a single, specified project.
   - Permissions: Cannot perform organization-level actions (like creating new projects) or delete the project it is scoped to. This is the most secure and limited key type.
   - Best For: Project-specific integrations, third-party services, or automation that should be isolated to one project.
   - Created By: Any organization member.

### Authentication and Client Initialization

All interactions with the Neon API require an API key. Store your key securely as an environment variable (e.g., `NEON_API_KEY`).

Initialize the API client in your code. This client instance will be used for all subsequent API calls.

```typescript
import { createApiClient } from '@neondatabase/api-client'

// Best practice: Load API key from environment variables
const apiKey = process.env.NEON_API_KEY

if (!apiKey) {
  throw new Error('NEON_API_KEY environment variable is not set.')
}

const apiClient = createApiClient({ apiKey })
```

## API Keys

Manage programmatic access to the Neon API.

### List API keys

Description: Retrieves a list of all API keys associated with your Neon account. The response includes metadata about each key but does not include the secret key token itself for security reasons.

Method Signature:
`apiClient.listApiKeys()`

Parameters: None.

Example Usage:

```typescript
const response = await apiClient.listApiKeys()
console.log('API Keys:', response.data)
// Example output: [{id: 1234, name: "my-api-key", created_at: "xx", created_by: { id: "xx", name: "USER_NAME"},last_used_at: "xx",last_used_from_addr: "IP_ADDRESS"}]
```

Key Points & Best Practices:

- Use this method to get the `key_id` required for revoking a key.

### Create API key

Description: Creates a new API key with a specified name. The response includes the `id` and the secret `key` token.

Method Signature:
`apiClient.createApiKey(data: ApiKeyCreateRequest)`

Parameters:

- `data` (`ApiKeyCreateRequest`):
  - `key_name` (string, required): A descriptive name for the API key.

Example Usage:

```typescript
const response = await apiClient.createApiKey({
  key_name: 'my-automation-script-key',
})
console.log('ID:', response.data.id) // can be used for revoking the key later
console.log('Key (store securely!):', response.data.key) // Example: "napi_xxxx"
```

Key Points & Best Practices:

- Store the Key Securely: The `key` token is only returned once upon creation. Store it immediately in a secure location like a secret manager or an `.env` file. You cannot retrieve it later.
- Use descriptive names for keys to easily identify their purpose.

### Revoke API key

Description: Revokes an existing API key, permanently disabling it. This action cannot be undone.

Method Signature:
`apiClient.revokeApiKey(keyId: number)`

Parameters:

- `keyId` (number, required): The unique identifier of the API key to revoke.

Example Usage:

```typescript
const response = await apiClient.revokeApiKey(1234)
console.log(`API key with ID ${response.data.id} has been revoked.`)
```

Key Points & Best Practices:

- Revoke keys that are no longer in use or may have been compromised.
- You must know the `keyId` to revoke a key. Use `listApiKeys` if you don't have it.

## Operations

An operation is an action performed by the Neon Control Plane (e.g., `create_branch`, `start_compute`). When using the SDK programmatically, it is crucial to monitor the status of long-running operations to ensure one has completed before starting another that depends on it. Operations older than 6 months may be deleted from Neon's systems.

### List operations

Description: Retrieves a list of operations for a specified project.

Method Signature:
`apiClient.listProjectOperations(params: ListProjectOperationsParams)`

Parameters:

- `params` (`ListProjectOperationsParams`):
  - `projectId` (string, required): The ID of the project.
  - `limit?` (number): The number of operations to return.
  - `cursor?` (string): The pagination cursor.

Example Usage:

```typescript
const response = await apiClient.listProjectOperations({
  projectId: 'your-project-id',
})
console.log(`Operations for project ${projectId}:`, response.data.operations)
// Example output: [{ id: "xx", project_id: "your-project-id", branch_id: "xxx", endpoint_id: "xxx", action: "start_compute", status: "finished", failures_count: 0, created_at: "xxx", updated_at: "2025-09-15T02:15:35Z", total_duration_ms: 239,}, ...]
```

### Retrieve operation details

Description: Retrieves the status and details of a single operation by its ID.

Method Signature:
`apiClient.getProjectOperation(projectId: string, operationId: string)`

Parameters:

- `projectId` (string, required): The ID of the project.
- `operationId` (string, required): The ID of the operation.

Example Usage:

```typescript
const response = await apiClient.getProjectOperation(
  'your-project-id',
  'your-operation-id'
)
```

## Projects

Manage your Neon projects.

### List projects

Description: Retrieves a list of all projects for your account or organization.

Method Signature:
`apiClient.listProjects(query: ListProjectsParams)`

Parameters:

- `limit?` (integer): Specifies the number of projects to return. (Min: 1, Max: 400, Default: 10)
- `cursor?` (string): Used for pagination. Provide the `cursor` value from a previous response to fetch the next set of projects.
- `search?` (string): Filters projects by a partial match on the project `name` or `id`.
- `org_id?` (string): Filters projects by a specific organization ID.

Example Usage:

```typescript
const response = await apiClient.listProjects({})
console.log('Projects:', response.data.projects)
// Example response: [{ id: "your-project-id", platform_id: "aws", region_id: "aws-us-east-2", name: "project-name", provisioner: "k8s-neonvm", default_endpoint_settings: { autoscaling_limit_min_cu: 0.25, autoscaling_limit_max_cu: 2, suspend_timeout_seconds: 0 }, settings: { allowed_ips: { ips: [], protected_branches_only: false }, enable_logical_replication: false, maintenance_window: { weekdays: [ 3 ], start_time: "06:00", end_time: "07:00" }, block_public_connections: false, block_vpc_connections: false, hipaa: false }, pg_version: 17, proxy_host: "us-east-2.aws.neon.tech", branch_logical_size_limit: 512, branch_logical_size_limit_bytes: 536870912, store_passwords: true, active_time: 0, cpu_used_sec: 0, creation_source: "console", created_at: "xx", updated_at: "xx", synthetic_storage_size: 31277056, quota_reset_at: "xx", owner_id: "owner-id", compute_last_active_at: "2025-08-20T06:50:15Z", org_id: "org-id", history_retention_seconds: 86400 }, ...]
```

### Create project

Description: Creates a new Neon project with a specified name, Postgres version, and region.

Method Signature:
`apiClient.createProject(data: ProjectCreateRequest)`

Parameters:

- `data` (`ProjectCreateRequest`):
  - `project` (object, required): The main container for all project settings.
    - `name` (string, optional): A descriptive name for the project (1-256 characters). If omitted, the project name will be identical to its generated ID.
    - `pg_version` (integer, optional): The major Postgres version. Defaults to `17`. Supported versions: 14, 15, 16, 17, 18.
    - `region_id` (string, optional): The identifier for the region where the project will be created (e.g., `aws-us-east-1`).
    - `org_id` (string, optional): The ID of an organization to which the project will belong. Required if using an Organization API key.
    - `store_passwords` (boolean, optional): Whether to store role passwords in Neon. Storing passwords is required for features like the SQL Editor and integrations.
    - `history_retention_seconds` (integer, optional): The duration in seconds (0 to 2,592,000) to retain project history for features like Point-in-Time Restore. Defaults to 86400 (1 day).
    - `provisioner` (string, optional): The compute provisioner. Specify `k8s-neonvm` to enable Autoscaling. Allowed values: `k8s-pod`, `k8s-neonvm`.
    - `default_endpoint_settings` (object, optional): Default settings for new compute endpoints created in this project.
      - `autoscaling_limit_min_cu` (number, optional): The minimum number of Compute Units (CU). Minimum value is `0.25`.
      - `autoscaling_limit_max_cu` (number, optional): The maximum number of Compute Units (CU). Minimum value is `0.25`.
      - `suspend_timeout_seconds` (integer, optional): Duration of inactivity in seconds before a compute is suspended. Ranges from -1 (never suspend) to 604800 (1 week). A value of `0` uses the default of 300 seconds (5 minutes).
    - `settings` (object, optional): Project-wide settings.
      - `quota` (object, optional): Per-project consumption quotas. A zero or empty value means "unlimited".
        - `active_time_seconds` (integer, optional): Wall-clock time allowance for active computes.
        - `compute_time_seconds` (integer, optional): CPU seconds allowance.
        - `written_data_bytes` (integer, optional): Data written allowance.
        - `data_transfer_bytes` (integer, optional): Data transferred allowance.
        - `logical_size_bytes` (integer, optional): Logical data size limit per branch.
      - `allowed_ips` (object, optional): Configures the IP Allowlist.
        - `ips` (array of strings, optional): A list of allowed IP addresses or CIDR ranges.
        - `protected_branches_only` (boolean, optional): If `true`, the IP allowlist applies only to protected branches.
      - `enable_logical_replication` (boolean, optional): Sets `wal_level=logical`.
      - `maintenance_window` (object, optional): The time period for scheduled maintenance.
        - `weekdays` (array of integers, required if `maintenance_window` is set): Days of the week (1=Monday, 7=Sunday).
        - `start_time` (string, required if `maintenance_window` is set): Start time in "HH:MM" UTC format.
        - `end_time` (string, required if `maintenance_window` is set): End time in "HH:MM" UTC format.
    - `branch` (object, optional): Configuration for the project's default branch.
      - `name` (string, optional): The name for the default branch. Defaults to `main`.
      - `role_name` (string, optional): The name for the default role. Defaults to `{database_name}_owner`.
      - `database_name` (string, optional): The name for the default database. Defaults to `neondb`.

Example Usage:

```typescript
const response = await apiClient.createProject({
  project: { name: name, pg_version: 17, region_id: 'aws-us-east-2' },
})
console.log('Project created:', response.data.project)
console.log('Connection URI:', response.data.connection_uris[0]?.connection_uri) // Example: "postgresql://neondb_owner:xxxx@ep-muddy-brook-aevd5iky.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"
```

### Retrieve project details

Description: Fetches detailed information for a single project by its ID.

Method Signature:
`apiClient.getProject(projectId: string)`

Parameters:

- `projectId` (string, required): The ID of the project.

Example Usage:

```typescript
const response = await apiClient.getProject('your-project-id')
console.log('Project Details:', response.data.project)
// Example response: { data_storage_bytes_hour: 6706234656, data_transfer_bytes: 1482607, written_data_bytes: 38603544, compute_time_seconds: 9567, active_time_seconds: 35236, cpu_used_sec: 9567, id: "your-project-id", platform_id: "azure", region_id: "azure-westus3", name: "your-project-name", provisioner: "k8s-neonvm", default_endpoint_settings: { autoscaling_limit_min_cu: 0.25, autoscaling_limit_max_cu: 2, suspend_timeout_seconds: 0 }, settings: { allowed_ips: { ips: [], protected_branches_only: false }, enable_logical_replication: false, maintenance_window: { weekdays: [ 4 ], start_time: "06:00", end_time: "07:00" }, block_public_connections: false, block_vpc_connections: false, hipaa: false }, pg_version: 17, proxy_host: "westus3.azure.neon.tech", branch_logical_size_limit: 512, branch_logical_size_limit_bytes: 536870912, store_passwords: true, creation_source: "console", history_retention_seconds: 86400, created_at: "xx", updated_at: "xx", synthetic_storage_size: 34690488, consumption_period_start: "xx", consumption_period_end: "xx", owner_id: "owner-id", owner: { email: "owner@email.com", name: "owner_name", branches_limit: 20, subscription_type: "free_v3"}, compute_last_active_at: "2025-09-16T03:40:57Z", org_id: "org-id" }
```

### Update project

Description: Updates the settings of an existing project, such as its name.

Method Signature:
`apiClient.updateProject(projectId: string, data: ProjectUpdateRequest)`

Parameters:

- `projectId` (string, required): The ID of the project.
- `data` (`ProjectCreateRequest`):
  - `name` (string, optional): A new descriptive name for the project.
  - `history_retention_seconds` (integer, optional): The duration in seconds (0 to 2,592,000) to retain project history.
  - `default_endpoint_settings` (object, optional): New default settings for compute endpoints created in this project.
    - `autoscaling_limit_min_cu` (number, optional): The minimum number of Compute Units (CU). Minimum `0.25`.
    - `autoscaling_limit_max_cu` (number, optional): The maximum number of Compute Units (CU). Minimum `0.25`.
    - `suspend_timeout_seconds` (integer, optional): Duration of inactivity in seconds before a compute is suspended. Ranges from -1 (never suspend) to 604800 (1 week). A value of `0` uses the default of 300 seconds (5 minutes).
  - `settings` (object, optional): Project-wide settings to update.
    - `quota` (object, optional): Per-project consumption quotas.
      - `active_time_seconds` (integer, optional): Wall-clock time allowance for active computes.
      - `compute_time_seconds` (integer, optional): CPU seconds allowance.
      - `written_data_bytes` (integer, optional): Data written allowance.
      - `data_transfer_bytes` (integer, optional): Data transferred allowance.
      - `logical_size_bytes` (integer, optional): Logical data size limit per branch.
    - `allowed_ips` (object, optional): Modifies the IP Allowlist.
      - `ips` (array of strings, optional): The new list of allowed IP addresses or CIDR ranges.
      - `protected_branches_only` (boolean, optional): If `true`, the IP allowlist applies only to protected branches.
    - `enable_logical_replication` (boolean, optional): Sets `wal_level=logical`. This is irreversible.
    - `maintenance_window` (object, optional): The time period for scheduled maintenance.
      - `weekdays` (array of integers, required if `maintenance_window` is set): Days of the week (1=Monday, 7=Sunday).
      - `start_time` (string, required if `maintenance_window` is set): Start time in "HH:MM" UTC format.
      - `end_time` (string, required if `maintenance_window` is set): End time in "HH:MM" UTC format.
    - `block_public_connections` (boolean, optional): If `true`, disallows connections from the public internet.
    - `block_vpc_connections` (boolean, optional): If `true`, disallows connections from VPC endpoints.
    - `audit_log_level` (string, optional): Sets the audit log level. Allowed values: `base`, `extended`, `full`.
    - `hipaa` (boolean, optional): Toggles HIPAA compliance settings.
    - `preload_libraries` (object, optional): Libraries to preload into compute instances.
      - `use_defaults` (boolean, optional): Toggles the use of default libraries.
      - `enabled_libraries` (array of strings, optional): A list of specific libraries to enable.

Example Usage:

```typescript
// Example: Update a project's name
await apiClient.updateProject(projectId, {
  project: { name: 'newNameForProject' },
})
```

### Delete project

Description: Permanently deletes a project and all its associated resources (branches, databases, roles). This action is irreversible.

Method Signature:
`apiClient.deleteProject(projectId: string)`

Parameters:

- `projectId` (string, required): The ID of the project.

Example Usage:

```typescript
await apiClient.deleteProject('projectid-to-delete')
```

### Retrieve connection URI

Description: Gets a complete connection string for a specific database and role within a branch in a project.

Method Signature:
`apiClient.getConnectionUri(params: GetConnectionUriParams)`

Parameters:

- `params` (`GetConnectionUriParams`):
  - `projectId` (string, required)
  - `branch_id?` (string): Defaults to the project's primary branch.
  - `database_name` (string, required)
  - `role_name` (string, required)
  - `pooled?` (boolean): If `true`, returns the pooled connection string.

Example Usage:

```typescript
const response = await apiClient.getConnectionUri({
  projectId: 'your-project-id',
  database_name: 'dbName',
  role_name: 'roleName',
  pooled: true,
})
console.log('Pooled Connection URI:', response.data.uri)
// Example: "postgresql://neondb_owner:xxx@ep-xx-pooler.westus3.azure.neon.tech/neondb?channel_binding=require&sslmode=require"
```

## Branches

Manage branches within a project. Branches in Neon are copy-on-write clones, allowing for isolated development, testing, and production environments without duplicating data.

### Create branch

Description: Creates a new branch from a parent branch. You can optionally create a compute endpoint at the same time and specify a point-in-time from the parent's history to branch from.

Method Signature:
`apiClient.createProjectBranch(projectId: string, data?: BranchCreateRequest)`

Parameters:

- `projectId` (string, required): The ID of the project where the branch will be created.
- `data` (`BranchCreateRequest`, optional):
  - `branch` (object, optional): Specifies the properties of the new branch.
    - `name` (string, optional): A name for the branch (max 256 characters). If omitted, a name is auto-generated.
    - `parent_id` (string, optional): The ID of the parent branch. If omitted, the project's default branch is used.
    - `parent_lsn` (string, optional): A Log Sequence Number (LSN) from the parent branch to create the new branch from a specific point-in-time.
    - `parent_timestamp` (string, optional): An ISO 8601 timestamp (e.g., `2025-08-26T12:00:00Z`) to create the branch from a specific point-in-time.
    - `protected` (boolean, optional): If `true`, the branch is created as a protected branch.
    - `init_source` (string, optional): `parent-data` (default) copies schema and data. `schema-only` creates a root branch with only the schema from the specified parent.
    - `expires_at` (string, optional): An RFC 3339 timestamp for when the branch should be automatically deleted (e.g., `2025-06-09T18:02:16Z`).
  - `endpoints` (array of objects, optional): A list of compute endpoints to create and attach to the new branch.
    - `type` (string, required): The endpoint type. Allowed values: `read_write`, `read_only`.
    - `autoscaling_limit_min_cu` (number, optional): Minimum Compute Units (CU). Minimum `0.25`.
    - `autoscaling_limit_max_cu` (number, optional): Maximum Compute Units (CU). Minimum `0.25`.
    - `provisioner` (string, optional): Specify `k8s-neonvm` to enable Autoscaling. Allowed values: `k8s-pod`, `k8s-neonvm`.
    - `suspend_timeout_seconds` (integer, optional): Inactivity period in seconds before suspension. Ranges from -1 (never) to 604800 (1 week).

Example Usage:

```typescript
import { EndpointType } from '@neondatabase/api-client'

const response = await apiClient.createProjectBranch('your-project-id', {
  branch: { name: 'feature-branch-x' },
  endpoints: [{ type: EndpointType.ReadWrite, autoscaling_limit_max_cu: 1 }],
})
console.log('Branch created:', response.data.branch)
// Example response: {"id":"your-branch-id","project_id":"your-project-id","parent_id":"parent-branch-id","parent_lsn":"0/1BB6D40","name":"feature-branch-x","current_state":"init","pending_state":"ready","state_changed_at":"xx","creation_source":"console","primary":false,"default":false,"protected":false,"cpu_used_sec":0,"compute_time_seconds":0,"active_time_seconds":0,"written_data_bytes":0,"data_transfer_bytes":0,"created_at":"xx","updated_at":"xx","created_by":{"name":"user_name","image":""},"init_source":"parent-data"}
console.log('Endpoint created:', response.data.endpoints[0])
// Example response: {"host":"ep-xxx.ap-southeast-1.aws.neon.tech","id":"ep-xxx","project_id":"your-project-id","branch_id":"your-branch-id","autoscaling_limit_min_cu":0.25,"autoscaling_limit_max_cu":1,"region_id":"aws-ap-southeast-1","type":"read_write","current_state":"init","pending_state":"active","settings":{},"pooler_enabled":false,"pooler_mode":"transaction","disabled":false,"passwordless_access":true,"creation_source":"console","created_at":"xx","updated_at":"xx","proxy_host":"ap-southeast-1.aws.neon.tech","suspend_timeout_seconds":0,"provisioner":"k8s-neonvm"}
// The `response.data` object also contains `operations`, `roles`, `databases` and `connection_uris`
```

### List branches

Description: Retrieves a list of branches for the specified project. Supports filtering, sorting, and pagination.

Method Signature:
`apiClient.listProjectBranches(params: ListProjectBranchesParams)`

Parameters:

- `params` (`ListProjectBranchesParams`):
  - `projectId` (string, required): The ID of the project.
  - `search?` (string): Filters branches by a partial match on name or ID.
  - `sort_by?` (string): Field to sort by. Allowed: `name`, `created_at`, `updated_at`. Default: `updated_at`.
  - `sort_order?` (string): Sort order. Allowed: `asc`, `desc`. Default: `desc`.
  - `limit?` (integer): Number of branches to return (1-10000).
  - `cursor?` (string): Pagination cursor from a previous response.

Example Usage:

```typescript
const response = await apiClient.listProjectBranches({
  projectId: 'your-project-id',
})
// Example response: {"branches":[{"id":"branch-id","project_id":"project-id","parent_id":"parent-branch-id","parent_lsn":"0/1BB6D40","parent_timestamp":"xx","name":"feature-branch-x","current_state":"ready","state_changed_at":"xx","logical_size":30842880,"creation_source":"console","primary":false,"default":false,"protected":false,"cpu_used_sec":0,"compute_time_seconds":0,"active_time_seconds":0,"written_data_bytes":0,"data_transfer_bytes":0,"created_at":"xx","updated_at":"xx","created_by":{"name":"user_name","image":""},"init_source":"parent-data"}, ...other branches details]}
```

### Retrieve branch details

Description: Fetches detailed information for a single branch by its ID.

Method Signature:
`apiClient.getProjectBranch(projectId: string, branchId: string)`

Parameters:

- `projectId` (string, required): The ID of the project.
- `branchId` (string, required): The ID of the branch.

Example Usage:

```typescript
const response = await apiClient.getProjectBranch(
  'your-project-id',
  'br-your-branch-id'
)
// Example response: { branch: { ... branch details } }
```

### Update branch

Description: Updates the properties of a specified branch, such as its name or protection status.

Method Signature:
`apiClient.updateProjectBranch(projectId: string, branchId: string, data: BranchUpdateRequest)`

Parameters:

- `projectId` (string, required): The ID of the project.
- `branchId` (string, required): The ID of the branch to update.
- `data` (`BranchUpdateRequest`):
  - `branch` (object, required):
    - `name?` (string): A new name for the branch.
    - `protected?` (boolean): `true` to protect the branch, `false` to unprotect.
    - `expires_at?` (string | null): Branch new expiration timestamp or `null` to remove expiration.

Example Usage:

```typescript
const response = await apiClient.updateProjectBranch(
  'your-project-id',
  'br-your-branch-id',
  {
    branch: { name: 'updated-feature-branch' },
  }
)
```

### Delete branch

Description: Permanently deletes a branch. This action will idle any associated compute endpoints.

Method Signature:
`apiClient.deleteProjectBranch(projectId: string, branchId: string)`

Parameters:

- `projectId` (string, required): The ID of the project.
- `branchId` (string, required): The ID of the branch to delete.

Key Points & Best Practices:

- You cannot delete a project's default branch.
- You cannot delete a branch that has child branches. Delete children first.

Example Usage:

```typescript
await apiClient.deleteProjectBranch('your-project-id', 'br-branch-to-delete')
```

### List branch endpoints

Description: Retrieves a list of all compute endpoints associated with a specific branch.

Method Signature:
`apiClient.listProjectBranchEndpoints(projectId: string, branchId: string)`

Parameters:

- `projectId` (string, required): The ID of the project.
- `branchId` (string, required): The ID of the branch.

Example Usage:

```typescript
const response = await apiClient.listProjectBranchEndpoints(
  'your-project-id',
  'br-your-branch-id'
)
// Example response: { endpoints: [... endpoints details] }
```

### List databases

Description: Retrieves a list of all databases within a specified branch.

Method Signature:
`apiClient.listProjectBranchDatabases(projectId: string, branchId: string)`

Parameters:

- `projectId` (string, required): The ID of the project.
- `branchId` (string, required): The ID of the branch.

Example Usage:

```typescript
const response = await apiClient.listProjectBranchDatabases(
  'your-project-id',
  'br-your-branch-id'
)
// Example response: { databases: [{ id: 39700786, branch_id: "br-your-branch-id", name: "neondb", owner_name: "neondb_owner", created_at: "xx", updated_at: "xx" }, ...other databases if they exist] }
```

### Create database

Description: Creates a new database within a specified branch.

Method Signature:
`apiClient.createProjectBranchDatabase(projectId: string, branchId: string, data: DatabaseCreateRequest)`

Parameters:

- `projectId` (string, required): The ID of the project.
- `branchId` (string, required): The ID of the branch.
- `data` (`DatabaseCreateRequest`):
  - `database` (object, required):
    - `name` (string, required): The name for the new database.
    - `owner_name` (string, required): The name of an existing role that will own the database.

Example Usage:

```typescript
await apiClient.createProjectBranchDatabase(
  'your-project-id',
  'br-your-branch-id',
  {
    database: { name: 'my-app-db', owner_name: 'neondb_owner' },
  }
)
```

### Retrieve database details

Description: Retrieves detailed information about a specific database within a branch.

Method Signature:
`apiClient.getProjectBranchDatabase(projectId: string, branchId: string, databaseName: string)`

Parameters:

- `projectId` (string, required): The ID of the project.
- `branchId` (string, required): The ID of the branch.
- `databaseName` (string, required): The name of the database.

Example Usage:

```typescript
const response = await apiClient.getProjectBranchDatabase(
  'your-project-id',
  'br-your-branch-id',
  'my-app-db'
)
```

### Update database

Description: Updates the properties of a specified database, such as its name or owner.

Method Signature:
`apiClient.updateProjectBranchDatabase(projectId: string, branchId: string, databaseName: string, data: DatabaseUpdateRequest)`

Parameters:

- `projectId` (string, required): The ID of the project.
- `branchId` (string, required): The ID of the branch.
- `databaseName` (string, required): The current name of the database to update.
- `data` (`DatabaseUpdateRequest`):
  - `database` (object, required):
    - `name?` (string): A new name for the database.
    - `owner_name?` (string): The name of a different existing role to become the new owner.

Example Usage:

```typescript
const response = await apiClient.updateProjectBranchDatabase(
  'your-project-id',
  'br-your-branch-id',
  'my-app-db',
  {
    database: { name: 'my-renamed-app-db' },
  }
)
```

### Delete database

Description: Deletes the specified database from a branch. This action is permanent.

Method Signature:
`apiClient.deleteProjectBranchDatabase(projectId: string, branchId: string, databaseName: string)`

Parameters:

- `projectId` (string, required): The ID of the project.
- `branchId` (string, required): The ID of the branch.
- `databaseName` (string, required): The name of the database.

Example Usage:

```typescript
await apiClient.deleteProjectBranchDatabase(
  'your-project-id',
  'br-your-branch-id',
  'my-renamed-app-db'
)
```

### List roles

Description: Retrieves a list of all Postgres roles from the specified branch.

Method Signature:
`apiClient.listProjectBranchRoles(projectId: string, branchId: string)`

Parameters:

- `projectId` (string, required): The ID of the project.
- `branchId` (string, required): The ID of the branch.

Example Usage:

```typescript
const response = await apiClient.listProjectBranchRoles(
  'your-project-id',
  'br-your-branch-id'
)
// Example response: { roles: [{ branch_id: "br-your-branch-id", name: "neondb_owner", protected: false, created_at: "xx", updated_at: "xx"}, ... other roles if they exist] }
```

### Create role

Description: Creates a new Postgres role in a specified branch. The response includes the role's generated password.

Method Signature:
`apiClient.createProjectBranchRole(projectId: string, branchId: string, data: RoleCreateRequest)`

Parameters:

- `projectId` (string, required): The ID of the project.
- `branchId` (string, required): The ID of the branch.
- `data` (`RoleCreateRequest`):
  - `role` (object, required):
    - `name` (string, required): The name for the new role (max 63 bytes).
    - `no_login?` (boolean): If `true`, creates a role that cannot log in.

Example Usage:

```typescript
const response = await apiClient.createProjectBranchRole(
  'your-project-id',
  'br-your-branch-id',
  {
    role: { name: 'demo_user' },
  }
)
console.log('Role created:', response.data.role.name)
console.log('Password (store securely!):', response.data.role.password)
```

### Retrieve role details

Description: Retrieves detailed information about a specific Postgres role.

Method Signature:
`apiClient.getProjectBranchRole(projectId: string, branchId: string, roleName: string)`

Parameters:

- `projectId` (string, required): The ID of the project.
- `branchId` (string, required): The ID of the branch.
- `roleName` (string, required): The role name to retrieve details

Example Usage:

```typescript
const response = await apiClient.getProjectBranchRole(
  'your-project-id',
  'br-your-branch-id',
  'demo_user'
)
// Example response: { branch_id: "br-your-branch-id", name: "demo_user", protected: false, created_at: "xx", updated_at: "xx" }
```

### Delete role

Description: Deletes the specified Postgres role from the branch.

Method Signature:
`apiClient.deleteProjectBranchRole(projectId: string, branchId: string, roleName: string)`

Parameters:

- `projectId` (string, required): The ID of the project.
- `branchId` (string, required): The ID of the branch.
- `roleName` (string, required): The role name to delete

Example Usage:

```typescript
await apiClient.deleteProjectBranchRole(
  'your-project-id',
  'br-your-branch-id',
  'demo_user'
)
```

## Endpoints

Manage compute endpoints, which are the Postgres instances that connect to your branches.

### Create compute endpoint

Description: Creates a new compute endpoint and associates it with a branch.

Method Signature:
`apiClient.createProjectEndpoint(projectId: string, data: EndpointCreateRequest)`

Parameters:

- `projectId` (string, required): The ID of the project.
- `data` (`EndpointCreateRequest`):
  - `endpoint` (object, required):
    - `branch_id` (string, required): The ID of the branch to associate the endpoint with.
    - `type` (string, required): `read_write` or `read_only`.
    - `autoscaling_limit_min_cu?` (number): Minimum Compute Units.
    - `autoscaling_limit_max_cu?` (number): Maximum Compute Units.
    - `suspend_timeout_seconds?` (integer): Inactivity seconds before suspension.

Example Usage:

```typescript
import { EndpointType } from '@neondatabase/api-client'

const response = await apiClient.createProjectEndpoint('your-project-id', {
  endpoint: { branch_id: 'br-your-branch-id', type: EndpointType.ReadOnly },
})
// Example response: {"endpoint":{"host":"ep-xxx.neon.tech","id":"ep-endpoint-id","project_id":"your-project-id","branch_id":"br-your-branch-id","autoscaling_limit_min_cu":0.25,"autoscaling_limit_max_cu":2,"region_id":"aws-ap-southeast-1","type":"read_only","current_state":"init","pending_state":"active","settings":{},"pooler_enabled":false,"pooler_mode":"transaction","disabled":false,"passwordless_access":true,"creation_source":"console","created_at":"xx","updated_at":"xx","proxy_host":"ap-southeast-1.aws.neon.tech","suspend_timeout_seconds":0,"provisioner":"k8s-neonvm"}}
```

### List compute endpoints

Description: Retrieves a list of all compute endpoints for a project (includes endpoints of all branches)

Method Signature:
`apiClient.listProjectEndpoints(projectId: string)`

Parameters:

- `projectId` (string, required): The ID of the project.

Example Usage:

```typescript
const response = await apiClient.listProjectEndpoints('your-project-id')
// Example response: {"endpoints": [... all endpoint details]}
```

### Retrieve compute endpoint details

Description: Fetches detailed information for a single compute endpoint.

Method Signature:
`apiClient.getProjectEndpoint(projectId: string, endpointId: string)`

Parameters:

- `projectId` (string, required): The ID of the project.
- `endpointId` (string, required): The ID of the specific compute endpoint to retrieve the details.

Example Usage:

```typescript
const response = await apiClient.getProjectEndpoint(
  'your-project-id',
  'ep-your-endpoint-id'
)
```

### Update compute endpoint

Description: Updates the configuration of a specified compute endpoint.

Method Signature:
`apiClient.updateProjectEndpoint(projectId: string, endpointId: string, data: EndpointUpdateRequest)`

Parameters:

- `projectId` (string, required): The ID of the project.
- `endpointId` (string, required): The ID of the endpoint to update.
- `data` (`EndpointUpdateRequest`):
  - `endpoint` (object, required):
    - `autoscaling_limit_min_cu?` (number): New minimum Compute Units.
    - `autoscaling_limit_max_cu?` (number): New maximum Compute Units.
    - `suspend_timeout_seconds?` (integer): New suspension timeout.
    - `disabled?` (boolean): Set to `true` to disable connections or `false` to enable them.

Example Usage:

```typescript
const response = await apiClient.updateProjectEndpoint(
  'your-project-id',
  'ep-your-endpoint-id',
  {
    endpoint: { autoscaling_limit_max_cu: 2 },
  }
)
```

### Delete compute endpoint

Description: Deletes a compute endpoint. This will drop all active connections.

Method Signature:
`apiClient.deleteProjectEndpoint(projectId: string, endpointId: string)`

Parameters:

- `projectId` (string, required): The ID of the project.
- `endpointId` (string, required): The ID of the endpoint to delete.

Example Usage:

```typescript
await apiClient.deleteProjectEndpoint(
  'your-project-id',
  'ep-endpoint-to-delete'
)
```

### Start compute endpoint

Description: Manually starts an `idle` compute endpoint.

Method Signature:
`apiClient.startProjectEndpoint(projectId: string, endpointId: string)`

Parameters:

- `projectId` (string, required): The ID of the project.
- `endpointId` (string, required): The ID of the endpoint to start.

Example Usage:

```typescript
const response = await apiClient.startProjectEndpoint(
  'your-project-id',
  'ep-your-endpoint-id'
)
```

### Suspend compute endpoint

Description: Manually suspends an `active` compute endpoint.

Method Signature:
`apiClient.suspendProjectEndpoint(projectId: string, endpointId: string)`

Parameters:

- `projectId` (string, required): The ID of the project.
- `endpointId` (string, required): The ID of the endpoint to suspend.

Example Usage:

```typescript
await apiClient.suspendProjectEndpoint('your-project-id', 'ep-your-endpoint-id')
```

### Restart compute endpoint

Description: Restarts a compute endpoint by suspending and then starting it. Throws error if endpoint is not active (already suspended)

Method Signature:
`apiClient.restartProjectEndpoint(projectId: string, endpointId: string)`

Parameters:

- `projectId` (string, required): The ID of the project.
- `endpointId` (string, required): The ID of the endpoint to restart.

Example Usage:

```typescript
await apiClient.restartProjectEndpoint('your-project-id', 'ep-your-endpoint-id')
```

## Organizations

Manage organizations, members, and organization-scoped API keys.

### Retrieve organization details

Description: Retrieves detailed information about a specific organization.

Method Signature:
`apiClient.getOrganization(orgId: string)`

Parameters:

- `orgId` (string, required): The organization ID

Example Usage:

```typescript
const response = await apiClient.getOrganization('org-your-org-id')
```

### List organization API keys

Description: Retrieves a list of all API keys for a specified organization.

Method Signature:
`apiClient.listOrgApiKeys(orgId: string)`

Parameters:

- `orgId` (string, required): The organization ID

Example Usage:

```typescript
const response = await apiClient.listOrgApiKeys('org-your-org-id')
```

### Create organization API key

Description: Creates a new API key for an organization. Can be scoped to the entire org or a single project.

Method Signature:
`apiClient.createOrgApiKey(orgId: string, data: OrgApiKeyCreateRequest)`

Parameters:

- `orgId` (string, required): The organization ID
- `data` (`OrgApiKeyCreateRequest`):
  - `key_name` (string, required): A name for the key.
  - `project_id?` (string): If provided, restricts the key's access to this project.

Example Usage:

```typescript
const response = await apiClient.createOrgApiKey('org-your-org-id', {
  key_name: 'ci-key-for-project-abc',
  project_id: 'project-abc-id',
})
```

### Revoke organization API key

Description: Permanently revokes an organization API key.

Method Signature:
`apiClient.revokeOrgApiKey(orgId: string, keyId: number)`

Parameters:

- `orgId` (string, required): The organization ID
- `keyId` (number, required): The key id of the api key to revoke

Example Usage:

```typescript
await apiClient.revokeOrgApiKey('org-your-org-id', 12345)
```

### Retrieve organization members details

Description: Retrieves a list of all members in an organization.

Method Signature:
`apiClient.getOrganizationMembers(orgId: string)`

Parameters:

- `orgId` (string, required): The organization ID

Example Usage:

```typescript
const response = await apiClient.getOrganizationMembers('org-your-org-id')
```

### Retrieve organization member details

Description: Retrieves information about a single member of an organization.

Method Signature:
`apiClient.getOrganizationMember(orgId: string, memberId: string)`

Parameters:

- `orgId` (string, required): The organization ID
- `memberId` (string, required): The member ID to retrieve the details

Example Usage:

```typescript
const response = await apiClient.getOrganizationMember(
  'org-your-org-id',
  'member-uuid'
)
```

### Update role for organization member

Description: Updates the role of a member within an organization. Only admins can perform this action.

Method Signature:
`apiClient.updateOrganizationMember(orgId: string, memberId: string, data: OrganizationMemberUpdateRequest)`

Parameters:

- `orgId` (string, required): The organization ID
- `memberId` (string, required): The member ID to update.
- `data` (`OrganizationMemberUpdateRequest`):
  - `role` (string, required): The new role. Allowed: `admin`, `member`.

Example Usage:

```typescript
import { MemberRole } from '@neondatabase/api-client'

await apiClient.updateOrganizationMember('org-your-org-id', 'member-uuid', {
  role: MemberRole.Admin,
})
```

### Remove member from organization

Description: Removes a member from an organization. Only admins can perform this action.

Method Signature:
`apiClient.removeOrganizationMember(orgId: string, memberId: string)`

Parameters:

- `orgId` (string, required): The organization ID
- `memberId` (string, required): The member ID to remove.

Example Usage:

```typescript
await apiClient.removeOrganizationMember(
  'org-your-org-id',
  'member-uuid-to-remove'
)
```

### Retrieve organization invitation details

Description: Retrieves a list of outstanding invitations for an organization.

Method Signature:
`apiClient.getOrganizationInvitations(orgId: string)`

Parameters:

- `orgId` (string, required): The organization ID

Example Usage:

```typescript
const response = await apiClient.getOrganizationInvitations('org-your-org-id')
```

### Create organization invitations

Description: Creates and sends email invitations for users to join an organization.

Method Signature:
`apiClient.createOrganizationInvitations(orgId: string, data: OrganizationInvitesCreateRequest)`

Parameters:

- `orgId` (string, required): The organization ID
- `data` (`OrganizationInvitesCreateRequest`):
  - `invitations` (array of objects, required):
    - `email` (string, required): The email address to invite.
    - `role` (string, required): The role for the invited user. Allowed: `admin`, `member`.

Example Usage:

```typescript
import { MemberRole } from '@neondatabase/api-client'

await apiClient.createOrganizationInvitations('org-your-org-id', {
  invitations: [{ email: 'new.dev@example.com', role: MemberRole.Member }],
})
```

## Error Handling

The SDK uses `axios` under the hood and throws `AxiosError` for API failures. Always wrap API calls in `try...catch` blocks to handle potential errors gracefully.

Error Structure:

- `error.response.status`: The HTTP status code (e.g., `401`, `404`, `429`).
- `error.response.data`: The error payload from the Neon API, usually containing a `code` and `message`.

Example Error Handling:

```typescript
async function safeApiOperation(projectId: string) {
  try {
    const response = await apiClient.getProject(projectId)
    return response.data
  } catch (error: any) {
    if (error.isAxiosError) {
      const status = error.response?.status
      const data = error.response?.data
      console.error(`API Error: Status ${status}`)
      console.error(`Message: ${data?.message}`)

      switch (status) {
        case 401:
          console.error('Authentication error: Check your NEON_API_KEY.')
          break
        case 404:
          console.error(`Resource not found for project ID: ${projectId}`)
          break
        case 429:
          console.error('Rate limit exceeded. Please wait before retrying.')
          break
        default:
          console.error('An unexpected API error occurred.')
      }
    } else {
      console.error('A non-API error occurred:', error.message)
    }
    return null
  }
}
```

Common Status Codes:

- `401 Unauthorized`: Your API key is invalid or missing.
- `403 Forbidden`: Your API key does not have permission for this action.
- `404 Not Found`: The requested resource (project, branch, etc.) does not exist.
- `422 Unprocessable Entity`: The request body is invalid. Check your parameters.
- `429 Too Many Requests`: You have exceeded the API rate limit.
- `500 Internal Server Error`: An error occurred on Neon's side.

** Neon Auth Rules **

---

description: Use these rules to relate your database data with your Auth users information
globs: _.tsx, _.ts
alwaysApply: false

---

# Neon Auth guidelines

## The Problem Neon Auth Solves

Neon Auth integrates user authentication directly with your Neon Postgres database. Its primary purpose is to **eliminate the complexity of synchronizing user data** between your authentication provider and your application's database.

- **Before Neon Auth:** Developers need to build and maintain custom sync logic, webhooks, and separate user tables to handle user creation, updates, and deletions. This is error-prone and adds overhead.
- **With Neon Auth:** User data is automatically populated and updated in near real-time within a dedicated `neon_auth.users_sync` table in your database. This allows you to treat user profiles as regular database rows, ready for immediate use in SQL joins and application logic.

## The Two Halves of Neon Auth

Think of Neon Auth as a unified system with two main components:

1.  **The Authentication Layer (SDK):** This is for managing user sessions, sign-ins, sign-ups, and accessing user information in your application code (client and server components). It is powered by the Stack Auth SDK (`@stackframe/stack`).
2.  **The Database Layer (Data Sync):** This is the `neon_auth.users_sync` table within your Neon database. It serves as a near real-time, read-only replica of your user data, ready to be joined with your application's tables.

## Stack Auth Setup Guidelines

### Initial Setup

Ask the human developer to do the following steps:

- Enable Neon Auth: In the Neon project console, navigate to the Auth page and click Enable Neon Auth.
- Get Credentials: Go to the Configuration tab and copy the environment variables.

Steps which you can do after that:

- Run the installation wizard with:  
  `npx @stackframe/init-stack@latest --agent-mode --no-browser`
- Update the API keys in your `.env.local` file with the values from the Neon console:
  - `NEXT_PUBLIC_STACK_PROJECT_ID`
  - `NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY`
  - `STACK_SECRET_SERVER_KEY`
- Key files created/updated include:
  - `app/handler/[...stack]/page.tsx` (default auth pages)
  - `app/layout.tsx` (wrapped with StackProvider and StackTheme)
  - `app/loading.tsx` (provides a Suspense fallback)
  - `stack/server.tsx` (initializes your Stack server app)
  - `stack/client.tsx` (initializes your Stack client app)

### UI Components

- Use pre-built components from `@stackframe/stack` like `<UserButton />`, `<SignIn />`, and `<SignUp />` to quickly set up auth UI.
- You can also compose smaller pieces like `<OAuthButtonGroup />`, `<MagicLinkSignIn />`, and `<CredentialSignIn />` for custom flows.
- Example:

  ```tsx
  import { SignIn } from '@stackframe/stack'
  export default function Page() {
    return <SignIn />
  }
  ```

### User Management

- In Client Components, use the `useUser()` hook to retrieve the current user (it returns `null` when not signed in).
- Update user details using `user.update({...})` and sign out via `user.signOut()`.

### Client Component Integration

- Client Components rely on hooks like `useUser()` and `useStackApp()`.
- Example:

  ```tsx
  'use client'
  import { useUser } from '@stackframe/stack'
  export function MyComponent() {
    const user = useUser()
    return <div>{user ? `Hello, ${user.displayName}` : 'Not logged in'}</div>
  }
  ```

### Server Component Integration

- For Server Components, use `stackServerApp.getUser()` from `stack/server.tsx` file.
- Example:

  ```tsx
  import { stackServerApp } from '@/stack/server'
  export default async function ServerComponent() {
    const user = await stackServerApp.getUser()
    return <div>{user ? `Hello, ${user.displayName}` : 'Not logged in'}</div>
  }
  ```

### Page Protection

- Protect pages by redirecting to Sign in page:
  - Using `useUser({ or: "redirect" })` in Client Components.
  - Using `await stackServerApp.getUser({ or: "redirect" })` in Server Components.
  - Implementing middleware that checks for a user and redirects to `/handler/sign-in` if not found.
- Example middleware:

  ```tsx
  export async function middleware(request: NextRequest) {
    const user = await stackServerApp.getUser()
    if (!user) {
      return NextResponse.redirect(new URL('/handler/sign-in', request.url))
    }
    return NextResponse.next()
  }
  export const config = { matcher: '/protected/:path*' }
  ```

## Stack Auth SDK Reference

The Stack Auth SDK provides several types and methods:

```tsx
type StackClientApp = {
  new(options): StackClientApp;
  getUser([options]): Promise<User>;
  useUser([options]): User;
  getProject(): Promise<Project>;
  useProject(): Project;
  signInWithOAuth(provider): void;
  signInWithCredential([options]): Promise<...>;
  signUpWithCredential([options]): Promise<...>;
  sendForgotPasswordEmail(email): Promise<...>;
  sendMagicLinkEmail(email): Promise<...>;
};
type StackServerApp =
  & StackClientApp
  & {
    new(options): StackServerApp;
    getUser([id][, options]): Promise<ServerUser | null>;
    useUser([id][, options]): ServerUser;
    listUsers([options]): Promise<ServerUser[]>;
    useUsers([options]): ServerUser[];
    createUser([options]): Promise<ServerUser>;
    getTeam(id): Promise<ServerTeam | null>;
    useTeam(id): ServerTeam;
    listTeams(): Promise<ServerTeam[]>;
    useTeams(): ServerTeam[];
    createTeam([options]): Promise<ServerTeam>;
  }
type CurrentUser = {
  id: string;
  displayName: string | null;
  primaryEmail: string | null;
  primaryEmailVerified: boolean;
  profileImageUrl: string | null;
  signedUpAt: Date;
  hasPassword: boolean;
  clientMetadata: Json;
  clientReadOnlyMetadata: Json;
  selectedTeam: Team | null;
  update(data): Promise<void>;
  updatePassword(data): Promise<void>;
  getAuthHeaders(): Promise<Record<string, string>>;
  getAuthJson(): Promise<{ accessToken: string | null }>;
  signOut([options]): Promise<void>;
  delete(): Promise<void>;
  getTeam(id): Promise<Team | null>;
  useTeam(id): Team | null;
  listTeams(): Promise<Team[]>;
  useTeams(): Team[];
  setSelectedTeam(team): Promise<void>;
  createTeam(data): Promise<Team>;
  leaveTeam(team): Promise<void>;
  getTeamProfile(team): Promise<EditableTeamMemberProfile>;
  useTeamProfile(team): EditableTeamMemberProfile;
  hasPermission(scope, permissionId): Promise<boolean>;
  getPermission(scope, permissionId[, options]): Promise<TeamPermission | null>;
  usePermission(scope, permissionId[, options]): TeamPermission | null;
  listPermissions(scope[, options]): Promise<TeamPermission[]>;
  usePermissions(scope[, options]): TeamPermission[];
  listContactChannels(): Promise<ContactChannel[]>;
  useContactChannels(): ContactChannel[];
};
```

## Stack Auth Best Practices

- Use the appropriate methods based on component type:
  - Use hook-based methods (`useXyz`) in Client Components
  - Use promise-based methods (`getXyz`) in Server Components
- Always protect sensitive routes using the provided mechanisms
- Use pre-built UI components whenever possible to ensure proper auth flow handling

## Neon Auth Database Integration

### Database Schema

Neon Auth creates and manages a schema in your database that stores user information:

- **Schema Name**: `neon_auth`
- **Primary Table**: `users_sync`
- **Table Structure**:
  - `raw_json` (JSONB, NOT NULL): Complete user data in JSON format
  - `id` (TEXT, NOT NULL, PRIMARY KEY): Unique user identifier
  - `name` (TEXT, NULLABLE): User's display name
  - `email` (TEXT, NULLABLE): User's email address
  - `created_at` (TIMESTAMP WITH TIME ZONE, NULLABLE): When the user was created
  - `updated_at` (TIMESTAMP WITH TIME ZONE, NULLABLE): When the user was last updated
  - `deleted_at` (TIMESTAMP WITH TIME ZONE, NULLABLE): When the user was deleted (if applicable)
- **Indexes**:
  - `users_sync_deleted_at_idx` on `deleted_at`: For quickly identifying deleted users

> NOTE: The table is automatically created and managed by Neon Auth. Do not manually create or modify it. This is provided for your reference only.

### Database Usage

#### Querying Active Users

The `deleted_at` column is used for soft deletes. Always include `WHERE deleted_at IS NULL` in your queries to ensure you only work with active user accounts.

```sql
SELECT * FROM neon_auth.users_sync WHERE deleted_at IS NULL;
```

#### Relating User Data with Application Tables

To join user data with your application tables:

```sql
SELECT
  t.*,
  u.id AS user_id,
  u.name AS user_name,
  u.email AS user_email
FROM
  public.todos t
LEFT JOIN
  neon_auth.users_sync u ON t.owner = u.id
WHERE
  u.deleted_at IS NULL
ORDER BY
  t.id;
```

## Integration Flow

1. User authentication happens via Stack Auth UI components
2. User data is automatically synced to the `neon_auth.users_sync` table
3. Your application code accesses user information either through:
   - Stack Auth hooks/methods (in React components)
   - SQL queries to the `neon_auth.users_sync` table (for read only data operations)

## Best Practices for Integration

- **The `users_sync` Table is a Read-Only Replica**: User data is managed by the Neon Auth service. **NEVER** `INSERT`, `UPDATE`, or `DELETE` rows directly in the `neon_auth.users_sync` table. All user modifications must happen through the Authentication Layer SDK (e.g., `user.update({...})`, `user.delete()`). Direct database modifications will be overwritten and can break the sync process.

- **Use Foreign Keys Correctly**: You **SHOULD** create foreign key constraints from your application tables _to_ the `neon_auth.users_sync(id)` column. This maintains referential integrity. Do **NOT** attempt to add foreign keys _from_ the `users_sync` table to your own tables.

  ```sql
  -- CORRECT: Your table references the Neon Auth table.
  CREATE TABLE posts (
      id SERIAL PRIMARY KEY,
      content TEXT,
      author_id TEXT NOT NULL REFERENCES neon_auth.users_sync(id) ON DELETE CASCADE
  );

  -- INCORRECT: Do not try to alter the Neon Auth table. Will break entire Neon Auth system.
  -- ALTER TABLE neon_auth.users_sync ADD CONSTRAINT ...
  ```

## Example: Custom Profile Page with Database Integration

### Frontend Component

```tsx
'use client'
import { useUser, useStackApp, UserButton } from '@stackframe/stack'
export default function ProfilePage() {
  const user = useUser({ or: 'redirect' })
  const app = useStackApp()
  return (
    <div>
      <UserButton />
      <h1>Welcome, {user.displayName || 'User'}</h1>
      <p>Email: {user.primaryEmail}</p>
      <button onClick={() => user.signOut()}>Sign Out</button>
    </div>
  )
}
```

### Database Query for User's Content

```sql
-- Get all todos for the currently logged in user
SELECT
  t.*
FROM
  public.todos t
LEFT JOIN
  neon_auth.users_sync u ON t.owner = u.id
WHERE
  u.id = $current_user_id
  AND u.deleted_at IS NULL
ORDER BY
  t.created_at DESC;
```
