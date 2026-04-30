# UI & 响应式硬约束（2026-04 定稿）

## 1. 全站统一壳层
- 所有新页面必须使用 `components/layout/AppShell.tsx`。
- 桌面宽屏优先，断点必须兼容：`sm`(>=640)、`md`(>=768)、`lg`(>=1024)、`xl`(>=1280)。
- 禁止依赖浏览器缩放（如 50%）来“看起来正常”。

## 2. Design Tokens（不可绕过）
- 颜色、边框、阴影必须使用 `app/globals.css` 中 token：
  - `--bg-app --bg-card --bg-subtle`
  - `--text-primary --text-secondary --text-muted`
  - `--line-default --line-strong`
  - `--brand-primary --brand-primary-soft --success --warning --danger`
  - `--shadow-soft`
- 禁止在页面内新增大面积硬编码十六进制颜色。

## 3. 主题模式
- 支持：`跟随系统 / 浅色 / 深色`。
- 主题切换组件统一使用 `components/theme/ThemeToggle.tsx`。
- 任何新页面不得单独实现另一套主题状态。

## 4. 移动端可用性
- 手机端（宽度 < 640）必须单栏可读、按钮可点击、表格可横向滚动。
- 输入框不得使用固定宽导致溢出（优先 `w-full min-w-0`）。

## 5. 业务页必须包含的状态
- 登录注册：提交中、失败提示、成功提示。
- 支付页：支付发起中、支付结果提示。
- 权限页：未登录重定向到 `/login?next=...`。
