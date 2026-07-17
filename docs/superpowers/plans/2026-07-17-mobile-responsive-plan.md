# 移动端适配 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有 Next.js + Ant Design 前端适配 320px 至 768px 的移动端视口，覆盖共享导航、数据列表、统计、详情、导入和登录流程。

**Architecture:** 在 dashboard layout 中引入移动端导航抽屉与响应式内容容器，在根布局加载全局移动端样式；页面层只补充响应式栅格、表格横向滚动和表单/弹层宽度。保留现有 API、状态管理、路由和业务交互。

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript 5, Ant Design 5, Playwright.

---

### Task 1: 建立全局移动端样式入口

**Files:**
- Create: `apps/frontend/src/app/globals.css`
- Modify: `apps/frontend/src/app/layout.tsx`

- [x] **Step 1: Add global baseline and mobile overrides**

  为 `body`、`.dashboard-content-shell`、`.dashboard-header`、`.dashboard-content`、`.mobile-full-width` 等共享类添加基础样式，并在 `max-width: 767px` 下收紧 padding、允许工具条换行、优化表格分页和弹层宽度。

- [x] **Step 2: Load the stylesheet from the root layout**

  在 `layout.tsx` 顶部引入 `./globals.css`，保持现有 AntD registry 和 theme 不变。

- [x] **Step 3: Run TypeScript and lint checks for the touched files**

  Run: `cd apps/frontend && npx tsc --noEmit && npm run lint`
  Expected: PASS.

### Task 2: 将 dashboard shell 改为移动抽屉导航

**Files:**
- Modify: `apps/frontend/src/app/(dashboard)/layout.tsx`

- [x] **Step 1: Add viewport state and drawer state**

  使用 `window.matchMedia('(max-width: 767px)')` 管理 `isMobile`，新增 `mobileMenuOpen`；桌面保留 `collapsed`，手机默认不渲染固定 `Sider`。

- [x] **Step 2: Extract shared menu content and render mobile Drawer**

  复用现有 `items`，桌面渲染 `Sider`，手机渲染 `Drawer placement="left" width={280}` 内的品牌区和 `Menu`；路由点击后关闭抽屉。

- [x] **Step 3: Make header and content responsive**

  顶栏通过类名在手机隐藏 Breadcrumb 和用户名，菜单按钮在手机打开 Drawer、桌面切换侧栏；内容容器使用 `.dashboard-content` 与 `.dashboard-content-shell`。

- [x] **Step 4: Run the dev server and inspect the dashboard at mobile width**

  Run: `cd apps/frontend && npm run dev`
  Expected: 375px 视口只有顶栏和内容，不出现固定侧栏造成的横向挤压；菜单按钮可打开并关闭完整导航。

### Task 3: 适配首页与统计页栅格和图表

**Files:**
- Modify: `apps/frontend/src/app/(dashboard)/page.tsx`
- Modify: `apps/frontend/src/app/(dashboard)/statistics/page.tsx`

- [x] **Step 1: Replace fixed Col spans with responsive spans**

  指标卡使用 `xs={12} sm={12} md={6}`，三项概览使用 `xs={24} sm={8}`，让手机保持两列、窄屏不被压缩。

- [x] **Step 2: Make chart container width fluid**

  为趋势图包裹可收缩容器，保留 260px 左右的可读高度，并在 Card body 上使用 `min-width: 0` 避免图表撑破页面。

- [x] **Step 3: Verify with dashboard and statistics routes**

  检查 320px/375px 下卡片、标题和图表不超出内容宽度，桌面布局仍保持原有密度。

### Task 4: 适配列表、详情、导入与管理页

**Files:**
- Modify: `apps/frontend/src/app/(dashboard)/hazards/page.tsx`
- Modify: `apps/frontend/src/app/(dashboard)/tasks/page.tsx`
- Modify: `apps/frontend/src/app/(dashboard)/batches/page.tsx`
- Modify: `apps/frontend/src/app/(dashboard)/batches/history/page.tsx`
- Modify: `apps/frontend/src/app/(dashboard)/enterprises/page.tsx`
- Modify: `apps/frontend/src/app/(dashboard)/users/page.tsx`
- Modify: `apps/frontend/src/app/(dashboard)/audit-logs/page.tsx`
- Modify: `apps/frontend/src/app/(dashboard)/notifications/page.tsx`
- Modify: `apps/frontend/src/app/(dashboard)/hazards/[id]/page.tsx`
- Modify: `apps/frontend/src/app/(dashboard)/tasks/[id]/page.tsx`
- Modify: `apps/frontend/src/app/(dashboard)/batches/import/page.tsx`

- [x] **Step 1: Make list filters and actions wrap cleanly**

  给筛选 `Space` 添加共享类，移动端使用 `width: 100%` 和换行；新增/重置/全部已读等按钮保持可见且不被挤出。

- [x] **Step 2: Add explicit horizontal scroll to dense tables**

  为 hazards、tasks、batches、history、enterprises、users、notifications 和 task detail 的 `Table` 设置合理 `scroll.x`，审计日志继续保留 `1200`，并用移动端分页样式减少底部拥挤。

- [x] **Step 3: Collapse descriptions and action groups on detail pages**

  详情 `Descriptions` 使用响应式 `column={{ xs: 1, sm: 2 }}`；标题 extra 和报告下载按钮允许换行，长文本保留自然换行。

- [x] **Step 4: Make import and modal/drawer surfaces fit mobile**

  导入卡片和错误抽屉使用共享类；新增企业/用户、编辑隐患、任务复核弹窗在手机上设置 `width: calc(100vw - 32px)` 或 `width="100%"` 的内层布局。

### Task 5: 适配登录页并完成验证

**Files:**
- Modify: `apps/frontend/src/app/login/page.tsx`
- Test: `apps/frontend/e2e/login.spec.ts`

- [x] **Step 1: Make the login card and page padding fluid**

  将卡片宽度限制为 `min(420px, 100%)`，手机端减少页面 padding，保证输入框与登录按钮完整可见。

- [x] **Step 2: Run lint and production build**

  Run: `cd apps/frontend && npm run lint && npm run build`
  Expected: PASS.

- [x] **Step 3: Run mobile Playwright checks**

  Run: `cd apps/frontend && npx playwright test --project=chromium`
  Expected: existing login flow passes; additionally inspect mobile viewport manually for `/login`, `/`, `/hazards`, `/tasks` and `/statistics`.

- [x] **Step 4: Scan changed files for placeholders and unresolved overflow**

  Run: `rg -n "TODO|TBD|test\.skip|test\.only|@ts-ignore|@ts-expect-error|as any" apps/frontend/src/app`
  Expected: no new matches caused by this change; changed screens have no page-level horizontal overflow.
