## 1. 问题发现

**关于 `job_match` 任务触发机制的结论：**

1.  **OCR 任务 (`job_summary`) 完成后触发 `match` 状态更新：**

    - 在 `/Users/edisonmbli/Projects/CareerShaper/lib/worker/handlers.ts` 中，当 `job_summary` 任务成功完成后，系统会更新 `job` 记录的 `jobSummaryJson` 字段（存储 OCR 提取的文本），并将对应的 `match` 记录状态设置为 `MATCH_PENDING`。
      ```typescript
      // lib/worker/handlers.ts
      else if (String(templateId) === 'job_summary') {
        // ... (更新 jobSummaryJson)
        if (exec.result.ok) {
          await (await import('@/lib/prisma')).prisma.match.update({
            where: { serviceId },
            data: { status: 'MATCH_PENDING' as any },
          })
        }
      }
      ```
    - 这意味着 `job_summary` 任务的成功执行是 `match` 任务后续处理的前提。

2.  **没有独立的后台进程主动轮询 `MATCH_PENDING` 状态：**

    - 我的搜索没有发现任何独立的后台进程（例如 cron 作业或单独的 worker）主动轮询数据库以查找 `MATCH_PENDING` 状态的 `match` 记录并触发 `job_match` 任务。
    - 相反，`job_match` 任务是**在 `createServiceAction` 中与 `job_summary` 任务几乎同时入队的** (`/Users/edisonmbli/Projects/CareerShaper/lib/actions/service.actions.ts#L101-105`)。

3.  **`job_match` 任务的执行依赖于 `jobSummaryJson` 的存在：**

    - `job_match` 任务（通过 `handleStream` 或 `handleBatch` 处理）在执行时，会从数据库中获取 `jobSummaryJson`。
    - 在 `/Users/edisonmbli/Projects/CareerShaper/lib/services/business-logic.ts` 中的 `executeJobMatch` 函数调用中，`jobSummaryJson` 是通过 `serviceData.jobSummary` 从数据库中获取的。
      ```typescript
      // lib/services/business-logic.ts
      async executeJobMatch(request: JobMatchRequest, context: ApiContext): Promise<JobMatchResult> {
        const { service_id } = request
        const serviceData = await this.getServiceData(service_id, userKey) // 这里会获取 jobSummary
        const result = await executeJobMatch(
          JSON.stringify(serviceData.resumeSummary),
          JSON.stringify(serviceData.jobSummary), // jobSummaryJson 从这里传入
          userKey,
          service_id,
          { tier: finalTier }
        )
      }
      ```
    - 这意味着，即使 `job_match` 任务被提前入队，它在实际执行时也会等待 `jobSummaryJson` 在数据库中可用。如果 `jobSummaryJson` 尚未准备好（即 OCR 任务尚未完成），`job_match` 任务可能会因为缺少必要数据而失败或等待。

4.  **QStash 任务重试配置：**
    - 在 `/Users/edisonmbli/Projects/CareerShaper/lib/queue/producer.ts` 中，`pushTask` 函数将 QStash 任务的 `retries` 设置为 `0`。
      ```typescript
      // lib/queue/producer.ts
      .enqueueJSON({
        // ...
        retries: 0,
      })
      ```
    - 这意味着 QStash 不会为失败的任务自动重试。如果 `job_match` 任务由于 `jobSummaryJson` 尚未准备好而失败，它不会被 QStash 自动重试。

**总结 `job_match` 任务的生命周期：**

1.  用户上传图片并点击分析后，`createServiceAction` 会**同时**将 `job_summary` (OCR) 和 `job_match` 任务入队到 QStash。
2.  `job_summary` 任务由 worker 处理，负责 OCR 图像并将其结果 (`jobSummaryJson`) 存储到数据库中的 `job` 记录。成功后，它会将 `match` 记录的状态更新为 `MATCH_PENDING`。
3.  `job_match` 任务也由 worker 处理。在执行时，它会尝试从数据库中获取 `jobSummaryJson`。
    - 如果 `job_summary` 任务已经完成并且 `jobSummaryJson` 可用，`job_match` 任务将正常执行。
    - 如果 `job_summary` 任务尚未完成或失败，`job_match` 任务可能会因为缺少 `jobSummaryJson` 而失败。由于 `retries: 0` 的配置，QStash 不会重试此任务。

