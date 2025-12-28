## 背景与原则（对齐更新）
- Step 1 `job_match` 为必经服务；Step 2 `customize` 与 Step 3 `interview` 为可选、可后续推进的服务（用户可能离开后回到历史继续跑）。
- UI 需既支持“一气呵成”（Step1→Step2→Step3）、也支持“离开后回来续跑”的操作心智，并做到简洁、直觉。
- 严格遵循“资产/服务分离”（docs/1.Project_Spec.md:46-50）、M9/M10 异步握手与计费规则（docs/1.Project_Spec.md:177-318、docs/2.Solution_Spec.md:428-520）。

## 交互设计（核心）
### 1. Workbench 布局与模式切换
- 左侧 Sidebar：
  - 顶部 `+ 新建服务`；中部历史服务（按时间倒序）；底部金币 Badge 与 `/profile` 入口、`i18n`/主题切换。
- 右侧 Main：两种模式
  - 新建模式：表单（JD 文本/图片）+ 前置 `Alert`（未上传简历禁用按钮）。
  - 历史模式：加载某 `serviceId` 的三步 Tabs（`Match|Customize|Interview`）。

### 2. Tabs（三步）的一致操作心智
- 顶部显示“步骤进度条”（或状态 Badge）：Step1（完成/进行中/失败）、Step2（未开始/进行中/完成）、Step3（未开始/进行中/完成）。
- 每个 Tab 内：
  - 清晰的主 CTA：
    - Tab1：完成后显式“下一步：帮我改简历”。
    - Tab2：未开始时“生成定制化简历”；完成后“保存修改”“导出 PDF”。
    - Tab3：未开始且 Step2 已完成时“生成面试 Tips”。
  - 次要 CTA：
    - Tab1 完成后提供“稍后再来”的提示与返回历史列表的操作（弱提示）。
- 回到历史：点击历史服务项加载服务详情页，Tabs 自动落地到用户上次停留的 Step（例如 Step1 完成则默认进入 Tab2 并提供“生成定制化简历”）。

### 3. 五态交互与异步焦虑管理
- Idle：正常按钮与输入。
- Queued：按钮禁用、Toaster（队列/免费降级），Sidebar 项显示“排队中”。
- Processing：
  - 流式（Tab1/Tab3）：Card 内实时渲染 markdown token；自动滚至内容区；限定 `max-h-[60vh]` 并 `overflow-y-scroll`。
  - 轮询（Tab2 与图片路径的 Tab1 预阶段）：Card 内 `Progress` 与提示文案（`OCR_PENDING`→`SUMMARY_PENDING`→`MATCH_PENDING`），在 `MATCH_PENDING` 切换到 SSE。
- Success：完成提示 Toaster 与下一步 CTA 高亮。
- Failed：Alert（destructive）与重试按钮；自动返还金币提示。

### 4. “一气呵成”与“离开续跑”融合
- 一气呵成：在 Tab1 完成后，显式呈现“下一步”主 CTA；点击直接触发 Step2，并在完成后提供 Step3 主 CTA。
- 离开续跑：历史页加载后：
  - 若 Step1 完成且 Step2 未开始：默认激活 Tab2，呈现主 CTA；
  - 若 Step2 完成且 Step3 未开始：默认激活 Tab3，呈现主 CTA；
  - 若任一步进行中：保持进行中态并提示当前进度，支持轮询/流式继续展示。

## 实施计划（与上一版衔接）
### 阶段 1：Workbench 两列布局
- 新建 `app/[locale]/workbench/layout.tsx`（Server）：两列骨架；
- 新建 `SidebarClient`（Client）与 `HistoryList`（Server）。

### 阶段 2：新建服务页（Step1 入口）
- 在 `app/[locale]/workbench/page.tsx` 使用 `NewServiceForm`（Client）。
- 前置检查简历；文本直连 SSE；图片走轮询→SSE。

### 阶段 3：历史服务详情页
- 新建 `app/[locale]/workbench/[serviceId]/page.tsx`（Server）加载完整服务。
- 新建 `components/app/ServiceDisplay.tsx`（Client）实现三步 Tabs 与主/次 CTA。

### 阶段 4：状态管理与 Hooks
- 新建 `lib/stores/workbench.store.ts`（Zustand）统一“七态”；
- 新建 `lib/hooks/useSseStream.ts`；复用 `useTaskPolling`。

### 阶段 5：Actions/Workers 对齐
- `createServiceAction`：文本链（`job_summary`→`job_match`）、图片链（`ocr`→`job_summary`→`job_match`）。
- `batch/[service]`：case `ocr`/`job_summary`/`resume_customize` 更新状态与落表；
- `stream/[service]`：case `job_match`/`interview_prep` 流式发布 token、结束落表。

### 阶段 6：Markdown 编辑器与导出 PDF
- 新建 `MarkdownEditor` 与 `ExportPDFButton`（`html2canvas + jspdf`）。

### 阶段 7：Profile Billing 增量
- 新建 `billing.ts`、`payment.actions.ts` 与 `BillingTab`，从 Workbench 侧可快速进入 Profile。

### 阶段 8：UI/UX 落地
- `AppCard` 容器、`p-6`/`gap-6/8`、`text-muted-foreground`；Toaster/Progress/流式区域滚动优化。

### 阶段 9：Analytics 注入
- 在 Actions 与 Workers 的创建/完成/失败均注入埋点。

### 阶段 10：测试与验收
- 文本路径：SSE 首 token ≤ 8s；图片路径：轮询→SSE；
- Customize：轮询完成后加载编辑器、保存与导出；
- Interview：流式完成落表；
- 历史续跑：默认激活到合适的 Tab 与主 CTA。

## 验收要点（对应你的关注）
- Tab1 完成后显式主 CTA 引导下一步；同时弱化“稍后再来”路径。
- 历史列表点击加载后，自动激活未完成的下一步 Tab 并展示主 CTA；
- 轮询→流式过渡的提示文案清晰，移动端滚动体验佳；
- 所有文案均来自 i18n 字典，UI 风格统一、专业。

请确认本版交互与实施计划；确认后我将按阶段推进，并在关键节点（握手切换、历史续跑默认 Tab 激活、编辑器导出）进行演示与自验证。