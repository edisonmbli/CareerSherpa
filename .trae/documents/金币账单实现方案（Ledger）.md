**目标**

* 建立“金币账单（Ledger）”全链路：原子扣减/返还时即时落表、支持注册赠送、未来充值扩展、Profile 页账单可分页查看。

**现状与挂点**

* 金币账户模型已存在：`prisma/schema.prisma:34` 的 `Quota`。

* 统一原子操作：`lib/dal/quotas.ts:14` `getOrCreateQuota`、`lib/dal/quotas.ts:42` `deductQuota`、`lib/dal/quotas.ts:77` `addQuota`。

* 扣减入口：资产上传 `lib/actions/resume.actions.ts:15-18`；服务创建与进阶 `lib/actions/service.actions.ts:21-24, 70-73, 119-122`。

* 返还入口：入队失败 `lib/queue/producer.ts:99-105, 218-226`；Worker 失败 `lib/worker/handlers.ts:326-333, 639-645`。

* 账单 UI 占位：`app/[locale]/profile/page.tsx` 的“金币与账单”Tab，尚未加载数据表。

**数据模型**

* 新增 `CoinTransaction`（`coin_transactions`）：

  * 字段：`id`、`userId`、`type`、`status`、`delta`（变动值，正加负减）、`balanceAfter`、`serviceId?`、`taskId?`、`templateId?`、`messageId?`、`idemKey?`、`metadata?`（JSON）、`createdAt`、`relatedId?`（关联原始扣减条目）。

  * 关系：`userId -> neon_auth.users_sync.id`、`serviceId -> public.services.id`（可空）。

  * 枚举：`type ∈ { SIGNUP_BONUS, PURCHASE, SERVICE_DEBIT, FAILURE_REFUND, MANUAL_ADJUST }`；`status ∈ { PENDING, SUCCESS, FAILED, REFUNDED }`。

  * 索引：`(userId, createdAt DESC)`、`(taskId, createdAt DESC)`、`(idemKey UNIQUE)`。

  * 设计要点：

    * 扣减时写一条 `SERVICE_DEBIT`（`status=PENDING`），后续任务成功则将其更新为 `SUCCESS`；失败则追加一条 `FAILURE_REFUND`（`delta=+cost`, `status=SUCCESS`, `relatedId=原扣减 id`）。

    * 注册赠送在账户首次创建时写一条 `SIGNUP_BONUS`（`delta=+N`, `status=SUCCESS`）。

    * 充值未来扩展：先写 `PURCHASE`（`status=PENDING`），Webhook 成功后将其更新为 `SUCCESS` 并增额。

**DAL 设计**

* 新增 `lib/dal/coinLedger.ts`：

  * `recordDebit({ userId, amount, serviceId?, taskId?, templateId?, messageId?, idemKey?, metadata? })`：在事务内执行（1）`Quota` 条件扣减（`balance>=amount`）与（2）插入 `CoinTransaction`（`type=SERVICE_DEBIT`, `status=PENDING`, `delta=-amount`, `balanceAfter=新余额`）。

  * `markDebitSuccess(debitId)`：更新 `status=SUCCESS`。

  * `recordRefund({ userId, relatedId, amount, serviceId?, taskId?, templateId?, messageId?, metadata? })`：事务内执行（1）返还 `Quota` 与（2）插入 `CoinTransaction`（`type=FAILURE_REFUND`, `status=SUCCESS`, `delta=+amount`, `balanceAfter=新余额`, `relatedId`）。

  * `recordSignupBonus({ userId, amount })`：用于账户首次创建；事务内增额并插入 `SIGNUP_BONUS`。

  * `listLedgerByUser(userId, { page, pageSize })`：时间倒序分页查询，返回展示所需字段。

  * 注意：所有函数接受可选 `tx`，以便被上层复用进已有事务。

**原子化改造（不改变现有业务语义）**

