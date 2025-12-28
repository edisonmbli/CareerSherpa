## 现状与问题
- 前端：`components/app/ServiceDisplay.tsx:138` 使用未定义变量 `currentSseTaskId`，导致流式连接报错；`tabValue` 未初始化却在 `Tabs` 受控模式使用（同文件 337）；`isConnected`、`statusDetail` 在组件中使用，但未从 `useWorkbenchStore` 解构（52-58 与 249、331）。
- 后端：任务入队与消费链路正常，但长时间等待主要来自两处限流/背压：
  - 生产端限流窗口：`lib/rateLimiter.ts:6` 设置 `windowSec=300`（5 分钟），试用额度 `trialLimit=3`；命中后早退并提示 `retryAfter`。
  - 生产端队列背压：`lib/queue/producer.ts:157-206` 使用 `bumpPending(...)`，TTL 来自 `ENV.CONCURRENCY_LOCK_TIMEOUT_MS`（默认 30s），超限时返回 `retryAfter` 并退款；可反复触发，累计形成分钟级等待。
- QStash：当前 `enqueueJSON({ retries: 0 })`（`lib/queue/producer.ts:224`），未使用 `dependsOn/delay/schedule`；等待不是 QStash 的计划任务，而是代码内限流/背压导致。

## 修复与对齐（Workbench 前端）
- 修正 SSE 启动参数：
  - 将 `useSseStream(userId, enableMatchStream ? serviceId : '', currentSseTaskId)` 改为传入已有 `matchTaskId`：`useSseStream(userId, enableMatchStream ? serviceId : '', enableMatchStream ? matchTaskId : '')`（`components/app/ServiceDisplay.tsx:138`）。
- 初始化并驱动 Tabs：
  - 添加 `const [tabValue, setTabValue] = useState<'match'|'customize'|'interview'>('match')`；删除孤立的 `const initialTab = 'match'` 与下一行的残留表达式（`components/app/ServiceDisplay.tsx:140-142`）。
- 完整解构 Store 字段：
  - 将 `const { status, setStatus, startTask, streamingResponse, setError, errorMessage } = useWorkbenchStore()` 扩充为同时解构 `statusDetail` 与 `isConnected`（用于状态文案与连接态显示）（组件顶部 52-58 与 249、331）。
- 状态对齐方案设计：
  - 进入 Workbench 服务页时，根据 `initialService.currentStatus` 派发：`OCR_PENDING`→`SUMMARY_PENDING`→`MATCH_PENDING/MATCH_STREAMING`→`COMPLETED/FAILED`（同文件 71-111）。
  - 图片场景：`shouldPollMatch = status in {'SUMMARY_PENDING','OCR_PENDING'}`，轮询到 `STREAMING`/`COMPLETED` 后切换到 SSE（`useTaskPolling` 已具备，121-131）。
  - 文本场景：服务创建返回 `stream: true` 时，直接建立 SSE（`enableMatchStream` 条件 133-137）。

## 性能优化（参数与协同）
- 生产端限流与背压参数调优：
  - 将 `lib/rateLimiter.ts:6` 的 `windowSec` 下调至 60–90 秒（开发/内测阶段），或提高 `trialLimit/boundLimit`；避免 300 秒窗口导致的 5 分钟等待。
  - 将 `ENV.CONCURRENCY_LOCK_TIMEOUT_MS` 下调至 5000–10000ms，减少队列背压键的存活时间；结合业务量适度提高 `queueLimits.*`（`getConcurrencyConfig()`）的上限，降低拒绝率。
  - 保持 `finally` 的 `decPending`（消费侧）与生产侧超限退款逻辑不变，保证一致性与原子性。
- QStash 选项建议：
  - 保持文本场景直接流式；图片场景继续按 “OCR→job_summary→job_match” 串联。若需更严格依赖管理，可在“图片”场景启用 `dependsOn`（仅用于 job→match），减少自实现串联中的短时竞态，但不期望显著影响延迟。
- SSE 启动时机优化：
  - 文本场景在 Action 成功返回即建连；图片场景在轮询状态切换到 `MATCH_STREAMING` 后建连，避免空连与闪烁。
- Token 合并窗口：
  - 依据体验调节 `ENV.STREAM_FLUSH_INTERVAL_MS` 与 `ENV.STREAM_FLUSH_SIZE`（见 `lib/worker/common.ts:279-286`），在不卡顿前提下降低渲染频率，缓解 UI 抖动。

## 可观测性与“时间线”专属文档
- 建立跨端统一时间线（trace）：使用 `serviceId`、`taskId`、`requestId`、`traceId` 关联事件，落盘到 `tmp/perf-timeline/{serviceId}.md`（或 `docs/perf_timeline.md`）并输出结构化日志。
- 注入点与事件：
  - 前端：
    - 服务创建返回：`createServiceAction` 响应时间与字段（`stream/isFree/taskType/taskId`）。
    - Workbench：`shouldPollMatch` 开始/结束时间；`useSseStream` 建连/切换（`fromLatest=1→0`）。
  - 生产端：
    - `pushTask`：`rateLimited/backpressured` 与 `retryAfter`；成功 `TASK_ENQUEUED`（`lib/queue/producer.ts:237-263`）。
  - Worker：
    - `publishStart`、`guardUser/guardModel/guardQueue` 进入/阻塞；`execute*` 开始/结束；`publish_event` `status: summary_* / match_*`；`done/error`（`lib/worker/handlers.ts`）。
- 事件格式（建议）：
  - `[ts] phase=worker.stream.enter taskId=... model=... queue=...`
  - `[ts] phase=guard.queue.block retryAfter=...`
  - `[ts] phase=sse.connected fromLatest=1`
  - `[ts] phase=match.streaming start`
  - `[ts] phase=match.completed latencyMs=... tokensIn=... tokensOut=...`

## 验证用例
- 文本 JD：创建后 8 秒内首 token（NFR-2.3）；UI 显示 `MATCH_STREAMING`，`StreamPanel` 实时滚动；最终结果写库并显示。
- 图片 JD：先显示 `OCR_PENDING/Extracting job`，轮询切换到 `MATCH_STREAMING` 后建 SSE；全程无闪烁与“空连接”。
- 并行服务：同时创建 A/B 两个服务；确认生产端限流不导致同用户串行化，且背压键在 `finally` 后归零（`lib/worker/common.ts:140-150`）。

## 交付内容
- 前端修复补丁（`ServiceDisplay.tsx`）与状态机对齐。
- 参数调优清单（限流窗口、背压 TTL、队列上限、token 合并窗口）。
- 时间线仪表模块与事件注入点列表（含落盘位置与日志字段）。
- 回归用例脚本/说明（文本/图片/并行）。

请确认以上方案，我将按此计划提交具体补丁与配置更新，并在本地验证流式稳定性与端到端耗时。