因此，系统不是通过后台进程轮询 `MATCH_PENDING` 状态来触发 `job_match`，而是通过**在 `job_summary` 任务成功后更新数据库状态，并依赖 `job_match` 任务在执行时从数据库中获取所需数据**。如果 `job_match` 任务在 `job_summary` 任务完成之前执行，它将依赖于其内部的错误处理机制来处理 `jobSummaryJson` 缺失的情况，并且不会被 QStash 自动重试。

## 2. 解决方案

**背景上下文摘要**

- 本轮重点是完善 Workbench 的视觉与交互、将 LLM 结果结构化落库、并增强 Markdown 导出的“可见即所得”专业度与模板选择。
- 已完成的优化包括：侧栏队列类型徽章（付费/免费）、Tabs 进度徽章与提示、Markdown 导出 3 套模板（classic/modern/professional）、SSE 流式显示与批处理入队、以及将匹配/面试/定制化等结果写回 Prisma。
- 当前 M9 流的核心服务是 job_match（岗位匹配度分析），其依赖 job_summary（JD 文本提炼，OCR 可选）与用户的 resume_summary/detailed_resume_summary。你的担忧集中在“并发入队 + 通过重试实现信息咬合”的稳定性风险与运维复杂度。

**现状回顾**

- 入队逻辑（Server Action）：
  - 图片 JD：同时入队 `job_summary`（batch）与 `job_match`（stream），费用一次性扣减并在两个任务上复用同一 `debitId`。`lib/actions/service.actions.ts:90`、`lib/actions/service.actions.ts:138`
  - 文本 JD：仅入队 `job_match`（stream），另无显式 job_summary 步骤。`lib/actions/service.actions.ts:138`
- 路由与模型选型：
  - `job_summary` 走 batch 队列；`job_match` 走 stream 队列，按付费/免费分路由。`lib/llm/task-router.ts:1`、`lib/llm/task-router.ts:91`
- Worker 执行与落库：
  - `job_summary` 成功后更新 `job.jobSummaryJson` 并将 `match.status` 标记为 `MATCH_PENDING`。`lib/worker/handlers.ts:542`
  - `job_match` 流式结束时直接将 `match.matchSummaryJson` 更新并将 `status` 标记为 `COMPLETED`，对 JSON 解析失败仅做 try-catch，不校验 Schema。`lib/worker/handlers.ts:238`、`lib/worker/handlers.ts:242`
- Prompt 输入变量要求（job_match 需要四段结构化上下文）：
  - `rag_context`、`resume_summary_json`、`detailed_resume_summary_json`、`job_summary_json`。`lib/prompts/zh.ts:411-444`
- QStash 入队参数：
  - 生产者设置 `retries: 0`，无自动重试；存在背压与并发守卫，但缺乏“等待前置产物”后的自适应重递机制。`lib/queue/producer.ts:176`、`lib/queue/producer.ts:204`
- 业务读取（BusinessLogicService）：
  - `getServiceData` 要求 `resumeSummaryJson` 与 `jobSummaryJson` 均已存在，但 `getServiceById` 将 `status` 恒定返回为 `'done'`，导致前置检查形同虚设。`lib/services/business-logic.ts:250`、`lib/dal/index.ts:118-129`
- SSE 与前端进度：
  - SSE 路由与前端 hooks 已实现流式 token/done/error 事件。`app/api/sse-stream/route.ts:25`、`lib/hooks/useSseStream.ts:1`
  - 侧栏与 Tabs 显示基础进度文案，但未细化到“OCR 中/提炼中/流式中”的完整串行阶段语义。`components/app/SidebarClient.tsx:106`、`components/app/ServiceDisplay.tsx:1`

**问题分析与合理性评估**

