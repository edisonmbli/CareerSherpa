**现状分析**

* 队列语义在代码中以 `QueueId` 表示，但并未在 QStash 创建对应“命名队列”；生产者通过 `url` 分层路径把消息推到多个 API 路由，同时用 Redis 计数做背压（`lib/queue/producer.ts:140-159`）。

* Worker 入口按“体验模式+付费等级”拆成 6 个路由，逻辑集中在两个核心处理器（`lib/worker/handlers.ts`），路由仅做签名与转发。

* SSE 与并发守卫在处理器内完成，运行稳定，但存在路由重复与开发态维护成本。

**最佳实践建议（QStash 多队列）**

* 在 QStash Console 创建 6 个“命名队列”（`q_paid_stream`、`q_free_stream`、`q_paid_batch`、`q_free_batch`、`q_paid_vision`、`q_free_vision`），为每队列设置并行度（与业务期望一致，具体策略见 Solution Spec）。

* 生产者推送消息时显式指定 `queue`（QStash 支持按队列分发与并行度控制），同时仍传 `queueId` 到消息体用于 Worker 侧的细粒度守卫与审计。

* Worker 路由精简为 2 个入口：`/api/worker/stream/[service]` 与 `/api/worker/batch/[service]`（视觉仍走 `batch`），避免“路由互相导入”与重复包装器；6 个适配器路由可保留一版（向后兼容）或逐步下线。

* 并发控制分层：

  * 队列层（QStash）：利用“命名队列”的并行度进行粗粒度门控与暂停/恢复。

  * 模型层（Redis）：保留现有 `enterModelConcurrency/exitModelConcurrency` 针对 `modelId+tier` 做限流（`lib/worker/common.ts:123-129`）。

  * 用户层（Redis）：保留现有 `enterUserConcurrency/exitUserConcurrency`。

* 生产者侧背压保留（Redis 计数），与 QStash 队列并行度共同形成双保险；SSE 与事件桥逻辑不变。

**与当前实现的差异与优劣**

* 当前：通过分层 URL 模拟队列隔离，未使用 QStash“命名队列”，维护 6 个路由增加开发态复杂度；优点是无需外部队列配置即可隔离；缺点是缺乏队列级暂停、并行度与可视化管理。

* 建议方案：真正用 QStash 多队列，生产者按队列名推送，Worker 统一入口；优点是运维友好、并行度与暂停可视、降低路由复杂度；缺点是需要在 QStash Console/SDK 进行队列配置与权限管理。

**迁移步骤**

1. 在 QStash Console 创建 6 个队列并设置并行度（与 `docs/2.Solution_Spec.md:90-133` 对齐）。
2. 更新生产者：在 `publishJSON` 指定 `queue` 字段/头（与 QStash SDK对齐），同时消息体保留 `queueId`、`tier`、`modelId` 以便 Worker 侧守卫与审计。
3. 精简 Worker 路由：保留核心 2 个入口，6 个适配器路由改为薄层（签名校验后转发到处理器或直接返回“使用统一入口”的兼容提示），逐步下线。
4. 校验并发与背压：

   * 队列级：在 QStash 调整并行度验证吞吐与暂停行为。

   * 模型级/用户级：保持 Redis 锁与计数器逻辑不变，确保 `exit` 路径覆盖异常。
5. 验收与监控：

   * SSE 测试页：三态覆盖（Auto/Paid/Free）分别验证 `queueId` 与事件序列。

   * QStash 队列监控：观察每队列流量与并行度；必要时启用 DLQ。

**进一步重构建议（不改功能，仅优化结构）**

* 处理器拆分为“管线步骤”：验证→路由决策→守卫→执行→事件→清理，每步为纯函数：`lib/worker/steps/*`，通过组合驱动，便于单测与维护。

* 类型与契约：为消息体与事件定义 `zod`/TS 类型（`WorkerBody`、`WorkerEvent` union），集中在 `lib/worker/types.ts`；引入 `Result<T,E>` 以明确错误分支。

* 配置集中化：并发、队列大小、模型阈值统一到 `lib/config/concurrency.ts`，减少散落读取。

* 日志与审计统一：`lib/observability/logger.ts` 封装 `trackEvent/audit`，支持结构化字段与采样。

* 测试与脚本：新增 `scripts/dev/worker-sim.ts`，直接调用处理器模拟请求，便于离线压测与 CI；完善单测覆盖各管线步骤。

* 路由适配器治理：保留但不相互 import；后续通过 URL 组或 301 指引统一入口，避免再发生递归堆栈与 AsyncHooks 膨胀。

**交付与验证**

* 先完成生产者与 QStash 队列接入的最小改动，保持现有 Redis 守卫与处理器逻辑不变，逐步下线路由套壳。

* 提供验收清单：三态 SSE、付费/免费/视觉三组合、并行度测试、队列暂停/恢复、DLQ 验证、模型并发锁触顶与释放。

