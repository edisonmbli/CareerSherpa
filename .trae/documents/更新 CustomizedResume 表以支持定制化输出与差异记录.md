## 变更内容（单文件）
- 文件：`prisma/schema.prisma`，模型：`CustomizedResume`
- 在现有字段基础上新增：
  - `markdownText String? @map("markdown_text")` — 存储生成后的 Markdown 文本
  - `opsJson Json? @map("ops_json")` — 存储最小修改操作列表（含原句/改句并排）
  - `degradeReason String? @map("degrade_reason")` — 可选，记录失败/降级原因
- 保留现有字段：`serviceId @unique`、`status AsyncTaskStatus`、`createdAt/updatedAt`、`service` 关系，不做修改。

## 兼容性与迁移
- 新增字段默认允许 `NULL`，不影响现有数据。
- 你完成 `prisma migrate` 与 `prisma generate` 后，我继续对接后端 Action/Worker 与前端 UI（Step2）。

## 不做改动的范围
- 其他模型与枚举 `AsyncTaskStatus/ServiceStep` 不变。
- 此次仅修改 `CustomizedResume` 的结构。