- 并发入队的稳定性问题是真实的：
  - `job_match` 可能在 `job_summary` 尚未完成时执行，Prompt 缺必要变量导致输出不可用或不合 Schema；当前流式路径对 JSON/Schema 没有严格校验，仍落库并标记为 `COMPLETED`。这会制造数据不一致与后续连锁问题。`lib/worker/handlers.ts:238-247`
  - 生产者 `retries: 0` 且 Worker 未使用 `requeueWithDelay` 等延迟重投机制来“等待前置产物成熟”。`lib/queue/producer.ts:204`、`lib/worker/common.ts:72`
- 费用/原子化问题：
  - 目前两个任务复用一个 `debitId`，不符合“两次 LLM 服务必须原子化同时完成，其中一个失败则原子化返还两次费用”的诉求，也不利于审计。`lib/actions/service.actions.ts:90`、`lib/worker/handlers.ts:330`
- 业务检查缺位：
  - `getServiceData` 设计上希望串行完成，但 `getServiceById` 恒定返回 `'done'`，放过了未准备好的上下游数据。`lib/dal/index.ts:118-129`
- 前端 UX 的“在线体感”需要更细颗粒的状态：
  - 目前状态仅有 `PENDING/MATCH_PENDING/COMPLETED/FAILED`，不区分 OCR/提炼/流式阶段，难以承载你的分步串行提示诉求。`components/app/SidebarClient.tsx:106`

你的“串行方案”的六点主张是合理的，尤其是在生产环境强调可控性与可观测性时：

- 明确阶段化：OCR（可选）→ 文本提炼 → 匹配流式，前一步失败立即终止并友好提示。
- 计费原子化：按统一配置扣费，两次任务作为一个原子包；如果任一失败，统一返还两次费用。
- 重试策略：匹配失败可以从历史记录重试，复用已落表的 `job_summary`，避免重复成本。
- 前端进度与提示：通过细颗粒状态与 SSE 事件强化“持续在线”的体感。

**方案对比与差距梳理**

- 后台执行与编排
  - 差距：当前“并发入队 + 结果到达时直接落库”缺少“等待前置产物”的队列编排与严格校验。
  - 调整：
    - 在 Worker `job_match` 开始前增加前置检查：如 `jobSummaryJson` 不存在，主动发布“WAITING_FOR_SUMMARY”事件并使用 `requeueWithDelay` 延时重投，设定最大等待时间与重试上限；超过阈值则失败并返还费用。`lib/worker/common.ts:72`
    - 或者在 `job_summary` 成功后，由 Worker 直接触发入队 `job_match`（仅在成功时），彻底避免并发入队。
- 数据校验与落库
  - 差距：流式任务结束未做结构化校验即标记 `COMPLETED`。
  - 调整：在 `job_match` 的 `finalize` 阶段使用 `validateJson` + Schema 校验；失败则标记 `FAILED`，并原子返还费用。`lib/llm/service.ts:258-262`
- 计费与原子性
  - 差距：两个步骤共享一个 `debitId`。
  - 调整：引入“计费组”（bundleId），对 `job_summary` 与 `job_match` 分别创建独立 `debitId`，组内成功条件是“两者均成功”；任一步失败则整体退款两次。可在 Worker 的最终归档中统一决定成功/退款，并落审计记录。`lib/dal/coinLedger.ts:1`
- 业务读取防线
  - 差距：`getServiceById` 恒定 `'done'`。
  - 调整：根据 `Job.status` 与 `Match.status` 真实状态计算 `service.status`（如 pending/done/error），阻止未准备好数据的业务调用。`prisma/schema.prisma:116`、`lib/dal/index.ts:118-129`
- 前端 UI/UX
  - 差距：状态语义不足。
  - 调整：
    - 引入更细阶段映射：`IDLE → OCR_PENDING → OCR_COMPLETED → SUMMARY_PENDING → SUMMARY_COMPLETED → MATCH_STREAMING → MATCH_COMPLETED/FAILED`，并在 Tabs/侧栏以徽章+文案呈现。
    - SSE 事件扩展，增加 `waiting_for_summary`、`summary_completed`、`match_streaming` 等阶段事件，前端根据事件推进状态条。
    - 提供“重试匹配”按钮：仅触发 `job_match`，复用已存在 `job_summary_json`。

**执行计划**