* 将现有 `deductQuota`/`addQuota` 的调用点改为 Ledger 包装：

  * 资产与服务扣减：在 Server Action 处改为调用 `recordDebit(...)`（维持原有 `hasQuota` 判定）并将返回的 `debitId` 透传到队列变量 `taskId` 或 `metadata`，方便 Worker 成功时 `markDebitSuccess(debitId)`。

  * 入队失败/Worker 失败：在既有返还处调用 `recordRefund({ relatedId: debitId, ... })` 替代直接 `addQuota`，确保账单有条目。

  * 注册赠送：在 `getOrCreateQuota` 首次创建时调用 `recordSignupBonus`（或在 `getOrCreateQuota` 检测新建后触发）。

  * 兼容：保留 `deductQuota`/`addQuota` 供极少数无需记账的内部工具使用（目前业务均需记账）。

**Profile 账单展示**

* 在 `app/[locale]/profile/page.tsx` 的 Billing Tab：

  * 服务端获取：新增 `getCoinLedgerAction(userId, { page, pageSize })` 或直接在 RSC 中调用 DAL。

  * 表格列（时间倒序）：

    * `类型`：枚举映射（注册赠送/充值/服务扣减/失败返还/手动调整）。

    * `服务名称`：由 `templateId` 映射（如“匹配度分析”“面试 Tips”“简历解析”）；若存在 `serviceId` 可跳转到 Workbench。

    * `任务 id`：`taskId` 或 `messageId`（QStash）；点击复制。

    * `状态`：`PENDING/SUCCESS/FAILED/REFUNDED`。

    * `quota 数量变化`：`delta`（带正负号），可在行尾显示 `balanceAfter` 作为当前余额快照。

    * `发生时间`：`createdAt`。

  * 交互：分页（每页 20）、空态、加载骨架；保留国际化文案来自字典。

**一致性与幂等**

* 幂等键：所有扣减入口生成 `idemKey`（复用现有 `checkIdempotency` 的 `step` 与请求体哈希），Ledger 上设 `UNIQUE(idemKey)` 防止重复扣减落表；重复请求返回已有 `debitId`。

* 余额约束：扣减 SQL 保持 `updateMany where balance>=amount`，避免负数；Ledger 的 `balanceAfter` 用于审计与 UI 展示。

**迁移与实现步骤**

1. Prisma：在 `schema.prisma` 添加 `CoinTransaction` 模型与枚举、索引；生成迁移并应用（开发库）。
2. DAL：新增 `lib/dal/coinLedger.ts` 并实现上述函数；在 `lib/dal/quotas.ts` 暴露“首次创建”钩子或由调用方处理注册赠送。
3. Server Actions：

   * `resume.actions.ts`/`service.actions.ts` 用 `recordDebit` 替代直接 `deductQuota`；将返回的 `debitId` 放入 `variables`。

   * 入队失败与 Worker 失败（参见 `lib/queue/producer.ts:99-105, 218-226`、`lib/worker/handlers.ts:326-333, 639-645`）：改用 `recordRefund` 并传入 `relatedId`。

   * Worker 成功路径（`job_match`/`interview_prep`/资产解析成功）：调用 `markDebitSuccess(debitId)`。
4. Profile 页：在 Billing Tab 加载 `listLedgerByUser` 的分页结果渲染表格。
5. Analytics：保持现有事件，不与账单重复；必要时在 Ledger 写入时也 `logAudit` 一条用于安全追踪。

**测试与验收**

* 单元测试：

  * `recordDebit` 在余额足够/不足的分支；`recordRefund` 正确返还与 `balanceAfter` 校验；`markDebitSuccess` 状态更新。

  * 幂等：同一 `idemKey` 不产生重复扣减条目。

* E2E：

  * 运行一次资产上传与一次服务创建，观察账单出现两条 `SERVICE_DEBIT` 与一条 `FAILURE_REFUND`（模拟一次失败）。

  * Profile 账单表按时间倒序正确显示所需字段。

**DoD**

* 发生“注册赠送、服务扣减、失败返还”时，账单均能即时落表并在 Profile 账单页展示；余额与 `balanceAfter` 一致；分页与国际化正常。

