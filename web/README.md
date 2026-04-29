# AIFinView Web

基于 `Next.js + Supabase + Cloudflare + Stripe` 的机构级中文研报平台前端/BFF。

## 已实现能力

- 登录/注册（含基础反刷钩子：Turnstile + 风险事件）
- 会员权益（FREE / VIP / SVIP）与每日额度（1 / 10 / 20）
- Stripe 一次性付费（VIP 30天 ¥199，SVIP 365天 ¥1990）
- 邀请奖励（仅被邀请人首次付费触发，邀请人 +30天 VIP）
- Admin 用户权限维护（可手动改为 VIP/SVIP，实时生效）
- Admin Prompt 配置（7 Agent + 主编）
- 7-Agent 辩论工作流 + DeepSeek 主编统一汇总（固定七段结构 + 免责声明）
- 报告异步任务（Cloudflare Queue 优先，未配置时本地同步降级）
- Cloudflare Queue 消费模板（见 [workers/cloudflare-queue-consumer.js](/E:/AIFinView/workers/cloudflare-queue-consumer.js)）
- 多源数据聚合（Yahoo/Finnhub/SEC/东财公告/FRED）+ 来源追踪 + 缺失即禁估算
- 报告详情页主题切换（默认跟随系统）+ 动态分析面板说明 + 三张表可视化 + 证据锚点跳转

## 本地启动

```bash
cd web
npm install
cp .env.example .env.local
npm run dev
```

## 必要环境变量

见 [`.env.example`](/E:/AIFinView/web/.env.example)。

重点：

- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_VIP_30D`, `STRIPE_PRICE_ID_SVIP_365D`
- Turnstile: `CLOUDFLARE_TURNSTILE_SECRET_KEY`
- Turnstile 前端：`NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- 队列：`CLOUDFLARE_QUEUE_ENQUEUE_URL`, `CLOUDFLARE_QUEUE_TOKEN`, `INTERNAL_QUEUE_SECRET`
- 队列消费 Worker：`APP_INTERNAL_BASE_URL`, `INTERNAL_QUEUE_SECRET`（可选 `DOUYIN_RENDER_WEBHOOK_URL`）
- 模型路由：Cloudflare/Gemini/DeepSeek 对应 Key
- 主编汇总：`DEEPSEEK_*` 必填；如需降级可设 `ALLOW_EDITOR_FALLBACK=true`

## 数据库迁移

先执行：

- [202604280001_reports_tasks.sql](/E:/AIFinView/supabase/migrations/202604280001_reports_tasks.sql)
- [202604280002_membership_agentic_workflow.sql](/E:/AIFinView/supabase/migrations/202604280002_membership_agentic_workflow.sql)

## Stripe 支付方式说明

本项目为一次性付费（非订阅），通过 `Checkout(mode=payment)` 拉起支付。  
支付方式受 Stripe 账号地区、币种、开通状态影响，如需严格控制可用方式，请配置：

`STRIPE_PAYMENT_METHOD_TYPES=card,alipay,wechat_pay`