- 现状评估
  - 核查入队关系与执行时序：确认图片 JD 同时入队两任务的所有路径与边界。`lib/actions/service.actions.ts:90`、`lib/actions/service.actions.ts:138`
  - 审计落库路径：`job_match` 的 JSON 解析与状态标记。`lib/worker/handlers.ts:238-247`
  - 计费流水穿透：单一 `debitId` 在两任务中如何被成功/退款。`lib/worker/handlers.ts:330`
  - 业务读取防线：`getServiceById` 与 `getServiceData` 的串行预期与现实差异。`lib/services/business-logic.ts:250`、`lib/dal/index.ts:118-129`
- 新方案设计
  - 队列编排：
    - 图片 JD：仅入队 `job_summary`；成功后由 Worker 触发入队 `job_match`。避免并发入队。
    - 文本 JD：直接入队 `job_match`，但 Worker 首先检查 `job_summary_json`，不存在则先内部执行“文本提炼”（结构化批任务），成功后再流式匹配。
    - 引入 `requeueWithDelay` 等待机制与最大等待阈值，避免死循环。`lib/worker/common.ts:72`
  - 校验策略：
    - `job_match` 在 `finalize` 强制 `validateJson` + Schema 校验，失败即 `FAILED` 并退款两次。
  - 计费模型：
    - 统一配置化扣费（不 hardcode），新增“计费组（bundleId）”；两个步骤各自 `debitId`，最终根据组内任务结果统一处理成功或整体退款。`lib/dal/coinLedger.ts:1`
  - 业务读取：
    - `getServiceById` 返回真实状态，阻止未准备好数据的上游调用。
  - 前端进度与交互：
    - 扩展 SSE 事件与状态映射；在 Tabs 头部呈现阶段徽章与文案；支持失败重试（复用已落表的 `job_summary`）。
- 代码开发与单元测试
  - 开发重点：
    - Server Action：修改 `createServiceAction` 的入队策略（图片 JD 串行触发；文本 JD 内部串行）。
    - Worker：在 `handleStream` 增加前置产物检查与 `requeueWithDelay`；`finalize` 增加结构化校验与状态/退款原子化处理。`lib/worker/handlers.ts:238-247`、`lib/worker/common.ts:72`
    - DAL：补充 `getServiceById` 的真实状态计算；新增计费组的存储模型与统一结算方法。`lib/dal/index.ts:118-129`、`lib/dal/coinLedger.ts:1`
    - 前端：状态机与 SSE 事件映射、进度徽章与提示、重试入口。
  - 单元测试（vitest）：
    - 路由与入队：确保图片 JD 只入队 `job_summary`；成功后触发 `job_match`。`tests/task-router.test.ts:1`
    - Worker 前置检查：缺少 `job_summary_json` 时触发等待与延迟重投；达到阈值后失败且退款。
    - 校验失败路径：`job_match` 输出不合 Schema 时正确标记 `FAILED` 与两次退款。
    - 业务读取：`getServiceById` 状态计算正确，未准备好数据时抛错。
- 脚本与脚本模拟测试
  - 新脚本：`scripts/debug-job-match-pipeline.ts`
    - 输入：`<service_id>` 或 `<job_text|job_image>`、`[locale]`、`[tier]`
    - 行为：串行调用“文本提炼 → 匹配流式”，打印与保存输出（raw/cleaned/validator、token usage、阶段日志）、校验 JSON/Schema、统计计费与退款、将产物落到 `tmp/llm-debug/`。
    - 参考脚本：`scripts/debug-detailed-resume-summary.ts:25-70` 的模式（变量渲染、validator、输出落盘）。`scripts/debug-detailed-resume-summary.ts:52`、`scripts/debug-detailed-resume-summary.ts:68-71`、`scripts/debug-detailed-resume-summary.ts:150-164`
- E2E 界面自测
  - 场景覆盖：
    - 图片 JD：显示 `OCR_PENDING → SUMMARY_COMPLETED → MATCH_STREAMING → MATCH_COMPLETED/FAILED` 的完整路径与对应提示；失败路径的退款与重试。
    - 文本 JD：跳过 OCR，串行执行提炼+匹配；校验超长文本的拦截与提示。
    - 重试：历史记录中对失败的匹配单独重试，复用既有 `job_summary_json`。
  - 验收指标：
    - 阶段状态与 SSE 事件一致性；JSON/Schema 校验通过率；计费成功（两次）或退款（两次）的正确性；UI 进度与文案符合预期。

