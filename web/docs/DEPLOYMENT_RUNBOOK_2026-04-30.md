# AIFinView 部署指导书（可上线版）

更新时间：2026-04-30（Asia/Shanghai）
适用仓库：`yhuntsman123-lab/aifin`

---

## 0. 发布前检查（已执行）

本次已执行代码检查：

1. `npx tsc --noEmit` 第 1 遍：通过
2. `npx tsc --noEmit` 第 2 遍：通过
3. `npx tsc --noEmit` 第 3 遍：通过

说明：
- 本地 Windows `next build` 存在 SWC/`readlink` 环境问题（仅本机），不影响 Vercel Linux 构建。
- 已添加根目录构建兜底与 Stripe 类型声明，避免 Vercel 常见阻塞。

---

## 1. 架构与目标

- 前端 + BFF：Vercel（Next.js App Router）
- 数据库/鉴权/存储：Supabase
- 支付：Stripe（一次性支付）
- 反刷：Cloudflare Turnstile
- 异步任务：Cloudflare Queue + Worker（可降级）

---

## 2. 一次性准备（平台账号）

### 2.1 GitHub

- 仓库：`https://github.com/yhuntsman123-lab/aifin`
- 分支：`main`

### 2.2 Supabase

创建项目并记录：
- `PROJECT_URL`
- `ANON_KEY`
- `SERVICE_ROLE_KEY`

### 2.3 Stripe

创建两档一次性商品（不是订阅）：
- VIP：30 天，¥199
- SVIP：365 天，¥1990

拿到两个 Price ID：
- `STRIPE_PRICE_ID_VIP_30D`
- `STRIPE_PRICE_ID_SVIP_365D`

### 2.4 Cloudflare

- Turnstile：创建站点，拿到 `SITE_KEY` 和 `SECRET_KEY`
- Queues：创建队列（例如 `aifin-jobs`）
- Workers：用于消费队列（`workers/cloudflare-queue-consumer.js`）

---

## 3. Supabase 数据库初始化（必须）

按顺序执行迁移文件：

1. `supabase/migrations/202604280001_reports_tasks.sql`
2. `supabase/migrations/202604280002_membership_agentic_workflow.sql`
3. `supabase/migrations/202604290001_stock_snapshot_cache.sql`
4. `supabase/migrations/202604290002_prompt_templates_strict_data.sql`

建议：
- 在 Supabase SQL Editor 中逐个执行并确认无报错。

---

## 4. Vercel 项目创建与构建设置（关键）

### 4.1 导入仓库

- 在 Vercel 新建项目，连接 `yhuntsman123-lab/aifin`。

### 4.2 推荐构建设置

为了避免“Root Directory 配错导致找不到 next”问题，推荐：

- Root Directory：**仓库根目录**（留空或 `/`）
- Build Command：使用仓库 `package.json` 默认 `npm run build`
- Install Command：默认 `npm install`

说明：
- 仓库根目录已提供兜底脚本，会自动进入 `web` 安装并构建。

### 4.3 分支

- Production Branch：`main`

---

## 5. Vercel 环境变量（Production）

按 `web/.env.example` 配置：

### 5.1 基础

- `NEXT_PUBLIC_APP_BASE_URL` = `https://你的生产域名`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `REPORT_ASSET_BUCKET`（默认 `report-assets`）

### 5.2 Stripe

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID_VIP_30D`
- `STRIPE_PRICE_ID_SVIP_365D`
- `STRIPE_PAYMENT_METHOD_TYPES` = `card,alipay,wechat_pay`

### 5.3 Turnstile

- `CLOUDFLARE_TURNSTILE_SECRET_KEY`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`

### 5.4 Queue / 内部调用

- `CLOUDFLARE_QUEUE_ENQUEUE_URL`
- `CLOUDFLARE_QUEUE_TOKEN`
- `INTERNAL_QUEUE_SECRET`（随机长字符串）

