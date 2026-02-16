# Neon 数据表定期清理指南 (Cron Job)

本文档详细说明了如何使用 **Vercel Cron Jobs** 来定期清理 Neon 数据库中的历史数据（主要是 `analytics_events` 表），以控制存储成本并保持查询性能。

## 1. 方案架构

我们采用 **Next.js API Route + Vercel Cron** 的 Serverless 方案，而非数据库原生的 `pg_cron`。

*   **触发器**: Vercel Cron (每天 UTC 00:00 触发一次 HTTP GET 请求)。
*   **执行层**: Next.js API Route (`/api/cron/cleanup-analytics`)。
*   **逻辑层**: Prisma DAL (`lib/dal/analyticsEvent.ts`) 执行 `deleteMany`。
*   **安全**: 使用 `CRON_SECRET` 校验请求来源，防止未授权调用。

### 优势
*   **零额外成本**: 利用 Vercel 免费额度（Hobby 计划每天 1 次，Pro 计划更多）。
*   **代码即配置**: `vercel.json` 定义调度，无需登录数据库控制台。
*   **类型安全**: 复用现有的 Prisma 客户端和 Guard 机制。

---

## 2. 代码实现 (已完成)

### A. DAL 层清理逻辑
文件: `lib/dal/analyticsEvent.ts`

我们定义了以下保留策略：
*   **SYSTEM** (系统日志/Debug): 保留 **30天**。
*   **BUSINESS** (业务数据): 保留 **90天**。
*   **SECURITY** (安全审计): 保留 **90天**。

```typescript
export async function cleanupOldAnalyticsEvents() {
  const now = new Date()
  const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const day90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

  // ...执行 deleteMany ...
}
```

### B. Cron API Route
文件: `app/api/cron/cleanup-analytics/route.ts`

该接口接收 GET 请求，验证 `Authorization` 头，并调用 DAL 清理函数。

```typescript
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  
  // 安全校验
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }
  // ...
}
```

### C. 调度配置
文件: `vercel.json`

在项目根目录创建此文件，定义 Cron 表达式。

```json
{
  "crons": [
    {
      "path": "/api/cron/cleanup-analytics",
      "schedule": "0 0 * * *"
    }
  ]
}
```
*   `0 0 * * *`: 每天 UTC 时间 00:00 运行。

---

## 3. 部署与配置步骤

### 第一步：设置环境变量 (CRON_SECRET)

为了防止恶意用户频繁调用清理接口，Vercel 会自动为 Cron 请求注入一个密钥。你需要确保环境变量中有这个密钥。

1.  登录 Vercel Dashboard -> Settings -> Environment Variables。
2.  添加变量 `CRON_SECRET`。
    *   **值**: 生成一个随机长字符串（例如 `openssl rand -hex 32`）。
    *   **注意**: 如果你在本地测试，也需要在 `.env.local` 中添加该变量。

> **提示**: Vercel 的 Cron Jobs 在预览环境 (Preview Deployments) 中默认**不运行**，只在生产环境 (Production) 生效。

### 第二步：部署代码

提交上述三个文件的变更 (`lib/dal`, `app/api`, `vercel.json`) 并推送到主分支。Vercel 会自动识别 `vercel.json` 并注册 Cron Job。

### 第三步：验证与测试

#### 方式 1: Vercel Dashboard (推荐)
部署完成后：
1.  进入 Vercel 项目页面 -> **Settings** -> **Cron Jobs**。
2.  你应该能看到 `/api/cron/cleanup-analytics` 任务。
3.  点击 **Run Now** 按钮手动触发一次。
4.  查看 **Logs** 确认执行结果（应返回 `{ success: true, systemDeleted: N, ... }`）。

#### 方式 2: 本地/Postman 测试
在本地启动服务 (`pnpm dev`) 后，使用 curl 或 Postman 调用：

```bash
curl -H "Authorization: Bearer <YOUR_CRON_SECRET>" \
     http://localhost:3000/api/cron/cleanup-analytics
```

---

## 4. 扩展建议

如果未来需要更复杂的清理（例如归档到 S3 而非直接删除），只需修改 `lib/dal/analyticsEvent.ts` 中的 `cleanupOldAnalyticsEvents` 函数即可，无需改动调度逻辑。
