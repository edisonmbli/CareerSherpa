## 目标

* 完成 /design-system 两处增强：Primary 交互演示与“仅文本型 PDF”说明；统一 Toast 使用。

* 输出 Profile DOR 文档并启动 M8 的 UI+交互落地：资产上传五态与轮询（复用现有 Actions 与文件解析能力）。

## 将进行的代码变更

1. 设计系统增强

* 新增 `components/dev/PrimaryDemo.tsx`：展示主按钮 Default/Hover/Focus/Disabled 四态（含图标/纯文本），用于对比度与焦点可视验证。

* 更新 `app/[locale]/(dev)/design-system/page.tsx`：

  * 添加“Primary 交互演示”区块（字典驱动文案）。

  * 添加“仅文本型 PDF”说明区块（Muted 文案或 `Alert info`）。

* 更新 `components/dev/FeedbackDemo.tsx`：改为调用 `toast.info/success/warning/error`，展示非阻塞反馈，不再叠加 Alert 浮层。

* 更新字典 `lib/i18n/en.ts` 与 `lib/i18n/zh.ts`：新增 Primary 演示与 PDF 说明相关文案。

1. Profile DOR 文档

* 新增 `docs/14.Profile_DOR.md`：

  * 结构：Tabs（Assets | Billing），两张资产 Card 的空状态与状态映射（PENDING/COMPLETED/FAILED）。

  * 五态：Idle/Queued/Processing/Success/Failed 的组件与文案映射；禁用态策略。

  * Toaster 触发点：免费队列、排队态、失败返还、完成提示。

  * 文案/i18n/可访问性/移动端适配清单与门禁；DoD 验收步骤对齐 3.Execution\_Plan M8。

1. M8 UI+交互落地（首轮）

* 新增 `components/app/AssetUploader.tsx`（客户端）：

  * 五态渲染、提交后进入轮询（调用 `GET /api/task-status`）。

  * Toaster 提示：`isFree`、背压 QueueFull、完成与失败。

  * 仅文本型 PDF：前端提示，不阻塞；由服务端解析判别（文本不足返回错误）。

* 新增 `lib/hooks/useTaskPolling.ts`：封装轮询；成功/失败回调刷新 Server Component。

* 新增 `app/[locale]/profile/page.tsx`（服务端）：

  * 加载用户资产与余额；渲染 Tabs + 两张资产 Card；嵌入 `AssetUploader`。

* Server Actions 使用策略：

  * 优先复用现有 `lib/actions/resume.actions.ts`（维持接口稳定）。

  * 若需要 FormData 解析：增设 `lib/actions/asset.actions.ts`（仅资产流），内部调用文件解析并最终委派至现有 `resume.actions` 路径，避免重复逻辑。

## 验收与门禁

* Gate 0：/design-system 新区块验收（四态 + Toast），PDF 说明呈现合理。

* Gate 1：Profile DOR 完成并评审通过。

* 首轮 UI：上传→Toast + Polling→Badge；严禁硬编码文案；移动端 Tabs 体验达标。

## 之后节奏

* 第二轮：完善 `task-status` API 与 Worker 写回细节；E2E 自测；DoD 验收。