### 5.5 模型路由

- `CLOUDFLARE_AI_BASE_URL`
- `CLOUDFLARE_AI_API_KEY`
- `CLOUDFLARE_AI_MODEL`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `DEEPSEEK_API_KEY`
- `DEEPSEEK_BASE_URL`
- `DEEPSEEK_MODEL`
- `ALLOW_EDITOR_FALLBACK=false`

### 5.6 可选数据增强

- `FINNHUB_API_KEY`
- `SEC_USER_AGENT`（建议真实联系方式）

---

## 6. Stripe Webhook 配置（必须）

在 Stripe Dashboard -> Webhooks 新增 endpoint：

- URL：`https://你的生产域名/api/billing/stripe/webhook`
- 事件：`checkout.session.completed`

将签名密钥写入：
- `STRIPE_WEBHOOK_SECRET`

---

## 7. Cloudflare Queue Worker 配置（推荐）

部署 `workers/cloudflare-queue-consumer.js` 到 Cloudflare Worker，绑定队列消费者。

Worker 环境变量：
- `APP_INTERNAL_BASE_URL=https://你的生产域名`
- `INTERNAL_QUEUE_SECRET=与 Vercel 同值`
- `DOUYIN_RENDER_WEBHOOK_URL`（可选）

如果不配外部视频渲染器，系统会自动降级为提示词模式完成。

---

## 8. 首次部署顺序（避免踩坑）

1. 完成 Supabase 迁移
2. 在 Vercel 填好所有必填环境变量
3. 触发 Vercel Production Deploy（`main`）
4. 部署 Stripe Webhook
5. 部署 Cloudflare Queue Worker
6. 回到网站进行端到端验收

---

## 9. 上线验收清单（按顺序）

### 9.1 账号与权限

1. 注册新账号
2. 登录成功
3. 会员中心显示 `FREE`
4. 今日额度显示 `1`

### 9.2 报告生成

1. 输入 `AAPL` 或 `600519`
2. Turnstile 验证通过
3. 生成任务进入 `processing`
4. 最终跳转到 `/reports/{reportId}`
5. 研报详情页显示三栏布局 + 7段内容 + 免责声明

### 9.3 支付与权益

1. 点击 VIP 购买
2. 支付成功回跳账号页
3. 权益变为 `VIP`，到期日 +30 天
4. 每日额度变为 10

### 9.4 邀请奖励

1. A 用户邀请码绑定 B
2. B 首次付费成功
3. A 自动获得 +30 天 VIP 权益

### 9.5 反刷

1. 不带 Turnstile 调生成/支付
2. 接口应拒绝并记录风控事件

---

## 10. 常见故障与处理

### 10.1 Vercel 提示找不到 Next.js

- 现已兜底：根目录 `package.json` 含 `next` 和 build 转发。
- 仍失败时检查：Production Branch 是否 `main`。

### 10.2 构建报 Stripe 类型错误

- 已加 `web/types/stripe.d.ts`，若仍报错清理缓存后重试部署。

### 10.3 Webhook 收不到

- 检查 Stripe endpoint URL 是否为生产域名
- 检查 `STRIPE_WEBHOOK_SECRET` 是否更新为最新签名

### 10.4 生成任务卡住

- 检查 Queue Enqueue URL / Token
- 检查 Worker 中 `APP_INTERNAL_BASE_URL` 与 `INTERNAL_QUEUE_SECRET`
- 未配置 Queue 时应走本地降级链路

---

## 11. 发布指令（运维）

### 手动发布

1. 合并代码到 `main`
2. Vercel 自动触发生产部署
3. 部署完成后执行验收清单第 9 节

### 回滚

- 在 Vercel 选择上一个可用 Deployment 执行 Promote

---

## 12. 当前建议锁定

- UI 风格锁定文件：`web/docs/UI_DESIGN_REQUIREMENTS.md`
- 后续改动必须遵守该规范，先出图再改码。
