## 目标
- 针对 detailed_resume 提供独立调试脚本，完整打印输入/输出并评估 Prompt 与 Schema 的保留率。
- 修复 Workbench 预览在 detailed_summary_json 有值时仍为空的加载问题（预览打开即拉取最新 JSON，空时用服务端值兜底）。

## 1. 新增脚本 scripts/debug-detailed-resume-summary.ts
- 功能：模拟 `/scripts/debug-resume-summary.ts`，但读取 `detailed_resumes`，用 `detailed_resume_summary` 模板与变量。
- 实现要点：
  - 读取 `DATABASE_URL`（同原脚本），导入 `prisma` 与 `getTemplate`、`getModel`。
  - `findUnique` from `prisma.detailedResume` by id（测试 id: `cmi4fd6fs00018oewskjh54lu`）。
  - 模板：`getTemplate(locale, 'detailed_resume_summary')`。
  - 变量：`{ detailed_resume_text: rec.originalText }`（确保变量命名与模板一致）。
  - 模型：`glm-4.5-flash`（轻量，匹配免费队列场景；脚本直接调用模型不经过队列，仅用于质量评估）。
  - 打印内容：
    - Prompt messages（system + schema + user）
    - 原文 `original_text` 前 1200 字与输出 JSON（剥离 fence）
    - 统计计数：summaryLen、experienceCount、projectsCount、skillsCount（union）、summary_pointsCount、specialties_pointsCount、educationCount/课程数、highlights总数等（按 V2 schema）
  - 校验：若解析失败打印清洗后文本，便于定位模型返回结构问题。

## 2. 预览空白问题修复（AssetUploader）
- 根因：解析完成后若未刷新页面，`initialSummaryJson` 为空且 `onSuccess` 的拉取未完成就打开预览，导致渲染时无数据。
- 修复方案：
  - 在 `showPreview` 变为 true 且 `summaryJson` 为空时，立即调用只读 Action：
    - resume：`getLatestResumeSummaryAction()`
    - detailed：`getLatestDetailedSummaryAction()`
  - 拉取成功后更新 `summaryJson`，展示 Skeleton 占位直到数据到位。
  - 兜底：若服务端仍返回空值，则使用 `initialSummaryJson` 进行渲染（避免完全空白）。

## 3. 验证
- 运行 `pnpm tsx scripts/debug-detailed-resume-summary.ts cmi4fd6fs00018oewskjh54lu zh`：观察输入/输出与统计计数，评估保留率。
- Web：上传详细履历，待状态为 Completed 后，直接点击“预览”：
  - 面板滑出，Skeleton 显示，随后展示最新 `detailed_summary_json`。即使未刷新页面也不为空白。
- 特殊场景：balance=0 时队列走免费，模型为 GLM-4.5-Flash（工作流端验证）；脚本层不改动队列，仅用于质量评估。

## 4. 交付
- 新增脚本文件 + AssetUploader 的预览数据加载逻辑（useEffect 监听 showPreview）
- 不改动 DB schema 与服务端写库逻辑。

## 5. 回滚
- 脚本是新增，不影响现有功能；前端若有问题，可移除 showPreview 触发的拉取逻辑，回退到仅依赖 `onSuccess` 拉取。