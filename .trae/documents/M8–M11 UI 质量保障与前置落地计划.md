## 计划目标

* 将「2.5 页面设计」「2.6 设计系统」「2.7 交互与状态」规范转化为可执行的验收条款与质量门禁，确保 M8–M11 的页面既美观专业、又交互清晰无歧义。

## 关键交付物（启动前必须到位）

1. 设计系统核验页完善：`/design-system` 展示并核验 H1/H2/Body、Buttons（主按钮数量限制）、Cards（p-6、阴影）、Alerts/Toaster、Badge、色板与暗黑主题切换。
2. UI 质量门禁清单（PR 模板）：Spacing、Color、Typography、Components 使用约束、五态覆盖、移动端适配、i18n、SEO、可访问性、视觉回归等。
3. 文案与字典清单：确保 Landing/Profile/Workbench 的所有文案在 `getDictionary(locale)` 中有项，含空状态与 Toaster/Alert 文案。
4. 页面蓝图与 DOR：Landing、Profile、Workbench 三页的线框蓝图与 Definition of Ready（结构、组件、状态、文案、i18n、SEO）。

## 质量门禁（可操作的验收条款）

* Spacing：卡片内部 `p-6`；卡片之间 `gap-6/8`；元素组 `gap-2/4`；优先用间距而非边框。

* Color：仅用 `primary: blue` 于核心操作；描述性文字用 `text-muted-foreground`；禁用纯黑/纯灰；背景分层 `bg-background` vs `bg-card`。

* Typography：标题 `text-2xl lg:text-3xl` + `font-semibold` + `tracking-tight`，正文 `text-base` + `leading-relaxed`；描述 `text-sm` + `text-muted-foreground`。

* Components：Card 作为核心容器；主按钮每视图最多 1–2 个；阻塞提示用 Alert，非阻塞用 Toaster；状态用 Badge（outline）。

* 五态覆盖：Idle / Queued / Processing / Success / Failed 均需在 UI 上有清晰表现（含 Sidebar Badge、进度、流式渲染、错误 Alert 与返金币文案）。

* 移动端适配：Workbench 隐藏 Sidebar，用 Drawer；编辑器改 Tabs；流式区 `max-h-[60vh]` + `overflow-y-scroll`，自动滚动至 CardContent。

* i18n 完整性：页面元数据、所有按钮/标签/提示均来自字典；切换 locale 刷新路由并加载对应字典。

* SEO 合规：Landing 使用 `generateMetadata`（从字典取 title/description）+ `metadataBase` + `alternates hreflang`；注入 `SoftwareApplication` 或 `Service` JSON-LD。

* 可访问性：对比度 AA；焦点环可见；键盘可操作；减少动效遵从 `prefers-reduced-motion`；图片/图标有语义。

* 视觉回归：关键视图（Landing/Profile/Workbench）建立基线截图并做回归比对（桌面与移动断点）。

## 页面蓝图与 DOR（每页的“准备就绪”条件）

* Landing

  * 结构：Hero + Value Props（三 Card）+ How It Works

  * 主按钮“免费试用（赠 8 金币）”为唯一主行动；SEO `generateMetadata` + JSON-LD；i18n 文案就绪

* Profile

  * Tabs：资产、金币与账单；两张资产 Card 的空状态（图标、标题、描述）与状态 Badge（PENDING/COMPLETED）；轮询提示与 Toaster 文案

* Workbench

  * 两列布局（桌面）；空状态引导 Card；“新建服务”表单（文本与图片入口）与前置检查 Alert；流式 Card 区域与队列/背压反馈

## 文案与字典前置

* 建立“文案地图”：按钮、标签、描述、空状态、Toaster/Alert（含失败返还）逐项列入字典。

* 文案风格：工具型、专业、简练；动词先行；避免歧义；中英双语一致语气。

## 异步交互落地细则

* Polling：Profile 上传后不阻塞；Sidebar/Badge 体现状态；进度文案明确时长预期。

* Streaming：开始即自动滚动；CardContent 可滚动；期间禁用下一步按钮；失败弹 destructive Alert 并提示返金币。

* 队列映射：Toaster 明确“免费队列/付费队列”路由与等待心智。

## 可访问性与性能

* 骨架/占位：加载前使用 Skeleton 或占位文案，降低跳跃感。

* 资源与首屏：Hero 图与图标按需加载；卡片内容懒加载；避免过度阴影与边框导致重绘。

## 评审与节奏（Design Review Gates）

* Gate 0（M3 完成后）：`/design-system` 规范核验通过。

* Gate 1（每页 DOR）：线框 + 文案 + 状态映射 + i18n/SEO 方案就绪。

* Gate 2（Dev 完成）：五态与移动端适配自测通过；视觉回归与 a11y 检测通过。

* Gate 3（合并前）：产品/设计联合走查，用门禁清单逐项打勾。

## 标杆拆解（可复用模式）

* ChatGPT/Claude：左侧历史 + 中间会话的密度与层级、流式滚动体验。

* Vercel Dashboard：shadcn/ui 风格的一致性、两列布局与信息层级。

* Linear/Notion：极简排版、灰度层级与分隔用法（空间 > 背景 > 阴影 > 边框）。

* Stripe Dashboard：表单与反馈的清晰度、状态标签与错误呈现。

## 实施时间线（建议）

* 第 1 天：完善 `/design-system` 与质量门禁清单；梳理文案地图。

* 第 2–3 天：输出三页 DOR 蓝图（桌面/移动）；确定 SEO/i18n 策略与 JSON-LD 模板。

* 第 4 天：首次 Gate 1 评审；进入 M8 开发。

## 成功标准（Definition of Done for UI）

* `/design-system` 完美复现规范；

* 三页均通过门禁清单；

* PR 走查无硬编码文案、主按钮限制符合规范；

* 流式/轮询的五态展示与移动端体验达标；

* i18n/SEO/a11y/视觉回归检测全部通过。