**关键代码参考**

- 并发入队：`lib/actions/service.actions.ts:90`（job_summary 入队）、`lib/actions/service.actions.ts:138`（job_match 入队）
- job_match Prompt 变量要求：`lib/prompts/zh.ts:411-444`
- job_match 流式落库未校验：`lib/worker/handlers.ts:238-247`
- job_summary 落库并标记 MATCH_PENDING：`lib/worker/handlers.ts:542`
- 生产者无自动重试：`lib/queue/producer.ts:204`
- 读取防线恒定 done：`lib/dal/index.ts:118-129`
- SSE 事件：`app/api/sse-stream/route.ts:25`
- 脚本范例：`scripts/debug-detailed-resume-summary.ts:52`、`scripts/debug-detailed-resume-summary.ts:68-71`、`scripts/debug-detailed-resume-summary.ts:150-164`

以上是完整的现状评估、问题分析、差距梳理与执行计划。若你认可“串行方案”，我将按上述计划分支实现：先改编排与校验，再完善计费组与前端状态机，最后交付脚本与测试。

## 3.架构升级（失败重试的问题根治）

### 核心诊断

- 前端在页面加载时主动“驱动”状态机，造成假进度。`components/app/ServiceDisplay.tsx:68-87` 初始化时直接将状态置为 `SUMMARY_PENDING`（或 `OCR_PENDING`），即使后端没有真正入队；因此刷新页面就进入“正在提炼岗位要点”。这属于前端状态驱动的反模式，应该改为“后端状态唯一来源（SSOT）”。
- 状态聚合的来源不一致、更新不原子。失败发生时，常见情况是只更新了 `llmUsageLog` 或子表（如 `job.updatedAt`），但没有统一更新 `service/job/match` 的状态与更新时间；而轮询路由又依赖 `service.updatedAt` 或松散的聚合判断，导致 304 未变更，前端永远在等。
- 入队与状态更新缺乏幂等一致性。`ensureEnqueued` 的 `taskId` 复用（如 `match_${serviceId}`）与“失败重试”的语义冲突，重复入队与覆盖不可控；同时“重试动作”的事务中没有统一写入“当前步骤/状态”，也没有统一的会话语义（session），造成前端与后端对“是否已重试”的理解不一致。
- 事件源不统一。当前同时存在轮询 `/api/task-status` 与 SSE 流式；轮询路由的“失败判定”又靠最近 `llmUsageLog` 的启发式，属于“衍生状态”，而非“主状态”。这增加了状态不一致风险。
- 开发稳定性问题（Turbopack ENOENT）：热更时 manifest tmp 文件读写竞态，导致 500 并需手动重启，打断验证链路。

### 证据与代码指向

- 刷新即进入“提炼岗位要点”：`components/app/ServiceDisplay.tsx:68-87` 的 `useEffect` 根据 `isImageFlow` 或“部分状态”主动调用 `startTask`，而不以后端真实状态为准。
- 轮询 304 未变更：日志显示多次 `/api/task-status ... 304`，初始 200 后状态不变；此前 `ETag` 仅依赖 `service.updatedAt`，后续虽已修补为 `max(service.updatedAt, job.updatedAt, match.updatedAt)` 与最近失败日志检查（`app/api/task-status/route.ts:25-53`），但主因仍是“前端自驱进度 + 后端未原子标记失败”。
- 批处理失败路径没有统一标记 job 失败：`lib/worker/handlers.ts:520-606` 附近仅对 `match`/`interview` 标记失败；`job_summary` 失败是否写入 `job.status=FAILED`、`service.currentStep=FAILED` 不一致。
- 重试逻辑非幂等：`lib/actions/service.actions.ts:318-391` 返回 `step`，但并未引入 `sessionId`/幂等键；入队键仍可能与历史相同，导致用户以为“重试成功”，但后端实际没有新任务或状态未刷新。

### 根因总结

