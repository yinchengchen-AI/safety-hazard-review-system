# 移动端适配加强 — 设计文档

日期：2026-07-27
状态：已确认（auto 模式，由助手依据代码勘察结论决策）

## 背景

项目前端（Next.js 14 + AntD 5）已做过一轮移动端适配：`apps/frontend/src/app/(dashboard)/layout.tsx` 有 matchMedia 断点 + Drawer 移动导航，`src/app/globals.css` 有 767px / 374px 两组 media query，所有表格通过 `.dashboard-table-wrap` 横向滚动，Modal/Drawer 宽度用 `min(Npx, 100vw-32px)` 处理，登录页移动端友好。

本次目标：**在既有骨架上打磨残余的移动端问题**，不重写布局。

## 方案选型

- **方案 A（采纳）**：增量组件级响应式 —— 以 CSS media query 为主，仅在需要 JS 决策处（图表配置）使用 AntD 内置 `Grid.useBreakpoint()`。延续项目既有模式，无新依赖，风险低。
- 方案 B（否决）：移动端表格全面卡片化 —— 9 个表格重写，改动面大，YAGNI。
- 方案 C（否决）：统一自研断点 hook 重构 layout —— 既有 matchMedia 已可用，重构收益低。

## 改动清单（按优先级）

### P0 — 功能受阻

1. **统计页趋势图**（`src/app/(dashboard)/statistics/page.tsx`）
   - 用 `Grid.useBreakpoint()` 取得 `screens.xs`。
   - 图表高度：移动端 220，桌面 280。
   - x 轴标签开启 `autoHide` + `autoRotate`，避免 375px 下日期标签重叠。
   - 图例位置移动端置 `top`，桌面保持原样。

2. **复核 Modal 内图片上传**（`src/app/(dashboard)/tasks/[id]/page.tsx`）
   - 纯 CSS：767px 以下缩小 `.ant-upload-select-picture-card` 及已上传项尺寸（如 72×72），让每行容纳更多、点击目标仍 ≥44px。

### P1 — 体验明显受损

3. **DatePicker 弹层防溢出**（全局 CSS）
   - `@media (max-width: 767px)` 下为 `.ant-picker-dropdown` 范围面板加 `max-width: 100vw` 约束并允许面板纵向堆叠（`flex-direction: column` 于 `.ant-picker-panels`），避免 375px 屏上超出视口右缘。
   - 重点受益页面：`audit-logs/page.tsx`（工具栏含 2 个日期控件）。

4. **Drawer 内嵌表格横向滚动**（`src/app/(dashboard)/batches/history/page.tsx`）
   - 内嵌 Table 补 `scroll={{ x: 560 }}`，防止在 `100vw-24px` 的 Drawer 内溢出。

5. **任务详情顶部操作区**（`src/app/(dashboard)/tasks/[id]/page.tsx`）
   - CSS：移动端操作按钮块级全宽堆叠（作用于该 Card 的 extra 区 class），避免长文案按钮折行挤压标题。

6. **导入结果容器**（`src/app/(dashboard)/batches/import/page.tsx`）
   - 导入结果区加 `overflow-wrap: anywhere` + `max-height` + 纵向滚动，长失败明细不撑破布局。

### P2 — 细节打磨

7. **显式 viewport**（`src/app/layout.tsx`）
   - `export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' }`。
   - `globals.css` 为 dashboard 内容区底部加 `padding-bottom: env(safe-area-inset-bottom)`，适配 iPhone Home 指示条。

8. **分页器移动端精简**（全局 CSS）
   - 767px 以下隐藏 `.ant-pagination-options`（条/页选择 + 跳页输入），保留翻页核心功能。

9. **死代码清理**（`globals.css`）
   - 删除无人引用的 `.mobile-full-width`。

## 明确不做

- 表格卡片化重构（保留横向滚动方案）。
- `fixed: 'right'` 操作列移除（sticky 在窄屏仍可用，属于既有行为）。
- 通知 Dropdown 移动端 placement 调整（既有有意行为）。
- 不引入新依赖、不改后端、不动 layout 的 Drawer 导航方案。

## 测试

- `cd apps/frontend && npm run lint && npm run build` 通过。
- Playwright 以 375×812 视口对关键页面（statistics、tasks 详情、audit-logs、batches/history、batches/import）截图人工核验（若本地服务可起）。
