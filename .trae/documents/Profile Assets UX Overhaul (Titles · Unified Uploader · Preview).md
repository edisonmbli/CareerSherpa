总体思路

- 聚焦三处体验：卡片标题与视觉语义、一盒到底的上传器、预览区的内容与观感。
- 采用社区成熟范式：shadcn/ui 的 Sheet/Card 组合、Linear 的细腻动效与渐变、Notion 的内容层级、Vercel Dashboard 的暗色层次。
- 在保持简洁的前提下，以微动效、渐变点缀、分节秩序和弱化负面提示，传递积极的“可控与希望感”。
  卡片标题

- 图标增强：通用简历用 FileText ，详细履历用 NotebookText 。插入位置： app/[locale]/profile/page.tsx 的 AppCardTitle 。
- 视觉语义替代文字：右侧小徽标表达“必选/推荐”。
  - 必选：红色小星或红点徽标，配合副标题强化“所有服务依赖此文件”。
  - 推荐：浅色 Sparkles 徽标，副标题强调“强烈建议，可显著提升质量”。
- 具体传递：在 AppCardTitle 内组合图标 + 文本，在标题右侧插入 Badge 。文案源自字典 lib/i18n/zh.ts 与 lib/i18n/en.ts 。
  一盒到底的上传器

- 单组件管理三态：空白 → 上传/解析中 → 已完成。位置与文件： components/app/AssetUploader.tsx 。
- 空白态
  - 合并提示为一个信息块：仅支持文本型 PDF + 长度建议（6000/8000 字），统一显示在上传框上方。
  - 文案走 i18n；英文/中文切换受 locale 控制（保持与 dict.profile 一致）。
- 上传/解析中
  - 进度条与状态行集中显示，保留全局 toast。按钮禁用，避免误操作。
- 已完成
  - 文件名为主视觉，右侧提供“预览”与“重新上传”。
  - 重新上传行为：重置到空白态，清空文件名与 summaryJson ，允许再次选择文件。
- 兼容已存在的 dict 与 labels={dict.profile.previewLabels} ，所有文案通过字典。
  预览渲染与观感

- 结构顺序
  - 个人信息 → 教育经历 → 摘要要点 → 专业特长 → 工作经历 → 项目经验 → 技能 → 语言 → 其它
- 视觉强化
  - 分节标题：标题下 2px 渐变线（ from-primary → to-blue-400 ），节间距 space-y-4 ，正文行距 leading-6 。
  - 列表标记：用主色浅层替换默认圆点，提升活力而不喧宾夺主。
  - 暗色层次：在 Sheet 内容区内再包一层 rounded-lg border bg-card shadow-xl ，与背景形成清晰前景层。
  - 微动效：Sheet 打开沿用右侧滑入；分节采用轻微 opacity/translate 级联过渡（最多 5 节，间隔约 60ms）。
  - 链接呈现：Header 的 links 渲染为小 Chip（icon+label）， hover:bg-muted 。
- 交互增强
  - 锚点导航（可选）：顶部显示分节导航 Chip，点击平滑滚动到对应节；移动端转为 Dropdown。
  - 空状态占位：首次打开预览或刚拉取最新 JSON 时显示 3-4 行 Skeleton 与轻微 shimmer。
- 可访问性

  - 聚焦可见（标题可 focus-ring）、键盘导航锚点、暗色模式对比度达到 AA。
    数据刷新与“空白预览”问题

- 原因： AssetUploader 使用 initialSummaryJson ，轮询成功后未刷新数据。
- 方案：在 useTaskPolling.onSuccess 内请求只读 Server Action 获取最新 JSON，写入 summaryJson 本地状态，预览使用该状态渲染。
- 只读 Server Actions：
  - getLatestResumeSummaryAction 与 getLatestDetailedSummaryAction （读最新记录并返回 JSON），位置： lib/actions/resume.actions.ts 。
- 组件内：增加 summaryJson 与 loadingPreview 状态；onSuccess 时异步拉取并设值，Skeleton 在加载时显示。预览关闭/打开均展示最新数据。
  字典与文案

- 预览分节文案： lib/i18n/zh.ts 与 lib/i18n/en.ts 的 profile.previewLabels 已包含分节键位与“Stack”。如需锚点或 Skeleton 文案（如“正在加载预览…”），可在同处补充。
- 页面向上传器传递 labels={dict.profile.previewLabels} ： app/[locale]/profile/page.tsx 。
  后续可选增强（一起实现）

- 复制按钮
  - 复制 JSON：右上角一枚按钮，复制 summaryJson 的字符串。
  - 复制 Markdown：按当前预览顺序拼接轻量 Markdown（标题为 ## ，列表项为 - ），一键复制。
- 分节计数

  - 在分节标题右侧以小号淡色展示条目数，例如 教育经历 (2) 、 工作经历 (5) ，直观传达信息密度。
    文件与改动入口

- components/app/AssetUploader.tsx ：三态整合、数据刷新、预览顺序与样式、Skeleton、复制按钮、计数。
- app/[locale]/profile/page.tsx ：标题图标与徽标、labels 传递。
- lib/actions/resume.actions.ts ：只读 Server Actions（最新 JSON）。
- lib/i18n/zh.ts / lib/i18n/en.ts ：必要时补齐文案键位。
  验证清单

- zh/en 分别上传同一 PDF：解析完成后，预览不刷新也能立即显示完整内容。
- 暗色模式：预览内容与背景层次明显；渐变线可见但不刺眼。
- 重新上传流程：清空状态 → 再次上传 → 预览仍按最新数据展示。
- 复制功能：JSON/Markdown 复制成功，粘贴格式正确。
- 锚点（若启用）：点击直达分节，移动端体验不破坏。
  风险与回滚

- 改动集中于 Profile 页与 Uploader；如出现问题，可快速回退到当前版本。
- Server Actions 均为只读查询，不涉及数据写入与 Prisma 迁移。
  如无补充意见，我将按以上方案落地并给出代码位置与截图，确保实施细节可查、可回滚。