- 任务执行的“单一真相”没有统一在后端；前端在“猜测”或“推动”状态机。
- 后端未提供明确的“执行会话”“原子事务”“幂等入队”“统一状态更新”机制，使得失败与重试链路容易散落在多处。
- 状态路由（轮询）基于衍生信息（日志）弥补，而非读自主状态，导致持续兜圈。

### 架构级改造建议（一次性根治

- 后端统一状态机（SSOT）
  - 引入统一的执行状态枚举：`idle | summary_pending | summary_failed | summary_completed | match_pending | match_streaming | match_failed | match_completed`
  - 在数据库层提供一个“执行状态来源”表/字段（建议在 `service` 上新增 `current_step`、`current_status`、`failure_code`、`last_updated_at`），并由后端在“每一个动作”中原子更新它；不要让前端推断。
  - 所有子表状态同步（`job.status`、`match.status`）由后端事务内统一更新，与 `service` 主状态保持一致。
- 执行会话与幂等
  - `retryMatchAction` 创建一次新的 `execution_session_id`（UUID），返回给前端；后端入队时使用 `taskId=match_${serviceId}_${executionSessionId}` 或 `job_${serviceId}_${executionSessionId}` 作为幂等键；从此杜绝“复用旧 taskId 导致队列不触发”的问题。
  - 在同一个会话内，后端将“摘要 → 匹配”的链路完全在服务端编排：摘要成功自动入队匹配；失败写统一 `failure_code` 与退款；前端只订阅事件，不驱动链路。
- 事件统一（SSE 优先，轮询为降级）
  - SSE 作为主事件源，事件载荷直接携带主状态枚举与 `last_updated_at`；轮询仅作为 SSE 失败时的回退，并且返回的状态源自主状态（不是日志启发式）。
  - 前端订阅 SSE 并直接渲染状态；禁止任何“页面加载主动 startTask”的逻辑。`useEffect` 初始化仅做订阅，不做状态变更。
- 统一的失败码与错误记录
  - 在 `llmUsageLog` 增加 `errorCode`（enum），由后端在所有失败路径填充；`errorMessage` 仅作补充。
  - `app/api/task-status` 返回主状态与 `failure_code`；前端展示映射，不再猜测。
- 事务一致性保障
  - 入队（摘要/匹配）与账务（扣费/退款）与状态更新在一个事务中提交，或通过“事务半编排 + outbox 事件”确保一致（先写 DB 后异步发队列并标记 outbox processed）。
- 开发稳定性
  - 开发统一使用 `pnpm dev:webpack`，保留 `dev:clean`。生产仍可用 Turbopack。
  - 在 dev 的 `/api/task-status` 返回 `debug` 字段（最近执行会话、最近错误码），便于快速定位。

### 实施方案（分阶段）

- 阶段 A：停止前端自驱
  - 删除 `components/app/ServiceDisplay.tsx:68-87` 初始化的 `startTask` 自动置位逻辑。
  - 前端只根据 SSE/轮询返回的主状态渲染进度；点击“重试匹配”才调用 Server Action。
- 阶段 B：后端统一状态机与事务
  - 在 `service` 增加 `current_step`、`current_status`、`failure_code`、`last_updated_at`（或新表 `ServiceExecution`）。
  - `retryMatchAction`、`worker/handlers.ts` 的入队/扣费/状态更新走事务；失败路径统一写 `failure_code` 与退款。
- 阶段 C：执行会话与幂等
  - `retryMatchAction` 返回 `execution_session_id`；队列 `taskId` 拼接会话 ID；SSE 事件也携带会话 ID，前端在相同会话内做幂等（按钮防抖）。
- 阶段 D：事件统一与路由简化
  - `/api/task-status` 返回主状态与 `last_updated_at` 与 `failure_code`；不再读日志推断。
  - `useSseStream` 作为主路径，轮询只在 SSE 不可用时启用。
- 阶段 E：观测与测试
  - 增加集成测试：失败后重试两次，分别在“摘要缺失”和“摘要已存在”场景；验证状态机、队列幂等、退款与文案映射。
  - 在 dev 提供 `debug` 字段（最近会话、失败码），缩短定位时间。

