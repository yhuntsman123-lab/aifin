# UI Design Requirements (Frozen)

本文件定义 AIFinView 的固定设计要求。后续 UI 迭代必须在本规范内演进，不允许脱离风格重做。

## 1. 视觉定位

- 关键词：机构级、证据驱动、可信审计、信息高密度但可读。
- 主色：蓝/石板灰/翡翠绿；禁止紫色主导。
- 主题：默认跟随系统（浅色优先），支持黑白切换。
- 卡片：圆角 14-18px，轻阴影，层次清晰。

## 2. 首页固定结构

- 顶部导航：`首页 / 研报中心 / 数据中心 / 策略工具 / 会员中心` + 搜索框 + 主题切换。
- 第一屏左侧：生成台（股票输入、生成按钮、实时任务提示、Turnstile）。
- 第一屏右侧：
  - 研报质量中枢（质量分、证据覆盖、反幻觉、模型路由）
  - 会员权益卡（仅 `FREE / VIP / SVIP`）
- 第二屏：7-Agent 协作工作流可视化（运行中/已完成/待命状态）。
- 第三屏：质量模块四卡（证据锚点、数据血缘、反幻觉规则、宏观雷达与行业温度）。

## 3. 研报详情页固定结构

三栏布局固定：

- 左栏：报告目录 + 数据源审计卡
- 中栏：
  - 头部（标的、价格、操作按钮）
  - 10Y 深度分析面板
  - 三张表可视化
  - 七段核心结论卡
  - 七段正文
  - 证据锚点块
  - 免责声明
- 右栏：
  - 会员权益
  - 证据来源
  - 证据锚点表
  - 智能分析团队
  - 风险监控

## 4. 内容真实性约束

- 页面禁止展示明显硬编码“伪实时”数字（如固定统计、固定更新时间）作为真实数据。
- 缺失数据必须显式提示“数据缺失，禁止估算”。
- 会员等级文字只允许：`FREE / VIP / SVIP`。

## 5. 模块与代码映射

- 首页：`web/app/page.tsx`
- 研报详情页：`web/app/reports/[reportId]/page.tsx`
- 会员权益：`web/components/account/EntitlementCard.tsx`、`web/components/report/CompactEntitlementWidget.tsx`
- 深度面板：`web/components/report/FinancialDeepDivePanel.tsx`
- 三张表：`web/components/report/FinancialStatementsPanel.tsx`
- 证据锚点：`web/components/report/EvidenceAnchorsPanel.tsx`

## 6. 变更流程

- 任何页面大改，先出效果图再改代码。
- 若用户已明确“定稿”，后续只能做微调与修复，不得重做布局。
