## 目标
- 按你列出的 9 点逐项优化：标题图标与语义、上传器空白/完成态样式与文案、国际化一致性、预览按钮与分节渐变线、锚点导航。

## 拟改动
### 上传与标题
- app/[locale]/profile/page.tsx
  - 将“必选/推荐”徽标改为紧贴标题右侧的小型彩色图标（无背景），去掉远离标题的红底/灰底。
  - 删除副标题中的长度建议文案（保留在上传器空白态信息块）。
  - zh/en 标题文案不再包含“（必选）/（推荐）”，直接使用纯标题。
- lib/i18n/zh.ts、lib/i18n/en.ts
  - 移除 `profile.resume.title` 和 `profile.detailed.title` 的括号提示；若需保留含义，用副标题强化但不加括号。

### 上传器（components/app/AssetUploader.tsx）
- 空白态文案字号改为 `text-xs`，弱化为辅助提示；保持 Info 图标与两行合并。
- 完成态样式重组为“单条目风格”：
  - 外层 `rounded-md border bg-card px-3 py-2`，左侧文件名（绿色状态），右侧并排“预览 / 重新上传”。
- 国际化
  - 新增 `labels.preview` 与 `labels.reupload`，分别用于按钮文案；页面传入对应字典（zh/en）。

### 预览（Sheet）
- JSON/MD 按钮调整为更小尺寸 `size="xs"`、`variant="ghost"`，与标题右侧水平对齐（在 SheetHeader 右上角）。
- 为所有分节标题补齐渐变线（包括 Languages/Certifications/Awards/OpenSource/Extras）。
- 增加锚点导航：
  - 在 SheetHeader 下方渲染一行 Chip（仅展示存在的分节），点击平滑滚动到对应分节。
  - 每个分节容器赋予 `id`，导航按钮 `onClick` 执行 `document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })`。

## 变更文件与位置
- app/[locale]/profile/page.tsx：标题行结构与图标样式、去除副标题长度文案、传递 `labels={{ preview: ..., reupload: ... }}`。
- lib/i18n/zh.ts / lib/i18n/en.ts：去除标题括号内容；新增/补充上传器按钮文案（preview/reupload）。
- components/app/AssetUploader.tsx：
  - 空白态字号与信息块样式；完成态条目式布局；按钮使用 `labels.preview/labels.reupload`。
  - SheetHeader 的 JSON/MD 按钮右上对齐、size 调整；预览分节全部加渐变线；添加锚点导航组件与滚动逻辑。

## 验证
- zh/en：上传→解析→预览，不刷新即可显示；空白态文案更轻；完成态是一个整体条目；按钮中英文正确；标题无括号。
- 预览：顶部锚点可点击直达分节；所有分节标题下均有渐变线；JSON/MD 按钮不占空间。

## 回滚
- 所有改动限于页面与组件，无 DB 变更；若样式不满意，分别恢复组件局部样式与字典文案即可。

确认后我将立即执行，并提供代码引用与截图。