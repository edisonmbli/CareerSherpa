## 目标
- 全站统一 Header（品牌 + 语言切换 + 主题切换 + 登录/用户菜单 + 金币徽章）。
- middleware：未登录访问 Workbench/Profile 时重定向至当前 locale 的 Landing。
- Sidebar/Profile 清理：移除底部语言/主题按钮，Sidebar 增加 Profile 两个深链入口；Profile 支持深链并提供返回 Workbench 导航。
- 增强：Header 显示金币余额入口、用户菜单支持头像/更名、品牌与文案 i18n 化。

## 依赖与最佳实践
- 认证：采用 Neon Auth 的 Stack Auth（@stackframe/stack）前端组件与 hooks。
  - 登录态判断：`useUser()`（Client）/`stackServerApp.getUser()`（Server）。
  - 用户菜单：`<UserButton />`（头像、更名、登出等）。
- i18n：复用现有 `switchLocalePath` 路由切换逻辑；所有文案从字典加载，避免硬编码。

## 实施方案
1. 新增 `components/app/SiteHeaderServer.tsx`（Server）与 `SiteHeaderClient.tsx`（Client）
   - Server 读取 `x-locale` 与用户/金币余额（Prisma），将数据传给 Client。
   - Client 渲染：
     - 左侧品牌：`zh: 求职加速器` / `en: CareerShaper`，点击（已登录→`/${locale}/workbench`，未登录→`/${locale}`）。
     - 右侧：
       - **I18nToggleCompact**（单按钮，切 en/zh，复用 `switchLocalePath`）。
       - **ThemeToggle**（复用现有）。
       - **Auth**：未登录显示“登录”按钮，跳转 `/handler/sign-in?redirect=<当前路径>`；已登录显示 `<UserButton />`。
       - **金币徽章**：显示 `Coins: N`，点击跳转 `/${locale}/profile?tab=billing`。
2. 根布局：在 `app/layout.tsx` 的 `{children}` 之前插入 `<SiteHeaderServer />`。
3. middleware：修改未登录的页面请求重定向从 `/handler/signin` → `/${currentLocale}`（Landing）；API 保持 401。
4. Sidebar 清理：`components/app/SidebarClient.tsx`
   - 底部移除 `I18nToggle`、`ThemeToggle`。
   - 新增两个入口：`/${locale}/profile?tab=assets` 与 `/${locale}/profile?tab=billing`。
5. Profile 页深链与返回 Workbench：`app/[locale]/profile/page.tsx`
   - 签名引入 `searchParams`，`const tab = searchParams?.tab ?? 'assets'` → `Tabs defaultValue={tab}`。
   - 顶部添加“返回工作台”按钮（或依赖 Header 品牌导航）。
6. 文案与 i18n：在字典中增加品牌与 Header 按钮文案（`zh/en`）。

## 验收与测试
- 未登录访问 Workbench/Profile 重定向 Landing；登录后正常访问。
- Header 按钮可用：语言切换、主题切换、登录/用户菜单；金币徽章展示并可跳转 Billing。
- Sidebar 与 Profile 清理到位；Profile 的深链 `?tab=billing` 生效；返回 Workbench 导航存在。

## 交付增量（增强项）
- Header 显示金币徽章并可跳 Billing。
- `<UserButton />` 菜单支持头像与更名；登录/登出连通。
- 品牌与所有按钮/提示文案 i18n 化。

## 下一步动作
- 我按照该方案落地代码并验证；如需细节微调（品牌命名、按钮样式），将基于 shadcn/ui 规范做快速迭代。