**我们为什么现在还在原地打圈？**

- 主要因为“前端驱动状态 + 后端多源状态 + 非幂等入队”三个不匹配的点相互牵扯：任何一个局部修补（例如轮询路由加日志判断）都能暂时缓解某一个症状，但另外两个点会在下一次刷新或重试时把系统拉回原位。
- 根治的关键是把“状态的权威来源”、“状态变更的时机”、“入队的幂等性”收敛到后端单一机制，前端彻底去驱动。

### 可以期待的变更效果

- 刷新页面只会“显示当前状态”，不会“自启动任务”。
- 点击“重试匹配”，后端要么“重跑摘要”，要么“直接匹配”，两者都在一个会话与事务里完成编排；前端只订阅事件。
- 失败立即呈现细化文案（来自统一 `failure_code`），不再出现“卡住等待”。
- 账务与状态统一一致，退款只在最终失败时触发。

如果你认可上述架构调整与分阶段实施，我将先落地“阶段 A + 部分 B/C 的基础骨架”（后端 SSOT 字段与执行会话、删除前端自驱逻辑、统一失败码枚举与路由返回格式），随后再完成队列幂等与事务统一。这样两到三次迭代即可彻底把“重试假进度”和“失败不识别”问题处理干净。

### 3.1 推进记录

**已完成的骨架改造**

- 移除前端自驱状态，改为以服务端的单一真相字段驱动

  - 在 `components/app/ServiceDisplay.tsx:60-71` 移除基于 `job/match` 派生初始状态的逻辑，改为读取 `initialService.currentStatus` 并同步到本地状态；同时当状态为失败时写入失败键以驱动失败文案。
  - 现在 UI 状态只受服务端的 `Service.currentStatus` 控制，前端不再“猜测流程”。

- 引入执行会话并在重试时写 Service.currentStatus

  - 在 `lib/actions/service.actions.ts:8-17` 引入 `updateServiceExecutionStatus`。
  - 在 `lib/actions/service.actions.ts:313-392` 的 `retryMatchAction`：
    - 为每次重试生成 `executionSessionId`，并随任务变量传入。
    - 文本提炼重试时写 `Service.currentStatus = SUMMARY_PENDING`，流式匹配重试时写 `MATCH_PENDING`。
    - 重试成功后不再在前端手动切状态，而是触发 `router.refresh()` 让 UI 按服务端状态刷新。

- 统一状态轮询路由，返回简化态

  - 在 `app/api/task-status/route.ts:77-140` 将 `service_match` 的聚合逻辑替换为基于 `Service.currentStatus` 的简化返回：
    - `SUMMARY_PENDING -> PENDING`
    - `SUMMARY_FAILED -> FAILED`
    - 其他（含 `SUMMARY_COMPLETED / MATCH_*`）-> `COMPLETED`
  - 配合 `useTaskPolling`，当简化态为 `COMPLETED` 时，前端切到 `MATCH_PENDING` 进入流式阶段；当为 `FAILED` 时触发失败并刷新余额。

- Worker 写入 Service.currentStatus 与失败码

  - 在流式开始时写入 `MATCH_STREAMING`：`lib/worker/handlers.ts:118-126, 132-140` 和 `lib/worker/handlers.ts:145-152` 附近（发布 `match_streaming` 状态后更新 `Service.currentStatus`）。
  - 批任务（`job_summary`）写结果时：
    - `lib/worker/handlers.ts:801-872` 写回 `JobSummaryJson` 后根据执行结果写 `SUMMARY_COMPLETED` 或 `SUMMARY_FAILED`，并对常见错误映射 `failureCode`（如 `PREVIOUS_MODEL_LIMIT / PROVIDER_NOT_CONFIGURED / ZOD_VALIDATION_FAILED / JSON_PARSE_FAILED`）。
  - 流式匹配（`job_match`）写结果时：
    - `lib/worker/handlers.ts:981-1011` 若解析成功写 `MATCH_COMPLETED`，否则写 `MATCH_FAILED` 且 `failureCode = JSON_PARSE_FAILED`。
  - 流式匹配异常时：
    - 在 `lib/worker/handlers.ts:380-398` 的异常分支里，除 `Match.status = FAILED` 外同时写 `Service.currentStatus = MATCH_FAILED` 并根据错误码映射 `failureCode`。
  - 批任务异常（`job_summary` 早期调用失败）：
    - 在 `lib/worker/handlers.ts:686-715` 的异常分支里，额外写 `Service.currentStatus = SUMMARY_FAILED` 并映射 `failureCode`。

