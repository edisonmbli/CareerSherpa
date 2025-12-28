## 目标
- 在不影响既有功能的前提下，提升 Workbench 的输入体验与信息密度，统一“粘贴文本/上传文件”为一个可切换控件，并适度引入图标与色彩强化信息层级。
- 为 Sidebar 增加可收起的简化条（含折叠开关与创建服务 icon），在桌面端与移动端保持统一的行为与视觉。
- 将 Account 页四个高频场景入口做规范化的视觉升级：加入 lucide-react 图标、右对齐的 icon-only 跳转按钮，节省空间且更直观。
- 补齐 i18n 文案键，确保新增元素完全可国际化。

## Workbench 主工作区精简
1. 新建组件 `components/workbench/JDInput.tsx`（Client）
   - 组成：
     - Segmented control（两段）切换模式：Paste | Upload
     - Paste 模式：`Textarea` + `Clipboard` 图标；占位文本来自字典（`workbench.new.placeholderText`）
     - Upload 模式：Dropzone（轻量）或按钮触发隐藏 input；显示文件名与大小；使用 `FileUp` 图标
   - 视觉与间距：
     - 卡片内 `p-6`，元素间 `gap-4`；Upload 模式增加浅色背景（`bg-muted`）以区分
     - 图标与标题使用 `text-muted-foreground`；主操作按钮（Start Analysis）保持 primary
   - 交互：
     - 模式切换保留文本或文件状态（避免误操作丢失）
     - 键盘支持：`Ctrl+Enter` 提交；聚焦时提示
   - 对接：向现有 `NewServiceForm` 传回 `jobText | jobImage`，替换原有两段输入区

2. 新建空状态提示 `components/workbench/EmptyState.tsx`
   - Icon（`Sparkles`）+ 标题 + 简短描述（来自字典 `workbench.new.emptyTitle/emptyDesc`）
   - 在没有输入或清空时展示，指导用户从粘贴或上传开始

3. Streaming/SSE 输出区域微调（如后续需要）
   - 限高与滚动（保持 `max-h-[60vh]`），增加 `ScrollArea` 样式，逐步淡入

## Sidebar 可收起简化条
1. 新增 `components/workbench/SidebarToggle.tsx`（Client）
   - `ChevronLeft`/`ChevronRight` icon，点击切换 `collapsed` 状态；状态存储在 `localStorage`
   - 提供“创建服务”icon（`PlusCircle`）快速回到新建表单
2. 修改 `SidebarClient.tsx`
   - Desktop：
     - 展开态：当前布局不变
     - 收起态：仅显示图标列（创建服务/历史服务入口）+ 下方 My CV 与 Coins；Hover 提示（`Tooltip`）
   - Mobile：仍使用 Drawer（`Sheet`），与桌面收起态视觉一致

## Account 快捷入口视觉升级
1. 在 `AccountSettingsClient` 四个卡片加入 lucide-react 图标：
   - User name：`User`
   - Upload avatar：`Image`
   - Set email：`Mail`
   - Update password：`Lock`
2. 将“Open/前往”按钮改为右侧 icon-only（`ArrowUpRight` 或 `ExternalLink`），与文案右对齐、垂直居中
3. 卡片布局：
   - 标题（`AppCardTitle`）+ 图标 + 说明（`AppCardDescription`）+ 右侧 icon 按钮
   - 卡片内部 `p-6`，元素 `gap-4`，用分组对齐避免空白块

## i18n 文案补充
- `workbench.new`：
  - `segmentedPaste`（“粘贴文本”/“Paste text”）
  - `segmentedUpload`（“上传截图”/“Upload screenshot”）
  - `emptyTitle`、`emptyDesc`
- `account.shortcuts`：
  - `iconOpenLabel`（`zh: 前往`/`en: Open` 用于 aria/tooltip）

## 技术实现清单
- Add：`components/workbench/JDInput.tsx`、`components/workbench/EmptyState.tsx`、`components/workbench/SidebarToggle.tsx`
- Update：
  - `components/app/NewServiceForm.tsx` 替换输入区域为 `JDInput`
  - `components/app/SidebarClient.tsx` 支持 `collapsed` 模式与切换
  - `components/app/AccountSettingsClient.tsx`：加图标、右侧 icon-only 跳转按钮
  - `lib/i18n/zh.ts`、`lib/i18n/en.ts`：新增键

## 验收与视觉规范
- 对齐规范：
  - 卡片内 `p-6`、元素间 `gap-4`；页面主体保持 `container` 宽度与一致的边距
  - 使用 `text-muted-foreground`、`primary` 限量色彩，图标尺寸统一 `h-5 w-5`
- 行为：
  - Sidebar 收起/展开流畅、状态记忆
  - JDInput 两模式切换不丢失数据；`Ctrl+Enter` 提交
  - Account 卡片点击均跳到指定内置 Tab

## 风险与回退
- 若 segmented control 引入依赖不稳定，回退为两个 `Tabs` 切换
- 若 Sidebar 收起影响可访问性，保留 Tooltip 与键盘导航

## 交付计划
- 实施顺序：JDInput → SidebarToggle → Account卡片升级 → 文案与字典 → 验收与细调
- 输出：变更文件列表 + 本地验证清单（桌面/移动）
