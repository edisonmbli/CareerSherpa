## 问题复盘与根因
- 解析结果为空：`resume_summary_json` 仅有 `{ skills: { technical: [] } }`。
  - 根因：Worker 在执行 `resume_summary` 时未向链路传入 `resume_text`，模板变量未填充导致模型输出最小内容。现有推送只含 `{ resumeId, wasPaid, cost }`，未包含正文。参照 `lib/prompts/en.ts:235-249` 模板变量要求 `resume_text`。
- 日志出现两条 `rag_embedding`：与资产流无关，应来自其他路径（如测试或独立调用）。需要审计资产流程中是否误调用 `runEmbedding`，并为日志打上来源标签以区分。

## 后端修复方案
- 在批处理 Worker 为资产任务注入正文：
  - 位置：`lib/worker/handlers.ts`
  - `resume_summary`：读取 `resumeId` 对应的 `resume.originalText`，构造 `variables = { resume_text: <text>, ... }` 后再调用 `executeStructured`。
  - `detailed_resume_summary`：读取 `detailedResume.originalText`，构造 `variables = { detailed_resume_text: <text>, ... }`。
  - 保持 QStash 消息体小，避免把全文放到队列消息里。
- 输出质量兜底：
  - 在写回阶段加入“有效性判断”（如至少有 `summary` 或 `experience` 非空），否则按 `FAILED` 处理并返还金币。
- `rag_embedding` 溯源：
  - 审计资产流程是否调用 `runEmbedding`；若有，移除或加开关。为 `createLlmUsageLogDetailed` 增加来源字段（如 `source: 'asset_flow' | 'rag_pipeline' | 'test'`）。

## LLM 调试脚本
- 新建 `scripts/debug-resume-summary.ts`：
  - 输入：`resume_id`（如：`cmi2lzakg00158oim8uzvcvcc`）。
  - 步骤：用 Prisma 取出 `original_text`；按 Worker 决策调用 `runStructuredLlmTask('resume_summary', locale, { resume_text })`；打印 `raw`、`data`、`usage` 以及“质量判断”结果。
  - 目的：独立验证模板变量、模型选择与解析质量，快速定位问题。

## 低流量轮询保持
- 已完成：`task-status` 支持 `ETag/304` 与 `lastUpdatedAt`，前端使用退避策略。
- 保持：成功/失败即停轮询；Pending 才轮询；同一任务仅一个定时器。

## UI/UX 优化建议
- 进度条与视觉：
  - Pending 进度条采用中性灰（如 `bg-muted` 或降低不透明度），与页面整体层级协调。
  - 在 Pending 区域显示“最近状态更新时间”（已接入）。
- 成功态组件隔离：
  - 首次上传前：当前说明结构保留，引导用户。
  - 上传成功后或页面发现已有资产：切换为“资产卡片”视图，视觉主角为已上传简历。
    - 快速预览：使用 `HoverCard/Popover` 展示 `resume_summary_json` 的格式化预览（Header/Experience/Skills），清爽样式；支持中英文。
    - 重新上传：按钮置于卡片右侧或二级操作区，文案轻量（如“重新上传”）。
  - 同样适用于“详细履历”分区。
- 文案与交互：
  - 成功吐司：提示“已入队，后台解析中”。
  - 失败吐司：提示“解析失败（含简述原因），已返还金币（如为付费队列）”。

## 验证与测试
- 脚本验证：用指定 `resume_id` 运行脚本，查看解析有效性与字段覆盖率。
- Worker 验证：上传一次文本型 PDF，确认：
  - QStash 投递；Worker 注入正文；`resume_summary_json` 有效；失败时返还金币。
- 单测/E2E：
  - 新增“有效性兜底”测试；
  - 资产流 E2E：从上传到状态完成/失败的完整链路，校验返还逻辑与 UI 展示。

## 实施顺序
1) Worker 注入正文与结果有效性判断；
2) 调试脚本；
3) `rag_embedding` 溯源与标注；
4) UI 成功态与预览组件；
5) 测试与端到端验证。

请确认以上修复与优化方案，确认后我将按步骤实施并回报验证结果。