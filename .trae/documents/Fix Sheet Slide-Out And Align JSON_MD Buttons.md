## 问题诊断
- 右侧面板不滑出：自定义 `SheetContent` 与绝对定位容器改变布局，可能破坏 Radix/Sheet 的内部结构或覆盖层次，导致内容未正常渲染。
- JSON/MD 成为“副标题”：`SheetHeader` 默认是 `flex-col`，仅加 `items-center justify-between` 不足以改为同行；需明确 `flex-row` 才能让按钮与标题同一行。

## 修复策略（回到标准用法）
1) 恢复标准结构
- `SheetContent` 仅保留 `sm:max-w-2xl`，不加 `relative` 或绝对定位包裹。
- `SheetHeader` 放 `SheetTitle` 与按钮；类名改为 `flex flex-row items-center justify-between p-4 pr-12`。
- 保留 `SheetTitle`（避免可访问性警告）。
2) 按钮同行右对齐
- 将 JSON/MD 放在 `SheetHeader` 右侧容器，使用 `ghost xs` 与 `hover:bg-muted`。
3) 清理残留样式
- 移除顶部绝对定位按钮容器与任何时间轴/锚点相关代码。
4) 保持分节顺序与轻量渐变
- 个人信息 → 教育经历 → 摘要要点/摘要 → 专业特长 → 工作经历 → 项目 → 技能 → 语言 → 证书 → 奖项 → 开源 → 其它；分节下划线为 `from-blue-400 to-blue-100`。

## 验证
- 点击“预览”右侧面板正常滑出；标题左、按钮右同一行，按钮可点击且不与关闭按钮重叠。
- 控制台无 `DialogTitle` 相关警告。
- 教育经历分节存在且顺序正确；全文上下滚动展示。

## 交付
- 仅修改 `components/app/AssetUploader.tsx` 的 Sheet 布局；不改 DB/逻辑。
- 完成后提供代码引用与截图确认。