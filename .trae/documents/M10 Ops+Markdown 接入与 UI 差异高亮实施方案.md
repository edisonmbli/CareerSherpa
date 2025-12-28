## 必要的 schema 变更（CustomizedResume）
- 现有结构：`CustomizedResume { id, serviceId(unique), markdownContent?, status, createdAt, updatedAt, service@relation }`（prisma/schema.prisma:135-146）
- 新增字段（不重名覆盖，避免迁移风险）：
  - `markdownText String? @map("markdown_text")` — 存储生成后的 Markdown（用于展示与导出），与旧 `markdownContent` 并存（后续统一迁移或清理）。
  - `opsJson Json? @map("ops_json")` — 存储最小修改操作列表（reorder/augment/trim/rewrite-lite），每项包含 `original/revised` 并行记录。
  - （可选）`degradeReason String? @map("degrade_reason")` — 失败或降级原因（便于运维与回滚决策）。
- 其余保持：
  - `serviceId @unique` 不变（每个服务一步只保留一份定制结果）。
  - `status AsyncTaskStatus`（PENDING/COMPLETED/FAILED）不变。
- 迁移建议：新增字段采用 `NULL` 默认，旧数据不受影响；上线后逐步迁移 `markdownContent → markdownText` 或最终统一清理。

## 接入计划（基于上述 schema 变更）
- 后端（M10）
  - 新增 `triggerCustomizeAction(serviceId)`：
    - 读取 `resume_summary_v2`、`job_summary`、`match_result`。
    - 调用 `generateOps(...)` 与 `toMarkdown(...)`；将结果落表：`markdownText/opsJson/status`。
    - Analytics：`TASK_CREATED/COMPLETED/FAILED('customize')`（附 `opsCount/markdownLength`）。
  - `batch-processor` 增加 `case 'resume_customize'`（如需异步）：逻辑与 Action 一致；完成后更新 `service.customizedResume.status='COMPLETED'`。
- 前端（Workbench Tabs）
  - Step2（customize）：
    - 空态：主 CTA “生成定制化简历”（Step1 未完成时给出前置提示）。
    - 进行中：`useTaskPolling`（PENDING→COMPLETED）。
    - 完成态：Markdown Viewer + Diff 列表（原句/改句并排）+ CTA（保存/导出 PDF）。
  - 历史续跑：Step1 完成后默认激活 Tab2；Step2 完成后默认激活 Tab3。
  - i18n：新增 Step2 相关键（title/cta/start/success/fail/diffTitle/exportPdf）。

## 运行参数与简化约束
- Tokens：统一单参数 `maxTokens`（模型总长度理念）；集中配置在 `lib/llm/config.ts`：
  - `detailed_resume_summary: 10000`
  - 其他任务：`8000`
  - 可动态调整，不需改代码。
- 设计准则：“提取而非改写”，职责与亮点分栏；不引入复杂降级；失败自动退款已在 Worker 生效。

## 回滚策略（无开关）
- 版本级回滚：若上线后异常，直接回退到此前稳定版本；Step1（M9）不受影响。
- 数据级回滚：保留 `original_text/markdownText/opsJson`，可按 ops 恢复原文或局部还原。
- 验收与监控：上线前跑单测与 E2E；上线后监控 `TASK_FAILED('customize')` 与生成耗时，如超阈值则回滚。

## 执行顺序
1) 你进行 prisma/schema 迁移：为 CustomizedResume 新增 `markdownText/opsJson/(degradeReason)` 字段。
2) 我接入后端 Action 与 Worker；更新 Workbench Step2 UI；补 i18n 与 Analytics；跑单测与 E2E。
3) 上线并监控；必要时走版本回滚。

请确认上述 schema 变更与接入计划；你完成迁移后通知我，我将继续落地后续动作。