- 会话化的 TaskId 与 SSE
  - Service 流式观察的 `taskId` 现在会优先带上会话后缀：`components/app/ServiceDisplay.tsx:58-63`，即 `match_${serviceId}_${executionSessionId}`；没有会话 ID 时退回 `match_${serviceId}`。
  - 批任务串流触发（首次创建）行为仍沿用 `match_${serviceId}`，保证历史任务可用；重试则使用带会话后缀的 `taskId`，避免与历史流混淆。
  - SSE 客户端监听使用 `useSseStream` 不变，服务端 `app/api/sse-stream/route.ts:38-40` 按 `userId/serviceId/taskId` 定位通道。

**与 UI 的衔接**

- 轮询时机调整
  - `ServiceDisplay.tsx:73-84` 将 `shouldPollMatch` 收敛为仅在 `SUMMARY_PENDING` 期间轮询；成功后 `onSuccess` 切 `MATCH_PENDING`，失败时 `onError` 设置失败键并触发 `router.refresh()`（可刷新金币余额）。
- 流式阶段开启
  - `ServiceDisplay.tsx:86-93` 当状态为 `MATCH_PENDING/MATCH_STREAMING` 开启 SSE，并在 `useSseStream.ts:24-38` 持续更新流式状态。
- 重试按钮
  - `ServiceDisplay.tsx:423-445` 点击后使用服务端的 `retryMatchAction`，成功则刷新页面而不是前端自切状态；失败则落具体失败键。

**类型与构建**

- 扩充任务变量类型以支持会话 ID
  - 在 `lib/prompts/types.ts:60-69` 与 `lib/prompts/types.ts:71-81` 为 `JobSummaryVars` 与 `JobMatchVars` 增加可选字段 `executionSessionId`。
- 通过 `npm run lint` 与 `npm run build` 验证，编译通过。

**如何验证**

- 触发“文本 JD 提炼失败”（如将 `lib/llm/config.ts:7` 的 `detailed_resume_summary` 或相关模板 `maxTokens` 调大至超限进行压力测试）：
  - 创建服务后，主卡片进入“正在提炼”并轮询。
  - 后端失败时写 `Service.currentStatus = SUMMARY_FAILED` 且 `failureCode`，前端停止轮询并展示失败文案，同时刷新左下角金币为退款后的值。
  - 侧边栏条目状态不再“排队中”，而是“失败”（来源于 `currentStatus`）。
- 点击“重试匹配”：
  - 生成新的 `executionSessionId` 并入队；`Service.currentStatus` 先写 `SUMMARY_PENDING` 或直接进入 `MATCH_PENDING`。
  - SSE 监听的 `taskId` 带上会话后缀，流式输出不与历史流混淆。
  - 成功解析后写 `MATCH_COMPLETED`；若解析失败写 `MATCH_FAILED` 并含 `failureCode = JSON_PARSE_FAILED`。

**关键代码参考**

- 初始化状态改为服务端单一真相：`components/app/ServiceDisplay.tsx:60-71`
- 仅在提炼阶段轮询：`components/app/ServiceDisplay.tsx:73-84`
- SSE 会话化 `taskId`：`components/app/ServiceDisplay.tsx:58-63`
- 重试按钮改为服务端驱动：`components/app/ServiceDisplay.tsx:423-445`
- 统一简化状态路由：`app/api/task-status/route.ts:77-140`
- 重试行为与会话 ID、状态写入：`lib/actions/service.actions.ts:313-392`
- Worker 批任务写状态与失败码：`lib/worker/handlers.ts:801-872`
- Worker 流式开始与成功/失败状态写入：`lib/worker/handlers.ts:118-126, 982-1011, 380-398`
- 任务变量类型扩展：`lib/prompts/types.ts:60-69, 71-81`
