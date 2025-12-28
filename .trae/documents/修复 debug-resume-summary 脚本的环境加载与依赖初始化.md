## 问题
- 当前 `scripts/debug-resume-summary.ts` 在顶层 `import { prisma } from '@/lib/prisma'`，导致在 dotenv 尚未加载完环境变量时，`lib/prismaConnection.ts` 读取不到 `DATABASE_URL`，抛出 Missing DATABASE_URL。

## 修复方案
- 参照 `scripts/debug-llm-call.ts` 的做法：
  1) 顶层先加载 `.env.local` 与 `.env`：`dotenv.config({ path: '.env.local' }); dotenv.config()`。
  2) 若 `DATABASE_URL` 仍为空且存在 `PRISMA_DATABASE_URL`，用其覆盖：`process.env.DATABASE_URL = process.env.PRISMA_DATABASE_URL`。
  3) 将 `import { prisma } from '@/lib/prisma'` 改为在 `main()` 内、dotenv 注入后再动态导入：`const { prisma } = await import('@/lib/prisma')`，确保初始化时环境变量已可用。
  4) 其余逻辑保持：按 `resume_id` 读取 `originalText`，调用 `runStructuredLlmTask('resume_summary', ...)` 并打印输出。

## 验证
- 本地运行：
  - `pnpm tsx scripts/db-connection-test.ts`（已存在脚本）确认连接参数读取正常。
  - `pnpm tsx scripts/debug-resume-summary.ts <resume_id> zh` 输出 `ok/data/error/usage`。

## 不做变更
- 暂不引入日志来源标注；资产流已确认不涉及 embedding。

请确认，确认后我将修改脚本为动态导入 prisma 并重新自测运行。